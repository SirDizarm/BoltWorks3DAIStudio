# Texture Randomizer - v49.64.25

Connect Texture Input cards to the four Texture Randomizer inputs. Connect its Texture output to Brick Wall's Texture socket, or Stone Wall's Upper/Middle/Bottom/Overall sockets. Build the graph again. Each generated mesh chooses one of the connected images with equal probability. Empty inputs are skipped. One connected image still supports UV variation. A seed offset changes assignments; unchanged graph seed, names and node IDs reproduce them. Different neighboring parts can still select the same image: this is random selection, not guaranteed alternation.

Vary UVs enables per-part crop/scale, quarter-turn and mirror variation. UV variation controls its strength; turn it off for directional artwork. Existing Texture Input UV randomization now also applies to the four game-asset generators. The node chooses images; it does not blend them or create a combined atlas. It affects each mesh, not each triangle. Mortar/backing meshes on Brick Wall receive texture assignment as well.

Works through the shared custom-geometry output used by brick walls, stone walls, rocks and game-asset nodes. It does not retrofit textures onto primitive sources that never consumed a texture socket. Nested randomizers flatten their inputs (maximum 32 choices, depth 8); outer randomizer settings govern the resulting pool. Imported graph cycles return no texture instead of recursing indefinitely.

The Add node here menu is now up to 560px wide, with wrapping labels and a single-column layout on narrow screens. Both sidebar and detached menus use the shared stylesheet.

No new dependencies, downloaded images, or changes to the live scene. Sources and versioned browser bundle updated together. Live visual testing has not been performed.
