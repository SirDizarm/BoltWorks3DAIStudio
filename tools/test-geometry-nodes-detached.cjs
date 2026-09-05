const assert = require("node:assert/strict");
const { chromium } = require("C:/Users/sir_d/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright");

(async () => {
  const browser = await chromium.launch({
    headless: true,
    executablePath: "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe"
  });
  try {
    const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
    const pageErrors = [];
    page.on("pageerror", error => pageErrors.push(error.message));
    await page.goto("http://127.0.0.1:4173/?geometry-detached-test=1");
    await page.waitForFunction(() => !!window.ModelerStudio);
    if (!await page.locator("#pluginManagerBody").isVisible()) await page.locator("#pluginManagerToggle").click();
    assert.equal(await page.locator('[data-plugin-row="geometry-nodes"] .plugin-ready').innerText(), "OFF");
    await page.locator('[data-plugin-toggle="geometry-nodes"]').click();
    if (!await page.locator("#geometryNodesBody").isVisible()) await page.locator("#geometryNodesToggle").click();
    const graphSelect = page.locator("#geometryNodeGraphSelect");
    if (!await graphSelect.locator("option").count()) await page.locator("#geometryNodeNewBtn").click();

    const popupPromise = page.waitForEvent("popup", { timeout: 5000 }).catch(() => null);
    await page.locator("#geometryNodeDetachBtn").click();
    const popup = await popupPromise;
    if (!popup) {
      const status = await page.locator("#geometryNodeStatus").innerText();
      throw new Error(`Detached window did not open. Status: ${status}. Page errors: ${pageErrors.join(" | ") || "none"}`);
    }
    await popup.waitForLoadState("load");
    assert.equal(await popup.locator(".geometry-node-card").count(), 9);
    await popup.waitForFunction(() => document.querySelectorAll(".geometry-node-link").length === 8);
    assert.match(await popup.title(), /BoltWorks Geometry Nodes/);
    const connectorLayout = await popup.evaluate(() => ({
      canvas: document.querySelector(".geometry-node-canvas").getBoundingClientRect().toJSON(),
      svg: document.querySelector(".geometry-node-links").getBoundingClientRect().toJSON(),
      cards: [...document.querySelectorAll(".geometry-node-card")].map(card => ({
        type: card.dataset.geometryNode,
        offsetLeft: card.offsetLeft,
        offsetTop: card.offsetTop,
        offsetWidth: card.offsetWidth,
        offsetParent: card.offsetParent?.className,
        bounds: card.getBoundingClientRect().toJSON(),
        position: getComputedStyle(card).position,
        width: getComputedStyle(card).width
      })),
      paths: [...document.querySelectorAll(".geometry-node-link")].map(path => ({ d: path.getAttribute("d"), bounds: path.getBoundingClientRect().toJSON() }))
    }));
    assert.equal(connectorLayout.paths.length, 8);
    assert.ok(connectorLayout.paths.every(path => path.bounds.bottom < connectorLayout.canvas.top + 250), JSON.stringify(connectorLayout));

    assert.equal(await popup.locator('[data-geometry-node="seed"] .geometry-node-port.input').count(), 0);
    assert.equal(await popup.locator('[data-geometry-node="trunk"] .geometry-node-port.input').count(), 1);
    assert.equal(await popup.locator('[data-geometry-node="trunk"] .geometry-node-port.output').count(), 1);
    assert.equal(await popup.locator('[data-geometry-node="output"] .geometry-node-port.output').count(), 0);
    assert.equal(await popup.locator('[data-geometry-param="variantStyle"]').inputValue(), "classic");
    assert.equal(await popup.locator('[data-geometry-param="jointSize"]').inputValue(), "0.85");
    assert.equal(await popup.locator('[data-geometry-node-type="bark"]').count(), 0);
    assert.equal(await popup.locator('[data-geometry-param="cutRingCount"]').inputValue(), "7");
    await popup.locator('[data-geometry-param="variantStyle"]').selectOption("broad");
    await popup.locator('[data-geometry-param="variantSeason"]').selectOption("autumn");
    await popup.locator('[data-geometry-param="variantMaturity"]').selectOption("sapling");
    await popup.locator(".geometry-node-palette summary").click();
    await popup.locator('[data-geometry-add-node="roots"]').click();
    assert.equal(await popup.locator(".geometry-node-card").count(), 10);
    await popup.waitForFunction(() => document.querySelectorAll(".geometry-node-link").length === 8);
    assert.equal(await popup.locator(".geometry-node-link").count(), 8);
    assert.equal(await popup.locator('[data-geometry-node="roots"] .geometry-node-port.input').count(), 1);
    assert.equal(await popup.locator('[data-geometry-node="roots"] .geometry-node-port.output').count(), 1);
    await popup.getByRole("button", { name: "Remove Root Flare node" }).click();
    assert.equal(await popup.locator(".geometry-node-card").count(), 9);
    await popup.locator(".geometry-node-palette").evaluate(element => { element.open = true; });
    await popup.locator('[data-geometry-add-node="primitiveTest"]').click();
    assert.equal(await popup.locator('[data-geometry-add-node="smoothGeometry"]').count(), 1);
    await popup.locator('[data-geometry-node="trunk"]').click({ button: "right" });
    assert.equal(await popup.locator(".geometry-node-context-menu").isVisible(), true);
    assert.match(await popup.locator(".geometry-node-context-menu").innerText(), /Advanced values/);
    await popup.locator(".geometry-node-context-menu details").evaluate(element => { element.open = true; });
    assert.match(await popup.locator(".geometry-node-context-menu").innerText(), /Node ID/);
    await popup.locator('.geometry-node-context-menu [data-geometry-attach-type="smoothGeometry"]').click();
    await popup.locator('[data-geometry-node="primitiveTest"]').evaluate(element => element.dispatchEvent(new MouseEvent("contextmenu", { bubbles: true, cancelable: true, clientX: 520, clientY: 420 })));
    await popup.locator('.geometry-node-context-menu [data-geometry-attach-type="smoothGeometry"]').click();
    assert.equal(await popup.locator(".geometry-node-card").count(), 12);
    const trunkSmooth = popup.locator('[data-geometry-node-type="smoothGeometry"]').filter({ hasText: "Smooth Geometry: Trunk" });
    const primitiveSmooth = popup.locator('[data-geometry-node-type="smoothGeometry"]').filter({ hasText: "Smooth Geometry: Primitive Smooth Test" });
    assert.equal(await trunkSmooth.locator('[data-geometry-param="axis"]').inputValue(), "xyz");
    assert.deepEqual(await trunkSmooth.locator('[data-geometry-param="axis"] option').evaluateAll(options => options.map(option => option.value)), ["xyz", "xy", "xz", "yz", "x", "y", "z"]);
    await trunkSmooth.locator('[data-geometry-param="axis"]').selectOption("z");
    await trunkSmooth.locator('[data-geometry-param="strength"]').fill("4");
    assert.equal(await primitiveSmooth.locator('[data-geometry-param="axis"]').inputValue(), "xyz");
    assert.equal(await primitiveSmooth.locator('[data-geometry-param="strength"]').inputValue(), "0.72");
    await primitiveSmooth.locator('[data-geometry-connect-from]').click();
    await popup.locator('[data-geometry-node="output"] [data-geometry-connect-to]').click();

    await popup.locator(".geometry-node-palette").evaluate(element => { element.open = false; });
    await popup.locator(".geometry-node-viewport").click({ button: "right", position: { x: 420, y: 320 } });
    assert.match(await popup.locator(".geometry-node-context-menu").innerText(), /Add node here/);
    await popup.locator('.geometry-node-context-menu [data-geometry-add-node="smoothGeometry"]').click();
    const freeSmooth = popup.locator('[data-geometry-node-type="smoothGeometry"]').last();
    assert.equal(await freeSmooth.locator('[data-geometry-param="strength"]').inputValue(), "0.72");
    await popup.locator('[data-geometry-node="canopy"] [data-geometry-connect-from]').click();
    await freeSmooth.locator('[data-geometry-connect-to]').click();
    await freeSmooth.locator('[data-geometry-connect-from]').click();
    await popup.locator('[data-geometry-node="cutSurface"] [data-geometry-connect-to]').click();

    await popup.locator(".geometry-node-palette").evaluate(element => { element.open = true; });
    await popup.locator('[data-geometry-add-node="knot"]').click();
    await popup.locator('[data-geometry-node="trunk"] [data-geometry-connect-from]').click();
    await popup.locator('[data-geometry-node="knot"] [data-geometry-connect-to]').click();
    await popup.locator('[data-geometry-node="knot"] [data-geometry-connect-from]').click();
    await popup.locator('[data-geometry-node="output"] [data-geometry-connect-to]').click();
    assert.equal(await popup.locator(".geometry-node-card").count(), 14);
    await popup.waitForFunction(() => document.querySelectorAll(".geometry-node-link").length === 14);
    assert.equal(await popup.locator(".geometry-node-link").count(), 14);
    await popup.locator(".geometry-node-link-hit").first().click({ button: "right", force: true });
    assert.match(await popup.locator(".geometry-node-context-menu").innerText(), /Disconnect/);
    await popup.keyboard.press("Escape");

    await popup.locator('[data-geometry-node="seed"]').click({ button: "right" });
    assert.match(await popup.locator(".geometry-node-context-menu").innerText(), /Draw connection/);
    assert.match(await popup.locator(".geometry-node-context-menu").innerText(), /Advanced values/);
    await popup.keyboard.press("Escape");
    await popup.locator('[data-geometry-view="zoom-out"]').click();
    assert.notEqual(await popup.locator('[data-geometry-zoom-label]').innerText(), "100%");
    await popup.locator('[data-geometry-view="fit"]').click();
    const viewportBox = await popup.locator(".geometry-node-viewport").boundingBox();
    const transformBeforeWheel = await popup.locator("#geometryNodeDetachedCanvas").evaluate(element => element.style.transform);
    await popup.mouse.move(viewportBox.x + viewportBox.width / 2, viewportBox.y + viewportBox.height / 2);
    await popup.mouse.wheel(0, -240);
    const transformAfterWheel = await popup.locator("#geometryNodeDetachedCanvas").evaluate(element => element.style.transform);
    assert.notEqual(transformAfterWheel, transformBeforeWheel);
    await popup.mouse.down({ button: "middle" });
    await popup.mouse.move(viewportBox.x + viewportBox.width / 2 + 45, viewportBox.y + viewportBox.height / 2 + 30);
    await popup.mouse.up({ button: "middle" });
    const transformAfterPan = await popup.locator("#geometryNodeDetachedCanvas").evaluate(element => element.style.transform);
    assert.notEqual(transformAfterPan, transformAfterWheel);
    await popup.locator('[data-geometry-node="canopy"]').evaluate(element => element.dispatchEvent(new MouseEvent("contextmenu", { bubbles: true, cancelable: true, clientX: 500, clientY: 420 })));
    await popup.locator(".geometry-node-context-menu details").evaluate(element => { element.open = true; });
    await popup.screenshot({ path: "exports/geometry-nodes-context-menu-qa.png", fullPage: false });

    await popup.locator('[data-geometry-param="height"]').fill("11");
    assert.equal(await page.locator('[data-geometry-param="height"]').inputValue(), "11");
    await popup.locator('[data-geometry-param="variantSeason"]').selectOption("snowy");
    await popup.getByRole("button", { name: "Build / Update Geometry" }).click();
    await page.waitForFunction(() => document.querySelector("#sceneTree")?.textContent.includes("Snow"));
    assert.match(await page.locator("#sceneTree").innerText(), /Joint blend/);
    assert.doesNotMatch(await page.locator("#sceneTree").innerText(), /Bark wrinkle/);
    assert.match(await page.locator("#sceneTree").innerText(), /Trunk continuous/);
    assert.match(await page.locator("#sceneTree").innerText(), /Knot 1 cut ring/);
    assert.match(await page.locator("#sceneTree").innerText(), /Cut ring/);
    assert.match(await page.locator("#sceneTree").innerText(), /QA Cube smoothed/);
    assert.match(await page.locator("#sceneTree").innerText(), /QA Pentagon smoothed/);
    assert.match(await page.locator("#sceneTree").innerText(), /QA Low cone smoothed/);
    assert.match(await popup.locator("#geometryNodeDetachedStatus").innerText(), /linked to \d+ generated parts/);
    await page.locator("#resetZoomBtn").click();
    await page.waitForTimeout(250);
    await page.screenshot({ path: "exports/geometry-nodes-detail-qa.png", fullPage: false });
    await popup.locator('[data-geometry-param="variantStyle"]').selectOption("bare");
    await popup.getByRole("button", { name: "Build / Update Geometry" }).click();
    await page.waitForFunction(() => !document.querySelector("#sceneTree")?.textContent.includes("Snow"));
    await popup.close();

    const reopenedPromise = page.waitForEvent("popup");
    await page.locator("#geometryNodeDetachBtn").click();
    const reopened = await reopenedPromise;
    assert.equal(await reopened.locator('[data-geometry-param="height"]').inputValue(), "11");
    assert.equal(await reopened.locator('[data-geometry-node-type="smoothGeometry"]').filter({ hasText: "Smooth Geometry: Trunk" }).locator('[data-geometry-param="strength"]').inputValue(), "4");
    if (!await page.locator("#pluginManagerBody").isVisible()) await page.locator("#pluginManagerToggle").click();
    await page.locator(".plugin-row").filter({ hasText: "geometry-nodes" }).getByRole("button", { name: "Disable" }).click();
    await page.waitForTimeout(100);
    assert.equal(reopened.isClosed(), true);
    assert.equal(await page.locator("#geometryNodeCanvas").textContent(), "");
    console.log("PASS: detached Geometry Nodes editor shares state, reopens, and unloads with its plugin.");
  } finally {
    await browser.close();
  }
})().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
