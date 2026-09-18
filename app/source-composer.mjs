export const studioModuleOrder = Object.freeze([
  "bootstrap",
  "plugins",
  "plugin-installer",
  "plugin-catalogue",
  "plugin-export-bridge",
  "plugin-generator-bridge",
  "plugin-character-bridge",
  "plugin-graph-bridge",
  "viewport",
  "toolbar",
  "meshes",
  "geometry-building-details",
  "geometry-building",
  "scene-environment-nodes",
  "geometry-nature-details",
  "village-props",
  "scene-damage-effects",
  "geometry-assets",
  "geometry-nodes",
  "import-export",
  "usd-io",
  "autosave-update",
  "mcp-bridge",
  "ai-viewer",
  "rigging",
  "workspace-tools",
  "legacy-clip-compat",
  "animator-workspace",
  "pose-straightener",
  "dice-demo",
  "panels",
  "scene-studio",
  "edition-handoff",
  "scenes-toolbar"
]);

export async function composeStudioSource(readModule) {
  const parts = await Promise.all(studioModuleOrder.map(async name => {
    const source = await readModule(name);
    return `// ---- app/modules/${name}.js ----\n${source.trim()}\n`;
  }));
  return `// Generated from canonical feature modules. Do not edit this bundle.\n${parts.join("\n")}`;
}
