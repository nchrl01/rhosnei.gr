# Address-generated EarthBound visual vocabulary

Source: https://github.com/gjtorikian/Earthbound-Battle-Backgrounds-JS
Reference revision: 572caf31f996e3055251368011a5d073b5a59003

The player hashes the canonical chain + contract address into a stable seed
for two independent layers. Numeric seeds remain available in the labs.
Every parameter uses a separately labeled draw from that seed; coins are no
longer reduced to an index in the Suggested Layers list.

## Characteristics carried into UPIC

- Numeric metadata for all 327 background records (326 nonblank choices).
- Independent source-layer selections, arrangements and distortion sequences.
- Horizontal displacement, alternating-band displacement, vertical compression.
- Effect duration, signed 16-bit amplitude/frequency/compression acceleration.
- Palette cycling and reflected cycling translated to monochrome occupancy.
- Tile repetition, mirrored arrangements, orientation, aspect and phase.
- Two-layer mixing; additional procedural interference and maximum blending.

The upstream graphics use actual game tile/palette data. UPIC instead generates
12 procedural tile families and bounded continuous luminance cycling, before
its existing dither/mark renderer. It does not reproduce the game artwork.
Scrolling is an original UPIC extension; the reference declares movement fields
but marks their implementation TODO. No game texture/ROM is loaded at runtime.
Numeric metadata can be rebuilt with scripts/build-earthbound-visual-metadata.py.
Original attribution remains in public/licenses/earthbound-backgrounds.txt.

The production path is the Canvas renderer in `upic-oct07-renderer.js` and
`oct07-live/pixel-blast-canvas.js`. The shared clock retains its 24-second
cycle. Active market input increases motion; a quiet market keeps the existing
slow drift. The mark population remains the observed holder count, capped at
10,000; historical candles use the existing reconstructed population. Liquidity
continues to determine mark size, independently of sound.

`earthbound-presentation.js` makes the two layers easier to distinguish:

- Stronger procedural contrast and broad counter-moving bands.
- Reduced random selection noise, so the pattern determines which existing
  lattice positions are selected.
- Artwork blend follows the player's supplied cap-identity progression from
  30% to 68%, leaving a procedural share at the highest cap. Missing artwork
  keeps the abstract composition. No periodic image reveal is introduced.
- Accepted score attacks, sustains and echoes briefly increase field emphasis;
  they do not add holders, resize marks, or reset the motion clock.

The added warping uses integer harmonics of the shared loop phase. With fixed
market and sound inputs, both the field and complete rendered pixels repeat
after 24 seconds. Changing observations and performed notes remain independent
inputs. Reduced motion disables added warping and sound-driven motion.

The 480,000-pixel render budget and holder cap remain in place. Source sampling
uses a 14-pixel field grid and two noise octaves in production, replacing five
octaves so the stronger band treatment does not add a second raster pass.

These are deterministic generative identities, not a proof that every possible
address must be perceptually unique. No browser visual/audio audition accompanied
this source change. Offline regressions cover periodic field/pixel output,
bounded sound emphasis, fixed holder count and unchanged liquidity sizing.
