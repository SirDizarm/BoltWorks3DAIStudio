# Quick wall copies - v49.64.27

Brick Wall now includes Wall copies (1-12) and Add copy right. The button increases the count, enables Seamless horizontal repeat, saves the graph draft and rebuilds its output. Copies are placed one Length apart on local X before the existing Output Transform. Each brick retains exactly the original color, texture and UVs. Wall copies=1 returns to a single wall after Build.

These are generated repeats of the whole wall, not duplicates of a selected individual brick. They remain controlled by the same node parameters. Bake before manually editing or moving individual repeat parts; rebuilding replaces that graph's generated output. The graph still needs a connection to Group Output. Existing part-budget limits include copies and can reject a large repeat request without deleting its old result.

Sources app/modules/geometry-assets.js and geometry-nodes.js are bundled in studio-v49.64.27.js. No scene changes or live UI tests were performed during installation.
