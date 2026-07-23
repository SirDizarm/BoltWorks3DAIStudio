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

The detailed lettered steps are added when each test is issued.
