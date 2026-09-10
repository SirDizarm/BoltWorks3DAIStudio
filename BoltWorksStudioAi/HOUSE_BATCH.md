# House Batch - v49.64.39

Connect House Batch downstream of a single House Layout and onward to output. Count 1-100, columns, spacing, size variation, storey variation, palettes. Build / Update generates the entire batch. House Outputs in the main GN panel supports multiple selection and selective rebuilds. Stop takes effect between houses. Per-house deterministic seeds keep unselected outputs unchanged. Shrinking count does not delete older outputs automatically.

Each output has its own group and gameAsset house ID; geometry is combined by material per house. One undo checkpoint for the batch. Completed houses persist if interrupted; each replacement is prepared before old output deletion. Saved projects carry IDs and reserved floor-cell bounds in mesh gameAsset metadata and recipe params. Layout changes increment revision and flag furnishing review. Cells are floor envelopes, not validated room/collision/navigation volumes. Furniture integration is not implemented. Manual edits to generated house geometry are replaced by rebuild; separate prop objects are not removed.

Curved roof option uses the original curvedPanel primitive underlying the supplied roof tile, not the accidental copied triangle patch. No image textures were present in that project. This release does not add L-shaped houses, stair repositioning, railing collision, or a texture-library node. Preset is exterior/floor shells without stairs or furniture, pending those layout fixes. Per-tile color jitter is disabled for batches to reduce material draw calls; house palettes still vary.

Sources geometry-building.js, geometry-nodes.js, house-batch.js, source-composer.mjs synchronized with studio-v49.64.39.js. No live 60-house rendering or selective-rebuild test performed.
