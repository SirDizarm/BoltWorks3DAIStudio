import { readFileSync } from "node:fs";

const mobileHtml = readFileSync(new URL("../mobile.html", import.meta.url), "utf8");
const studioHtml = readFileSync(new URL("../index.html", import.meta.url), "utf8");
const mobileScript = readFileSync(new URL("../app/panels/mobile-workspace.js", import.meta.url), "utf8");
const styles = readFileSync(new URL("../app/styles/studio.css", import.meta.url), "utf8");

for (const required of ["BoltWorks Mobile Studio", "index.html?mobile=1", "viewport-fit=cover"]) {
  if (!mobileHtml.includes(required)) throw new Error(`Missing mobile entry feature: ${required}`);
}

for (const required of [
  "mobile-workspace.js?v=49.59.6",
  'id="canvas"',
  'id="sceneTree"',
  'id="inspectorSection"',
  'id="animationSection"',
  'id="saveProjectBtn"',
  'id="loadProjectBtn"',
  'id="outputToolsOpenBtn"'
]) {
  if (!studioHtml.includes(required)) throw new Error(`Full studio is not available to mobile: ${required}`);
}

for (const required of [
  'data-mobile-action="scene"',
  'data-mobile-action="view"',
  'data-mobile-action="edit"',
  'data-mobile-action="animate"',
  'data-mobile-action="more"',
  "mobile-left-open",
  "mobile-right-open",
  "mobile-command-sheet",
  "modelToolsOpenBtn",
  "surfaceEditorOpenBtn",
  "cameraControlsOpenBtn",
  "loadProjectUrlBtn",
  "data-mobile-selector",
  "mobile-reference-views-open",
  "setReferenceViewsVisible",
]) {
  if (!mobileScript.includes(required)) throw new Error(`Missing mobile workspace behavior: ${required}`);
}

for (const required of [
  'button.classList.contains("active")',
  'if (action === "animate") leaveAnimator();',
  "setActive(null)"
]) {
  if (!mobileScript.includes(required)) throw new Error(`Missing mobile navigation toggle behavior: ${required}`);
}

for (const required of [
  "html.mobile-layout .app",
  ".mobile-workspace-nav",
  ".mobile-command-sheet",
  ".app.mobile-left-open .left",
  ".app.mobile-right-open .right",
  ".app.animator-mode"
]) {
  if (!styles.includes(required)) throw new Error(`Missing responsive mobile style: ${required}`);
}

for (const required of [
  "html.mobile-layout .top > .toolbar-group { display: none !important; }",
  "html.mobile-layout .top #toolbarUndoGroup,",
  "html.mobile-layout .top #toolbarSnapGroup { display: flex !important; }",
  ".app.mobile-reference-views-open .reference-viewports",
  "overflow-x: hidden;"
]) {
  if (!styles.includes(required)) throw new Error(`Missing simplified mobile toolbar style: ${required}`);
}

if (mobileScript.includes('data-mobile-target="undoBtn"')) {
  throw new Error("Undo must remain in the mobile top bar instead of being duplicated in More.");
}

if (mobileScript.includes("mobile-scroll-rail") || styles.includes(".mobile-scroll-rail")) {
  throw new Error("The removed mobile edge-scroll zones must not be recreated.");
}

console.log("Full Mobile Studio smoke check passed.");
