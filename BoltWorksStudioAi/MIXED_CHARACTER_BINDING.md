# Mixed skin and solid character binding

Use one animation rig for deforming flesh and separate anatomical bone meshes.
Do not merge the anatomical skeleton into the skin.

1. Fit the rig in T-pose.
2. Mark the deforming body mesh as Skin & Bone.
3. Assign each solid anatomical part to its matching rig bone. Armor also uses rigid bone attachments.
4. Click Glue Bone to Model. If already glued, unglue first, then glue again.

Glue now binds the marked skin even when rigid part assignments already exist.
It preserves those assignments and captures their rest pose alongside the skin.
Rebuilding a skin runtime refreshes generated weights for the current fitted rig.

The current runtime supports one deforming skin mesh per rig. Glue reports an
error instead of silently choosing among multiple marked skins. Separate rigid
head details, nails and armor do not need to be marked as skin.

This does not automatically repair anatomical joint fitting, split finger bone
meshes, or provide authored weight painting. Inspect elbows, knees and finger
poses before exporting a playable character.
