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
- **Show Tile Neighbours** uses the selected model's real bounds so copies meet
  precisely at their edges: walls form a side-to-side row and floor tiles form
  a 3×3 floor patch. A **Neighbour opacity** slider makes their textures easy
  to inspect. These copies are neither saved nor included in the tile export.
- **Apply Continuous Texture** repeats the selected texture in U and V and can
  trim a small percentage of each image edge to hide dark gutters. It does not
  alter the UV layout or source image; **Reset Tile Texture** restores the
  normal one-repeat, no-trim material mapping.
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
- **Hide Floor in Export** leaves the detected floor out of the finished PNG
  while still using that floor as the invisible centre and scale guide. This
  gives standalone props the same footprint as normal floor-based tiles.

### Tile export

**Export Tile + 4x Sheet** saves a tile manifest and a transparent four-cell
PNG. It supports selected individual meshes, groups, or multiple checked parts.
Only the export targets are rendered. All four cameras orbit the fixed editor
origin at the configured target height, so a floor and its props retain the
same assembly pivot in every Unity-facing view.

- **NE / SE / SW / NW Isometric** outputs four diagonal orthographic views.
  Only a large, flat tile at the assembly's lowest level is held screen-stable;
  every prop part, including flat anvil plates, rotates through the four views.
  This keeps the ground below the prop without freezing or mis-rotating model
  pieces.
- **N / E / S / W Straight Walls** outputs the separate cardinal wall-facing
  set.
- Every cell uses one shared scale, so an orientation with a wider silhouette
  is not enlarged relative to the other three cells.
- The floor-only silhouette defines the compositor anchor. Its screen centre
  and size remain identical in all four cells; props and walls are drawn around
  it and cannot recenter or resize the tile.
- Tile-sheet renders temporarily remove material specular and environment
  reflections, preventing a moving sun-glare spot from appearing on the ground.
- The exporter frames the complete selected assembly and uses a transparent
  background.

Use the manifest's orientation order when importing the sheet into Unity.

## Shared transform snapping

The top-bar **Snap** setting controls fixed increments for translation,
rotation, and scale. The Model Tile Kit grid-surface command uses the same
translation increment so placement and editing stay consistent.

## Core modeling and selection

The editor provides primitive shapes and direct scene assembly tools for normal
3D construction.

- Add Mesh contains boxes, panels, wedges, hollow boxes, tubes, arches, stairs,
  domes, capsules, prisms, pyramids, and other base shapes.
- Select All / Deselect, Hide / Un Hide, Group / Ungroup, Duplicate, and Merge
  Mesh work with ordinary mesh parts and grouped assemblies.
- Move, Rotate, and Scale use the transform gizmo. The top-bar Snap control
  applies matching fixed translation, rotation, and scale increments.
- Edit Pivot changes the shared rotation pivot for checked parts; Center Pivot
  restores it to their combined center.
- Mirror Copy creates independent mirrored geometry. Live Mirror is a preview
  that can later be made editable with Apply Live Mirror.
- Loft Checked creates a closed mesh through checked profile objects. Use it
  when an asset is better defined by several cross-sections than primitives.

For a finished asset, name every part and group by its function. Use groups for
assemblies such as walls, floor, roof, trim, props, or rigged body sections.

## Surface, topology, and repair tools

Surface Edit contains mesh-level tools for building and repairing editable
geometry. They work best on the smallest relevant selection.

- Select Tri, Select Face, Area Select, and Paint select individual triangles
  or connected surface regions.
- Line Tool, Close Line, Make Face, Fill Line, Cut Hole, Bridge, and Dig Into
  construct faces, connectors, and openings from sketches or selected bounds.
- Delete Tri, Extract Tri, Copy Tri, Paste Tri, and Fill Hole edit selected
  triangle regions and boundary openings.
- Bevel, Edge Bevel, Corner Bevel, Loop/Ring Cut, Knife/Plane Cut, Subdivide,
  Edge Slide, and Scale Selected Surface refine form and edge treatment.
- **Pull to Target** keeps the selected connected, flat source region, then
  lets you click a receiving face. It uses the existing Pull extrusion to
  extend the source along its normal until it reaches the receiving face's
  plane, with a fixed microscopic outward offset. It does not read Inset,
  Distance, or Mouse Step. The button stays available in both input modes;
  click **Pick Target…** again or press Escape to cancel before choosing the
  receiving face.
- Normals, Non-manifold Check, Remove Doubles, Mesh Statistics, Weld Vertices,
  Dissolve Edge or Vertex, and Smooth/Relax Vertices diagnose and repair mesh
  quality.
- Protected Decimate and LOD Generator make lower-detail copies while offering
  protection for borders, UV seams, and material borders.

After topology edits, inspect the opposite view as well as the edited view.
Thin or coplanar surfaces can look correct from one camera while failing in
another.

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

## Scene, camera, and QA controls

- Front Work, Side Work, and Top Work provide constrained work views; Restore
  View returns to the free perspective editor camera.
- Background & Environment controls the studio/plain/road environment,
  backgrounds, grid visibility, and shot grid visibility.
- Reference Image loads an image as a panel, overlay, or both, with adjustable
  opacity, scale, and offset.
- Camera Views offers standard Front/Back/Left/Right/Top/Iso framing, custom
  camera directors, a player camera, and a Gameplay Preview.
- Save Views and the individual PNG buttons export reference images. QA Sheet
  exports the canonical six-view contact sheet for visual review.

The screenshot view contract is Front from `+Z`, Back from `-Z`, Left from
`-X`, Right from `+X`, Top from `+Y`, and Iso from positive X/Y/Z.

## Projects, import, and export

- Save Project and Load Project preserve the editable `.modelerproj` scene,
  editor state, lighting, textures, groups, and rig data.
- **Insert OBJ** adds an OBJ as editable parts in the current workspace without
  clearing the models already there. Select its OBJ, MTL, and texture images
  together to bring in its available colours and textures; the inserted model
  is then selected and framed so it can immediately be moved into place.
- **Open OBJ (Replace Scene)** intentionally clears the current workspace before
  opening the selected OBJ bundle. Use it only when starting a new scene.
- Import supports scene JSON, OBJ, OBJ folders with optional MTL/textures, DAE,
  and Blockbench `.bbmodel` files.
- **Export OBJ + MTL** creates a ZIP containing the OBJ, matching MTL material
  file, and available texture images. Extract it before importing elsewhere so
  plain colours and texture assignments remain intact. The selected-model OBJ
  export uses the same material bundle format.
- Export supports scene JSON, Roblox packs, DAE, Bolt 2D,
  and the Model Tile Kit sheet/manifest workflow.
- Game Optimize Copy creates a separate game-focused project by merging
  materials and simplifying dense geometry while keeping the original project.

Use project save files as the canonical source. Mesh exports are delivery
formats and do not preserve all BWS editing information.

## Rigging, animation, Minecraft, and AI workflows

- Bone Placement creates, imports, edits, glues, and removes bone hierarchies.
  It supports skinned mesh binding and reference-view bone placement.
- Timeline / Animator supports animation clips, key poses, frame editing,
  animation JSON, transparent sprite sheets, WebM, and local MP4 export.
- Minecraft Model imports Blockbench projects, supports Minecraft player rigs
  and animation presets, and exports a NeoForge Java ZIP.
- Reference Match / Image-to-Mesh provides reference-guided model creation
  workflows. Human AI Viewer and MCP work sessions provide visible, auditable
  AI-assisted editing rather than hidden background mutations.
- Plugins can be created or imported through the Plugins panel.

Use a fresh QA Sheet after changes to a rig, texture, model orientation, or
export setting. For animated assets, also inspect the output sheet or video.

## Completion expectation for AI-authored assets

After a material geometry, UV, texture, orientation, or tile-export change:

1. run the project inspector when a `.modelerproj` is involved;
2. load the latest project in the actual studio;
3. make a fresh QA Sheet;
4. inspect Front, Back, Left, Right, Top, and Iso views;
5. when relevant, inspect the generated tile sheet at its intended Unity scale.

Do not claim an asset or exporter is complete without current visual evidence.
