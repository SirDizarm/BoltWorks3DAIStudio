# Plugin-loader preview and legacy edition

## Current addition: Minecraft grid API 6 (50.0.60)

API versions 1–6 are accepted. API 6 is specifically the optional isolated
Minecraft block-grid workspace: `runtime: sandbox-html`,
`contributes.minecraftWorkspace: true`. It receives only the `.blockgrid.json`
file the player selects with **Open block grid…**. Valid edited snapshots enable
**Save edited block grid**; downloading still requires that explicit host click.
It has no editor-scene access, model snapshot, general RPC or network permission.
Unknown top-level grid metadata and optional embedded `preview_assets` are retained.

The plugin 0.1.1 browser round trip was verified with a cottage import, block
addition, undo/redo, movement, explicit download and successful textured re-import
into Connect. Installation remains a separate player action; this host support
does not bundle or automatically enable the plugin. See the
[API 6 file-bridge contract and limits](../docs/MINECRAFT-GRID-API6-50.0.60.md).

## Historical initial-loader notes

The notes below describe the first loader implementation, not the complete
capabilities and verification of later API versions.

Spell Binder Room is on hold. The main entry presents an in-app edition chooser before starting the editor. Legacy has a frozen pre-loader editor bundle at legacy/index.html and no cutoff date. A BWS edition button returns to the choice. The editions currently share browser project storage; save project files before switching. Shared UI assets are not separately frozen.

Existing bundled features and preferences remain available. Roblox Exporter now has its own compatibility toggle and export guard in the new edition, but its implementation has NOT yet been extracted from the main bundle. Other bundled modules are also still included.

Install from a local .bwsplugin JSON file, a public HTTPS package URL, a GitHub blob/file URL, or a public GitHub repository with plugin.bwsplugin at its root. HTTPS hosts must allow browser CORS; redirects are rejected. Download locally when cross-origin fetch is unavailable. Private repositories and credentials are not supported yet.

Packages retain format v1. Optional manifest fields: runtime: sandbox-html, entry: main.html, apiVersion: 1, dependencies: [plugin ids]. Entry HTML must be self-contained, with inline scripts/styles and embedded data images. Sandbox workspaces have no same-origin permission and no editor/native bridge. Other file assets can be stored but are not automatically resolved into the HTML. This is not yet the API needed for arbitrary exporters or geometry generators.

Review shows source, version, dependencies, and a locally computed SHA-256 fingerprint. A fingerprint records bytes; it is NOT publisher authentication. Installing or replacing a package leaves it disabled. Enable and Open are explicit separate actions. Updates are manual replacements. Compatibility currently checks API version and dependency IDs, not engine-version ranges. Automatic rollback, signatures, a trusted catalog, a native downloader, and full plugin API permissions remain future work.

Migration sequence: stabilize installation and package persistence; define a narrow exporter API; extract Roblox export and its dependencies; then Minecraft export, game-engine export, Image to Mesh, Scene Rendering, and Geometry Nodes (dependency-sensitive). Publish versioned packages and only then remove their code from a clean new distribution. Preserve the legacy edition until an announced cutoff is agreed.

No tests or browser verification were run for this first implementation.
