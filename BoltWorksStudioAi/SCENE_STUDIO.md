# Scene Studio - v49.64.62

Local-first separate scene workspace with its own renderer and editable sequential recipe cards: seed, plots, paths, nature and rendering. Capture one visible static house from the modeling workspace, then generate up to 64 instanced copies with seeded scale/rotation variation. Materials and textures are preserved where supported. Basic conifer trees and low-poly rocks avoid road and house clearances. Layout is a rectangular street grid, not a general road solver. House floor-plan variation, arbitrary graph wiring and importing generated scene objects back to the model editor are not yet implemented.

Uses WebGL, standard PBR materials, directional shadows, fog and ACES tone mapping. No local server, paid service, ray tracing or external asset download is required. Save .bwscene includes the captured asset and may include private textures. PNG export uses the scene camera. Unreviewed external texture URLs are rejected on scene import.

Sources: scene-studio.js and source-composer.mjs. Browser bundle: studio-v49.64.62.js. Build synchronization only; no browser validation performed. This experimental version is not automatically pushed online.
