# Repeatable brick walls - v49.64.26

Enable Seamless horizontal repeat on Brick Wall and rebuild. Duplicate the generated wall group and move the copy by exactly the Length parameter along X (default 6). Preserve orientation, scale and Y/Z. For a scaled group use Length times that scale; for a rotated group use its local wall direction.

The generator clips complete, joint-inset bricks at the module boundary. In staggered courses, the two end halves use one periodic brick identity for color, texture selection and UV randomization. Their UVs preserve the corresponding regions of the full brick rather than stretching each half. The mortar backing remains a solid color in repeat mode to avoid a nonperiodic background image seam. Normal nonrepeat generation remains the default for older graphs.

Texture Randomizer works with this mode, including UV variation: paired halves choose the same source and transformation. Repeat mode controls the generated material assignment; it does not remove baked lighting from uploaded photographs or make arbitrary images globally seamless. Duplicate the same built module for exact repetition. Different seeds, dimensions or inputs do not define matching modules. Only horizontal brick-wall repetition is implemented, not vertical/2D repetition, corner walls or continuous procedural worlds. Existing Output Transform behavior remains unchanged.

Sources: app/modules/geometry-assets.js and geometry-nodes.js. Loaded bundle: studio-v49.64.26.js. No live geometry inspection or seam tests performed in this change.
