# AI texture workflow

Textures are portable project assets, not external decorations. Follow this
workflow when an asset needs stone, wood, moss, roof tile, rust, fabric or other
surface detail.

## 1. Decide what belongs in geometry

A texture can describe color and small surface variation. It cannot repair the
silhouette. Model these as geometry instead:

- roof tile rows that must cast a readable silhouette;
- window frames and deep joints;
- thick moss clumps, vines and roots;
- beams, cracks large enough to change an edge, and projecting stones.

Use the bitmap for fine grain, stains, small moss, mortar and color variation.

## 2. Generate a material image

When using an image-generation tool, ask for a material swatch rather than a
photograph of an object. A useful prompt pattern is:

```text
Seamless square PBR-style albedo texture of aged handmade terracotta roof tiles,
subtle green moss in joints, orthographic flat material scan, even neutral
lighting, no perspective, no objects, no border, no text, tileable on all edges.
```

Recommended properties:

- square PNG, normally 512×512 or 1024×1024;
- seamless/tileable edges;
- orthographic, flat and evenly lit;
- no baked directional shadow that conflicts with studio lighting;
- no labels, frames or background beyond the material;
- enough contrast to remain readable at the intended shot distance.

Inspect the bitmap itself before embedding it.

## 3. Reference the source during authoring

During project construction, a library entry may temporarily point at a local
path relative to the repository working directory:

```json
{
  "name": "Mossy Terracotta Roof",
  "dataUrl": "samples/showcases/textures/mossy-terracotta-roof.png",
  "robloxAssetId": ""
}
```

Every receiving object uses the same name:

```json
{
  "textureName": "Mossy Terracotta Roof",
  "textureUrl": null,
  "textureFlipY": true,
  "textureRotation": 0,
  "color": "#ffffff"
}
```

White object color preserves the bitmap's intended colors. A non-white color
tints the texture.

## 4. Pack the portable project

From the repository root:

```text
node tools/pack-project-textures.mjs draft.modelerproj final.modelerproj
```

The packer converts local texture files to Base64 data URLs in the project
library, leaves one canonical copy of each image, clears matching runtime object
URLs and keeps object references by `textureName`.

Never deliver the unpacked draft when the recipient needs a self-contained
project.

## 5. Verify actual mapping

Load the packed file, not the draft. Generate a fresh QA Sheet and check:

- the texture is visible instead of white;
- opposite/mirrored parts have the intended orientation;
- `textureFlipY` is correct;
- `textureRotation` is correct;
- seams land in plausible places;
- scale does not stretch recognizable features excessively;
- tint color has not destroyed the material colors.

The current project format stores image, flip and 90-degree-style rotation
metadata but does not provide a universal independent UV tiling control for all
primitive shapes. If mapping is unacceptable, change the bitmap composition,
split the surface into better-oriented parts, or use custom geometry with UVs.
