# Detailed house recipe - v49.64.32

House template now creates a two-storey timber house recipe with upper and ground windows, a door, bracing, stone foundation facing, facade trim, internal staircase, attic floor/access, roof tiles and chimney. It does not overwrite an existing graph. Build produces the configured geometry; change graph seed for roof/foundation color variation and any connected texture randomizers. Structural dimensions are not randomly changed.

## New attachments

- Staircase: central U-return stairwell, paired flights, half landings, optional handrails and attic access. Width/tread/riser values are desired dimensions fitted to the footprint and storey height. Each upper floor is cut around the stairwell. If no Floor node is connected, a default floor is supplied. Very small footprints that cannot fit minimum width/tread omit stairs rather than emit invalid geometry. Start with the default 6 x 5 footprint or larger.
- Attic access: when Staircase Access attic and a Roof node are present, adds a floor at total wall height plus the final stair flights. Roof rise is increased when necessary to allow 2.25 units of clearance over the stairwell's horizontal extent. Geometry clearance is not proof of game navigation/collision; this must be checked after export. No attic access is built without Roof.
- Foundation: stone facing on the first-storey wall, respecting opening rectangles, with course count and seeded tone variation. This is a visible wall base, not a terrain-aware footing system.
- Facade Details: storey cornices, brackets, window sills and door canopies. Uses existing fitted openings.
- Chimney: hollow masonry stack above the roof, with cap pieces and an open flue. No fireplace/interior flue or flashed roof penetration is modelled.
- Roof gains seeded color variation. Existing roof tiles remain individually editable faceted solids, not high-detail scanned shingles.

A single Staircase/Foundation/Facade Details/Chimney node per chain is supported. Attach them between House Layout and Group Output. Opening overlap rules remain unchanged; ground template windows are narrower to leave the central door clear. These are generated editable meshes, not game-engine stairs or collisions. Rebuilding replaces generated parts; bake/save before manual refinements.

## Reference scope

This moves toward the supplied timber-house reference with more detailed facade and usable floor openings. It does not reproduce the reference exactly: dormers, asymmetrical wings, overhanging upper storeys, custom carved doors, curved tile profiles, weathering and sculpted timber remain future work. Existing corner/frame intersections and roof penetration require visual inspection before production export. Stairwell guardrail coverage and live traversal have not been validated.

Sources: app/modules/geometry-building-details.js, geometry-building.js, geometry-nodes.js and app/source-composer.mjs. Versioned browser bundle studio-v49.64.32.js synchronized. No new dependencies or downloaded assets. Build only; no live visual or gameplay testing performed.
