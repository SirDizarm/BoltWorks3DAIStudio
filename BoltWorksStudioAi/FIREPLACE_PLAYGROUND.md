# Fireplace playground

Open fire-fluid-comparison.html from the BWS local server or Pages build. The editor links to it as Fireplace playground.

The standalone preview runs a GPU 2D fluid-flow study on a camera-facing sheet inside a 3D room. It is not a full 3D combustion simulator or a game-engine spell export. It keeps the main model workspace untouched.

Controls: Restart, Fire ON/OFF, Pause/Resume, Firelight ON/OFF, Fuel, Turbulence, and Light strength. Fire OFF clears the simulation, disables emitted light, and leaves the original dark stones. Restart ignites a fresh simulation. Pause freezes simulated flow. The approved ground pieces are non-glowing stones; they receive firelight but have no ember emission.

Four lights follow bright regions sampled from the simulation. The previous procedural comparison is intentionally not part of this public playground.

Requires a WebGL2 browser with renderable half-float textures. The Pages build includes the installed Three.js runtime; no CDN is required. This is the visual starting point for a future Spell Binder Room, not yet an integrated spell workspace.
