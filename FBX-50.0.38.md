# FBX support: 50.0.38

Import FBX loads binary and ASCII FBX supported by Three.js, meshes, materials, skeletons and clips through the existing model import workflow. Select one FBX and any external texture images together. Missing images are reported. Embedded colour textures are retained where browser decoding permits.

Export FBX writes binary FBX 7.4 with triangle meshes, hierarchy, normals, UVs, vertex colours, material assignments, embedded colour images, bone weights/bind poses, and preserved imported position/rotation/scale clips. Quaternion clips are sampled at 30 fps. Studio coordinates are declared as metres, Y-up.

Current limits: timeline edits are not baked; preserved imported clips are exported. Morph targets, additional PBR maps and texture rotation are reported as unsupported. Realize instanced meshes before export. Standard FBX consumers may approximate PBR materials differently. Compatibility with external editors has not been tested in this change.

Canonical sources: app/exporters/fbx.js and app/modules/import-export.js; controls in panels.js, animator-workspace.js and index.html; imports in bootstrap.js. Build with npm run build:studio. The local application loads studio-v50.0.38.js from the project root. Saved projects are not changed by this upgrade.
