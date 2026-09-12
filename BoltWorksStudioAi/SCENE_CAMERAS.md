# Scene cameras - v49.64.83

Scene Studio has a collapsible Saved cameras panel at the upper right. Move the normal orbit camera, enter a name and choose Add current view. Clicking a saved name jumps to that position and target; Set replaces it with the current view and optionally the name entered above. X deletes that bookmark. Up to 16 cameras are stored per scene.

Keep view when regenerating is enabled by default. First generation still frames the town; subsequent generations retain the view. Frame town remains an explicit override. This locks camera framing, not scene content or random seeds, and does not prevent manual orbit or pan.

Save scene stores the bookmarks, camera field of view and lock setting. Load scene restores them. Older scene files without bookmarks remain supported. Camera controls are HTML overlays, not world meshes, so Render PNG automatically excludes them. No camera markers are inserted into the scene.

Source scene-studio.js and studio-v49.64.83.js synchronized. No browser testing performed.

## v49.64.87 - Unobstructed scene controls
The experimental notice is hidden while Scene Studio is visible, and returns in the main workspace. This keeps the scene playback controls accessible without changing the user's notice-collapse preference. Browser testing not performed.
