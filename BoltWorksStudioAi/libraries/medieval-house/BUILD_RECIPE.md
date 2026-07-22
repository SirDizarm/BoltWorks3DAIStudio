# Medieval House Construction Recipe

## 1. Block the inhabited volume

Establish the foundation, lower stone storey, upper framed storey, roof volume, floor heights, and stair opening first. Check the silhouette from front, side, top, and iso views before adding detail.

Blackstone uses X for facade width, Y for height, and Z for depth. Its roof ridge runs along X and the two roof pitches descend along positive and negative Z.

## 2. Build masonry as a system

Use a recessed continuous mortar backing, then place irregular fieldstones in front of it. Vary width, height, depth, color, and row offset. Interlock corners with L-shaped or alternating corner stones; do not leave visibly hollow wall edges.

Reference groups:

- `foundation` — primary masonry base;
- `mortar-backing` — continuous recessed backing;
- `stonework` — irregular veneer and interlocked corners.

## 3. Add the heavy timber frame

Create continuous sill, corner, storey, wall-post, gable, and diagonal brace members. Timbers should overlap convincingly at joints and remain proud of the plaster infill. Use the shared `Hand-Hewn Dark Oak Timber` texture with high roughness; use color only as a restrained tint, not as a substitute for wood grain.

## 4. Recess plaster infill

Place warm aged plaster panels behind the outer timber faces. Split panels around windows and doors instead of covering openings with one large surface. Preserve wall thickness so the interior has real window reveals.

## 5. Construct transparent leaded windows

Use three layers:

1. dark timber surround and lintel;
2. thin blue-grey glass plane;
3. narrow lead lattice slightly in front of the glass.

Canonical glass settings:

```json
{
  "color": "#24444c",
  "roughness": 0.18,
  "opacity": 0.38
}
```

Opacity must be stored on the mesh, restored on load, and applied with material transparency enabled and depth writing disabled below full opacity. Verify that interior geometry is visible through the pane from both sides.

## 6. Build roof and interior structure together

Use two pitched roof panels, a continuous ridge beam, edge/cap pieces, and visible internal trusses. Blackstone's interior frame uses five stations; every station has paired sloping rafters plus a high collar tie. Keep collar ties high enough to preserve walking sightlines.

Do not treat the roof as an exterior shell only. Interior cameras must show believable support beneath it.

## 7. Connect chimney, stove, and floors physically

The stove body, door, handle, collar, flue pipe, chimney sleeve, and masonry stack must form one continuous assembly. Floors should meet walls, leave the stairwell open, and use a distinct finished surface above structural slabs.

## 8. Finish with editable groups

Retain meaningful groups for masonry, timber, plaster, windows, doors, roof, chimney, stove, stairs, furniture, and architectural details. Avoid merging the entire building into one mesh.

## 9. Add camera directors

Every completed building should include at least:

- one exterior three-quarter view;
- one primary interior view;
- one view for every separate floor or cellar;
- optional detail views for unusual construction.

Name cameras by location or purpose, not `Camera 1` once the view is known.

For a player view, place a joint at eye height and choose **Player Camera on Joint**. The camera stores its direction and offset relative to that joint, follows joint translation and rotation, and hides camera/bone helpers while active.

## 10. Make a separate game copy

Keep the editable grouped building as the source model. **Game Optimize Copy** simplifies only dense geometry, bakes the material set into an atlas, merges the visible result to one game mesh, reports mesh/triangle counts before and after, and downloads a separate `.modelerproj`.

Use **Pixel PNG** from an isometric or saved camera to create a low-resolution, color-quantized sprite with optional transparency. This is a render export; it does not destructively voxelize the source geometry.

## 11. Visual QA checklist

- No missing wall or roof surfaces from any standard view.
- Corners are closed and masonry has visible mortar behind gaps.
- Glass is transparent, leadwork is opaque, and windows are viewable from both sides.
- Roof rafters sit beneath the roof skin and do not collide with chimneys.
- Stove and flue connect continuously.
- Stairs reach the intended floor opening.
- Interior cameras do not begin inside a wall, beam, or marker.
- Texture scale and orientation remain consistent across related parts.
