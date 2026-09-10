# Node scene environment - v49.64.67

Removed procedural cone-tree and dodecahedron-rock fallback assets from Scene Studio. Tree and rock selectors now capture real built graph outputs by generated IDs, preserving their geometry and materials without changing the model scene. Missing graph outputs produce an actionable error, not a substitute. Rebuild the source graph in Modeling and reload its output to update the scene snapshot. Provenance records graph name, ID, seed, build version and recipe. A single captured output is instanced with seeded size/orientation variation; automatic per-instance graph reevaluation is not implemented.

Terrain, Path and Water are reusable Geometry Nodes source types. Their geometry builders are also used by Scene Studio. A pond is cut into Terrain and excluded from nature placement. Scene-only physical water, normal maps and environment illumination improve rendering. Paths remain sampled ribbons, not editable spline graphs. The scene composer is still a sequential recipe UI, not a fully wired graph editor. Rivers, bridges, terrain-aware road grading, true reflections/ray tracing and photograph-quality assets remain future work.

Scene format v3 retains node-generated nature snapshots and environment recipes; older saves load without placeholder nature. Save before changing project. Saved scenes include source graph metadata and any embedded textures; treat them as project data, not anonymized screenshots.

Sources scene-environment-nodes.js, geometry-assets.js, scene-studio.js and source-composer.mjs synchronized with studio-v49.64.67.js. No live browser validation performed.
