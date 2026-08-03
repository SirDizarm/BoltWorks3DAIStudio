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
- [ ] Texture / Material Paint (icon tools with exact per-tool pointer hotspots, hover help, Pen, Brush, Spray, Eraser, Eyedropper, UV-island Fill, Glass Hammer, zoom/pan with live preview rescaling during wheel input, pointer-locked live size preview, selected-face masking, solid Pen stamping, texture-bound PNG snapshot Undo/Restore, separate Base Color/Roughness/Metalness/Emissive channels, channel-correct grayscale/value controls and eyedropper sampling, resize-aware distortion-free initial rendering, persistent compact tool controls across material-channel changes, persistent rectangle/ellipse/lasso paint selections, drag-to-size rectangle/ellipse/triangle/diamond/star/heart shapes with filled or outline output, and Off/U/V/U+V paint symmetry with mirrored guides and previews implemented through v49.23.0; layers remain)
- [ ] Bake high-poly till Normal Map
- [ ] Bone Weights och Weight Paint
- [ ] Pose- och animationstest
