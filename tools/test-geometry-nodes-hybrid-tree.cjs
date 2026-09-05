const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { chromium } = require("C:/Users/sir_d/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright");

(async () => {
  const browser = await chromium.launch({
    headless: true,
    executablePath: "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe"
  });
  try {
    const context = await browser.newContext({ viewport: { width: 1600, height: 1050 }, acceptDownloads: true, permissions: ["clipboard-read", "clipboard-write"] });
    const page = await context.newPage();
    await page.goto("http://127.0.0.1:4173/?geometry-hybrid-tree-qa=1");
    await page.waitForFunction(() => !!window.ModelerStudio);
    if (!await page.locator("#pluginManagerBody").isVisible()) await page.locator("#pluginManagerToggle").click();
    assert.equal(await page.locator('[data-plugin-row="geometry-nodes"] .plugin-ready').innerText(), "OFF");
    await page.locator('[data-plugin-toggle="geometry-nodes"]').click();
    await page.evaluate(() => localStorage.removeItem("boltworks.geometryNodes.v1"));
    await page.reload();
    await page.waitForFunction(() => !!window.ModelerStudio);
    if (!await page.locator("#geometryNodesBody").isVisible()) await page.locator("#geometryNodesToggle").click();

    const popupPromise = page.waitForEvent("popup");
    await page.locator("#geometryNodeDetachBtn").click();
    const popup = await popupPromise;
    await popup.waitForLoadState("load");

    for (const type of ["variant", "trunk", "branches", "smoothJoints", "twigs", "canopy", "cutSurface"]) {
      await popup.locator(`[data-geometry-remove-node="${type}"]`).click();
    }
    const addNode = async type => {
      await popup.locator(".geometry-node-palette").evaluate(element => { element.open = true; });
      await popup.locator(`[data-geometry-add-node="${type}"]`).click();
    };
    for (const type of ["stem", "branchArray", "junctionBlend", "clusterScatter", "join"]) await addNode(type);

    const connect = async (from, to) => {
      await popup.locator(`[data-geometry-node="${from}"] [data-geometry-connect-from]`).click();
      await popup.locator(`[data-geometry-node="${to}"] [data-geometry-connect-to]`).click();
    };
    await connect("seed", "stem");
    await connect("stem", "branchArray");
    await connect("branchArray", "junctionBlend");
    await connect("junctionBlend", "clusterScatter");
    await connect("clusterScatter", "join");
    await connect("join", "output");

    await popup.locator(".geometry-node-palette").evaluate(element => { element.open = false; });
    const positions = {
      seed: [30, 130], stem: [230, 30], branchArray: [430, 30], junctionBlend: [630, 105],
      clusterScatter: [830, 55], join: [1030, 130], output: [1230, 130]
    };
    for (const [nodeId, target] of Object.entries(positions)) {
      const card = popup.locator(`[data-geometry-node="${nodeId}"]`);
      const handle = card.locator(".geometry-node-title");
      const current = await card.evaluate(element => [element.offsetLeft, element.offsetTop]);
      const box = await handle.boundingBox();
      await popup.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
      await popup.mouse.down();
      await popup.mouse.move(box.x + box.width / 2 + target[0] - current[0], box.y + box.height / 2 + target[1] - current[1], { steps: 4 });
      await popup.mouse.up();
    }

    const fill = async (key, value) => popup.locator(`[data-geometry-param="${key}"]`).fill(String(value));
    await fill("seed", 73);
    await fill("stemHeight", 9.5);
    await fill("stemBaseRadius", .52);
    await fill("stemTopRadius", .13);
    await fill("stemSegments", 12);
    await fill("stemSides", 14);
    await fill("stemLean", .12);
    await fill("stemFlare", .28);
    await fill("branchArrayCount", 7);
    await fill("branchArrayLength", 2.45);
    await fill("branchArrayRise", .72);
    await fill("branchArrayRadius", .19);
    await fill("branchArrayTaper", .22);
    await fill("branchArrayTwist", 24);
    await fill("junctionBlendSize", 1.32);
    await fill("junctionBlendLength", 1.55);
    await fill("clusterScatterCount", 13);
    await fill("clusterScatterSize", .92);
    await fill("clusterScatterSpread", .5);
    await fill("outputName", "Hybrid Smooth Stem Tree");

    await popup.getByRole("button", { name: "Build / Update Geometry" }).click();
    await page.waitForFunction(() => document.querySelector("#sceneTree")?.textContent.includes("Hybrid Smooth Stem Tree Stem continuous"));
    const sceneText = await page.locator("#sceneTree").innerText();
    assert.match(sceneText, /Stem continuous/);
    assert.match(sceneText, /Branch array 1/);
    assert.match(sceneText, /Junction blend 1/);
    assert.match(sceneText, /Cluster scatter/);

    await popup.locator('[data-geometry-view="fit"]').click();
    await popup.screenshot({ path: "exports/hybrid-smooth-stem-tree-nodes.png", fullPage: false });
    await page.locator("#resetZoomBtn").click();
    await page.waitForTimeout(350);
    await page.screenshot({ path: "exports/hybrid-smooth-stem-tree-preview.png", fullPage: false });

    const downloadPromise = page.waitForEvent("download");
    await page.locator("#saveProjectBtn").click();
    const download = await downloadPromise;
    await download.saveAs(path.resolve("exports/hybrid-smooth-stem-tree.modelerproj"));
    assert.equal(await popup.locator(".geometry-node-card.inactive").count(), 0);

    const clusterDownloadPromise = popup.waitForEvent("download");
    await popup.locator("#geometryNodeDetachedSaveClusterBtn").click();
    const clusterDownload = await clusterDownloadPromise;
    const clusterPath = path.resolve("exports/hybrid-smooth-stem-tree.bwnc");
    await clusterDownload.saveAs(clusterPath);
    const clusterPayload = JSON.parse(fs.readFileSync(clusterPath, "utf8"));
    assert.equal(clusterPayload.kind, "boltworks-node-cluster");
    assert.equal(clusterPayload.version, 1);
    assert.equal(clusterPayload.graph.generatedIds.length, 0);
    assert.equal(clusterPayload.graph.connections.length, 6);

    await popup.locator("#geometryNodeDetachedCopyBtn").click();
    const nodeString = await popup.evaluate(() => navigator.clipboard.readText());
    assert.equal(JSON.parse(nodeString).kind, "boltworks-node-cluster");
    const beforeImportCount = await popup.locator("#geometryNodeDetachedGraphSelect option").count();
    popup.once("dialog", dialog => dialog.accept(nodeString));
    await popup.locator("#geometryNodeDetachedPasteBtn").click();
    assert.equal(await popup.locator("#geometryNodeDetachedGraphSelect option").count(), beforeImportCount + 1);
    assert.match(await popup.locator("#geometryNodeDetachedStatus").innerText(), /new editable graph/);

    await popup.locator("#geometryNodeDetachedClusterFile").setInputFiles(clusterPath);
    await popup.waitForFunction(expected => document.querySelectorAll("#geometryNodeDetachedGraphSelect option").length === expected, beforeImportCount + 2);
    assert.equal(await popup.locator("#geometryNodeDetachedGraphSelect option").count(), beforeImportCount + 2);
    assert.match(await popup.locator("#geometryNodeDetachedGraphSelect option:checked").innerText(), /Hybrid Smooth Stem Tree 3/);
    console.log("PASS: reusable Geometry Nodes built and saved the hybrid smooth-stem tree.");
  } finally {
    await browser.close();
  }
})().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
