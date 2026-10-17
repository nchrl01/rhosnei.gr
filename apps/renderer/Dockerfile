FROM mcr.microsoft.com/playwright:v1.56.1-noble
RUN apt-get update && apt-get install -y --no-install-recommends ffmpeg && rm -rf /var/lib/apt/lists/*
WORKDIR /repo
COPY package*.json ./
COPY apps ./apps
COPY packages ./packages
COPY tsconfig.base.json ./
RUN npm ci --ignore-scripts
RUN node_modules/.bin/esbuild apps/renderer/src/browser.ts --bundle --platform=browser --outfile=apps/renderer/dist/renderer.js
ENV REPO_ROOT=/repo ARTIFACTS_DIR=/artifacts
WORKDIR /repo/apps/renderer
CMD ["node","--experimental-strip-types","src/main.ts"]
