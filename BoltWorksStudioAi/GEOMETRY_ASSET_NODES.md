# Geometry asset nodes - v49.64.24

The Game Assets category extends the existing geometry graph, rather than replacing saved trees or stone walls. No current scene is imported or overwritten by this source update.

## Use

Open Geometry Nodes, right-click its canvas, and add a Game Assets node. Connect its Geometry output directly to Group Output and click Build. Seed is optional; the graph seed controls variation. Texture Input can connect to the second input. Offset X/Y/Z positions each generator. Bake detaches generated parts for ordinary mesh editing. Save the project or save the node cluster to keep parameters. Rebuild replaces that graph's generated output: bake or duplicate before manually editing a result you want to retain.

- Barrel: dimensions, belly, thickness, staves, hoops, colors and closed/open/broken ends. Each wooden stave has inner/outer faces and capped sides/ends. Iron bands have inner/outer faces and rims. Bottom and optional lid are polygon-clipped plank solids. Broken mode varies stave height; it is not a fracture simulation.
- Brick Wall: length/height/depth, row/column counts, staggered courses, joints and seeded color variation. Terminal bricks are clipped to the requested width. Mortar is a separate backing solid.
- House Wall: timber frame and plaster infill, optional real door/window opening, opening dimensions and sill height. Wall runs on X, front is +Z; opening is centered. No automatic doors, glazing, roofs or game collision are added.
- Ground Tiles: rows/columns, grid size, thickness, joints, optional base and seeded color variation. Slabs align on XZ with bottom at Y=0. Flat square slabs, not a terrain sculpting system.

Use separate Group Output sockets for several sources. Join Geometry's existing optional inner panel can fill intended barrel/window openings; disable that option when joining hollow assets. Output Transform follows the existing editor semantics. Nature decorators were not extended for these generators.

## Extending

Source registry BWS_ASSET_NODES in app/modules/geometry-assets.js defines each node's title and fields. Each field is label/default/min/max/step for numbers, label/default/options for a selector, or label/default for colors and booleans. Defaults, UI controls and validation derive from that registry. Add the corresponding implementation to assetNodeBuild. geometry-nodes.js registers the source socket, evaluates connected instances and hands the generated meshes to normal bake/export. Counts are bounded; asset graphs above 3000 estimated parts are rejected before replacing their existing output.

## Geometry and limitations

Original procedural code using the editor's existing Three.js dependency; no downloaded asset meshes or new dependencies. Y is up, wall width is X, depth Z. Parts retain labels and custom mesh data. This is a starting set of four generators, not support for every possible asset. Basic UVs are included; a production UV atlas is not generated. Full-ring sectors retain coincident seam faces. Repeated instances use independent fields and a deterministic graph-seed/node-order variation.

Source and browser bundle updated to v49.64.24. No live editor inspection or gameplay export validation performed in this change.
