# Curved straps and layered texture stacks from text

This offline helper turns a small JSON recipe into an ordinary `.modelerproj`.
It is intended for an AI without a BWS/MCP connection. It can create a new
project or append parts to an existing one. It never overwrites an input file.

## Command

Run from the BWS source directory:

```text
node BoltWorksStudioAi/tools/generate-ai-geometry.mjs recipe.json output.modelerproj
node BoltWorksStudioAi/tools/generate-ai-geometry.mjs recipe.json output.modelerproj existing.modelerproj
node BoltWorksStudioAi/tools/inspect-project.mjs output.modelerproj
```

Then load the output in BWS and inspect a fresh QA Sheet. For a quicker first
look, `node BoltWorksStudioAi/tools/render-offline-preview.mjs
output.modelerproj preview.png` creates an approximate offline preview. It
shows panel geometry without textures; inspect texture stacks in BWS.

## Recipe

```json
{
  "name": "Courier character",
  "straps": [
    {
      "id": "left-backpack-strap",
      "name": "Left backpack strap",
      "points": [[-0.4, 2.2, 0.1], [-0.5, 2.0, 0.28], [-0.42, 1.65, 0.35], [-0.3, 1.35, 0.15]],
      "width": 0.16,
      "thickness": 0.035,
      "widthAxis": [1, 0, 0],
      "color": "#785638"
    }
  ],
  "stacks": [
    {
      "id": "badge",
      "position": [0, 1.5, 0.5],
      "spacing": 0.025,
      "layers": [
        { "id": "badge-back", "size": [0.6, 0.6], "imagePath": "badge-back.png" },
        { "id": "badge-front", "size": [0.55, 0.55], "imagePath": "badge-front.png" }
      ]
    }
  ]
}
```

Strap `points` are world positions along the centerline. The helper sweeps a
closed ribbon with the specified width and thickness through those points,
including end caps. `widthAxis` suggests the ribbon's sideways direction; the
helper projects it perpendicular to each path segment. Use more points for a
smoother loop. The mesh is one editable custom-geometry BWS object.

Each texture-stack layer becomes a separate editable `panel` object with an
embedded texture in `textureLibrary`. Layers are ordered from back to front
along local +Z, with `spacing` between centers. `position` is the stack center.
Each layer accepts `size` `[width,height]`, optional `offset` XYZ, `rotation`
XYZ degrees, `thickness` (default 0.01), `roughness`, and `opacity`. An
optional `hasTransparency: false` is appropriate for a fully opaque image;
the default enables texture alpha for sprite cutouts. An
`imagePath` is resolved relative to the recipe file and embedded as PNG, JPEG,
WebP, or GIF. An AI may instead return a `dataUrl` containing an embedded image.
Separate files keep the resulting project portable. `spacing` must exceed
layer thickness to reduce coplanar faces.

This is a generation step, not a live procedural constraint. Editing the
recipe and regenerating creates another output file. BWS's in-editor Geometry
Nodes and mesh tools can refine the generated result after import.
