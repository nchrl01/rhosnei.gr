// A rest keeps the channel DAC connected. Turning a DAC off changes the
// analogue DC offset and adds an avoidable pop at every scored note ending.
// Pulse/noise silence is volume zero with envelope increase/pace zero, then a
// trigger to load that volume; wave silence uses its digital output-level mute.
// See https://gbdev.io/pandocs/Audio_details.html#avoiding-audio-pops
export function silenceGameBoyChannel(apu, channel) {
 if (channel === 2) { apu.write(0xff1c, 0); return; }
 if (channel !== 0 && channel !== 1 && channel !== 3) return;
 if (channel === 0) apu.write(0xff10, 0);
 const envelope = channel === 0 ? 0xff12 : channel === 1 ? 0xff17 : 0xff21;
 apu.write(envelope, 0x08);
 // Length is disabled for this silent state. The next attack programs the
 // full period/length again, so no write-only frequency bits need to be read.
 apu.write(envelope + 2, 0x80);
}
