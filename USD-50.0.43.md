# USD layered character import - 50.0.43

Added binary reference-list, string-vector and layer-offset-vector decoding; corrected encoded path counts for sparse crate path tables and inline double-vector decoding. Packaged reference and sublayer composition merges local opinions and remaps material/skeleton targets. Relative asset paths are resolved against their authoring layers. Supports st0 UVs and an explicitly approximate MDL-to-standard-material texture mapping. Cyclic layer references fail clearly. Missing external references produce visible import warnings.

Import the entire Orc.zip through Import USD, not Orc.usd alone: the browser cannot access adjacent folders automatically. The ZIP is read directly without recompressing its images during import.

Focused checks used the user-provided Orc.zip without modifying it. Browser import and rendering passed: 10 mesh parts, 20 textured material assignments, 89 decoded texture-map assignments; finite geometry, UVs on all parts and bound skins. Character dimensions approximately 2.32 x 1.81 x 1.13 metres in its rest pose. Standalone USDA, explicit reference target, relationship remapping, cycle rejection and missing-layer-warning checks passed.

Limitations: static/rest-pose application import, not animation parity. MDL shading is approximated, not executed. The archive references ../Debra/Props/Stage/LightingStage.usd, which is not included; this is omitted with a warning. This is not full OpenUSD composition: internal references, arbitrary list-op composition, variants, payloads and time-offset fidelity remain limited. No new dialogs or pointer/cursor behavior were introduced. No external DCC round-trip or public deployment was performed.
