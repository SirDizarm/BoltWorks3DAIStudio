# Mesh button previews - v49.64.36

All 24 primitive Add Mesh buttons now include a static image rendered from their actual shapeFactories geometry, a wrapping text label, and an accessible name. Descriptive tooltips clarify less familiar shapes. Faceted balls include their triangle edges.

A separate short-lived WebGL renderer generates one thumbnail per idle callback, releases all preview geometries/materials, then releases its context. Images remain as static PNGs; there are no animated canvases or new scene objects. If WebGL thumbnail creation fails, text buttons still work. Clear is an action rather than a mesh and is unchanged.

Canonical sources panels.js and studio.css synchronized with index.html and studio-v49.64.36.js. Build only; no live browser visual validation performed for this change.
