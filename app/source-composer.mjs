export const studioModuleOrder = Object.freeze([
  "bootstrap",
  "plugins",
  "viewport",
  "toolbar",
  "meshes",
  "import-export",
  "rigging",
  "panels"
]);

export async function composeStudioSource(readModule) {
  const parts = await Promise.all(studioModuleOrder.map(async name => {
    const source = await readModule(name);
    return `// ---- app/modules/${name}.js ----\n${source.trim()}\n`;
  }));
  return `// Generated from canonical feature modules. Do not edit this bundle.\n${parts.join("\n")}`;
}
