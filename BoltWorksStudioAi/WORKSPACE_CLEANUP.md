# Large workspace cleanup - v49.64.34

Clear Scene now detaches model parts in bulk, disposes each geometry/material once, and prunes rig bindings once instead of refreshing the entire editor for every removed object. Clear Scene retains its existing undo snapshot; creating that snapshot can still take time for very large scenes.

New Workspace cancels scheduled recovery saves and invalidates queued saves without waiting on an existing IndexedDB write. An already-started write may finish as the retained recovery record, but cannot clear the manual-recovery preference or replace the fresh-workspace status. New Workspace also releases the old undo history. Clear Scene keeps undo support.

Successful IndexedDB recovery writes no longer stringify an additional full project into localStorage; localStorage remains a fallback when IndexedDB fails. New saves remain serialized to preserve ordering.

Canonical modules: meshes.js, panels.js, autosave-update.js. Loaded bundle: studio-v49.64.34.js. No live large-scene timing or recovery tests performed.
