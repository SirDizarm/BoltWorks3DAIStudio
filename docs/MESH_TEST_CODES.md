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
