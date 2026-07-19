# BoltWorks AI rigging guide

This guide defines the interchange between BoltWorks 3D AI Studio and a multimodal model. It does not claim that an AI can infer a perfect rig from JSON alone.

## Input required on every pass

1. Export the editable BoltWorks scene JSON.
2. Use **Save Views** to export front, back, left, right, top, and isometric PNG images.
3. Give the model the scene JSON, all six images, and this guide URL.
4. Ask for one JSON response matching `response.schema.json`.

The images are mandatory. They reveal overlap, depth, symmetry, feet below the grid, and mistakes that are ambiguous in a raw mesh list.

## Native bone fields

Each bone has an `id`, human-readable `name`, nullable `parentId`, three-number `position`, and three-number `rotation`. The earlier BoltWorks bone importer accepts either a bare array, `{ "bones": [...] }`, `{ "rigging": { "bones": [...] } }`, or project editor rigging data.

World-space positions and radian rotations are the preferred interchange because they are least ambiguous. Parent IDs describe hierarchy; they must reference another unique bone ID or be `null`.

## Grounding

The grid is `Y = 0`. Feet must not be inferred from screen pixels alone. Add explicit contact bones such as `left-foot-contact` and `right-foot-contact` at exactly `Y = 0`, list them under `ground.contactBoneIds`, and report the check in `analysis.groundCheck`.

## Review loop

Import the returned rig, inspect it in all reference viewports, save a fresh set of views, and send those views back with correction notes. The model should move existing bones rather than silently replacing IDs between iterations.

## Current boundary

The bone editor exists in the earlier modeler implementation, while migration into the renamed main 3D repository is still incomplete. These schemas establish the stable contract for that migration; they do not yet skin meshes or generate animation weights.

## Planned Scene Capture module

Scene Capture will keep `Y = 0` as the physical ground while allowing the grid appearance to be replaced by a tileable texture or a ground model. The background will support a color, image, or scene model. Lighting presets will illuminate the model, ground, and background consistently before Save Views runs.
