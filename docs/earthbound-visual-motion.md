# EarthBound motion reference

Source: https://github.com/gjtorikian/Earthbound-Battle-Backgrounds-JS
Reference revision: 572caf31f996e3055251368011a5d073b5a59003

All 222 Suggested Layers entries are retained in earthbound-motion-presets.js,
including their 252 distinct nonblank layer IDs and distortion sequences.
The coin seed selects one entry deterministically. Its paired distortion
profiles move the existing UPIC field; this is an adaptation of motion settings,
not a reproduction of the game's tiled artwork or colour palettes.

Horizontal displacement, interlaced counterflow and vertical displacement use
continuous phase. UPIC bounds amplitude/frequency and replaces alternating
scanline jumps with smooth counterflow to preserve the square lattice.
Market cap controls deformation depth, the existing eight structures, and
white coverage. Audio/market activity controls the shared animation clock.
No deliberate active frame skipping. Render fills the visual container.
Audio silence continues to clear the field.

Original preset preview links use frameskip=1 and aspectRatio=0 (Full):
https://gjtorikian.online/Earthbound-Battle-Backgrounds-JS/?layer1=7&layer2=275&frameskip=1&aspectRatio=0

No game ROM or artwork is loaded at runtime. Attribution is retained in
public/licenses/earthbound-backgrounds.txt.
