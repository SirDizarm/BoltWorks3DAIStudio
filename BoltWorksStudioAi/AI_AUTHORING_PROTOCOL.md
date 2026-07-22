# AI authoring protocol

This document is normative. An AI creating a BoltWorks model must follow every
phase in order.

## 1. Understand the requested asset

Write a short design inventory before editing JSON:

- overall subject, scale and intended front direction;
- major masses;
- repeated or mirrored parts;
- thin directed parts such as windows, panels, wedges and roof slopes;
- materials and textures;
- functional groups;
- details that must be visible in each of the six review views.

Choose one front direction and keep it stable. BoltWorks screenshots use:

- **Front:** camera on `+Z`, looking toward `-Z`;
- **Back:** camera on `-Z`, looking toward `+Z`;
- **Left:** camera on `-X`, looking toward `+X`;
- **Right:** camera on `+X`, looking toward `-X`;
- **Top:** camera on `+Y`, looking downward;
- **Iso:** camera from positive X, Y and Z.

Object names such as `left`, `right`, `front` and `rear` must follow this view
contract, not the temporary orbit-camera angle.

## 2. Build a real project

Prefer a `.modelerproj` wrapper with:

- `kind: "modeler-project"`;
- a unique project name;
- a `scene` containing groups and objects;
- a `textureLibrary` for every embedded texture;
- editor view settings suitable for opening and review.

Use stable, descriptive IDs. Do not use names such as `box 17` in a finished
asset. Group by real component: bodywork, windows, wheels, roof, foundation,
lighting, props and so on.

Use built-in shapes whenever possible. Use custom `geometry` only when a shape
cannot be assembled cleanly from primitives.

## 3. Apply transforms deliberately

- `position`, `rotation` and `scale` are arrays in XYZ order.
- Rotation values are degrees and use Euler order XYZ.
- Position is world-space.
- Scale is applied in object-local space before rotation.
- Built-in geometry is centered on its local origin unless the shape catalogue
  explicitly says otherwise.
- Never assume a thin object faces the desired direction. Check its canonical
  depth axis in `SHAPE_CATALOG.md`.

For a mirrored pair, derive the second transform from the first. Do not eyeball
both sides independently. Mirroring a position does not always mean negating
the same rotation component; derive it from the local axis and verify both
views.

## 4. Handle textures as project data

For a portable project:

1. add each bitmap once to `textureLibrary` as a `data:image/...;base64,...`
   data URL;
2. give it a unique `name`;
3. set textured objects to `textureName` and `textureUrl: null`;
4. use `textureFlipY` and `textureRotation` per object;
5. never duplicate the same Base64 image on every object.

The studio hydrates `textureUrl` from `textureLibrary` when loading the project.
External file paths are not portable and must not be used as project textures.

## 5. Run structural inspection

Run:

```text
node BoltWorksStudioAi/tools/inspect-project.mjs MODEL.modelerproj
```

Resolve every error. Review warnings. A valid JSON file can still be visually
wrong, so this phase is necessary but not sufficient.

## 6. Render the real application

Load the file with **Load Project** in BoltWorks 3D AI Studio. Do not substitute
a generic Three.js viewer because the studio controls its own mesh builders,
texture settings, cameras and environment.

Press **QA Sheet**. It waits for scene textures and downloads one labeled 3x2
image containing Front, Back, Left, Right, Top and Iso.

## 7. Inspect the image, not the intention

Check every cell for:

- parts pointing in the wrong direction;
- mirrored rotations with the wrong sign;
- gaps, intersections, floating objects and clipping;
- asymmetry that was not requested;
- inconsistent thickness;
- z-fighting or coplanar surfaces;
- missing walls, windows, caps or back faces;
- textures that are white, stretched, rotated or absent;
- an unexpected object changing the scene bounds and making the asset tiny;
- geometry below the intended ground plane.

When an error is visible, identify the object by name and inspect its shape,
position, rotation and scale. Correct the project, reload it and generate a new
QA Sheet. Never reuse an older sheet as proof after changing the project.

## 8. Completion gate

The asset is complete only when all are true:

- the inspector reports zero errors;
- the latest project loads successfully;
- all textures appear in the latest QA Sheet;
- all six cells were reviewed;
- the asset reads correctly in silhouette and close detail;
- remaining limitations are explicitly reported.
