# House rooms and corners - v49.64.35

Foundation: Wrap stone corners defaults on for houses, adding paired return stones and trimming the adjoining veneer. Standalone house walls keep their previous veneer span.

Window: existing Count per wall is preserved and now supports 0 through 12. Enable Use separate side counts and select Wall = all to use independent Front/Back/Left/Right values on the chosen storey. Zero disables that side for this node; other Window nodes still contribute their own openings. Available wall space caps counts; conflicts with doors/balconies are omitted as before.

House Layout width/depth now allow 32 units; frame bays allow 12. This is a larger rectangular footprint, not an L-shaped layout.

Interior Partition: add after House Layout in the geometry chain. Choose storey, width/depth direction, normalized cross-floor position, thickness and optional doorway. Add multiple nodes for multiple rooms. Partitions fit inside the exterior walls, subtract previous partition volumes, and leave full-height clearance around the central staircase and chimney/stove. Doorways are open, not animated doors. This is manual room layout, not an automatic connectivity solver; room access and collision require game integration. No room nodes are added to existing graphs automatically.

Source geometry-building.js and geometry-building-details.js synchronized with studio-v49.64.35.js. No live visual or gameplay validation performed.
