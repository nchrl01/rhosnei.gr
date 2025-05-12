const AWS = require('aws-sdk');
const path = require('path');
const fs = require('fs').promises;
const os = require('os');

// Configure AWS
AWS.config.update({
  accessKeyId: process.env.AWS_ACCESS_KEY_ID,
  secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  region: process.env.AWS_REGION
});

const s3 = new AWS.S3();
const TEMP_DIR = path.join(os.tmpdir(), 'upload-chunks');

// Ensure temp directory exists
async function ensureTempDir() {
  try {
    await fs.access(TEMP_DIR);
  } catch {
    await fs.mkdir(TEMP_DIR, { recursive: true });
  }
}

// Handle chunk upload
async function handleChunkUpload(req, res) {
  try {
    const { chunkIndex, totalChunks, fileName } = req.body;
    const chunk = req.files.file;
    const chunkPath = path.join(TEMP_DIR, `${fileName}.part${chunkIndex}`);

    // Save chunk to temp directory
    await fs.writeFile(chunkPath, chunk.data);

    // If this is the last chunk, combine all chunks and upload to S3
    if (parseInt(chunkIndex) === parseInt(totalChunks) - 1) {
      const filePath = path.join(TEMP_DIR, fileName);
      const writeStream = fs.createWriteStream(filePath);

      // Combine all chunks
      for (let i = 0; i < totalChunks; i++) {
        const chunkPath = path.join(TEMP_DIR, `${fileName}.part${i}`);
        const chunkData = await fs.readFile(chunkPath);
        writeStream.write(chunkData);
        await fs.unlink(chunkPath); // Delete chunk after combining
      }

      writeStream.end();

      // Upload to S3
      const fileData = await fs.readFile(filePath);
      const s3Params = {
        Bucket: process.env.AWS_S3_BUCKET,
        Key: `uploads/${Date.now()}-${fileName}`,
        Body: fileData,
        ContentType: chunk.mimetype
      };

      const uploadResult = await s3.upload(s3Params).promise();
      await fs.unlink(filePath); // Delete combined file

      res.json({
        success: true,
        url: uploadResult.Location
      });
    } else {
      res.json({ success: true });
    }
  } catch (error) {
    console.error('Error handling chunk upload:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to process upload'
    });
  }
}

// Clean up temp directory periodically
async function cleanupTempDir() {
  try {
    const files = await fs.readdir(TEMP_DIR);
    const now = Date.now();
    
    for (const file of files) {
      const filePath = path.join(TEMP_DIR, file);
      const stats = await fs.stat(filePath);
      
      // Delete files older than 1 hour
      if (now - stats.mtime.getTime() > 3600000) {
        await fs.unlink(filePath);
      }
    }
  } catch (error) {
    console.error('Error cleaning up temp directory:', error);
  }
}

// Run cleanup every hour
setInterval(cleanupTempDir, 3600000);

module.exports = {
  handleChunkUpload,
  ensureTempDir
}; 