# USD support 50.0.40

Import now accepts binary USDC, binary .usd and USDZ containing binary layers, as well as ASCII USDA. Uses the Three.js USD reader pinned at 148ef33ecb6d2502ff796d4554abd1549c95d519; the rest of the app remains on Three.js 0.165.0. Sources are vendored under app/exporters/usd with the existing Three.js MIT license.

Select companion images and layers together with loose USD files, or use a complete USDZ. Missing/ambiguous referenced textures and image decoding failures stop import rather than silently dropping textures. Reference-layer texture loads are awaited. Scene units and up-axis are handled by the reader.

Import remains a static snapshot. This is not a complete OpenUSD or MDL implementation, and arbitrary shader graphs, composition and animation fidelity are not guaranteed. Export remains static USDZ or a USDA ZIP bundle. Existing project-save serialization may not preserve every imported PBR map; retain source files.

No new dialog or pointer-capture behavior was introduced. The existing import/export UI is retained. Actual user-file import and external application round-trip checks have not been performed.
