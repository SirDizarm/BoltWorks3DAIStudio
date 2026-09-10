# Graph board actions - v49.64.29

New graph creates a completely empty board. Add sources and Group Output yourself; it does not generate scene objects or erase another saved graph. Empty node lists remain empty through sanitization and reload. First-run defaults are empty rather than a populated tree.

Tree template is a separate button in both GN toolbars. It creates a new graph using the original tree setup without overwriting existing graphs or automatically building a tree.

Delete graph now uses two visible clicks: Delete graph, then Confirm delete graph. No browser confirm popup is required. Switching graphs or creating another graph cancels the pending confirmation. Deletion preserves generated and baked scene meshes, matching previous behavior. Deleting the last graph leaves no graph; an explicitly empty saved graph list stays empty on reload instead of recreating the old tree. Use New graph to continue.

Both creation and confirmed deletion record undo history. The existing saved-state limit of 24 graphs is enforced before creation so extra graphs are not silently lost on reload.

Sources app/modules/geometry-nodes.js and index.html synchronized with studio-v49.64.29.js. No existing saved scene or graph data changed during installation. Bundle built; live click/reload tests not run.
