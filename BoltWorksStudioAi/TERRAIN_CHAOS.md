# Clean towns, terrain chaos and workspace restoration - v49.64.90

New scenes default to zero grime and zero atmospheric smoke. Ambient smoke requires a nonzero destruction/burn setting and the Smoke enabled switch. The old periodic ground normal texture is removed. Clean terrain gets subtle color variation; burned terrain uses a restrained ash palette rather than bright white patches.

Chaos is a slider from 0 to 1 under Terrain & irregularity. It controls seeded terrain height variation and small plot-position offsets. House pads and roads stay level, and pond banks blend into the surrounding terrain. Tree and rock placement follows terrain height. Regenerate to apply.

Workspace initialization now respects boltworks.workspace, including Scene Studio. This restores the workspace, not the unsaved generated town; use Save scene/Load scene to retain scene content. No browser tests were run.
