Crash / Crush is parked for later.

Removed from the live app on 2026-06-16 so the editor stays focused on the modeling tools that are working well today.

When we revisit it, the main ideas to bring back are:

- pole and panel impact preview guides
- per-material deformation rules
- glass shatter handling
- softer seat and upholstery compression rules
- timeline or step-by-step deformation playback
- exportable damage states for later animation or training

The material-rule system in Mesh Details was left in place so future deformation tooling can build on it.

Image to Model is also parked for later.

When we revisit that, the practical v1 should be:

- upload one or more reference images
- detect major shapes and proportions from the image set
- generate an editable JSON build plan instead of pretending to output a finished perfect mesh
- let the user preview the extracted structure before building
- support multi-view sheets first, because they are much more reliable than a single dramatic image

Good first targets:

- buildings
- doors
- crates
- other structured hard-surface assets made from repeated beams, panels, windows, and trims

Harder later targets:

- organic rocks
- characters
- sculpted details
- exact hidden backside geometry from a single image

Best long-term direction:

- Image -> Plan
- Plan -> Editable model
- Editable model -> refined asset after user tweaks and feedback
