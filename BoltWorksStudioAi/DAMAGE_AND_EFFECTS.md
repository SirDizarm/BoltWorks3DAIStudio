# Damage and effects - v49.64.82

Scene Studio: set Damaged houses (%) above zero and Generate town. Damaged town plots now use copies of their actual captured house variant. Connected geometry pieces are recovered from the material batches. A seeded upper damage volume removes complete tiles, beams and panels, preserves foundations, darkens retained geometry with localized vertex-color scorch, and scatters a bounded number of original fragments. Original UVs and texture maps remain on surviving parts and debris. Source house assets remain unchanged. Large connected shells are treated conservatively; this is component removal, not arbitrary mesh fracture. The standalone Ruined House node remains available but is no longer substituted for town houses.

New Damage & Effects nodes: Ruined House, Rubble Scatter, Fire Emitter, Smoke Emitter. Add effect recipes to nodes creates editable starter graphs; each source can also be added individually through the node menu. Fire/smoke output in the modeling workspace is a static mesh preview. Scene Studio uses the shared emitter parameters with animated procedural particles; mesh exports do not carry these animations.

Play/Pause and Restart operate the effects clock. Playback speed is applied when generating or triggering a test effect. Test fire at view target uses the orbit target; Clear test effect removes it. Fire and smoke can be enabled independently. Scene files save damage and effect settings and rebuild from the seed; transient test emitters and playback position are not saved. PNG captures the current frame, not animation.

First visual-effects foundation: no physical destruction, spell collision/damage, dynamic fire lighting, video export, or game-engine particle export yet. Existing scenes without damage settings stay intact. No browser or behavior tests were run for this change.

Build correction: removed an extra closing parenthesis in the original-house debris rotation expression.

## v49.64.82 - Flame volume and roof openings
Fire now uses an animated procedural ray-marched shader volume, with no downloaded flame textures. This is a visual density approximation, not a fluid simulation. Smoke remains particle-based. Roof shells and other retained upper geometry are clipped against the seeded burn volume, preserving interpolated UVs and normals. Cut boundaries are open, not capped fracture solids. Browser appearance and performance have not been tested.

## Burned landscape - v49.64.82
Scene Studio adds Burned trees (%), Scorched ground (%), and Trees still burning (%). Burn selection is seeded and preserved by the scene settings. Original node tree geometry is reused: green material batches are hidden for burned instances, remaining parts are charcoal-tinted. This foliage heuristic targets the built-in green tree recipes; arbitrary custom foliage colors may remain as scorched silhouettes. Ground receives procedural vertex-color ash/char patches. A maximum of 12 tree fire/smoke sources is emitted for performance, controlled by the global fire/smoke switches. Burned-town aftermath applies high building/tree damage, scorched terrain and restrained effects. The existing renderer, not a game simulation, drives these visuals. No browser testing performed.

## v49.64.84 - Charcoal hearth and emissive damage
Damaged house fire origins are placed on a surviving upward-facing surface below 65% of building height. Raised, faceted charcoal pieces sit at the fire origin. Procedural surface shading darkens the hearth and damaged geometry, with sparse pulsing emissive cracks rather than uniformly glowing walls. The effects clock also drives ember materials. Flames use stronger three-dimensional turbulence, irregular lobes and a less white-hot palette. No downloaded textures or physical gas simulation. No visual testing performed.

## v49.64.85 - Scene-wide soot and atmosphere
Scene Studio adds Scene grime and Drifting smoke controls. Grime is applied to intact and damaged buildings, props, rocks, trees and roads using non-periodic world-space noise with coarse soot, fine grain and vertical streaks. Materials keep their original maps under the shading. Ground weathering replaces the periodic vertex/normal pattern with irregular charcoal, soil and ash shading. Water and visual effects are excluded. Atmospheric smoke has a separate density control and is saved with scene settings. Grime defaults to 0.75; use zero for original clean materials. These are appearance approximations, not physical combustion. Browser appearance and shader compilation have not been tested.

## v49.64.86 - Video-reference fire and smoke pass
Flame density now has sharper boundaries, twisting flow and separate curling lobes. Small independent sparks rise and fade. Smoke replaces point sprites with a bounded ray-marched noise volume: expanding billows, shaded density and thinning tops. Both use the scene playback clock and embedded procedural shaders, not external textures. This approximates fluid appearance, not a fluid simulation. Many simultaneous volumes can increase GPU cost; reduce smoke and active fires on slower devices. Reference video was sampled locally; no browser shader or appearance validation was performed.

## v49.64.88 - Lighting brightness controls
Render now includes Ambient light, alongside Sun strength and Exposure. Exposure can be lowered to 0.05. Lighting inputs apply on change without regenerating or reframing the town. Dusk lighting sets low ambient/sun, reduced exposure and a dark blue-gray sky. New scenes start with ambient 0.55, sun 2 and exposure 0.8; saved values retain their settings. Ambient light is included in scene saves. Browser testing not performed.
