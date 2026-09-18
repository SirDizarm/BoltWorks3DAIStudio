# USD import consent, motions and loading status

Every USD/ZIP import asks for confirmation of asset ownership or necessary permission before reading asset data. NVIDIA terms are conditional on asset origin: USD itself is not a NVIDIA-exclusive format. The prompt links to NVIDIA licensing and sample-pack information, requires an unchecked confirmation, and explicitly grants no rights. Cancel, Escape and Back reject the import. Acceptance is not persisted.

Focused simulated-DOM checks passed for confirmation gating, cancellation, focus restoration, pointer release and input-guard lifecycle. Real-browser gameplay pointer-lock interaction has not been checked.

Imports now show an indeterminate loading indicator for USD, glTF/GLB, FBX and OBJ. Synchronous parsing can still occupy the main thread; no percentage progress is claimed.

The five Orc skeletal motion files in the ZIP's Motions folder are offered as clips at source timing. Focused source-track checks passed at start/middle/end for all clips, including local translation, rotation-equivalent quaternions and scale. Maximum transform error was 4.74e-8. Facial blend shapes are not imported. Full animation playback UI and export round trips remain unchecked.

License-audit packaging findings remain unresolved. User confirmation is not a substitute for those fixes or clarification of asset permissions. No public deployment performed.
