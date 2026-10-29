# File-based AI editing without MCP

An AI that cannot connect to the live studio can return a complete `.modelerproj`,
or a small edit recipe for an existing project. The edit recipe is an offline
helper format; the studio imports the generated `.modelerproj`, not the recipe.

## Relative placement and protected parts

Give the AI the existing project and ask it to return `edits.json`:

```json
{
  "protectedIds": ["head", "snout", "teeth"],
  "operations": [
    {
      "action": "add",
      "id": "hand-left",
      "fields": {
        "name": "Left hand",
        "shape": "box",
        "position": [0, 0, 0],
        "rotation": [0, 0, 0],
        "scale": [0.3, 0.25, 0.35],
        "color": "#765432",
        "roughness": 0.9
      },
      "positionFrom": {
        "relativeTo": "arm-left",
        "anchor": "bottom",
        "ownAnchor": "top",
        "offset": [0, -0.03, 0.08],
        "keepLinked": true
      }
    }
  ]
}
```

Run from the project root:

```text
node BoltWorksStudioAi/tools/relative-edit.mjs original.modelerproj edits.json revised.modelerproj
node BoltWorksStudioAi/tools/inspect-project.mjs revised.modelerproj --surface-warnings
```

`add` creates an object; `update` changes only the fields named in `fields`.
Operations run in order, so a later part can reference one added earlier.
`protectedIds` rejects edits to those IDs. The original project is not overwritten,
and the output path must be new. Saved objects with `"locked": true` also reject
edits. The helper prints the changed IDs and concise old/new field values so
an AI can review a small iteration without rereading the whole file. Large
geometry values are summarized rather than dumped to the terminal.

Anchors are `center`, `left`, `right`, `bottom`, `top`, `back`, and `front` on
world-aligned bounds after rotation. `anchor` selects the reference object's
point; `ownAnchor` selects the point on the edited object to align to it.
Positive Z is the front for this helper. `offset` is a world-space XYZ vector.
Relative anchors support boxes, panels, and custom geometry. Other shapes need
reviewed bounds before they can use this operation. `keepLinked: true` writes
`relativePlacement` into the saved object so supported BWS versions can keep the
relationship live when the parent moves. Without it, placement is calculated
once; later changes to the reference object do not move the child.

For precise measurements and proportions, query any object's approximate
world bounds and its size as a fraction of the whole scene:

```text
node BoltWorksStudioAi/tools/inspect-project.mjs revised.modelerproj --bounds arm-left --json
```

The full `--json` inspection report includes `approximateBounds` on each
object. These are world-aligned boxes, so rotated or irregular shapes can have
larger bounds than their visible surface.

`--surface-warnings` adds up to 30 potential coplanar face pairs and 30
approximate volume overlaps to the normal inspection report. It checks objects
rotated by multiples of 90 degrees. Character body parts commonly overlap on
purpose; these are **review candidates**, not errors or an assertion that the
model is broken. The report prompts inspection of those spots in a fresh QA
Sheet. It never automatically separates geometry.

## Existing curved forms and visual iteration

The studio already supports `torus`, `ring`, `tube`, and `curvedPanel`. For a
strap that follows a path, use the offline generator in
[`AI_GEOMETRY_RECIPES.md`](AI_GEOMETRY_RECIPES.md). It creates a closed custom
mesh from points. The result can be refined as ordinary geometry in BWS.

The offline preview tool can shorten iteration:

```text
node BoltWorksStudioAi/tools/render-offline-preview.mjs revised.modelerproj revised-preview.png
```

The offline renderer supports common primitives (box, panel, sphere, cylinder,
cone, torus, ring, capsule) and custom triangle geometry. It reports omitted
shapes; the PNG is an approximate four-view preview without live materials or
textures. The preview and diagnostics do not replace loading the exact result in BWS and
reviewing a new QA Sheet. This helper only edits project files; the editor
controls and any geometry generators are separate features.

Run a repeatable end-to-end check of the offline recipe, protected objects,
bounds query, importable project, and optional preview rendering:

```text
node BoltWorksStudioAi/tools/test-file-based-workflow.mjs --preview
```

The small input and recipe live under `BoltWorksStudioAi/examples/offline-ai-*`.
The check writes only to a temporary directory and removes it afterward.
