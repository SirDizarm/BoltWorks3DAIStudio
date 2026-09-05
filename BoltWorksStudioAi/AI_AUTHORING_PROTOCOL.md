# AI authoring protocol

This document is normative. An AI creating a BoltWorks model must follow every
phase in order.

Before authoring, also read `STUDIO_FEATURES.md` for current editor and exporter
behavior. When a studio tool is added or changed as part of the work, update the
relevant handbook documentation in the same change.

## 1. Understand the requested asset

Write a short design inventory before editing JSON:

- overall subject, scale and intended front direction;
- major masses;
- repeated or mirrored parts;
- thin directed parts such as windows, panels, wedges and roof slopes;
- materials and textures;
- functional groups;
- details that must be visible in each of the six review views.

Choose one front direction and keep it stable. BoltWorks screenshots use:

- **Front:** camera on `+Z`, looking toward `-Z`;
- **Back:** camera on `-Z`, looking toward `+Z`;
- **Left:** camera on `-X`, looking toward `+X`;
- **Right:** camera on `+X`, looking toward `-X`;
- **Top:** camera on `+Y`, looking downward;
- **Iso:** camera from positive X, Y and Z.

Object names such as `left`, `right`, `front` and `rear` must follow this view
contract, not the temporary orbit-camera angle.

## 2. Build a real project

Prefer a `.modelerproj` wrapper with:

- `kind: "modeler-project"`;
- a unique project name;
- a `scene` containing groups and objects;
- a `textureLibrary` for every embedded texture;
- editor view settings suitable for opening and review.

Use stable, descriptive IDs. Do not use names such as `box 17` in a finished
asset. Group by real component: bodywork, windows, wheels, roof, foundation,
lighting, props and so on.

Use built-in shapes whenever possible. Use custom `geometry` only when a shape
cannot be assembled cleanly from primitives.

## 3. Apply transforms deliberately

- `position`, `rotation` and `scale` are arrays in XYZ order.
- Rotation values are degrees and use Euler order XYZ.
- Position is world-space.
- Scale is applied in object-local space before rotation.
- Built-in geometry is centered on its local origin unless the shape catalogue
  explicitly says otherwise.
- Never assume a thin object faces the desired direction. Check its canonical
  depth axis in `SHAPE_CATALOG.md`.

For a mirrored pair, derive the second transform from the first. Do not eyeball
both sides independently. Mirroring a position does not always mean negating
the same rotation component; derive it from the local axis and verify both
views.

## 4. Handle textures as project data

For a portable project:

1. add each bitmap once to `textureLibrary` as a `data:image/...;base64,...`
   data URL;
2. give it a unique `name`;
3. set textured objects to `textureName` and `textureUrl: null`;
4. use `textureFlipY` and `textureRotation` per object;
5. never duplicate the same Base64 image on every object.

The studio hydrates `textureUrl` from `textureLibrary` when loading the project.
External file paths are not portable and must not be used as project textures.

## 5. Run structural inspection

Run:

```text
node BoltWorksStudioAi/tools/inspect-project.mjs MODEL.modelerproj
```

Resolve every error. Review warnings. A valid JSON file can still be visually
wrong, so this phase is necessary but not sufficient.

## 6. Render the real application

Load the file with **Load Project** in BoltWorks 3D AI Studio. Do not substitute
a generic Three.js viewer because the studio controls its own mesh builders,
texture settings, cameras and environment.

Press **QA Sheet**. It waits for scene textures and downloads one labeled 3x2
image containing Front, Back, Left, Right, Top and Iso.

## 7. Inspect the image, not the intention

Check every cell for:

- parts pointing in the wrong direction;
- mirrored rotations with the wrong sign;
- gaps, intersections, floating objects and clipping;
- asymmetry that was not requested;
- inconsistent thickness;
- z-fighting or coplanar surfaces;
- missing walls, windows, caps or back faces;
- textures that are white, stretched, rotated or absent;
- an unexpected object changing the scene bounds and making the asset tiny;
- geometry below the intended ground plane.

When an error is visible, identify the object by name and inspect its shape,
position, rotation and scale. Correct the project, reload it and generate a new
QA Sheet. Never reuse an older sheet as proof after changing the project.

## 8. Completion gate

The asset is complete only when all are true:

- the inspector reports zero errors;
- the latest project loads successfully;
- all textures appear in the latest QA Sheet;
- all six cells were reviewed;
- the asset reads correctly in silhouette and close detail;
- remaining limitations are explicitly reported.

## Geometry Nodes authoring

For reusable assets that are not locked to the tree preset, start with Mesh
Primitive or Tapered Stem, add Branch Array and Cluster Scatter as needed, and
combine independent streams with Join Geometry. Junction Blend adds elongated
collars at branch origins to visually bridge a branch into its supporting stem.
Tapered Stem exposes base/top radius, segments, radial sides, lean, root flare,
and color; Branch Array exposes count, length, rise, radius, taper, twist, and
color. These cards are ordinary geometry stages and can be mixed with later
non-tree generators.

When the Geometry Nodes plugin is used, add optional stages from the node menu,
set their exposed inputs, and keep Trunk and Group Output in the graph before
building. Use Tree Variant for broad, round, tall, sparse, bare, seasonal, snowy,
sapling, mature, and ancient forms before manually tuning the lower-level nodes.
The Trunk node generates one continuous tapered mesh so its segment rings do not
create open seams. Use Smooth Joints for branch junction coverage. Use Cut Knot
for an inward-facing cut branch with visible rings at the trunk surface.
Use Cut Rings when the underside of a trunk, stump, or felled tree will be visible.
Before applying Smooth Geometry to a production tree, add Primitive Smooth Test
and verify the cube, five-sided prism, and low-sided cone silhouettes. Right-click
the exact node and add Smooth Geometry from its custom menu, or place a free
Smooth Geometry card and draw its connections manually. Each attachment has
independent settings, so Trunk, Branches, and Canopy can be tuned separately and
can each receive more than one modifier. Unconnected nodes remain saved and do
not affect Group Output. Use XYZ for normal asset
smoothing; XY, XZ, YZ, and X/Y/Z-only modes constrain real vertex movement while
leaving unselected coordinates unchanged. The same right-click menu exposes the
node's normally hidden ID, socket types, canvas position, and connection counts.
Use the mouse wheel to zoom and middle-drag or Space-drag to pan the detached board.
Bake & Detach only after the generated result passes the same real-app
render and visual inspection gates above; baking intentionally stops the scene
parts from following later graph edits.

Use **Copy node string** when another AI or collaborator needs the graph inline.
Use **Save .bwnc** for a reusable node-cluster template. Both formats omit
generated scene IDs. Import through **Paste node string** or **Load .bwnc**;
the studio must create a new sanitized graph rather than overwrite the active
graph. Build and inspect the imported graph before treating it as trusted model
output.

For nature props, Rock Generator creates single, clustered, lined, or stacked
rounded, jagged, flat, or boulder stones. Stone Wall creates irregular
dry-stacked courses. Chain Grass Scatter for lightweight crossed blade sheets
without an image texture, and Moss Growth for bottom, middle, top, or all-height
coverage. Leave **Avoid source geometry** enabled for ground vegetation and tune
**Mask clearance** so blade roots, width, and lean do not intersect upstream
rocks or wall stones. Keep these detail stages separate when variants need
different growth. Moss Growth uses closed, outward-facing volumetric cushions
deliberately embedded into their source stones; preserve the shared source transform and use
Thickness to tune their exposed depth. On walls, crack growth should cover both
outer faces and overlap neighboring stones. Combine into Shell is appropriate
when a single exterior shell is wanted because the hidden moss volume is already
inside the rock. Rock side strips and planar top/bottom caps have separate UV
islands, so verify the underside as well as the hero view after assigning a
material. In stacked arrangements, raised stones must overlap the measured top
bounds of at least one lower support; a nominal layer height is not sufficient.
Wall
courses should favor larger lower stones while retaining substantial seeded
size variation throughout the wall. Use at least two staggered depth layers for
a masonry wall; the three-layer default adds a rubble core and is preferred when
the wall must not show daylight through aligned joints. Length can generate
extended runs, while Stones / 7 units keeps stone scale consistent as the wall
grows. Use Moisture, Sun exposure, and Crack
preference to place moss by habitat rather than assuming it belongs only on top.
Use the Texture Editor's live material sphere to judge Base Color, Roughness,
Metalness, Normal, and Emissive together. A tangent-space normal map uses neutral
`#8080ff`; it changes lighting detail and does not replace silhouette geometry.
