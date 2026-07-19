# BoltWorks coordinate system

- BoltWorks uses a right-handed coordinate system.
- `Y` is vertical and positive `Y` points upward.
- The visual grid is the ground plane at exactly `Y = 0`.
- `X` and `Z` form the horizontal ground plane.
- One BoltWorks unit is one Roblox stud.
- DAE conversion uses `1 stud = 0.28 meters`.
- Bone positions should be returned in world space unless a request explicitly requires local space.
- Bone rotations are Euler `XYZ` values in radians unless `rotationUnit` says `degrees`.

## Ground rule

No required body geometry may unintentionally extend below `Y = 0`. A standing rig must include explicit left and right contact bones at `Y = 0`. The AI must inspect the front, back, left, right, top, and isometric views before claiming that the model is grounded.

The grid is a reference plane, not a floor mesh. A future Scene Capture module may replace its appearance with a texture or model, but the mathematical ground remains `Y = 0`.
