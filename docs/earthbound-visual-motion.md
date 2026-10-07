# Address-generated EarthBound visual vocabulary

Source: https://github.com/gjtorikian/Earthbound-Battle-Backgrounds-JS
Reference revision: 572caf31f996e3055251368011a5d073b5a59003

The renderer now uses the complete canonical chain + contract address to
produce two independent layers. Numeric seeds remain available in the labs.
Every parameter uses a separately labeled hash of the full identity; coins
are no longer reduced to an index in the Suggested Layers list.

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

The address fixes the visual structure. Market/audio controls the shared clock,
mark size, spacing, directional notation and persistence. No active frame skip
is introduced. WebGL and the software fallback share the parameter profile and
matching field equations. Color remains black and white.

Artwork formation is now tied to cap: no forced periodic image reveal. Between
$10M and $1B, a smooth logarithmic curve gradually resolves the same marks into
the token's dithered image. At $100M the mask influence is 50%; at $1B it is 100%.
Existing saturation generations shrink away during formation. Missing artwork
keeps the abstract composition. Quiet marks remain faintly visible.

These are deterministic generative identities, not a proof that every possible
address must be perceptually unique. No browser visual/audio audition accompanied
this source change.
