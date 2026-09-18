# USD support 50.0.39

Export USD offers a single-file USDZ and a ZIP containing model.usda, geometry layers and images. Both are static snapshots, including posed skins. Material groups, world placement, UVs and standard colour/normal/roughness/metallic/occlusion/emissive/opacity maps are handled. Texture dimensions are retained. Unsupported materials or unreadable textures stop export. Non-PBR materials are approximated.

Import supports a limited static triangulated ASCII USDA/USDA-based USDZ subset using USD Preview Surface. Binary USDC, MDL, animation, skeletal data, subsets, component transforms and advanced composition are rejected. This is not a full OpenUSD composition engine. Existing project-save serialization may not preserve all imported PBR maps; retain source files.

The export dialog releases pointer capture/lock, blocks gameplay recapture, supports Escape/Back and returns focus. Gameplay resumes on its existing deliberate canvas click. Native file dialogs release control and restore on selection/cancellation/focus return.

Build: npm run build:studio. Loaded bundle: studio-v50.0.39.js. External application round-trip testing has not been performed.
