# BWS 50.0.14

- Remove the Scene Rendering bundled plugin registration and its optional lamp-control panel.
- Preserve hidden lighting state inputs, shared core lighting and project save/load compatibility.
- Scene Rendering 1.1.0 is now a separate isolated static-lighting workspace in bws-plugins. Explicit model-copy transfer; no editor lighting changes.
- Game Engine and Geometry Nodes remain bundled pending dedicated extraction; Scene Studio is separate.
- Browser lighting and transfer testing pending. Nothing published in this change.
