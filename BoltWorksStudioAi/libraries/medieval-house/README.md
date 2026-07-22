# Medieval House Asset Library

This library is the canonical BoltWorks reference for medieval and Tudor-style houses. Before creating a related house, cottage, inn, workshop, manor, or village, an AI should inspect this directory and the linked Blackstone model.

## Canonical reference

- Editable model: [`../../../samples/showcases/blackstone-timber-manor.modelerproj`](../../../samples/showcases/blackstone-timber-manor.modelerproj)
- Procedural source: [`../../tools/generate-blackstone-timber-manor.mjs`](../../tools/generate-blackstone-timber-manor.mjs)
- Finishing and repair pass: [`../../../tools/rebuild-stonework-v2.ps1`](../../../tools/rebuild-stonework-v2.ps1)
- Component catalog: [`component-catalog.json`](component-catalog.json)
- Construction recipe: [`BUILD_RECIPE.md`](BUILD_RECIPE.md)
- Interior reference: [`references/blackstone-interior-attic.png`](references/blackstone-interior-attic.png)
- Exterior studio reference: [`references/blackstone-exterior-studio.png`](references/blackstone-exterior-studio.png)
- Upper-hall camera reference: [`references/blackstone-upper-hall-studio.png`](references/blackstone-upper-hall-studio.png)
- Cellar camera reference: [`references/blackstone-cellar-studio.png`](references/blackstone-cellar-studio.png)

The `.modelerproj` is the source of truth for dimensions, transforms, group hierarchy, embedded textures, transparent glass, and example camera directors.

## Required AI workflow

1. Read this file, `BUILD_RECIPE.md`, and `component-catalog.json`.
2. Inspect the reference images and the canonical model's groups.
3. Reuse the same construction logic and material family; do not clone the exact silhouette for every building.
4. Build with named parts and stable groups so walls, timber, windows, roof, interior, and fixtures remain independently editable.
5. Add useful custom camera directors for exterior, important rooms, and lower floors.
6. Load the result in BoltWorks Studio, create a fresh QA Sheet, and inspect both exterior and interior cameras before declaring completion.

## Village consistency rules

Keep these shared across a settlement:

- dark structural oak with warm aged plaster;
- irregular cool-grey fieldstone and recessed mortar;
- mossed terracotta roof material;
- blue-grey leaded glass at approximately `0.38` opacity;
- substantial ridge beams, visible interior rafters, and physically connected chimneys/flues;
- realistic wall thickness, window reveals, floor slabs, and stair openings.

Vary these between buildings:

- footprint and number of bays;
- gable direction, roof height, and overhang;
- window spacing and asymmetry;
- stone-to-plaster ratio;
- chimney placement;
- door style, extensions, dormers, signs, sheds, and occupation-specific props.

The goal is a coherent building tradition, not identical houses.
