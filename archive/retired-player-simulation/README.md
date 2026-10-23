# Retired player simulation tools

These browser-only test-mint, simulated-market and media-export helpers were
previously shipped in apps/web/public, although their controls were already
retired and the live player supplied no simulation settings. They are preserved
here for reference and their existing tests still import them. This directory is
outside the GitHub Pages upload path and is not a production feature.

They do not mint tokens, prove ownership, verify milestones or replace the
collection platform. The simulation module imports the current music-context
helper for compatibility; that import path is the only module relocation change.
