# BoltWorks 3D AI Studio

> Experimental preview: this application is under active development. Features may be incomplete and bugs can occur.

Current preview version: **v49.2.5**, with canonical feature modules for the toolbar, panels, viewport, meshes, rigging, import/export, plugins, and styling. GitHub Pages and the local adapter consume the same module sources.

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
`app/studio-v49.2.5.js`, so direct file opening does not depend on module CORS or a
running server. After editing files under `app/modules/`, run
`npm run build:studio` to refresh that bundle; `npm start` and `npm run check`
also refresh it automatically.

## Reference images

Use the collapsible **Reference Image** panel to keep concept art beside the model, display it as a transparent viewport overlay, or show both. Overlay opacity, scale, and X/Y offsets can be adjusted for silhouette matching. The image and its display settings are stored inside the editable project file. When a reference exists, Save Views and the AI QA sheet place it in the sixth panel instead of the automatic Iso view; the separate Iso PNG export remains available.

## UV and topology test asset

Open `samples/showcases/uv-topology-test.modelerproj` before testing topology-changing tools. The large selected block is the editable test object; the smaller block is an untouched visual reference. Its embedded A1-D4 grid, directional labels, asymmetric colors, origin marker, and center cross make stretched, flipped, rotated, missing, or discontinuous UV coordinates immediately visible. Regenerate the project after changing its source texture with `npm run generate:uv-test`.

Manual mesh tests use the permanent shorthand documented in `docs/MESH_TEST_CODES.md`. For example, `M01#D` means that Extrude Region test 01 was completed through step D, while `M01#D FEL UV` reports a texture failure at that step.

## Shape building

- **Loft Checked** builds one closed editable mesh through two or more checked profile objects. Place the profiles along X, Y, or Z, choose the axis (or Auto), and set the perimeter sample count.
- **Mirror Copy** creates independent editable copies across a world-space X, Y, or Z symmetry plane.
- **Surface Edit** is a collapsible right-side section. Mouse Drag automatically arms after a face is selected and supports either a smooth falloff radius or a hard-face move; Exact Value provides numerical Inset Face, Extend, Pull, Push, Soft Pull, Soft Push, and Bevel actions.
- Surface selection is always explicit: **Triangle** selects one mesh triangle and **Whole Face** selects the connected coplanar region. In Mouse Drag mode, Axis is color-coded: Free restores all three arrows, while a lock shows only X (red), Y (green), or Z (blue). Surface-normal axis guessing is intentionally not used.
- The classic **Select Tri** and **Select Face** tools are independent from Surface Edit. Activating either one releases Mouse Drag and its axis lock, then restores ordinary triangle or coplanar-face picking.
- Surface Edit also provides **Vertex** and **Edge** component modes. Vertex mode selects welded points, Edge mode selects the nearest triangle edge, Shift/Ctrl adds components, and the same snapped X/Y/Z gizmo moves the selected component geometry.
- **Inset Face** replaces one connected flat convex Triangle or Whole Face region with a true border ring and a newly selected center surface. The inset amount is saved in the project, and the center can immediately be used with Pull or Push.
- **Edge Bevel** chamfers one selected non-coplanar crease with a closed planar solid cut. Consecutive bevel planes trim earlier bevels cleanly at shared corners instead of bending their strips inward. Its saved width is clamped safely, flat triangulation diagonals are rejected, and newly created bevel boundaries are shown red and protected from accidental re-beveling.
- **Subdivide Surface** adds local topology without changing the model silhouette. Triangle or Whole Face selections can be split one or two levels (4x or 16x selected triangles), interpolated texture coordinates are retained, and protected bevel boundaries remain protected. Adjacent unselected triangles receive matching boundary splits, preventing T-junction cracks when the new detail is moved; only the requested surface remains selected for immediate shaping.
- **Loop Cut / Ring Cut** inserts one or more local-axis cutting planes through the selected mesh without changing its silhouette. A single cut uses an exact percentage of the mesh bounds; multiple cuts are evenly spaced. UVs and protected bevel edges are retained, and every newly inserted ring segment stays selected for immediate movement.
- **Edge Slide** moves selected edges along their neighboring topology rails without adding triangles. Signed percentage values choose either direction, Loop Cut rings remember their cutting axis, and Auto can infer a rail for manually selected edges.
- **Extrude Region** replaces one connected planar selection inside its original mesh with a translated cap and one continuous set of boundary walls. Internal triangle edges do not create duplicate walls, UVs are retained, and the new cap remains selected for repeated shaping.
- Mouse Drag only captures pointer-down events that begin on an already selected triangle. Unselected triangles remain clickable, double-click releases the current surface selection, and clicking the active Mouse Drag tab releases the drag mode and hides its arrows.
- On small surfaces, mesh triangles take pointer priority over the gizmo's larger invisible hit areas. An unselected triangle is selected in the earliest pointer phase, while clicking an already selected triangle can still start Mouse Drag. Arrow portions extending outside the model remain directly draggable.
- **Model Tools** moves profile/loft, selection, sketch, marker, triangle, hole, bridge, cut, and Duplicate operations into a collapsible right-side section so the main toolbar stays focused on frequent scene actions.
- **Files & Output** groups saved-view PNGs, game exports, and model imports in another right-side section instead of occupying multiple toolbar rows.
- **Go to Selected Mesh** scrolls the scene tree to the mesh currently selected in the viewport and briefly highlights its row, which is useful in large grouped models.
- **Soft Pull / Soft Push** deform selected triangles and nearby vertices with a smooth world-space falloff radius. Axis, distance, radius, and mouse snap are configured in the floating Surface Edit window and saved with the project.

## License and rights

Copyright (c) 2026 Daniel Rydin.

Source code is licensed under the [Apache License 2.0](LICENSE). BoltWorks branding and visual assets are not part of that license grant; see [trademark policy](docs/legal/TRADEMARKS.md) and [asset license](docs/legal/ASSET-LICENSE.md).
