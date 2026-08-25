# Current Studio Features

This is the practical feature reference for AI clients working in BoltWorks 3D
AI Studio. Update this document whenever a visible tool or exporter behavior is
added or changed. The project-format and authoring documents remain the format
contract; this file explains how to use the current editor.

## Model Tile Kit

The **Model Tile Kit** packages one mesh, a selected group, or multiple selected
parts as a reusable game tile. It is intended for 3D-authored assets that will
be rendered to 2D sprites or used as tile assemblies in Unity.

- **Center Model to Editor** moves the selected assembly as one unit so its
  combined bounds are centered on the editor origin. Relative placement is
  preserved.
- **Snap Selection to Grid Surface** moves the selected assembly together so
  its lowest point rests on `Y = 0`. Its X/Z center follows the current toolbar
  transform-snap increment when transform snapping is enabled.
- **Rotate to Next Compass** rotates the selected assembly around the fixed
  editor origin and changes wall facing in the order North, East, South, West.
- **Lock Isometric Camera** locks the editor camera to the configured azimuth,
  elevation, distance, and target height. Changes to those values update the
  locked camera immediately.
- **Flat 2D Look (no shading)** is linked to the matching Camera Controls
  toggle. Either control changes the same unlit material setting for editor
  preview and rendered output.

### Tile export

**Export Tile + 4x Sheet** saves a tile manifest and a transparent four-cell
PNG. It supports selected individual meshes, groups, or multiple checked parts.
Only the export targets are rendered.

- **NE / SE / SW / NW Isometric** outputs four diagonal orthographic views.
- **N / E / S / W Straight Walls** outputs the separate cardinal wall-facing
  set.
- Every cell uses one shared scale, so an orientation with a wider silhouette
  is not enlarged relative to the other three cells.
- The exporter frames the complete selected assembly and uses a transparent
  background.

Use the manifest's orientation order when importing the sheet into Unity.

## Shared transform snapping

The top-bar **Snap** setting controls fixed increments for translation,
rotation, and scale. The Model Tile Kit grid-surface command uses the same
translation increment so placement and editing stay consistent.

## Texture and UV Editor

Open **Edit Texture** for a selected textured mesh to paint texture channels,
inspect UVs, replace a texture, and correct mapping.

- **UV Width** and **UV Height** apply independent UV scaling around the UV
  layout center. Values below `1` compress that axis; values above `1` expand
  it.
- **Edit UV Layout** unlocks direct UV manipulation in the texture canvas.
  Drag to move the active part's complete UV layout.
- **Scale UV by drag**, used together with Edit UV Layout, scales the UV layout
  from its own center while dragging.
- UV edits are undoable. They change the selected mesh's UV coordinates, not
  the source bitmap.
- **Lock paint to selected/part UV** is a painting mask only; it does not lock
  UV editing.

For portable projects, embed source images once in `textureLibrary` and keep
the object color white unless intentional tinting is wanted.

## Completion expectation for AI-authored assets

After a material geometry, UV, texture, orientation, or tile-export change:

1. run the project inspector when a `.modelerproj` is involved;
2. load the latest project in the actual studio;
3. make a fresh QA Sheet;
4. inspect Front, Back, Left, Right, Top, and Iso views;
5. when relevant, inspect the generated tile sheet at its intended Unity scale.

Do not claim an asset or exporter is complete without current visual evidence.
