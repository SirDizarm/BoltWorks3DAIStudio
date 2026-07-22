# Visual QA and AI sight

The project JSON describes intent. The rendered views reveal reality. BoltWorks
therefore uses a two-part AI review package:

1. the `.modelerproj` file for exact object data;
2. a fresh `*-qa-sheet.png` for visual evidence.

## Producing the QA Sheet

1. Open the real `index.html` or local studio.
2. Press **Load Project** and choose the latest `.modelerproj`.
3. Wait until the object count and textures are visible.
4. Set a neutral environment when geometry is the review target.
5. Press **QA Sheet**.

The studio waits for texture images before capture and creates a 1920×840
contact sheet with six labeled cells: Front, Back, Left, Right, Top and Iso.

## What each view is best at detecting

| View | Primary checks |
|---|---|
| Front (`+Z`) | width, left/right symmetry, front details, vertical alignment |
| Back (`-Z`) | missing rear geometry, mirrored details, rear texture coverage |
| Left (`-X`) | depth, roof/gable profile, wheel/window alignment |
| Right (`+X`) | opposite profile and errors hidden from Left |
| Top (`+Y`) | footprint, overlaps, off-center parts, roof seams |
| Iso (`+X,+Y,+Z`) | overall readability, intersections and assembly hierarchy |

## Mandatory review checklist

- The asset occupies a useful portion of every cell.
- No isolated object makes the automatic bounds excessively large.
- Silhouette is intentional in all six cells.
- Paired parts are actually mirrored.
- Thin shapes face outward and do not cut through the body.
- Wedges slope in the intended direction.
- No large face is missing because its object was hidden or misplaced.
- No coplanar faces shimmer or form striped z-fighting.
- Every expected texture appears and has the intended rotation.
- Ground contact and vertical placement are consistent.
- Details visible in the request are represented from the relevant side.

## Object-level diagnosis

When a defect is found:

1. describe it by view and screen location;
2. identify the likely named object or group in the project report;
3. check the shape's canonical axis;
4. compare its transform with the corresponding mirrored object;
5. make the smallest deterministic correction;
6. regenerate the QA Sheet and inspect the same view plus its opposite.

Example diagnosis:

```text
Observed: white triangle outside the roof in Left view.
Object: Rear plaster gable.
Cause: one Wedge was used for an isosceles gable.
Correction: replace it with two mirrored half-width Wedges.
Evidence: fresh Left, Right, Top and Iso cells contain no protrusion.
```

## Occluded internal parts

Six exterior views cannot prove that hidden interior components are correct.
For an asset with an interior, create additional review states by temporarily:

- hiding roof or body-shell groups;
- using group `Only` mode;
- capturing a second QA Sheet for the exposed interior;
- restoring the final visibility before saving.

Name these images clearly, for example `vehicle-exterior-qa-sheet.png` and
`vehicle-interior-qa-sheet.png`. The project file remains the canonical model.

## Evidence rule

A textual claim such as “the rotation was changed” is not completion evidence.
Completion evidence is the latest rendered view showing the corrected result.
