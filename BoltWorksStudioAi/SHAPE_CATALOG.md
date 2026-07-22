# Built-in shape catalogue

All dimensions below describe the unscaled local geometry. Object `scale` is
applied before rotation.

| Shape key | Canonical orientation and useful facts |
|---|---|
| `box` | Unit box centered at origin, local bounds ±0.5 on XYZ. Scale equals final dimensions before rotation. |
| `sphere` | Radius 0.55, centered at origin. |
| `cylinder` | Height 1 on local Y, radius 0.48 in local XZ. To make an axle along Z, rotate X by 90°. |
| `cone` | Height 1 on local Y, radius 0.55 in XZ. |
| `torus` | Ring lies in local XY with symmetry/depth axis Z. Major radius 0.42, tube radius 0.14. |
| `panel` | Box-like panel, local size 1 × 1 × 0.08. Its thin/depth axis is local Z. |
| `wedge` | Right-triangle cross-section in local XY, extruded through local Z. See exact rule below. |
| `hollowBox` | Rectangular frame in local XY, shallow depth on local Z. |
| `tube` | Hollow tube along local Y. Outer radius 0.5 in XZ. |
| `curvedPanel` | Curved arc with canonical extrusion/depth along local Y. Always verify rotation visually. |
| `ring` | Flat ring in local XY with depth along local Z. |
| `arch` | Arch silhouette in local XY, extruded along local Z. |
| `hemisphere` | Upper half-sphere: dome rises toward local +Y; flat face is at local Y=0. |
| `dome` | Shallower hemisphere rising toward local +Y. |
| `capsule` | Main length runs along local Y. |
| `pyramid` | Square base toward local -Y, apex toward local +Y. |
| `prism` | Triangular prism: triangular faces lie at local ±Z. Triangle apex points local +Y. |
| `tetrahedron` | Centered regular tetrahedron. Orientation must be checked in QA. |
| `pyramidFrustum` | Square large base toward local -Y and smaller top toward local +Y. |
| `facetedBallLow` | Centered icosphere with 20 triangles. |
| `facetedBallMedium` | Centered icosphere with 80 triangles. |
| `facetedBallHigh` | Centered icosphere with 320 triangles. |
| `heart` | Heart silhouette in local XY, shallow extrusion along local Z. |
| `stair` | Four steps, spanning local X and rising in local +Y while advancing in local +Z. |
| `beveledPanel` | Usually saved with generated custom `geometry`; do not author it as an empty shape without geometry. |

## Wedge rule

The Wedge triangle uses these local XY vertices:

```text
(-0.5, -0.5)  lower-left
( 0.5, -0.5)  lower-right
( 0.5,  0.5)  upper-right
```

It is extruded from local `Z = -0.5` to `Z = +0.5`. The vertical edge is on
local `+X`; the slope runs from local lower-left to upper-right.

### Symmetric gable recipe

A single Wedge is a right triangle and cannot form a centered house gable.
Use two mirrored halves. For a gable whose wall plane is YZ and whose thickness
is X:

- negative-Z half: place at `z = -quarterWidth`, rotate Y `-90`;
- positive-Z half: place at `z = +quarterWidth`, rotate Y `+90`;
- each half uses local X scale `halfWidth`, Y scale `gableHeight`, and local Z
  scale `wallThickness`;
- both upper tips must meet at `z = 0`.

Example for total width 4.0, height 1.5 and thickness 0.2:

```json
[
  {
    "shape": "wedge",
    "position": [3, 4, -1],
    "rotation": [0, -90, 0],
    "scale": [2, 1.5, 0.2]
  },
  {
    "shape": "wedge",
    "position": [3, 4, 1],
    "rotation": [0, 90, 0],
    "scale": [2, 1.5, 0.2]
  }
]
```

This recipe must still be verified in Left/Right and Iso views.

## Thin-surface rule

Never put two opaque surfaces on exactly the same plane. Offset trim, glass,
brake discs, decals and panels slightly or give them intentionally different
thickness. Coplanar surfaces cause z-fighting.

## Rotation rule for beams

For a beam connecting two known points, calculate the midpoint, length and
rotation from those endpoints. Do not guess an angle separately from its
position. For mirrored sloped beams, confirm that both inner endpoints meet and
both outer endpoints land at the same height.
