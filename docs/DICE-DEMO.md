# BWS dice demo — modeling, animation and physics

Version: 49.64.0. The human project is not part of this demo.

## Round scoring and decorative water

Round limits: Players includes a Rounds selector (Unlimited, 1–20, 25, 50 or 100). Player count and round limit lock after the first accepted turn. The final turn uses Finish game instead of Next player & roll. It accepts the final result without another roll, locks the scores, and announces the highest cumulative numerical score in a central banner. Ties name every joint winner; coin-only games have no points winner. Coloured paper squares shoot from both sides and clean themselves up after a few seconds; reduced-motion preferences disable confetti. New game clears the banner and finished state, retaining player names and round settings. Both BWS and the offline HTML share this implementation.

Both Gameplay Preview and newly exported HTML share the same turn tracker. A valid settled roll displays “Player got X!”. **Next player & roll** accepts that result once, advances the player, and starts a roll; after the last player it advances the round. Rolling, ready, or cocked dice cannot advance. Rerolls and table hits replace the current unaccepted result, never past turns. Score history shows rounds, named players and cumulative numerical totals; an asterisk marks the current unaccepted result. Coins retain BoltWorks/Spark labels and add no numerical points. The player count is locked after accepting a turn; **New score game** clears history, keeps names, and starts round 1. Scores are session-only, not persistent saves or network multiplayer.

The silver goblet contains a decorative sloshing water surface. Closely spaced manual table hits build slosh energy and spill bounded ballistic droplets onto the tabletop, lowering the water level. This is a lightweight visual approximation, not a full fluid solver; it does not alter dice collisions or scores. Pause freezes it, Hide decorations hides it, and tray Reset clears spills and refills the cup without clearing scores.

## Larger labels, BW coin and manual table hit (49.64.0)

Launcher update: **Toolbars → Examples → Dice demo** is now an unchecked-by-default checkbox. Enabling it shows the Dice demo menu beside Gameplay Preview, as in the original placement. Disabling it hides and closes that menu; it does not alter the model. The checkbox starts off on each page load.

Open the demo through **Toolbars → Examples → Dice demo**; it no longer occupies the viewport toolbar. The optional **Players** panel on the right supports 1–12 names and highlights the current player. **Next player** advances in order, wraps after the last player, and never automatically rolls. Names are kept in the current page session only; each exported HTML starts with generic names. The panel also works in the offline export and with minimized controls.

Current labels: **Dice count** opens the selector; **Apply new dices** applies it. The shortcut reminder stays between the controls toggle and selector in both toolbar modes. Coin-only rolls display **BoltWorks** (BW/Heads) or **Spark** (lightning/Tails) in the large gold result instead of a numeric total. Multiple coins show counts of each side; mixed dice/coin selections retain a numeric dice-only total.

Latest input change: clicking the tray no longer rerolls (in BWS or offline HTML). Use Enter or the Roll again button. Space hits the table, including after clicking a toolbar button. This supersedes the earlier click-to-roll instructions below.

Coin artwork update: the supplied BW reference sheet is embedded unchanged as a texture atlas; circular UV windows select the BW front (Heads) and lightning/laurel back (Tails), excluding the labels and perspective views. The coin has raised gold rims and a reeded edge. The face relief is illustrated, not sculpted geometry; the physical coin dimensions and result directions are unchanged. Keyboard focus update: Space/Enter override native activation of focused buttons in dice mode, so clicking a toolbar control cannot hijack the next table hit. Inputs, selects and editable text remain protected.

Gameplay UI polish: side reference views are temporarily hidden during any Gameplay Preview and restored on close without changing the saved collapse preference. Dice mode hides Preview Tools, uses accessible Play/Pause icons and warm gold-accented buttons, and docks Top view / Clean box / Hide decorations at the bottom right. Space hits the table; Enter or a left click on the tray rerolls. Keyboard shortcuts ignore focused form/menu/button controls and held-key repeats. The offline demo also supports Space/Enter/canvas-click. The exterior veneer now reaches the base plinth, with brass corner covers sealing the visible trim seams; colliders remain unchanged.

Scoreboard update: results no longer occupy the toolbar or affect its wrapping. Per-type subtotals are stacked down the left (`D6: 12`, `D20: 7`); a large gold `Total: 19` sits at the top center of the scene below the controls. Both remain visible with minimized controls. Rolling/reset clears stale totals to a dash. Unresolved dice retain a retry message; coins remain outside the numeric total. This presentation is shared by BWS and the offline HTML.

The table now has reference-inspired walnut grain, gold compass-rose inlays, matching exterior tray veneers and subtle green felt. An open illustrated journal, quill/inkwell and hollow silver goblet sit outside the collision tray. **Hide decorations / Show decorations** toggles those three decorative assemblies without resetting or changing dice physics. They are visual-only, not rigid bodies. Textures are generated locally and included through the same code in the offline HTML; the editable timeline project is unchanged. This is a stylized interpretation, not a photographic replica of the reference.

Rest reporting now measures transform stability over 0.9 seconds instead of trusting noisy solver sleep flags. A reported result is reopened only after meaningful displacement/rotation, with a bounded 25-second evaluation window per roll or manual hit. A stable but unreadable angle stays a retry, without automatic impulses. Hit the table supplies a stronger 2.2-unit upward velocity impulse and a lateral component toward the tray interior to help release rim contacts. Regression coverage checks noisy wake flags beside a wall, genuine movement, and stronger manual hits.

Results remain visible with minimized controls, grouped by dice type with per-type subtotals and a complete numeric total (pending while any result is unresolved). D6 and dotted Dice remain separate groups; coins show Heads/Tails, not a numeric sum. **Top view / Angled view** changes the camera without moving the pieces. **Clean box / Restore props** removes/restores the block, pawn and domino colliders as well as their visuals, keeping the dice in place. Reset preserves the clean-box choice. The decorative grey cup was removed. The existing BoltWorks logo is embedded on the green tray floor, including in the offline export. All polyhedral dice now have narrow edge/corner bevels and matching collision hulls; the six-sided variants retain their rounded-box geometry.

The handful selector now distinguishes **D6** (numbers) from **Dice (dots)**. D4/D8/D10/D12/D20 use numbers only. Number textures are 256px with larger glyphs and larger face labels; D4 retains its three vertex-reading labels per face.

**BW coin** is a physical two-sided coin with placeholder BW / Heads and BW / Tails artwork, replaceable when final images are supplied. Coin results are excluded from the numeric dice total. A coin leaning against a prop may require another attempt; no fairness guarantee is made.

**Hit the table** jolts the existing dice, coins, pawn, block and dominoes and briefly shakes the camera. It does not respawn pieces or select a result. Physics then reads their new resting orientations. The button also works in minimized controls and the exported HTML. Rapid hits are throttled during the short shake. Nothing shakes automatically: an ambiguous result stays a retry until the user hits the table or rolls again. A hit is not guaranteed to dislodge every trapped piece.

49.63.1 resting-contact fix: automatic unstick impulses have been removed. A die may remain touching or supported by the pawn, block or another die. An ambiguous resting angle is reported as requiring a manual reroll, without waking or pushing the body. This supersedes the earlier nudge behavior described in the historical regression notes below. A 96-die mixed regression produced 87 valid results and nine retries, with zero calls to applyImpulse.

## Mixed handful and compact layout

In Gameplay Preview, open **Dice handful**, choose a count from 1 to 8, choose D4/D6/D8/D10/D12/D20 independently for each slot, then **Apply handful**. Dice collide with each other and the props. Results are listed in slot order with their types; a total is shown only when every die has a valid result. Roll again rolls the whole handful. The HTML export preserves the currently applied selection and lets its recipient change it offline.

**Minimize controls** hides the PLAYER SCREEN toolbar, leaving a small **Roll again / Show controls** strip over the scene. It does not pause physics. **Minimize Lower Panel** completely hides the Scene/JSON text and its grid row; when expanded that row fits its text rather than reserving a large fixed blank area.

The tray sits on a procedurally drawn map and wooden tabletop, with a book and cup outside it. These outside decorations are not colliders. The movable block has cartoon grain and end-grain rings on one face; both textures are generated locally, with no external image downloads.

The polyhedral collision hull and numbered surfaces share one face definition. D10 is a pentagonal trapezohedron with ten kite faces, not a ten-sided bipyramid. D4 displays each vertex number on its three adjacent faces and reads the upward vertex. Other dice read their most upward face. Number marks distinguish 6 from 9. Non-D6 dice are faceted; D6 retains rounded edges. These handful options are Gameplay/HTML features: the editable authored timeline remains the existing six-clip D6 example.

Regression: 12 throws of eight mixed dice (96 dice total) produced 93 valid outcomes and three explicit retries; all outcome orientations and face counts were checked. The original 60-throw D6 regression remains 58 valid/two cocked, including pawn/domino collisions and recovery. No statistical fairness guarantee is made.

The die now has rounded geometry in both the editable model and the physics player. Its collision hull has bevelled edges too. The golden block is movable; a compound chess pawn and three dominoes can be knocked over. Roll keeps fallen props where they landed, while Reset restores the entire tray. The props are Gameplay-only, not extra timeline tracks.

## Try it

Open **Die demo** beside **Gameplay Preview**.

- **Die in Gameplay Preview** opens an isolated physics tray without replacing the editor scene. Click **Roll again**. Pause freezes simulation; Reset puts the die at rest. Close returns to the editor.
- **Download demo project** saves `BWS-die-demo.modelerproj` without replacing anything.
- **Load editable die demo…** replaces the editor workspace only after confirmation. Save your current project first. Open Animator Workspace to see the six toss clips.
- **Random timeline toss** chooses a face and plays its authored clip. Enable **Randomize each timeline loop** for a new random choice at every loop. Normal clip selection/scrubbing remains deterministic; the checkbox is a session option, not embedded randomness in GLTF.
- **Export dice randomizer HTML** saves an offline, self-contained physics demo. Share the HTML; recipients open it in a WebGL-capable browser. It contains only this die/tray, not another editor model.

## What the example teaches an AI

1. Construct a unit cube using Add Mesh. Use flattened spheres for the pips: 1 through 6, with opposite faces adding to 7. Keep the 21 pips separate and editable. This example generates the same primitive specifications in code, rather than claiming every part was manually clicked into place.
2. Group the 22 meshes for organization. A scene group alone is not an animation binding.
3. Place one root rig control at the cube centre and bind every mesh rigidly to it. Rotating the root should preserve each pip's offset. Do not skin-weight a rigid die.
4. Create six clips at 24 FPS, frames 0–72. Key translation and rotation on the root. The sample uses dense arc keys, a small landing bounce and a final hold. Keys are editable in BWS.
5. Verify the last frame for every clip: the intended face must point upward. Scrub backwards as well as forwards, and save/reload a copy to check bindings.
6. Use Group, selection, Move/Rotate/Scale, material colour, bone binding, clip selection, keyframe inspection and view capture as the small repeatable tool exercise. Editing geometry here does **not** change the separately defined physics demo; that must be deliberately regenerated or extended.

## Important format details

- Y is up. The die is one unit wide and rests with its centre at Y = 0.5.
- Mesh specification rotations are **degrees**. Rig animation rotation channels are **radians**. Confusing them produces wild spins and wrong landings.
- All animated meshes use `rigBoneId: "dice-root"`. Preserve bind/rest transforms when modifying an existing project.
- Face normals: 1 = +Y, 6 = −Y, 2 = +X, 5 = −X, 3 = +Z, 4 = −Z.
- Euler channels retain full turns during authored playback. An endpoint quaternion alone cannot encode how many turns occurred.

## Physics is only in Gameplay Preview / HTML

The tray uses cannon-es with a rounded convex die collider, a static floor and four walls. The wooden block, compound pawn and three dominoes are dynamic bodies. Fixed 1/120-second substeps handle gravity, angular velocity, friction and bounce. The render geometry follows each rigid body. Props continue simulating after the die settles.

A physical throw randomizes launch orientation and velocities, **not its result**. After the body sleeps, transform each local face normal into world space and select the face most aligned with +Y. Require alignment of at least 0.98. An angled sleeping die receives at most two physical impulses, visibly reported as nudges. A still-angled or timed-out throw is reported as cocked/unsettled, never forcibly rotated into a chosen result. This is a visual demo, not a certified unbiased gambling system.

The rounded collider is lower-resolution than the visible surface. Merge coplanar triangles into whole convex polygons: using raw triangulated support faces caused persistent jitter during testing. The pawn is one body with cylinder and sphere shapes; do not make its decorative parts independent loose bodies.

The authored timeline uses uniform face selection followed by a clip, so it is deliberately different from physical rolling. No physics is injected into other animation clips or other editor meshes. This is not a general-purpose BWS scene-physics authoring system yet.

## Source and builds

- `app/demos/dice-model.js`: face mapping, editable project and render geometry.
- `app/demos/dice-physics.js`: isolated physics/render runtime.
- `app/modules/dice-demo.js`: BWS menu and lifecycle.
- `app/demos/dice-standalone.js`: offline player controls.
- `tools/build-dice-demo.mjs`: generates HTML and project; called by the studio build.
- `tools/test-dice-demo.mjs`: six endpoints, mapping, cocked result and 60 seeded simulation throws.
- `tools/test-dice-browser.cjs`: browser interaction, editor preservation and offline export checks. Override BWS_BROWSER/BWS_PLAYWRIGHT/BWS_TEST_URL for another installation; defaults to port 4181.

Run `npm run build:studio`, then `node tools/test-dice-demo.mjs` and `npm run check`. The web build includes the demo exports. Keep generated `demos/BWS-dice-randomizer.html` and the current studio bundle together with source when publishing. The HTML includes Three.js and cannon-es license notices.

## Limits / useful next steps

Verified in isolated Edge on 2026-09-04: all six actual BWS clip endpoints, reverse scrubbing, visible toss motion, random loop selection, physics pause/resume, editor scene unchanged by the physics tray, cancelling replacement, export download and offline physical rolling without network requests. The deterministic simulation test exercised 60 throws, all settled, with all six results represented. BWS smoke checks passed. This does not certify statistical fairness or arbitrary other model rigs.

The authored toss is a simple demonstration, not a recorded simulation. Pips are visual only; their thin caps extend approximately 0.009 units beyond the nominal cube faces. The tray uses a fixed camera. It does not yet turn any arbitrary user mesh into a physics body or bake physical rolls into the timeline. Such extensions should be explicit tasks, not assumptions made by a skill.

49.62.1 regression: 60 seeded throws exercised all six results, pawn collisions/toppling, domino toppling, bounded recovery nudges and complete prop reset. 58 settled; two reported cocked rather than inventing an outcome. The earlier 60/60 result above refers to the original sharp-box tray, not this more complex scene.
