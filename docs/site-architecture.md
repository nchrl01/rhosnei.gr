# Site architecture

## Shared page shell

The public website is a static application. Every page receives its header from
`src/site/` through `scripts/build-site-shell.mjs`. Public pages also receive the
same footer. Labs retain their own working toolbars and listening controls.

Run `npm run build:site` after editing a shell template. `npm start` and the
GitHub Pages workflow also generate the shell. Generated regions in public HTML
are marked; edit the template instead of the copied region. The generated HTML
contains controls before page modules execute, and renders without a client-side
shell request.

## Style ownership

Stylesheets load in this order:

1. `foundation.css`: fonts, design tokens, base elements and native range controls.
2. Page styles: instrument, marketplace, About, or lab layout and components.
3. `typography.css`: the common regular-weight 12 / 16 / 24px type scale.
4. `shared-navigation.css`: common header, footer and interaction states.

Shared header inset is 8px on both desktop and mobile. The navigation row is
44px; trending is a separate row. Page content uses the shared content gutter.
The footer remains in page flow and scrolls horizontally when its contents need
more room. Lab toolbar rules target `.lab-toolbar-header`; they do not target
all `header` elements.

`ui-controls.css` owns the volume slider popup and player controls.
`range-controls.css` owns white native sliders. `wallet-theme.css` supplies the
wallet SDK's scoped theme tokens; provider UI stays inside the SDK.

## Behavior ownership

- `shared-header.js`: common UI entry, current navigation state, range fills,
  viewing-only artwork drag policy and retired local sample migration. It independently loads
  footer prices and wallet UI once on pages with a footer. A failed optional module
  cannot prevent navigation or volume from starting.
- `listening-volume.js`: idempotent native volume binding and persistent listening
  preference. Both the player UI and common entry use the same binding. Audio
  engines receive the native `input` event; visual intensity remains independent
  of listening volume.
- `ui-controls.js`: optional React clock and loaders for the main player. The
  presentation bundle does not block market or audio initialization.
- `wallet-connect.js`: lazy configuration and wallet SDK loading after a click.
  `src/wallet/connect.js` owns SDK setup and account updates.
- `footer-prices.js`: cached spot quotes, with polling suspended in hidden tabs.

Page modules own their market requests, playback and lab state. They do not
replace or rebuild the shared header after startup. Audio and visual engines keep
their existing data mappings; shell changes do not alter those mappings.

## Publishing

GitHub Pages builds the shared static shell and publishes `public/`. Wallet SDK
assets are compiled separately with `node scripts/build-wallet.mjs` when its
source changes. Font, image, audio and vendor licensing remains with the assets.
No API credentials belong in the public build.
