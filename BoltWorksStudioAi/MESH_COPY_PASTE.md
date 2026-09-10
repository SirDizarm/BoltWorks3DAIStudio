# Mesh copy and paste - v49.64.37

Ctrl+C snapshots selected meshes when no triangles are selected. Ctrl+V pastes independent copies at their original world position, rotation and scale, then selects them. Multi-selection is supported; copies are detached from source scene/link groups. Paste records one undo step. Repeated pastes use the saved snapshot, not later edits or movement of the source. Existing triangle shortcuts still work when triangles are selected at copy time.

Clipboard is private to this editor session and is not the operating-system clipboard. Reloading closes that clipboard. Text fields, editable controls, texture editor and Animator Workspace are not intercepted. Cmd shortcuts also work. Does not clone full skeletons or procedural graphs.

panels.js synchronized with studio-v49.64.37.js; index and build versions updated. Build completed; no live shortcut tests performed.
