# BWS 50.0.10

- Removed the bundled Roblox compatibility plugin and Roblox ZIP/Lua generation from the new studio. Legacy edition is unchanged.
- Roblox Exporter 1.1.0 now lives in the separate bws-plugins repository with source, build script, installable package, information page and changelog.
- Plugin API 2 adds explicit read-only model-copy sharing and user-initiated ZIP downloads. No general editor or filesystem access.
- Existing API 1 scene plugins remain supported. Roblox must be installed and enabled in the new editor.
- Functional export and Roblox Studio round-trip tests are pending. Nothing published.
