# Procedural AI Notes

The app now exposes a dedicated procedural mesh layer through:

- `./MeshFactory.js`
- `window.ModelerStudio.proceduralTemplates()`
- `window.ModelerStudio.proceduralTemplateCatalog()`
- `window.ModelerStudio.buildProceduralAssembly(kind, options)`
- `window.ModelerStudio.addProceduralAssembly(kind, options, extra)`

## Current procedural templates

- `truss_boom_segment`
- `hook_block`
- `crawler_base`
- `operator_cabin`
- `simple_crawler_crane`

## Example console usage

```js
window.ModelerStudio.addProceduralAssembly("simple_crawler_crane", {
  boomLength: 8.5,
  baseWidth: 5,
  cabinColor: "#b86e46"
}, {
  offset: [0, 1.2, 0],
  prefix: "demo_"
});
```

## Why this helps AI later

Instead of asking an AI to invent every triangle directly, we can let it:

1. Pick a procedural template.
2. Change its dimensions and colors.
3. Duplicate or combine multiple assemblies.
4. Layer manual mesh edits on top afterward.

That gives us a much better path for things like cranes, beams, hooks, cabins, supports, scaffolds, medieval framing, and other structured assets.
