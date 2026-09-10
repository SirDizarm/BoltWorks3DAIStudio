# Architecture nodes - v49.64.31

House template creates a connected recipe without overwriting existing graphs or generating geometry until Build:
Seed -> House Layout -> Floor -> Window -> Door -> Diagonal Bracing -> Roof -> Group Output.

House Layout defines rectangular footprint, storeys, storey height, frame bays, wall thickness, timber and plaster. Floor, Window, Door, Opening, Diagonal Bracing and Roof are Geometry-in/Geometry-out recipe attachments, not independent geometry sources. Their second socket accepts a texture input or randomizer. Connect them in a chain downstream of the house source; Build regenerates the complete assembly in one go. Attachments also apply to House Wall for openings and bracing; Floor/Roof require House Layout.

- Floor: boards or square-ish stone divisions, thickness and color. Fits inside the source footprint, at each floor level.
- Window: wall side (including all), storey, count, dimensions, sill, and plain/cross/shutter style. Geometry fits the wall and matching holes are removed. Glass is an opaque tinted pane in this initial pass, not physical transparency.
- Door: side/storey, width/height, normalized horizontal position, planks or open. Cuts the corresponding doorway automatically.
- Opening: an unfilled rectangular void with fitted frame, without a door/window mesh.
- Diagonal Bracing: slash, alternating or crossed braces. Plaster is partitioned around diagonal bands; they are not coplanar overlays. Frame and diagonal pieces remain individually editable, not one welded structural mesh.
- Roof: gable roof fitted to footprint and total wall height. Controls rise, overhang, rows, columns, color and clay/slate/shingle variants. Every tile is a separate editable solid. Initial tile styles are simple faceted blocks differing in thickness, not curved clay profiles or irregular overlapping shakes.

Opening sizes are clamped to available wall space. Storeys outside the source range generate no opening. Colliding openings are skipped in connection traversal order; move/reduce them or change their wall/level rather than assuming overlapping cuts are supported. Opening attachment nodes supersede the legacy House Wall Opening dropdown. When several Floor/Roof/Bracing nodes are connected, the first is used. Keep one source per architectural chain to avoid applying the same attachment to multiple joined sources. Layout offsets move the whole generated house. Global transform and centering retain existing behavior.

Scope: rectangular houses up to three storeys, flat internal floors and a gable roof. This is not yet the ornate reference house: no stairs between storeys, foundation plinth, chimney, curved timber, pitched dormers, collision authoring, automatic game integration or weathering. Corner beams may intersect as separate structural members. A texture on House Layout applies to wall parts; attachment textures apply to their generated fitted parts where supported. Bracing uses the source timber material.

Canonical source: app/modules/geometry-building.js, geometry-assets.js, geometry-nodes.js; source-composer.mjs loads them in dependency order. index.html loads studio-v49.64.31.js. No downloaded model/image assets or new dependencies. Bundle generated; no live visual, topology, or interaction tests performed.
