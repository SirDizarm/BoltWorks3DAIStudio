# BWS 50.0.60 — isolated Minecraft block-grid file bridge

The main editor loads `studio-v50.0.60.js?revision=minecraft-grid-bridge-1` from the project root. Canonical host sources are `app/modules/plugin-minecraft-bridge.js`, `plugin-installer.js`, `plugins.js`, and `app/source-composer.mjs`.

API 6 is a narrow optional plugin workspace for a player-selected `.blockgrid.json` file. Its manifest must use `runtime: "sandbox-html"`, `apiVersion: 6`, and `contributes.minecraftWorkspace: true`. The only other allowed contribution keys are the descriptive `workspaces`, `importers`, and `exporters` metadata lists. API 6 skips every model/character/graph/generator sharing bridge. Other plugin API versions are unchanged.

The iframe keeps `sandbox="allow-scripts"`, an opaque origin, and a CSP that forbids network connections. It receives no BWS project, editor scene, filesystem access, same-origin permission or generic RPC capability.

## Player workflow

1. Install and enable the optional Minecraft workspace plugin, then choose Open.
2. Choose **Open block grid…** in the host header and pick one exported Blockmate `.blockgrid.json` file (at most 32 MiB).
3. Edit that independent grid inside the plugin.
4. Choose **Save edited block grid** in the host header to download a new `.edited.blockgrid.json` file. The BWS project is unchanged.

No edited-grid packet triggers an automatic download. The host validates the exported snapshot and only enables the save button. It preserves unknown top-level metadata omitted by the editor, including optional `preview_assets` with local image data URLs; metadata is treated as inert JSON, never executed or merged into editor state.

## Messages

- Plugin → host: `{type: "bws-plugin-ready"}`. `plugin-ready` is accepted as a compatibility alias.
- Host → plugin after player file selection: `{type: "bws-minecraft-import", requestId, grid}`.
- Plugin → host after import and edits: `{type: "bws-minecraft-grid", requestId, grid}`.

The host pins a fresh request ID per selected file. Packets from other frames, older file requests, disabled plugins, closed workspaces, or invalid/oversized grids are ignored or rejected. Cleanup aborts message listeners and invalidates pending file reads. The format is `blockmate-bws-grid-v1`, version 1, with at most 100,000 ordinary blocks plus 64 jigsaw block records and at most 64 connector metadata records. Basic validation checks bounded integer coordinates, namespaced block IDs, finite yaw and bounded property strings. Destination-pack block/state validation remains the Minecraft tool's responsibility.

## Build and checks

Run `node tools/studio-bundler.mjs` to rebuild the exact root bundle. Run `node tools/test-minecraft-plugin-bridge.mjs` for focused capability, file-selection, source/request pinning, explicit-download, metadata-preservation and legacy-manifest checks. This host bridge does not bundle Minecraft textures or automatically install a plugin.
