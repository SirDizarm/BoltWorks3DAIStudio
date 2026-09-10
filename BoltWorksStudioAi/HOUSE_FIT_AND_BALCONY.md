# House fit and balcony - v49.64.33

Roof gables now use the true roof-underside height, including overhang and backing thickness. Eave wall closures fill the side-wall gap. Roof backing and tiles are cut around the chimney rather than passing through it.

Chimney now extends from ground level through the storeys to its cap. Continuous courses remove the previous open horizontal gaps. Floor slabs exclude its footprint. A ground-floor stove, feet, door, handle and connecting flue are generated with the Chimney node. The flue visibly enters the shaft; there is no simulated fire, ventilation, hollow penetration boolean or operable stove door.

Floor slab tops now match storey/door thresholds instead of projecting above them. Door leaves have 0.016 units of bottom clearance. Doors are static geometry, not rigged hinges; inward movement has not been tested in a game engine.

Balcony is a new attachment with wall side, upper storey, width, projection, horizontal position, doorway dimensions, rail height and wood color. It reserves its own door opening before windows, places deck top at the corresponding storey floor height, and adds front/side rails, balusters and support braces. It requires a matching upper storey; lower or nonexistent storeys produce no balcony. Windows that conflict with a reserved door are skipped. New Window nodes default to one window per wall; existing saved counts remain unchanged. House template includes Balcony and uses reduced window density. Existing graphs can add the node manually.

Source geometry-building.js, geometry-building-details.js and geometry-nodes.js synchronized with studio-v49.64.33.js. Rebuild an existing graph to replace old geometry. No live visual, topology, physics or opening-swing validation performed.
