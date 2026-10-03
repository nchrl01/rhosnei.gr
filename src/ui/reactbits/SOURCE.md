React Bits components from https://reactbits.dev/r/ downloaded 2026-10-03.

- CometDial-JS-CSS.json
- LatticeLoader-JS-CSS.json
- Counter-JS-CSS.json

Copyright (c) 2026 David Haz. Full upstream license in LICENSE.md.
Used as part of the $UPIC application. Counter adds radix/wheel targets and
reduced motion for accurate clock rollover and replay seeking. LatticeLoader
announcements also react to changes in its label. Other integration is in
../interface.jsx and ../MarketClock.jsx.

CometDial scales its drag threshold for the compact header size (4px minimum).

PixelBlast-JS-CSS.json supplies the shader in public/pixel-blast-field.js.
Adapted for direct WebGL2, deterministic seed, shared frame scheduling, market
event timestamps/strengths, audio density, bounded resolution and fallback.
