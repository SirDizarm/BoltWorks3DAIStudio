# BoltWorks mesh test codes

This protocol gives every manual "do this" sequence a short, stable code. It is shared by the user and AI so a result can be reported without repeating the complete recipe.

## Code format

`M01#D` means **Mesh test 01, completed through step D**.

- `M01` identifies the complete test recipe.
- `#A`, `#B`, `#C` and so on identify the last completed step.
- `M01 OK` means the complete recipe passed.
- `M01#C FEL` means the problem appeared at step C.
- Add one or more result tags when useful: `GEO`, `UV`, `UV-DENSITY`, `SEL`, `UNDO`, `CRASH`.

Examples:

- `M01#D` — I completed all four steps.
- `M01 OK` — the complete test behaved as expected.
- `M01#D FEL UV` — geometry was created, but the texture or UV coordinates broke at D.
- `M01#B FEL SEL` — selection failed at B.
- `M01 DELVIS UV-DENSITY` — the tool worked, but the texture scale changed on new faces.
- `M03R1#D` — correction retest 1 for test M03, completed through step D.

The AI must include a test code whenever it gives a new manual test recipe. Codes are never reused for a different recipe. If a recipe changes materially, assign a new number.

An `R` suffix identifies a correction retest without changing the original recipe: `M03R1`, `M03R2`, and so on. The failed original result remains recorded.

## Who decides whether a test passed

The user is never expected to know whether the visible result is technically correct. Every test recipe issued by the AI must include:

1. The lettered actions to perform.
2. A plain-language **Expected result** describing the correct geometry, selection and texture behavior.
3. Any visual detail that must not happen, such as missing faces, stretched UVs, a lost selection or changes to untouched geometry.

After performing the steps, the user only needs to report the last completed code, for example `M02#D`, and attach a screenshot or describe what is visible. The AI compares that evidence with the expected result and assigns `OK`, `DELVIS` or `FEL`. The user may still add `FEL:` when something obviously looks wrong, but does not need to diagnose it.

When the AI reports `FEL`, it must state both:

- **Expected:** what the tool should have produced.
- **Observed:** what the evidence shows instead.

## M01 — Extrude Region with texture

Test project: `samples/showcases/uv-topology-test.modelerproj`

- `M01#A` — Activate **Whole Face**.
- `M01#B` — Select one flat face on the large textured block.
- `M01#C` — Activate **Exact Value** and enter `1` in **Distance**.
- `M01#D` — Click **Extrude Region**.

Expected result:

- The selected surface is extruded by one unit.
- Existing faces retain their previous UV mapping.
- New cap and wall faces contain the diagnostic texture instead of becoming blank.
- The new cap stays selected.
- A repeated full grid on each new wall is currently accepted but should be reported as `UV-DENSITY` if its visual scale is undesirable.

Observed 2026-07-23: `M01#D OK GEO`, `OK UV`, `NOTE UV-DENSITY`.

## Reserved test families

- `M02` — Inset Face with texture.
- `M03` — Edge Bevel with texture and adjacent corners. Original result: `M03#D FEL UV`; the bevel cap received collapsed UVs and rendered as a white strip. Correction retest: `M03R1`.
- `M04` — Subdivide Surface with texture.
- `M05` — Loop Cut / Ring Cut with texture.
- `M06` — Edge Slide with texture.
- `M07` — Pull, Push, Soft Pull and Soft Push with texture. Original Pull result: `M07#D FEL UV`; the detached extrusion lost the source texture. Pull and Push were corrected to use the connected, UV-preserving region extrusion in v49.2.5. Correction retest: `M07R1`.
- `M08` — Weld Vertices with center, first-selected and last-selected placement, retained UVs, remaining selection and Undo. First/last validation passed after v49.3.1. The v49.3.2 symmetry correction was manually confirmed for center, first and last placement on 2026-07-24: `M08R2 OK GEO UV SEL`.
- `M09` — Dissolve Edge or Vertex. Edge mode hides one flat internal modeling edge while retaining the renderer triangle and UVs. Vertex mode removes one internal same-material manifold vertex, fills its closed one-ring boundary, preserves a closed mesh and supports Undo.
- `M10` — Live Mirror / Symmetry with a non-selectable preview, live plane updates, editable Apply result and Undo restoration. Manually confirmed on 2026-07-24: `M10 OK GEO SEL`.
- `M11` — Scale Selected Surface with retained UVs, active surface selection, one-axis scaling and Undo. Manually confirmed on 2026-07-25: `M11 OK GEO UV SEL UNDO`.
- `M12` — Smooth / Relax Vertices with neighboring-surface relaxation, silhouette smoothing, retained UVs, active vertex selection, open-boundary protection and Undo. Original result: `M12#C FEL GEO/AXIS`; a vertex moved along Y was not relaxed and gizmo arrows overlapping the mesh were hard to pick. `M12R1` exposed that Y is end-on and therefore not draggable in Top view. `M12R2` passed in v49.8.2 using the synchronized FRONT/SIDE arrows; repeated Relax operations softened the selected surface correctly.
- `M13` — Knife / Plane Cut with a two-click viewport stroke, exact local-axis plane placement, optional side removal and planar capping. Manually confirmed in v49.9.0 on 2026-07-26: `M13#B OK GEO UV SEL`, `M13#D OK GEO UV DEPTH`, and `M13#F OK GEO UV CAP`.
- `M14` — Bridge Edge Loops between two equal-count open boundary loops inside one textured mesh, with automatic loop tracing, minimum-twist pairing, retained UVs, selected bridge edges and Undo. Deterministic manifold and UV regression confirmed in v49.10.2.
- `M15` — Recalculate Outside and Flip Selected Faces repair or deliberately reverse triangle winding while retaining per-corner UV data. Deterministic closed-mesh, outward-volume and UV regression confirmed in v49.10.2.
- `M16` — Find and Repair Holes detects true boundary loops, highlights each opening, frames it, and closes selected or all safe holes inside the same mesh with retained surrounding material. Auto UV inherits a coplanar neighbor's texture scale and alignment when possible, otherwise uses a stable world-plane fallback. Projection supplies an explicit new orientation. Deterministic manifold, UV-continuity, material and safety regression confirmed in v49.13.1.
- `M17` — Delete intent separation between complete scene models and selected Triangle or Whole Face topology.
- `M18` — Selected Face UV rotates or flips repaired and existing textured surfaces after the geometry edit.

### M09 — Dissolve Edge or Vertex

Test project: `samples/showcases/uv-topology-test.modelerproj`

- `M09#A` — Reload the untouched test project and activate **Whole Face**.
- `M09#B` — Select the large block's top face, set **Subdivide Surface** to level `1`, then click **Subdivide Selected** once.
- `M09#C` — Click **Camera Controls** in the main toolbar, then click **Top**. In Surface Edit, keep **Show Modeling Edges** checked. Activate **Edge** and select exactly one new internal cyan line inside the subdivided top surface. Do not select the square's outside outline.
- `M09#D` — Click **Dissolve Selected** under **Dissolve Edge or Vertex**. If the viewport says **Dissolve blocked**, keep Edge active and select a line farther inside the top surface before clicking again.

Expected result after `M09#D`:

- The active topology is visible as subtle cyan modeling edges and the selected edge is yellow.
- After a successful Dissolve, only the selected internal modeling edge disappears from the cyan overlay.

- The viewport says `DISSOLVE COMPLETE: 1 modeling edge removed. Shape and texture stay unchanged; Undo is ready.`
- The block keeps exactly the same outer shape and remains closed.
- The diagnostic texture remains visible without white, blank or stretched regions.
- The dissolved internal edge is no longer available as a modeling edge; renderer triangles are intentionally retained, so no visible hole or dramatic shape change is expected.
- The edge selection clears and **Undo** becomes available.
- Outer edges, the small comparison cube and the display stage do not move or change.

- `M09#E` — Click **Undo** once, activate **Vertex**, and select exactly one new vertex strictly inside the subdivided top surface. Do not select an original outside corner.
- `M09#F` — Click **Dissolve Selected** again.

Expected result after `M09#F`:

- The selected internal vertex disappears and its surrounding surface is re-triangulated without a hole.
- The block remains closed and its outer silhouette is unchanged.
- The diagnostic texture remains present without white or blank triangles.
- The vertex selection clears and **Undo** becomes available.
- Untouched objects and geometry remain unchanged.

### M10 — Live Mirror / Symmetry

Test project: `samples/showcases/uv-topology-test.modelerproj`

- `M10#A` — Reload the untouched test project. In the scene list, check only **EDIT ME - Textured topology block**.
- `M10#B` — Open **Model Tools**. Set **Sym** to `X`, enter `3` in **Plane**, then click **Live Mirror**.
- `M10#C` — Change **Plane** to `4`. Confirm that only the preview moves and that the source block stays in place.
- `M10#D` — Try clicking the preview in the viewport. It must not become selected. Then click **Apply Live Mirror**.
- `M10#E` — Confirm that the scene list now contains a second independent mirrored block. Select and move that new block slightly with **Move**.
- `M10#F` — Click **Undo** once.

Expected result:

- Before Apply, the scene list still contains only the original three project objects; the mirrored block is a non-selectable preview rather than a real scene object.
- Changing **Plane** updates the preview immediately without moving or deforming the source.
- The preview has the opposite left/right geometry and texture direction across the selected X plane. It must not become white, blank or lose its diagnostic grid.
- **Apply Live Mirror** replaces the preview with one independent editable mirrored mesh and disables Live Mirror on the source.
- The applied copy can be selected and moved without moving the original.
- **Undo** removes the applied copy and restores one source plus its live preview at the saved symmetry plane.
- The display stage, small comparison cube and all untouched geometry remain unchanged.

### M11 — Scale Selected Surface

Test project: `samples/showcases/uv-topology-test.modelerproj`

- `M11#A` — Reload the untouched test project, activate **Whole Face**, and select the large textured block's top face.
- `M11#B` — Open **Scale Selected Surface**, choose **Uniform**, enter `70` in **Size %**, and click **Scale Selected**.
- `M11#C` — Without changing the selection, enter `120` and click **Scale Selected** again.
- `M11#D` — Click **Undo** twice to return to the untouched block.
- `M11#E` — Select one vertical side face, choose its horizontal world axis (`X` or `Z`), enter `60`, and click **Scale Selected**.

Expected result:

- At `M11#B`, only the selected top surface becomes smaller around its own center. The neighboring side surfaces taper cleanly toward it; the opposite face does not move.
- The diagnostic texture remains attached to every edited triangle. No white, blank, missing, or detached surface may appear.
- The same top surface remains selected after scaling, so `M11#C` enlarges that surface again without requiring a new click.
- Two Undo operations restore the original rectangular block and clear the temporary edits.
- At `M11#E`, only the chosen world-space dimension changes. The other two dimensions of the selected side remain unchanged.
- The mesh remains closed, and the display stage, comparison cube, other faces, and object transform do not move unexpectedly.

### M12 — Smooth / Relax Vertices

Test project: `samples/showcases/uv-topology-test.modelerproj`

- `M12#A` — Reload the untouched test project. Activate **Whole Face**, select the large textured block's top face, set **Subdivide Surface** to level `1`, and click **Subdivide Selected** once.
- `M12#B` — Activate **Vertex** and select one or several new vertices strictly inside the subdivided top surface. Do not select the outer outline. If the surface is already perfectly even, move one selected vertex slightly with a surface movement arrow first.
- `M12#C` — Open **Smooth / Relax Vertices**. Choose **Relax Surface**, set **Strength %** to `50`, **Iterations** to `2`, keep **Preserve open boundaries** checked, and click **Relax Selected Vertices**.
- `M12#D` — Click **Undo** once. Re-select one corner vertex on the large block, choose **Smooth Shape**, set **Strength %** to `50` and **Iterations** to `1`, then click **Relax Selected Vertices**.

Expected result:

- At `M12#C`, the selected internal vertices move toward an even spacing with their connected neighbors. The top stays broadly flat and stable instead of inflating or collapsing.
- The diagnostic texture remains attached to every edited triangle. No white, blank, missing, detached, or newly stretched patch may appear.
- The edited vertices remain selected after each successful operation, and the object transform and untouched objects do not move.
- **Preserve open boundaries** prevents an open mesh outline from shrinking; the closed test block remains closed without holes or duplicate faces.
- Undo restores the geometry from immediately before Relax.
- At `M12#D`, the selected corner moves inward toward its neighbors and visibly softens that part of the silhouette. **Smooth Shape** may change the outline; **Relax Surface** should primarily redistribute spacing along the existing surface.

### M12R1 — Relax correction and surface-arrow picking

Test project: `samples/showcases/uv-topology-test.modelerproj`

- `M12R1#A` — Reload the untouched test project. Activate **Whole Face**, select the large textured block's top face, set **Subdivide Surface** to level `1`, and click **Subdivide Selected** once.
- `M12R1#B` — Open **Camera Controls** and choose **Top**. Activate **Vertex** and select exactly one new vertex strictly inside the subdivided top surface. Do not select an outside corner.
- `M12R1#C` — Keep **Mouse Drag** active, set **Axis** to `Y`, click **Show Move Arrow** if needed, then drag the single green arrow upward by a clearly visible but small amount. Release the mouse button completely.
- `M12R1#D` — Open **Smooth / Relax Vertices**. Choose **Relax Surface**, set **Strength %** to `50`, **Iterations** to `2`, keep **Preserve open boundaries** checked, and click **Relax Selected Vertices** once.
- `M12R1#E` — Set **Axis** to `Free`. Orbit to an angled view like the reference screenshot and briefly drag the red X arrow, then Undo. Briefly drag the blue Z arrow, then Undo.

Expected result:

- At `M12R1#C`, only the selected internal vertex rises along world Y and the pointer releases normally.
- At `M12R1#D`, that raised vertex moves visibly back down toward the surrounding top surface. The original upward deformation must not remain unchanged, and clicking Relax must not continue or replay the previous drag.
- The vertex stays selected and the diagnostic texture stays attached. No white, blank, missing, detached or newly stretched triangle may appear.
- At `M12R1#E`, each visible red or blue arrow can be hovered and grabbed even where it visually overlaps the mesh. The mesh must not steal that click from the arrow.
- The red arrow moves only world X, the blue arrow moves only world Z, and Undo restores each brief test movement. The green Y arrow remains independently usable.
- The block remains closed; the display stage, comparison cube, object transform and untouched geometry remain unchanged.

### M12R2 — Reference-view axis control

Test project: `samples/showcases/uv-topology-test.modelerproj`

- `M12R2#A` — Reload the project, activate **Whole Face**, select the large block's top face, and run **Subdivide Selected** at level `1` once.
- `M12R2#B` — Choose **Camera Controls > Top**, activate **Vertex**, and select exactly one internal top vertex.
- `M12R2#C` — Keep **Mouse Drag** active and lock **Axis** to `Y`. In the `SIDE: Z / Y` reference viewport, drag the green Y arrow upward a clearly visible but small amount, then release it.
- `M12R2#D` — Run **Relax Selected Vertices** with **Relax Surface**, strength `50%`, `2` iterations, and **Preserve open boundaries** enabled.

Expected result:

- The main Top view may show Y end-on as a point, but the synchronized SIDE viewport shows a vertical green Y arrow at the same selected vertex.
- Dragging that SIDE arrow moves the selected vertex only along world Y in every viewport; it does not move a bone or orbit the camera.
- Releasing the pointer ends the drag. Relax then moves the raised vertex visibly back toward the surrounding top surface.
- The selected vertex and diagnostic texture remain intact, Undo works, and no white, missing, or detached face appears.

### M13 — Knife / Plane Cut

Test project: `samples/showcases/uv-topology-test.modelerproj`

- `M13#A` — Reload the untouched test project. Select the large **EDIT ME - Textured topology block** with an ordinary object click or its scene-tree row. Open **Surface Edit > Knife / Plane Cut**.
- `M13#B` — Under **Plane Cut**, choose axis `Y`, position `50%`, and **Keep Both Sides**. Click **Apply Plane Cut** once.
- `M13#C` — Confirm the new yellow selected cut edges form one continuous horizontal ring halfway through the large block. Click **Undo** once and verify the untouched block returns.
- `M13#D` — Choose **Camera Controls > Front**. In **Knife / Plane Cut**, leave **Cut through the whole mesh** unchecked and click **Knife: Two Clicks**. On the large block's visible front face, click once near the upper-left inside corner and once near the lower-right inside corner. Do not click the black outer border.
- `M13#E` — Confirm a diagonal cut follows only the drawn segment, the new cut edges stay selected, and the button remains active for another stroke. Click **Knife: Two Clicks** again to release the tool completely, then click **Undo** once.
- `M13#F` — Select the large block again. Set Plane axis `X`, position `50%`, result **Keep Positive Side**, and enable **Cap removed side**. Click **Apply Plane Cut** once.

Expected result:

- At `M13#B`, the mesh silhouette does not change. A real connected edge ring is inserted at local Y 50%, and only those new edges are selected.
- The diagnostic texture remains attached on both sides of every cut. No white, blank, missing, flipped, detached, or newly collapsed texture patch may appear.
- At `M13#D`, the red guide runs between the two clicks and becomes a real diagonal topology cut when the second point is placed. With **Cut through** disabled, the cut must not continue beyond the chosen segment or appear on the hidden rear surface.
- Releasing the Knife button removes its guide and prevents later clicks from creating another cut until the button is activated again.
- At `M13#F`, only the positive-X half remains. The exposed cut is closed by a planar textured cap rather than a hole or white surface.
- Every operation supports one-step Undo, leaves the smaller reference cube and display stage unchanged, and does not create detached pieces or non-manifold openings.

### M14 — Bridge Edge Loops

Automated fixture: two separate UV-mapped cube shells inside one mesh, facing each other across a gap. Each shell has one four-corner boundary opening.

- `M14#A` — The regression locates exactly two separate four-vertex boundary loops and chooses one edge from each loop.
- `M14#B` — Run **Bridge Selected Loops** once.
- `M14#C` — Inspect the resulting topology and UV attributes, then run one Undo.

Expected result:

- At `M14#B`, the two square openings are connected by four new walls. No separate object is created.
- The tool automatically traces both complete boundary loops even though only one edge per loop was selected.
- The new bridge walls retain usable UV coordinates rather than becoming white or blank. Existing faces keep their previous UV coordinates.
- Four new longitudinal bridge edges remain selected in yellow. The viewport status reports four quads and eight new triangles.
- The result has no crack, missing triangle, twisted crossing wall, detached panel, or non-manifold overlap.
- Every resulting topology edge is shared by exactly two triangles, proving that the joined result is closed and manifold.
- At `M14#C`, one Undo removes the bridge walls and restores both separate open shells.

Important: deleting the front and back faces of one closed cube does not create a valid Bridge test. Its remaining side walls already connect the two loops, so another bridge would duplicate those walls and correctly be rejected as non-manifold.

### M15 — Recalculate / Flip Normals

Automated fixture: a closed UV-mapped cube with one deliberately reversed triangle.

- `M15#A` — Run **Recalculate Outside** on the damaged cube.
- `M15#B` — Confirm every shared edge now has opposite traversal on its two triangles and the closed component has positive signed volume.
- `M15#C` — On a fresh UV-mapped cube, select one triangle or whole face and run **Flip Selected Faces**.
- `M15#D` — Inspect the selected triangle winding and its UV corners, then run Undo.

Expected result:

- At `M15#A`, inconsistent neighboring winding is repaired and the closed component points outward. Open components are made internally consistent without inventing an unsupported outside direction.
- UV count and per-corner UV association remain intact; no face becomes white because of the repair.
- At `M15#C`, only the selected triangle winding is reversed. Its second and third position corners and UV corners swap together.
- Both operations are one-step undoable and reject non-manifold or non-orientable input rather than silently damaging it.

### M16 — Find and Repair Holes

Automated fixture: one UV-mapped cube with its top face removed, leaving one four-vertex boundary loop.

- `M16#A` — Select the open mesh and click **Find Holes**.
- `M16#B` — Confirm the blue guide traces the complete opening and the panel reports `Hole 1 of 1 — 4 boundary vertices`.
- `M16#C` — Leave **UV projection** at Auto, click **Frame Selected**, then **Repair Selected**.
- `M16#D` — Run **Find Holes** again, inspect the repaired surface and click Undo once.

Expected result:

- Exactly one true hole is found. Internal triangulation lines and ordinary sharp creases are not reported as holes.
- Frame Selected centers the camera on the blue boundary without moving the mesh.
- Repair Selected adds two cap triangles to the original mesh; it does not create a separate patch object.
- The repaired cube has no remaining boundary edges and every topology edge is shared by exactly two triangles.
- Every new triangle has usable UV coordinates and uses the most common material touching the repaired boundary. When a coplanar textured triangle remains beside the hole, Auto extends its affine UV mapping across the cap, preserving the same texture scale, direction, and seam alignment. When the complete top face is missing and no coplanar reference remains, Auto maps world X/Z rather than an arbitrary diagonal, so the texture is not rotated 45°. Projection X/Y/Z may be chosen before repairing to force a new mapping; final orientation is adjusted afterward with Selected Face UV. Existing UV corners and materials remain unchanged.
- Strongly twisted, self-intersecting, degenerate, or non-manifold candidates are refused without changing geometry or consuming Undo.
- One Undo restores the original open cube and its hole.

### M16R1 — Triangulated face UV continuity

Test project: `samples/showcases/uv-topology-test.modelerproj`

- `M16R1#A` — Reload the untouched project. Choose **Triangle**, select exactly one triangle on a textured square face of the large block, and click **Delete Selected Face**.
- `M16R1#B` — Select the large block as an object, expand **Find and Repair Holes**, leave **UV projection** at **Auto**, click **Find Holes**, then **Repair Selected**.
- `M16R1#C` — Deselect the result and inspect the repaired square from a straight and angled camera view.

Expected result:

- The missing triangle is restored inside the same mesh and the opening is closed.
- The repaired triangle continues the neighboring triangle's exact UV scale, direction, and alignment. Grid cells and lines cross the internal diagonal without changing size, rotating, jumping, or forming a separate normalized UV island.
- Existing triangles and UV corners remain unchanged. The repaired triangle uses the surrounding material and does not become white or blank.
- Choosing explicit X, Y, or Z instead of Auto deliberately creates a new planar mapping and therefore bypasses neighboring UV inheritance.
- One Undo restores the single-triangle opening.

### M17 — Delete Selected Model / Face

Test project: `samples/showcases/uv-topology-test.modelerproj`

- `M17#A` — Select the small textured reference cube as an ordinary scene model and click **Delete Selected Model** beside Undo.
- `M17#B` — Click Undo, open **Surface Edit**, choose **Whole Face**, select one flat face on the small cube, and click **Delete Selected Face**.
- `M17#C` — Click Undo once.

Expected result:

- At `M17#A`, the complete small cube is removed. The larger topology block and display stage remain unchanged.
- **Delete Selected Face** stays disabled in Vertex and Edge modes and whenever no Triangle or Whole Face is selected.
- At `M17#B`, only the selected surface triangles are removed, intentionally creating an opening while the rest of the cube remains in the scene.
- At `M17#C`, the deleted face, its texture coordinates, and its material return in one Undo.

### M18 — Selected Face UV

Test project: `samples/showcases/uv-topology-test.modelerproj`, preferably after completing M16 repair.

- `M18#A` — Open **Surface Edit**, choose **Whole Face**, and select the repaired textured surface.
- `M18#B` — Expand **Selected Face UV** and click **Rotate UV Right 90°**.
- `M18#C` — Click **Flip UV Horizontal**, inspect adjacent faces, then click Undo twice.

Expected result:

- Rotation and flipping happen after the hole has already been repaired, so the visible result can guide the choice.
- Only UV corners belonging to the selected Triangle or Whole Face change. Geometry, material, and neighboring surface UVs remain unchanged.
- The selection remains active after each UV action, allowing repeated 90-degree turns without reselecting the surface.
- Two Undo actions restore the original repaired UV orientation in reverse order.

### M19 — Non-manifold Check

Test project: `samples/showcases/uv-topology-test.modelerproj`

- `M19#A` — Reload the untouched project. Select the small textured reference cube as an ordinary model. Expand **Surface Edit > Non-manifold Check** and click **Check Selected Mesh**.
- `M19#B` — Confirm the panel reports a closed manifold mesh with 0 issues and that neither the model nor its texture changes.
- `M19#C` — Choose **Triangle**, select exactly one triangle on the small cube, and click **Delete Selected Face**. Select the cube again as a model and click **Check Selected Mesh**.
- `M19#D` — Confirm the report finds 3 open boundary edges. Use **Next**, **Previous**, and **Frame Issue** and verify the orange guide moves between the three sides of the triangular opening.
- `M19#E` — Click **Clear Report**, then Undo once and run **Check Selected Mesh** again.

Expected result:

- The untouched cube reports 12 triangles, 8 welded vertices, 0 open edges, and 0 topology issues.
- Removing one triangle reports exactly 3 open boundary edges; ordinary triangulation diagonals are not reported.
- Next and Previous cycle only through real reported issues. Frame Issue centers the camera without moving the mesh.
- Clear Report removes the viewport guide without changing geometry or consuming Undo.
- After Undo restores the triangle, the same cube reports closed and manifold again.
- The automated regression also verifies detection of an edge shared by three triangles and a vertex joining two disconnected surface fans.
- The diagnostic is read-only: positions, UVs, materials, object count, selection, and Undo history remain unchanged.

### M20 — Remove Doubles

Test project: `samples/showcases/uv-topology-test.modelerproj`

- `M20#A` — Reload the untouched project, select the small textured reference cube as an ordinary model, expand **Surface Edit > Remove Doubles**, keep Tolerance at `0.001`, and click **Analyze Doubles**.
- `M20#B` — Confirm the report says no separate nearby vertices were found and **Remove Analyzed Doubles** remains disabled.
- `M20#C` — On any edited mesh with two accidentally overlapping or nearly overlapping vertices, select the model, set a tolerance just large enough to include the gap, and click **Analyze Doubles**.
- `M20#D` — Read the candidate, cluster, and triangle counts in Status. If the analysis says the result is safe, click **Remove Analyzed Doubles** once and then Undo once.

Expected result:

- The untouched textured cube reports 0 doubles. Its repeated non-indexed corners are intentional UV/material seams and are not falsely merged.
- Analyze Doubles never changes geometry or consumes Undo.
- A safe result snaps each nearby cluster to its average position, removes only triangles that become degenerate or exact duplicates, and preserves UVs, colors, skin data, and materials per triangle corner.
- A merge that would open a previously closed mesh or create an edge shared by more than two triangles is refused.
- Changing Tolerance invalidates the old analysis and requires Analyze Doubles again.
- Undo restores the exact pre-merge geometry.
- The automated regression covers a textured two-triangle seam, verifies two logical vertex merges with UV/material preservation, verifies no result below tolerance, and rejects a three-triangle non-manifold merge.

### M21 — Mesh Statistics

Test project: `samples/showcases/uv-topology-test.modelerproj`

- `M21#A` — Reload the untouched project, select the small textured reference cube as an ordinary model, expand **Surface Edit > Mesh Statistics**, and click **Calculate Statistics**.
- `M21#B` — Confirm the report lists 12 triangles, 8 welded positions, 18 unique triangulated edges, 0 boundary edges, a closed manifold result, at least one UV channel, and non-zero geometry memory.
- `M21#C` — Click **Copy Report**, paste it into a text field, and confirm the complete human/AI-readable report was copied.
- `M21#D` — Choose **Triangle**, delete one triangle from the cube, select the cube as a model again, and recalculate.
- `M21#E` — Confirm the new report has 11 triangles, 3 boundary edges, topology marked for inspection, and closed volume reported as unavailable. Undo once.

Expected result:

- Calculate Statistics is read-only: geometry, UVs, materials, selection, object count, and Undo history remain unchanged.
- Local and transformed world dimensions are shown in studs; world dimensions are also converted using `1 stud = 0.28 meters`.
- Surface area is measured after the object transform. Volume is shown only for closed manifold geometry with consistent winding.
- GPU position vertices, triangle corners, welded positions, material slots, textures, estimated draw calls, UV channels, skin attributes, and approximate geometry-buffer memory are distinguished rather than combined into one misleading vertex count.
- Copy Report creates plain text suitable for a person or AI without changing the scene.
- The automated regression verifies an indexed scaled cube and an open textured cube independently.

### M22 — Protected Decimate

Use a dense textured mesh rather than the 12-triangle reference cube. A subdivided curved object makes the reduction easiest to see.

- `M22#A` — Select one dense editable model. Expand **Surface Edit > Protected Decimate**, keep Reduction at `35`, Feature angle at `35`, and leave all three protection options checked.
- `M22#B` — Click **Analyze Decimation**. Read the exact before, target, achievable, protected-edge, and protected-vertex result in Status. Confirm the model has not changed.
- `M22#C` — If **Apply Safe Decimation** is enabled, click it once. Inspect the silhouette, open borders, texture seams, and material borders, then click Undo once.
- `M22#D` — If analysis says every edge is protected, test a denser smooth mesh or deliberately disable only the protection you are willing to relax and analyze again.

### M23 — LOD Generator

Use **Faceted Ball 320** or another dense textured model. The 12-triangle reference cube is intentionally too small and too protected for a useful three-level LOD set.

- `M23#A` — Select one dense editable model. Expand **Surface Edit > LOD Generator** and keep the safe defaults: LOD1 `10%`, LOD2 `25%`, LOD3 `65%`, Feature angle `35`, all protection options checked, and **Hide generated levels** checked.
- `M23#B` — Click **Analyze LOD Set**. Expected: Status says `4 models total`, identifies LOD0 as `Original` and LOD1–LOD3 as `Preview`, and lists four strictly descending triangle counts. The scene tree and visible model must not change.
- `M23#C` — Click **Generate LOD Set** once. Expected: one named `LOD Set` group contains the unchanged visible source renamed `LOD0` plus separate `LOD1`, `LOD2`, and `LOD3` models. Generated levels are hidden, their triangle counts descend, and their texture/material appearance is retained.
- `M23#D` — In the scene tree, hide LOD0 and show one generated level at a time. Expected: each is a complete lighter version in exactly the same transform, without duplicated visible levels or z-fighting. Click Undo once; the complete generated set must disappear and the source name/group/metadata must return to its pre-generation state.
- `M23#E` — Generate the set again, select LOD3 in the scene tree, and click **Files & Output > Export Selected OBJ**. Expected: one OBJ named from the project and selected LOD downloads, the status log identifies LOD3 and its triangle count, and no other LOD level is included.

Expected result:

- Analyze is read-only and consumes no Undo entry.
- Apply reduces the triangle count inside the original mesh; it does not create a replacement scene object.
- Open boundaries, sharp features above Feature angle, UV seams, and material borders remain fixed when their protections are enabled.
- UV, color, skin, and material attributes remain attached per triangle corner on all surviving triangles.
- Closed meshes remain closed, non-manifold results and flipped triangles are rejected, and Undo restores the exact source geometry.
- The requested reduction is a goal rather than a promise: BWS reports the safely achievable amount under the active protections.

### M24 â€” UV Unwrap / Texture Atlas

Test project: `samples/showcases/uv-topology-test.modelerproj`

- `M24#A` â€” Reload the untouched project, select the large textured topology block as an ordinary model, expand **Surface Edit > UV Unwrap / Texture Atlas**, keep Seam angle `45`, Island padding `2`, Atlas size `1024`, and click **Analyze UV Layout**.
- `M24#B` â€” Confirm Status reports 12 triangles packed into 6 non-overlapping islands. The visible model and scene tree must remain unchanged.
- `M24#C` â€” Keep the default **Original Texture (Mesh Details)**. Confirm the panel says `1 PNG will be saved`, click **Export 1 Selected PNG**, and verify the downloaded PNG exactly matches the single unchanged A1â€“D4 image in Mesh Details, with no six-island UV packing. Then select **UV Guide Only** and verify a transparent 1024 x 1024 painting guide downloads with six separated, brightly color-coded rectangular face islands and visible triangle lines.
- `M24#D` â€” Click **Bake Texture Atlas**. Confirm the block keeps its six correctly oriented A1â€“D4 textures while receiving a new atlas texture and UV layout. Select **Baked UV Atlas Only** and verify its exported PNG contains the six deliberately packed texture faces. **Original Texture (Mesh Details)** must still export the unchanged single source image after baking. The optional **All 3 PNG Files** choice must explicitly report and save 3 PNG files. Click Undo once.
- `M24#E` â€” Analyze again and click **Apply UV Unwrap** instead. Confirm geometry and triangle count stay unchanged while only the UV layout changes; the old texture is allowed to look rearranged because no pixels were baked. Click Undo once.

Expected result:

- Analyze and all PNG exports are read-only and consume no Undo entry. Original Texture matches Mesh Details without UV packing; UV Guide exports topology lines; Baked UV Atlas exports deliberately repacked surface pixels.
- Sharp edges above Seam angle and material borders create separate UV islands; connected flatter triangles remain together.
- Every generated UV coordinate is finite, inside 0â€“1, and packed into a non-overlapping island cell with the requested padding.
- Bake moves the source texture pixels into the new atlas before applying the new UVs, preserving visible texture placement on a single-material mesh.
- Apply changes UV coordinates only. Model positions, triangle count, object transforms, and scene hierarchy remain unchanged.
- Apply and Bake each use one Undo step. The automated regression verifies a 12-triangle cube becomes six separated islands without mutating its source geometry.

### M25 - Texture / Material Paint Core

Test project: `samples/showcases/uv-topology-test.modelerproj`

- `M25#A` - Select the large textured topology block and click **Edit Texture**. Choose **Paint**, set a visible color, Brush Size `40`, Hardness `80`, and Opacity `100`. Draw one stroke inside a UV face.
- `M25#B` - Choose **Eraser** and erase part of that stroke. Click **Undo Paint** once and confirm only the erasing is reverted; click it again and confirm the original texture returns.
- `M25#C` - Choose **Eyedropper**, click a colored square, and confirm Brush Color changes to the sampled color. Eyedropper must not add an Undo step.
- `M25#D` - Choose **Fill UV Island**, click one cube-face island, and confirm only that connected UV island receives the chosen color. Click Undo Paint once.
- `M25#E` - Before reopening the editor, select one face in Surface Edit. In the editor enable **Mask to selected faces**, paint across the selected-face boundary, and confirm pixels change only inside the selected surface UVs.
- `M25#F` - Click **Apply Texture**, save and reload the project, and confirm the edited PNG texture remains on the model. Use the main Undo button once to restore the texture from before Apply.

### M25R1 - Texture Paint Workflow

- `M25R1#A` - Open **Edit Texture** and confirm Pen, Brush, Spray, Eraser, Eyedropper, Fill UV Island, Pan, and Glass Hammer are visible buttons. Select each one and confirm only that button remains active.
- `M25R1#B` - Change Size and confirm Tool Preview changes before painting. Brush must use a brush cursor rather than a magnifying-glass cursor.
- `M25R1#C` - Zoom with the `-`, percentage, and `+` controls and the mouse wheel. Select Pan and drag the enlarged texture without painting it.
- `M25R1#D` - Paint a stroke, close the editor without applying, reopen the same mesh, then use Undo Paint and Restore Original. Both must still reach the state from before the editor was first opened.

### M25R2 - Persistent Original Texture

- `M25R2#A` - Paint on a texture, close the editor without Apply, reopen the same mesh, and click **Restore Original**. The pristine texture must return immediately; no image reload or second click should be required.
- `M25R2#B` - Click **Undo Paint** once after Restore Original. The painted draft from immediately before the restore must return.

### M25R3 - Pen and Immutable Original

- `M25R3#A` - Open **Edit Texture**, choose **Pen**, set a visible color, Size `20`, and Opacity `100`, then draw a line. Expected: a solid, hard-edged line follows the pointer immediately; it must not behave like a soft brush or leave the texture unchanged.
- `M25R3#B` - Close the editor without Apply, reopen the same mesh, and click **Restore Original** once. Expected: the complete pristine texture returns immediately even though the editor window was closed between painting and restoring.
- `M25R3#C` - Click **Undo Paint** once. Expected: the painted draft from immediately before Restore Original returns, proving Restore is one reversible editor operation.

### M25R4 - Baked Atlas Restore

- `M25R4#A` - Bake the six-face texture atlas on the large topology block, open **Edit Texture**, and make several obvious edits on different atlas islands.
- `M25R4#B` - Close the editor without Apply, reopen the same mesh, and confirm the painted atlas draft is still visible.
- `M25R4#C` - Click **Restore Original** once. Expected: every edit disappears and the freshly baked six-face atlas returns unchanged. A draft belonging to the pre-bake texture must never be reused for the atlas.
- `M25R4#D` - Click **Undo Paint** once. Expected: the complete painted atlas draft from step A returns.

### M25R5 - Applied Baked Atlas Restore

- `M25R5#A` - Bake the six-face texture atlas, open **Edit Texture**, paint an obvious change, and click **Apply Texture**.
- `M25R5#B` - Reopen **Edit Texture** and confirm the applied painted atlas is visible.
- `M25R5#C` - Click **Restore Original** once. Expected: the paint disappears and the clean baked six-face atlas returns even though the painted texture was applied and the editor was closed.
- `M25R5#D` - Click **Undo Paint** once. Expected: the applied painted atlas returns, proving Restore remains one reversible editor operation.

### M26 - Material Paint Channels

- `M26#A` - Select the large textured topology block, open **Edit Texture**, and confirm **Base Color**, **Roughness**, **Metalness**, and **Emissive** are visible at the top. Switching channels must retain each channel's separate draft.
- `M26#B` - Choose **Roughness**, paint a black stripe on the white default channel, and click **Apply Roughness**. Expected: the stripe becomes glossier while the Base Color artwork remains unchanged.
- `M26#C` - Choose **Metalness**, paint one white area on its black default channel, and click **Apply Metalness**. Expected: only the painted area becomes metallic; Base Color and Roughness remain unchanged.
- `M26#D` - Choose **Emissive**, paint a colored mark, and click **Apply Emissive**. Expected: the mark stays visibly bright independently of ordinary scene lighting.
- `M26#E` - Save and reload the project. Reopen **Edit Texture** and verify all four channels and their separate images return. Rotate or flip the mesh texture once and confirm every material channel remains aligned to the same UVs. Main Undo must restore the state from before the most recent channel apply.

Expected result:

- Paint and Eraser respect UV islands and never modify empty atlas space.
- Hardness controls edge falloff, Opacity controls paint strength, and Brush Size controls diameter.
- Fill affects one connected UV island; selected-face masking can narrow every destructive tool to the active surface selection.
- Undo Paint restores editor operations before Apply. Apply creates one normal project-level Undo snapshot and stores the resulting PNG in the project texture library.
