# Shared NFT engine

The browser NFT player and headless renderer import the same versioned engine.
The `legacy/` directory retains the prototype's procedural composition and
Earthbound-inspired mathematical pattern functions, with its module imports
adapted for bundling. These functions do not fetch market data.

Licences and source notices for the original audio samples, pattern metadata,
fonts, and browser assets remain in `apps/web/public/licenses`,
`apps/web/public/vendor/licenses`, and the corresponding asset directories.
The experimental instrument remains at `/instrument.html`; its Pure Data,
ENVION and AI controls are not used to customize NFT identities.

Identity, composition schedules and frozen inputs are deterministic. Pixel and
encoded-media reproducibility requires the pinned renderer environment;
cross-device floating-point rendering is not represented as byte-identical.
