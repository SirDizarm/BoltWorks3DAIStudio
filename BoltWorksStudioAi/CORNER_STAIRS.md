# Corner stairs and floor shadows - v49.64.45

Staircase now has normalized X/Z placement controls, defaulting toward a corner. Stair geometry, upper-floor openings and partition clearance use the same plan; the smallest inset ground footprint limits placement. Ground-floor windows adjacent to the stair volume are omitted. Inner flight rails/balusters and half-landing rails added. Attic headroom calculation accounts for stair X offset.

Main directional-light shadow bias adjusted to reduce floor self-shadow striping. Screenshot diagnosis is tentative; this does not repair genuinely duplicate floor geometry. No live rendering validation performed.

New preset medieval-corner-stairs.bwnc includes corner stairs to the upper storey, with attic access disabled. Existing graphs need a Staircase node connected downstream of House Layout. Collision volumes are not added in this change.

Sources geometry-building.js, geometry-building-details.js and viewport.js synchronized with studio-v49.64.45.js.
