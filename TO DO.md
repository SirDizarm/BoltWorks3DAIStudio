# TO DO

Den här listan är den låsta verktygsplanen för BoltWorks 3D AI Studio.

**Omfattningslås:** Lägg inte till fler punkter. En ny punkt får bara tas in om en befintlig punkt först färdigställs, tas bort eller ersätts.

## Modellverktyg – först

- [x] Loop Cut / Ring Cut
- [x] Edge Slide
- [x] Riktig Extrude Region i samma mesh
- [x] Weld / Merge Vertices
- [x] Dissolve Edge / Vertex
- [x] Live Mirror / Symmetry
- [x] Scale Selected Surface
- [x] Smooth / Relax Vertices (M12R2 confirmed in v49.8.2; repeated Relax tests softened the selected surface correctly)
- [x] Knife / Plane Cut
- [x] Bridge Edge Loops (automated manifold + UV regression confirmed in v49.10.2)

## Kvalitet och reparation – därefter

- [x] Recalculate / Flip Normals (automated winding + UV regression confirmed in v49.10.2)
- [x] Find and Repair Holes (same-mesh manifold caps, surrounding material and safe rejection in v49.11.0; stable world-plane UV projection in v49.11.1; post-repair Selected Face UV rotation and flipping in v49.13.0; coplanar neighboring UV scale and alignment inheritance in v49.13.1)
- [x] Non-manifold Check (read-only issue detection, viewport highlighting, issue navigation, framing, and automated closed/open/non-manifold topology regression in v49.14.0)
- [x] Remove Doubles (analysis-first tolerance workflow, exact shared UV corners ignored, per-corner attributes retained, unsafe topology rejected, and automated near-seam regression in v49.15.0)
- [x] Mesh Statistics (read-only geometry/topology/size/area/volume/render/memory report, AI-copyable output, and automated indexed/open-mesh regression in v49.16.0)

## Spelmodeller – sist

- [x] Decimate med skyddade detaljer (analysis-first protected edge collapse, boundary/feature/UV/material safeguards, retained per-corner attributes, topology validation and Undo in v49.17.0)
- [x] LOD-generator (analysis-first protected LOD0–LOD3 sets, separate grouped scene objects, retained UV/material data, hidden generated previews, metadata and single-step Undo in v49.18.0)
- [x] UV Unwrap och Texture Atlas (read-only smart island analysis, sharp/material seams, non-overlapping padded packing, UV-only apply, seam-free current-texture atlas baking, separate unchanged Mesh Details texture / optional UV preview guide / baked atlas PNG exports with explicit file counts, single-step Undo and automated cube regression in v49.19.4)
- [x] Texture / Material Paint (icon tools with exact per-tool pointer hotspots, hover help, Pen, Brush, Spray, Eraser, Eyedropper, UV-island Fill, Glass Hammer, zoom/pan with live preview rescaling during wheel input, pointer-locked live size preview, selected-face masking, solid Pen stamping, texture-bound PNG snapshot Undo/Restore, separate Base Color/Roughness/Metalness/Emissive channels, channel-correct grayscale/value controls and eyedropper sampling, resize-aware distortion-free initial rendering, persistent compact tool controls across material-channel changes, persistent rectangle/ellipse/lasso paint selections, drag-to-size rectangle/ellipse/triangle/diamond/star/heart shapes with filled or outline output, Off/U/V/U+V paint symmetry, and per-channel editable paint layers with visibility, ordering, duplication, deletion, merge-down, composite preview/apply, persistence and layer-aware Undo completed in v49.24.0; non-overlapping editor layout corrected in v49.24.1 and the layer stack moved into a vertical scrollable sidebar in v49.24.2)
- [ ] Reference Match / Image-to-Mesh (build on the completed MCP v1 foundation with calibrated reference planes, reference opacity and depth lock, measurable landmarks, editable silhouette guides, front/side/back alignment, live difference overlay, AI-readable reference state, MCP-accessible topology operations, repeatable QA cameras and checkpointed comparison; the goal is an editable `.modelerproj` mesh generated and refined from reference images with visible human review)
- [ ] Bone Weights och Weight Paint
- [ ] Pose- och animationstest
# Import and rigging regressions

- [ ] **Raptor rig import regression:** importing the rigged raptor into the current studio damages or changes its existing rig. Reproduce with the saved raptor `.bbmodel`/project, compare the bone hierarchy, parent relationships, pivots, world/local transforms, bone glue assignments, and animation bind pose before and after import. The importer must preserve the original rig and mesh-to-bone connections exactly.
- [ ] **Minecraft player model is mirrored left-to-right:** importing the Minecraft player model swaps or mirrors its left and right sides. This appears specific to the player-model import/preset path; other imported models such as the raptor do not show the same left/right reversal. Check player-model coordinate conversion, front-facing correction, UV orientation, left/right bone naming, and any automatic player-rig transformation. Add regression tests proving that left arm/leg and right arm/leg remain on their correct sides after import.
- [ ] Test both fixes with a fresh import, saved `.modelerproj` reload, Animator Workspace playback, and Blockbench export/re-import before marking them complete.

# Unified file workflow

- [ ] **Unified Files window:** replace the scattered Save, Load, Import, and Export buttons with one predictable Files window containing **Save / Export** and **Open / Import** sections. Every save action must open a summary before generating data. Keep the editable base name separate from the selected file format and extension; show the format, scope (whole project or selected model), object count, vertex count, triangle count, estimated file size, and large-scene memory warning. Route existing `.modelerproj`, scene JSON, OBJ + MTL/textures ZIP, selected OBJ, Roblox pack, DAE, Bolt 2D, GLB, glTF, rig, image, animation, and other supported outputs through the same window without duplicating exporter logic. Open/Import should distinguish replacing the workspace from inserting into it and auto-detect formats where practical. Prefer the system file picker so users can select an existing file and receive the operating system's overwrite confirmation; explain that ordinary browser-download fallback cannot inspect or replace existing files and may append `(1)`, `(2)`, and similar suffixes. Preserve New Workspace and automatic recovery as separate safety actions. Audit every existing file button and regression test before removing or hiding the old controls.
