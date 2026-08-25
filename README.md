# BoltWorks 3D AI Studio

> Experimental preview: this application is under active development. Features may be incomplete and bugs can occur.

Current preview version: **v49.47.4**, with canonical feature modules for the toolbar, panels, viewport, meshes, rigging, animation, import/export, plugins, Minecraft workspace, and styling. GitHub Pages and the local adapter consume the same module sources.

## AI authorship note

Built with help from OpenAI Codex.

## Local development source

`D:\Game\BoltWorks3DAIStudio` is the canonical local development repository. Make 3D Studio and bone/rig changes here, then commit and push this repository to publish the GitHub Pages version.

BoltWorks 3D AI Studio is the 3D modeling, AI-assisted model generation, bone placement, rigging, animation, scene-rendering, and export application in the BoltWorks tool family.

The 2D scene, sprite, asset, and Character Animator workflows live in the separate **BoltWorks 2D Studio** project.

## Run locally

```text
npm start
```

The primary document is `index.html`; canonical application logic lives under
`app/modules/`. The local adapter composes those files in memory, while
`npm run build:web` creates the static GitHub Pages artifact in `dist/`.

`index.html` can also be opened directly. It loads the generated classic bundle
`app/studio-v49.49.5.js`, so direct file opening does not depend on module CORS or a
running server. After editing files under `app/modules/`, run
`npm run build:studio` to refresh that bundle; `npm start` and `npm run check`
also refresh it automatically.

## Load a project from a URL

Use **Load Project URL** beside **Load Project** to open an HTTPS link to a valid BoltWorks `.modelerproj` or saved-scene JSON file, including GitHub Raw links. The current scene is preserved if downloading, validation, or loading fails. Remote files are limited to 128 MB; HTTP is accepted only from localhost, and the host must allow browser CORS access.

## Local MCP for AI clients

BoltWorks can expose the open local editor to an MCP-compatible AI client without a BoltWorks login or cloud relay. Start BoltWorks with `npm start`, open the local editor in a browser, keep that tab open, and configure the AI client to run `node D:\Game\BoltWorks3DAIStudio\tools\mcp\server.mjs`. The short-lived local token is discovered automatically.

This release contains **MCP v1**, an experimental but working foundation. It provides 14 handbook/schema/example resources plus live tools for capabilities, scene inspection, selection, object creation/update/deletion, undo, an MCP audit log, and bounded AI work sessions. Exact object IDs and optional scene revisions protect collaborative changes. Full setup and the recommended AI workflow are documented in `BoltWorksStudioAi/MCP_SETUP.md`; `npm run check:mcp` verifies the stdio server and authenticated relay contract.

Timed AI sessions use a server-owned deadline, so a stated limit such as 15 minutes is enforced even if the client stalls. The Human AI Viewer can show the session's incremental, user-visible actions while it runs. A durable `.bws-session.json` sidecar may preserve compact forward/inverse deltas and factual workflow notes, but it must not contain hidden reasoning, private chain-of-thought, credentials, or a complete scene snapshot for every event. Deterministic replay and MP4 tutorial export remain future work rather than guarantees of the current session log.

MCP v1 is not yet a one-click image-to-mesh system. The planned next stage is to expose calibrated reference matching, landmarks, silhouette guides, topology operations, QA cameras, and checkpoints through the same MCP contract. That will let an AI turn front/side/back reference images into an editable `.modelerproj` mesh, compare its result visibly, and keep every change inspectable by a person.

## Reference images

Use the collapsible **Reference Image** panel to keep concept art beside the model, display it as a transparent viewport overlay, or show both. Overlay opacity, scale, and X/Y offsets can be adjusted for silhouette matching. The image and its display settings are stored inside the editable project file. When a reference exists, Save Views and the AI QA sheet place it in the sixth panel instead of the automatic Iso view; the separate Iso PNG export remains available.

## AI reference-model prototype

`samples/assets/female-t-pose-player-model.modelerproj` is the first high-detail human reference-model prototype produced for the future player-scale and image-to-mesh workflow. The matching `female-t-pose-player-model-preview-v6.png` is the reviewed visual checkpoint, and `tools/generate-female-t-pose.mjs` keeps its construction reproducible. This prototype demonstrates that BoltWorks can store, inspect, revise, and QA a reference-derived mesh; it does not claim that automatic image-to-mesh generation is complete yet.

Downloadable source files:

- [Original front/side/back T-pose reference image](samples/assets/female-t-pose-reference.png)
- [Editable BoltWorks Studio project](samples/assets/female-t-pose-player-model.modelerproj)
- [Latest four-view model preview](samples/assets/female-t-pose-player-model-preview-v6.png)

The original reference image is also embedded in the editable project, so the project remains self-contained after download.

## UV and topology test asset

Open `samples/showcases/uv-topology-test.modelerproj` before testing topology-changing tools. The large selected block is the editable test object; the smaller block is an untouched visual reference. Its embedded A1-D4 grid, directional labels, asymmetric colors, origin marker, and center cross make stretched, flipped, rotated, missing, or discontinuous UV coordinates immediately visible. Regenerate the project after changing its source texture with `npm run generate:uv-test`.

Manual mesh tests use the permanent shorthand documented in `docs/MESH_TEST_CODES.md`. For example, `M01#D` means that Extrude Region test 01 was completed through step D, while `M01#D FEL UV` reports a texture failure at that step.

**Surface Edit > UV Unwrap / Texture Atlas** analyzes sharp and material boundaries into packed, non-overlapping UV islands before changing the mesh. It can apply UVs only, bake the current single-material appearance into a new 512â€“2048 px atlas, or export a transparent PNG layout for painting. Analysis and layout export are read-only; Apply and Bake each support Undo.

## Shape building

- **Loft Checked** builds one closed editable mesh through two or more checked profile objects. Place the profiles along X, Y, or Z, choose the axis (or Auto), and set the perimeter sample count.
- **Mirror Copy** creates independent editable copies across a world-space X, Y, or Z symmetry plane.
- **Live Mirror** adds a non-selectable mirrored preview across the chosen world-space axis and plane. It follows geometry, texture, and object transforms immediately; **Apply Live Mirror** turns the preview into an independent editable part and supports Undo.
- **Surface Edit** is a collapsible right-side section. Mouse Drag automatically arms after a face is selected and supports either a smooth falloff radius or a hard-face move; Exact Value provides numerical Inset Face, Extend, Pull, Push, Soft Pull, Soft Push, and Bevel actions.
- Surface selection is always explicit: **Triangle** selects one mesh triangle and **Whole Face** selects the connected coplanar region. In Mouse Drag mode, Axis is color-coded: Free restores all three arrows, while a lock shows only X (red), Y (green), or Z (blue). Surface-normal axis guessing is intentionally not used.
- The classic **Select Tri** and **Select Face** tools are independent from Surface Edit. Activating either one releases Mouse Drag and its axis lock, then restores ordinary triangle or coplanar-face picking.
- Surface Edit also provides **Vertex** and **Edge** component modes. Vertex mode selects welded points, Edge mode selects the nearest triangle edge, Shift/Ctrl adds components, and the same snapped X/Y/Z gizmo moves the selected component geometry.
- **Inset Face** replaces one connected flat convex Triangle or Whole Face region with a true border ring and a newly selected center surface. The inset amount is saved in the project, and the center can immediately be used with Pull or Push.
- **Edge Bevel** chamfers one selected non-coplanar crease with a closed planar solid cut. Consecutive bevel planes trim earlier bevels cleanly at shared corners instead of bending their strips inward. Its saved width is clamped safely, flat triangulation diagonals are rejected, and newly created bevel boundaries are shown red and protected from accidental re-beveling.
- **Subdivide Surface** adds local topology without changing the model silhouette. Triangle or Whole Face selections can be split one or two levels (4x or 16x selected triangles), interpolated texture coordinates are retained, and protected bevel boundaries remain protected. Adjacent unselected triangles receive matching boundary splits, preventing T-junction cracks when the new detail is moved; only the requested surface remains selected for immediate shaping.
- **Loop Cut / Ring Cut** inserts one or more local-axis cutting planes through the selected mesh without changing its silhouette. A single cut uses an exact percentage of the mesh bounds; multiple cuts are evenly spaced. UVs and protected bevel edges are retained, and every newly inserted ring segment stays selected for immediate movement.
- **Knife / Plane Cut** adds either a two-click viewport stroke or an exact local X/Y/Z cutting plane. Plane Cut can retain both halves or remove one side with a closed planar cap. Interpolated texture coordinates stay attached, newly created cut edges remain selected, and Knife can be limited to the drawn segment or pass through the whole mesh.
- **Bridge Edge Loops** joins two complete open boundary loops inside the same mesh with a real quad strip. Select one boundary edge on each opening; the full loops are traced automatically, paired with minimum twist, and connected while existing and new UVs remain available. Equal loop vertex counts are required in this first safe version.
- **Normals** can recalculate consistent outward winding for a selected mesh or deliberately flip selected faces. Position and UV corners stay paired, non-manifold input is rejected, and both edits support Undo.
- **Find and Repair Holes** scans the selected mesh for true open boundary loops, highlights and frames each hole, then safely caps one or all valid holes inside the same mesh. Auto UV first continues the affine UV mapping of a coplanar neighboring triangle, preserving texture scale, direction, and alignment across a repaired triangulated face. If no suitable planar UV neighbor exists, Auto falls back to a stable closest-world-plane projection; X/Y/Z explicitly starts a new projection. After repair, **Selected Face UV** rotates the chosen Triangle or Whole Face 90 degrees left/right or flips it horizontally/vertically without changing geometry, material, or neighboring UVs. Surrounding material is retained; twisted, crossing, degenerate, or non-manifold results are refused without changing the model.
- **Explicit delete actions** keep object and topology editing separate: **Delete Selected Model** removes the selected scene model, while **Delete Selected Face** is available inside Surface Edit only for an active Triangle or Whole Face selection.
- **Edge Slide** moves selected edges along their neighboring topology rails without adding triangles. Signed percentage values choose either direction, Loop Cut rings remember their cutting axis, and Auto can infer a rail for manually selected edges.
- **Scale Selected Surface** scales selected vertices, edges, triangles, or a Whole Face around its own center. Uniform scaling keeps flat faces in their plane, world X/Y/Z can change one dimension, UV coordinates remain attached, the active selection is retained, and Undo restores the previous surface.
- **Smooth / Relax Vertices** edits selected vertices through connected one-ring topology. Relax Surface moves displaced vertices toward their neighboring surface while stabilizing the center of multi-vertex selections; Smooth Shape also rounds the silhouette. Strength, iterations, open-boundary protection, retained UVs, and Undo are supported. v49.8.1 settles completed pointer drags and prioritizes visible surface arrows; v49.8.2 also exposes the same selected-surface gizmo in the FRONT and SIDE reference views, so a camera-aligned world axis remains draggable.
- **Weld Vertices** merges two or more ordered Vertex selections inside one mesh. The result can be placed at the center, first selected vertex, or last selected vertex; per-corner UVs and materials stay intact, degenerate and duplicate triangles are removed, closed meshes are protected from accidental holes, and the welded result remains selected.
- **Dissolve Edge or Vertex** hides a flat internal renderer diagonal as a modeling edge, or removes one internal manifold vertex and re-triangulates its closed one-ring boundary. Boundary edges, material seams, UV seams, and non-manifold results are protected. **Show Modeling Edges** draws the active topology on the selected mesh so the removed edge visibly disappears.
- **LOD Generator** analyzes a dense selected model before changing the scene, then keeps the unchanged source as LOD0 and creates progressively lighter LOD1, LOD2, and LOD3 models as separate members of one named scene group. Its preview explicitly reports the total model count and identifies LOD0 as Original and LOD1–LOD3 as Preview models. Each level can be selected in the scene tree and exported alone with **Export Selected OBJ**. Generated levels retain per-corner UV/material data, carry machine-readable LOD metadata, are hidden by default to avoid z-fighting, and the complete generation is one Undo step.
- **Selected-model scene statistics** keep the current model's full triangle count visible in the scene summary while selected face and component counts remain separate editing statistics.
- **Alphabetical Surface Edit tools** are sorted automatically from their visible English labels, so current and future tool sections remain easy to scan.
- **Extrude Region** replaces one connected planar selection inside its original mesh with a translated cap and one continuous set of boundary walls. Internal triangle edges do not create duplicate walls, UVs are retained, and the new cap remains selected for repeated shaping.
- Mouse Drag only captures pointer-down events that begin on an already selected triangle. Unselected triangles remain clickable, double-click releases the current surface selection, and clicking the active Mouse Drag tab releases the drag mode and hides its arrows.
- On small surfaces, the visible X/Y/Z arrow pickers take priority where they overlap the mesh. Elsewhere an unselected mesh triangle remains directly selectable, while clicking an already selected face can still start Mouse Drag.
- **Model Tools** moves profile/loft, selection, sketch, marker, triangle, hole, bridge, cut, and Duplicate operations into a collapsible right-side section so the main toolbar stays focused on frequent scene actions.
- **Files & Output** groups saved-view PNGs, game exports, and model imports in another right-side section instead of occupying multiple toolbar rows.
- **Camera Controls** in the main toolbar expands Utilities and Camera Views, then scrolls directly to Front, Back, Left, Right, Top, Iso, and custom camera controls.
- Standard camera presets keep a consistent Y-up orbit system. Moving away from **Top** therefore uses the same mouse axes as Front, Back, Left, Right, and Iso without requiring an extra reset click.
- **Go to Selected Mesh** scrolls the scene tree to the mesh currently selected in the viewport and briefly highlights its row, which is useful in large grouped models.
- **Soft Pull / Soft Push** deform selected triangles and nearby vertices with a smooth world-space falloff radius. Axis, distance, radius, and mouse snap are configured in the floating Surface Edit window and saved with the project.

## License and rights

Copyright (c) 2026 Daniel Rydin.

Source code is licensed under the [Apache License 2.0](LICENSE). BoltWorks branding and visual assets are not part of that license grant; see [trademark policy](docs/legal/TRADEMARKS.md) and [asset license](docs/legal/ASSET-LICENSE.md).
