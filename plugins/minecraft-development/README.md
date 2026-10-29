# Minecraft: extracted for a separate rebuild

Status: development archive, NOT an installable plugin. No Minecraft importer, player-preset tool, Java exporter, or Minecraft workspace is bundled into BWS 50 from this archive.

legacy-minecraft.js and legacy-panel.html preserve the former implementation. Legacy BWS 49.64.94 is unchanged. This folder is not part of the active studio bundle or web distribution.

## Future modeling contract

- One complete block occupies 1 x 1 x 1 scene units.
- Default faces use 16 x 16 texels, not a 16-unit-wide mesh.
- A pixel-sized modeling step is 1/16 of a block where appropriate.
- Import/export boundary conversions must be explicit, not inferred from texture resolution.
- No existing user models have been rescaled as part of extraction.

The previous importer already had a 1/16 conversion constant. Oversized assets must therefore be investigated per source and placement workflow rather than fixed with a global scale change.

## Compatibility retained in BWS 50

Shared plugin/workspace UI moved into workspace-tools.js. Historical project metadata, imported cuboid rendering, bind transforms, and saved clip playback remain in the core as compatibility readers. Removing these would risk damaging existing projects, animations, and their return to Legacy. They are not new Minecraft authoring features.

The dormant voxel corner-bevel implementation is retained for now; its Minecraft-only menu option is removed. That implementation can be extracted with the future custom-block editor.

## Next phase

Build a standalone optional Minecraft package with its own unit-cube meshes, pixel grid, materials, authoring tools, and game-specific exporters. Do not present this archived source as a working plugin yet.
