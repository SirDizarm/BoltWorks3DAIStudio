# Plugin-loader preview and legacy edition

Spell Binder Room is on hold. The main entry presents an in-app edition chooser before starting the editor. Legacy has a frozen pre-loader editor bundle at legacy/index.html and no cutoff date. A BWS edition button returns to the choice. The editions currently share browser project storage; save project files before switching. Shared UI assets are not separately frozen.

Existing bundled features and preferences remain available. Roblox Exporter now has its own compatibility toggle and export guard in the new edition, but its implementation has NOT yet been extracted from the main bundle. Other bundled modules are also still included.

Install from a local .bwsplugin JSON file, a public HTTPS package URL, a GitHub blob/file URL, or a public GitHub repository with plugin.bwsplugin at its root. HTTPS hosts must allow browser CORS; redirects are rejected. Download locally when cross-origin fetch is unavailable. Private repositories and credentials are not supported yet.

Packages retain format v1. Optional manifest fields: runtime: sandbox-html, entry: main.html, apiVersion: 1, dependencies: [plugin ids]. Entry HTML must be self-contained, with inline scripts/styles and embedded data images. Sandbox workspaces have no same-origin permission and no editor/native bridge. Other file assets can be stored but are not automatically resolved into the HTML. This is not yet the API needed for arbitrary exporters or geometry generators.

Review shows source, version, dependencies, and a locally computed SHA-256 fingerprint. A fingerprint records bytes; it is NOT publisher authentication. Installing or replacing a package leaves it disabled. Enable and Open are explicit separate actions. Updates are manual replacements. Compatibility currently checks API version and dependency IDs, not engine-version ranges. Automatic rollback, signatures, a trusted catalog, a native downloader, and full plugin API permissions remain future work.

Migration sequence: stabilize installation and package persistence; define a narrow exporter API; extract Roblox export and its dependencies; then Minecraft export, game-engine export, Image to Mesh, Scene Rendering, and Geometry Nodes (dependency-sensitive). Publish versioned packages and only then remove their code from a clean new distribution. Preserve the legacy edition until an announced cutoff is agreed.

No tests or browser verification were run for this first implementation.
