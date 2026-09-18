# Imported rig preservation - 50.0.44

Imported skeletons retain their native local rest transforms, scales, inverse binds and existing weights across rig fitting transitions. The native pose adapter converts editor translations through the real parent matrix, including USD unit scale. All imported skinned parts update together; setup no longer replaces the shared imported bones or regenerates weights on the primary body. Imports without clips clear stale animation channels.

Focused Orc check: actual import, restore-bind, fitting-commit and skin-pose functions executed for five cycles using 10 meshes and 101 bones. Sampled world-space vertices drifted at most 1.52e-15 metres. All original skeleton, weight, index and bind-matrix references remained intact. UI dependencies were stubbed in this check; a full interactive workspace/cursor test was not performed. No cursor/input changes were made.

USD motion clip import remains separate work: the current USD UI supplies an empty animation list. This update fixes rig preservation, not import of all files in the Motions folder. Existing damaged scenes must be reimported from the original ZIP. Public deployment not performed.
