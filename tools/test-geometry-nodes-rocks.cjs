const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { chromium } = require("C:/Users/sir_d/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright");

const geometryBounds = object => {
  const positions = object.geometry?.positions || [];
  const xs = [], ys = [], zs = [];
  for (let index = 0; index < positions.length; index += 3) {
    xs.push(Number(positions[index]));
    ys.push(Number(positions[index + 1]));
    zs.push(Number(positions[index + 2]));
  }
  return { minX: Math.min(...xs), maxX: Math.max(...xs), minY: Math.min(...ys), maxY: Math.max(...ys), minZ: Math.min(...zs), maxZ: Math.max(...zs), halfX: (Math.max(...xs) - Math.min(...xs)) * .5, halfZ: (Math.max(...zs) - Math.min(...zs)) * .5 };
};

const worldXZBounds = objects => {
  let minX = Infinity, maxX = -Infinity, minZ = Infinity, maxZ = -Infinity;
  for (const object of objects) {
    const positions = object.geometry?.positions || [];
    const angle = Number(object.rotation?.[1] || 0) * Math.PI / 180;
    const cosine = Math.cos(angle), sine = Math.sin(angle);
    for (let index = 0; index < positions.length; index += 3) {
      const localX = Number(positions[index]), localZ = Number(positions[index + 2]);
      const x = localX * cosine + localZ * sine + Number(object.position?.[0] || 0);
      const z = -localX * sine + localZ * cosine + Number(object.position?.[2] || 0);
      minX = Math.min(minX, x); maxX = Math.max(maxX, x);
      minZ = Math.min(minZ, z); maxZ = Math.max(maxZ, z);
    }
  }
  return { minX, maxX, minZ, maxZ };
};

const assertClosedCapUvs = (object, slug) => {
  const positions = object.geometry?.positions || [], uvs = object.geometry?.uvs || [];
  const savedIndices = object.geometry?.indices || [];
  const indices = savedIndices.length ? savedIndices : Array.from({ length: positions.length / 3 }, (_, index) => index);
  assert.equal(uvs.length, positions.length / 3 * 2, `${slug} ${object.name} must have complete UVs`);
  const bounds = geometryBounds(object), height = Math.max(.001, bounds.maxY - bounds.minY);
  const planarBottomVertices = [];
  for (let vertex = 0; vertex < positions.length / 3; vertex++) {
    const y = Number(positions[vertex * 3 + 1]), v = Number(uvs[vertex * 2 + 1]);
    if (y <= bounds.minY + height * .08 && v > .04 && v < .96) planarBottomVertices.push(vertex);
  }
  assert(planarBottomVertices.length >= 5, `${slug} ${object.name} must have a planar bottom UV island`);
  let downwardCap = false;
  for (let index = 0; index < indices.length; index += 3) {
    const ia = Number(indices[index]), ib = Number(indices[index + 1]), ic = Number(indices[index + 2]);
    if (![ia, ib, ic].some(vertex => planarBottomVertices.includes(vertex))) continue;
    const ax = positions[ia * 3], ay = positions[ia * 3 + 1], az = positions[ia * 3 + 2];
    const bx = positions[ib * 3], by = positions[ib * 3 + 1], bz = positions[ib * 3 + 2];
    const cx = positions[ic * 3], cy = positions[ic * 3 + 1], cz = positions[ic * 3 + 2];
    const normalY = (bz - az) * (cx - ax) - (bx - ax) * (cz - az);
    if (normalY < -.00001 && Math.max(ay, by, cy) <= bounds.minY + height * .1) downwardCap = true;
  }
  assert(downwardCap, `${slug} ${object.name} bottom cap must face downward`);
};

const assertGrassRootsOutsideSources = (project, slug) => {
  const grass = project.scene.objects.find(object => /Grass sheets$/.test(object.name || ""));
  assert(grass, `${slug} must contain procedural grass`);
  const roots = [];
  const positions = grass.geometry?.positions || [];
  for (let index = 0; index < positions.length; index += 3) {
    if (Math.abs(Number(positions[index + 1]) - .015) < .002) roots.push([Number(positions[index]), Number(positions[index + 2])]);
  }
  assert(roots.length > 0, `${slug} must expose grass roots for mask QA`);
  const sources = project.scene.objects.filter(object => /(?:Rock \d+|Wall stone \d+\.\d+\.\d+)$/.test(object.name || ""));
  for (const source of sources) {
    const { halfX, halfZ } = geometryBounds(source);
    const rotation = -(Number(source.rotation?.[1] || 0) * Math.PI / 180);
    for (const [x, z] of roots) {
      const offsetX = x - Number(source.position?.[0] || 0);
      const offsetZ = z - Number(source.position?.[2] || 0);
      const localX = offsetX * Math.cos(rotation) - offsetZ * Math.sin(rotation);
      const localZ = offsetX * Math.sin(rotation) + offsetZ * Math.cos(rotation);
      const inside = /Wall stone/.test(source.name)
        ? Math.abs(localX) < halfX && Math.abs(localZ) < halfZ
        : (localX / halfX) ** 2 + (localZ / halfZ) ** 2 < 1;
      assert(!inside, `${slug} grass root clips ${source.name}`);
    }
  }
};

const makeCluster = ({ name, sourceType, detailTypes, seed, params }) => {
  const nodeOrder = ["seed", sourceType, ...detailTypes, "transform", "output"];
  return { kind: "boltworks-node-cluster", version: 1, name, graph: {
    id: `qa-${name}`, name, type: "geometry", seed,
    params: { ...params, transformX: 0, transformY: 0, transformZ: 0, outputName: name }, nodeOrder,
    nodePositions: Object.fromEntries(nodeOrder.map((node, index) => [node, [30 + index * 210, index % 2 ? 70 : 130]])),
    smoothNodes: [], generatedIds: [], buildVersion: 0, view: { x: 0, y: 0, scale: 1 },
    connections: nodeOrder.slice(0, -1).map((fromNodeId, index) => ({ id: `qa-link-${name}-${index}`, fromNodeId, toNodeId: nodeOrder[index + 1] }))
  } };
};

const assets = [
  { slug: "rounded-rock-cluster-grass", sourceLabel: "Rock 1", minObjects: 7,
    cluster: makeCluster({ name: "Natural Boulder Cluster", sourceType: "rocks", detailTypes: ["moss", "grass"], seed: 117,
      params: { rockProfile: "boulder", rockArrangement: "cluster", rockCount: 6, rockSize: 1.2, rockVariation: .78, rockSpacing: 1.08, rockColor: "#535e59", mossPlacement: "top", mossCoverage: .48, mossThickness: .07, mossMoisture: .76, mossSunlight: .28, mossCrackBias: .25, mossColor: "#315f2a", grassCount: 12, grassHeight: .42, grassWidth: .036, grassSpread: .2, grassAvoidGeometry: true, grassClearance: .14 } }) },
  { slug: "stacked-fieldstones", sourceLabel: "Rock 1", minObjects: 11,
    cluster: makeCluster({ name: "Supported Fieldstone Cairn", sourceType: "rocks", detailTypes: ["grass"], seed: 219,
      params: { rockProfile: "flat", rockArrangement: "stack", rockCount: 10, rockSize: 1.12, rockVariation: .58, rockSpacing: .9, rockColor: "#59635f", grassCount: 6, grassHeight: .32, grassWidth: .032, grassSpread: .12, grassAvoidGeometry: true, grassClearance: .12 } }) },
  { slug: "mossy-dry-stone-wall", sourceLabel: "Wall stone 1.1.1", minObjects: 180,
    cluster: makeCluster({ name: "Mossy Dry Stone Wall", sourceType: "stoneWall", detailTypes: ["moss", "grass"], seed: 311,
      params: { wallLength: 12, wallHeight: 3.2, wallDepth: 1.25, wallRows: 5, wallColumns: 9, wallDepthLayers: 3, wallIrregularity: .68, wallColorVariation: .66, wallColor: "#59625e", mossPlacement: "all", mossCoverage: .52, mossThickness: .065, mossMoisture: .86, mossSunlight: .22, mossCrackBias: .82, grassCount: 18, grassHeight: .38, grassWidth: .034, grassSpread: .18, grassAvoidGeometry: true, grassClearance: .14 } }) }
  ,{ slug: "jagged-rock-outcrop", sourceLabel: "Rock 1", minObjects: 5,
    cluster: makeCluster({ name: "Jagged Rock Outcrop", sourceType: "rocks", detailTypes: ["grass"], seed: 417,
      params: { rockProfile: "jagged", rockArrangement: "cluster", rockCount: 4, rockSize: 1.2, rockVariation: .92, rockSpacing: 1.15, rockColor: "#505a57", grassCount: 8, grassHeight: .36, grassWidth: .032, grassSpread: .16, grassAvoidGeometry: true, grassClearance: .13 } }) }
  ,{ slug: "flat-mossy-fieldstones", sourceLabel: "Rock 1", minObjects: 6,
    cluster: makeCluster({ name: "Flat Mossy Fieldstones", sourceType: "rocks", detailTypes: ["moss", "grass"], seed: 509,
      params: { rockProfile: "flat", rockArrangement: "cluster", rockCount: 5, rockSize: 1.08, rockVariation: .7, rockSpacing: 1.12, rockColor: "#606963", mossPlacement: "top", mossCoverage: .66, mossThickness: .055, mossMoisture: .82, mossSunlight: .2, mossCrackBias: .3, mossColor: "#315f2a", grassCount: 9, grassHeight: .3, grassWidth: .03, grassSpread: .14, grassAvoidGeometry: true, grassClearance: .12 } }) }
];

(async () => {
  const browser = await chromium.launch({ headless: true, executablePath: "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe" });
  try {
    const selectedAssets = process.env.BWS_ASSET ? assets.filter(asset => asset.slug === process.env.BWS_ASSET) : assets;
    for (const asset of selectedAssets) {
      const context = await browser.newContext({ viewport: { width: 1700, height: 1050 }, acceptDownloads: true });
      const page = await context.newPage();
      page.on("dialog", dialog => dialog.accept());
      page.on("pageerror", error => console.error(`PAGE ERROR (${asset.slug}):`, error));
      await page.goto(`http://127.0.0.1:4173/?geometry-${asset.slug}-qa=2`);
      await page.waitForFunction(() => !!window.ModelerStudio);
      if (!await page.locator("#pluginManagerBody").isVisible()) await page.locator("#pluginManagerToggle").click();
      assert.equal(await page.locator('[data-plugin-row="geometry-nodes"] .plugin-ready').innerText(), "OFF");
      await page.locator('[data-plugin-toggle="geometry-nodes"]').click();
      assert.equal(await page.locator('[data-texture-channel="normal"]').count(), 1, "Texture Editor must expose a Normal channel");
      assert.equal(await page.locator("#textureEditorMaterialPreview").count(), 1, "Texture Editor must expose a material preview sphere");
      await page.locator("#newWorkspaceBtn").click();
      if (!await page.locator("#geometryNodesBody").isVisible()) await page.locator("#geometryNodesToggle").click();
      assert.equal(await page.locator("#geometryNodeGraphSelect option:checked").innerText(), "Untitled Geometry");
      assert.equal(await page.locator("#geometryNodeCanvas .geometry-node-card").count(), 2);
      await page.locator("#geometryNodeClusterFile").setInputFiles({ name: `${asset.slug}.bwnc`, mimeType: "application/json", buffer: Buffer.from(JSON.stringify(asset.cluster)) });
      await page.locator("#geometryNodeBuildBtn").click();
      if (process.env.BWS_DIAG) {
        await page.waitForTimeout(5000);
        console.log("STATUS:", await page.locator("#geometryNodeStatus").innerText());
        console.log("SCENE:", (await page.locator("#sceneTree").innerText()).slice(0, 2000));
        await page.screenshot({ path: `exports/${asset.slug}-diagnostic.png`, fullPage: false });
        await context.close();
        continue;
      }
      await page.waitForFunction(label => document.querySelector("#sceneTree")?.textContent.includes(label), asset.sourceLabel, { timeout: 120000 });
      await page.locator("#geometryNodeGraphSelect").selectOption({ label: "Untitled Geometry" });
      await page.locator("#geometryNodeDeleteBtn").click();

      const popupPromise = page.waitForEvent("popup");
      await page.locator("#geometryNodeDetachBtn").click();
      const popup = await popupPromise;
      await popup.waitForLoadState("load");
      await popup.locator('[data-geometry-view="fit"]').click();
      await popup.screenshot({ path: `exports/${asset.slug}-nodes.png`, fullPage: false });
      const clusterDownloadPromise = popup.waitForEvent("download");
      await popup.locator("#geometryNodeDetachedSaveClusterBtn").click();
      const clusterDownload = await clusterDownloadPromise;
      const clusterPath = path.resolve("exports", `${asset.slug}.bwnc`);
      await clusterDownload.saveAs(clusterPath);
      const payload = JSON.parse(fs.readFileSync(clusterPath, "utf8"));
      assert.equal(payload.graph.params.transformX, 0);
      assert.equal(payload.graph.params.grassAvoidGeometry, true);
      assert(payload.graph.params.grassClearance > 0);
      assert(payload.graph.nodeOrder.includes(asset.cluster.graph.nodeOrder[1]));

      await page.locator("#resetZoomBtn").click();
      await page.waitForTimeout(450);
      await page.screenshot({ path: `exports/${asset.slug}-preview.png`, fullPage: false });
      if (asset.cluster.graph.nodeOrder.includes("stoneWall")) {
        for (const [viewName, buttonId] of [["front", "#previewFrontBtn"], ["back", "#previewBackBtn"], ["left", "#previewLeftBtn"], ["right", "#previewRightBtn"], ["top", "#previewTopBtn"], ["iso", "#previewIsoBtn"]]) {
          await page.locator(buttonId).click();
          await page.waitForTimeout(250);
          await page.locator("#canvas").screenshot({ path: `exports/${asset.slug}-${viewName}.png` });
        }
      }
      await popup.locator("#geometryNodeDetachedBakeBtn").click();
      const projectDownloadPromise = page.waitForEvent("download");
      await page.locator("#saveProjectBtn").click();
      const projectDownload = await projectDownloadPromise;
      const projectPath = path.resolve("exports", `${asset.slug}.modelerproj`);
      await projectDownload.saveAs(projectPath);
      const project = JSON.parse(fs.readFileSync(projectPath, "utf8"));
      assert(project.scene.objects.length >= asset.minObjects);
      assert(project.scene.objects.some(object => (object.geometry?.uvs || []).length > 0));
      const stoneSources = project.scene.objects.filter(object => /(?:Rock \d+|Wall stone \d+\.\d+\.\d+)$/.test(object.name || ""));
      for (const source of stoneSources.slice(0, 12)) assertClosedCapUvs(source, asset.slug);
      for (const moss of project.scene.objects.filter(object => / Moss \d+$/.test(object.name || ""))) {
        assert.equal(moss.shape, "custom", `${asset.slug} moss must be a projected custom surface`);
        assert((moss.geometry?.positions || []).length > 0, `${asset.slug} moss overlay must contain surface triangles`);
        const source = project.scene.objects.find(source => /(?:Rock \d+|Wall stone \d+\.\d+\.\d+)$/.test(source.name || "")
          && source.position.every((value, index) => Math.abs(Number(value) - Number(moss.position[index])) < .0001)
          && source.rotation.every((value, index) => Math.abs(Number(value) - Number(moss.rotation[index])) < .0001));
        assert(source, `${asset.slug} moss must share its source transform`);
        const sourceBounds = geometryBounds(source), mossPositions = moss.geometry?.positions || [];
        let embeddedVertices = 0;
        for (let vertex = 0; vertex < mossPositions.length; vertex += 3) {
          const x = Number(mossPositions[vertex]), y = Number(mossPositions[vertex + 1]), z = Number(mossPositions[vertex + 2]);
          if (x >= sourceBounds.minX && x <= sourceBounds.maxX && y >= sourceBounds.minY && y <= sourceBounds.maxY && z >= sourceBounds.minZ && z <= sourceBounds.maxZ) embeddedVertices++;
        }
        assert(embeddedVertices > 0, `${asset.slug} moss must intersect its source rock for Combine into Shell`);
      }
      const crackMoss = project.scene.objects.find(object => / Moss cracks$/.test(object.name || ""));
      if (asset.cluster.graph.nodeOrder.includes("stoneWall")) {
        if (asset.cluster.graph.nodeOrder.includes("moss")) assert(crackMoss, `${asset.slug} must generate crack-biased moss`);
        if (crackMoss) {
          const crackBounds = geometryBounds(crackMoss);
          assert(crackBounds.minZ < -.1 && crackBounds.maxZ > .1, `${asset.slug} crack moss must cover both wall faces`);
        }
        const wallStones = project.scene.objects.filter(object => /Wall stone \d+\.\d+\.\d+$/.test(object.name || ""));
        assert(new Set(wallStones.map(object => object.name.match(/Wall stone (\d+)\./)?.[1])).size >= 2, `${asset.slug} must contain staggered depth layers`);
        assert(new Set(wallStones.map(object => object.color)).size >= 8, `${asset.slug} must vary stone colors`);
      }
      if (asset.cluster.graph.params.rockArrangement === "cluster") {
        const rocks = project.scene.objects.filter(object => / Rock \d+$/.test(object.name || ""));
        for (const rock of rocks) {
          const bounds = geometryBounds(rock);
          assert(rocks.some(other => {
            if (other === rock) return false;
            const otherBounds = geometryBounds(other);
            const dx = Math.abs(Number(rock.position[0]) - Number(other.position[0]));
            const dz = Math.abs(Number(rock.position[2]) - Number(other.position[2]));
            return dx <= (bounds.halfX + otherBounds.halfX) * 1.08 && dz <= (bounds.halfZ + otherBounds.halfZ) * 1.08;
          }), `${asset.slug} ${rock.name} must touch the clustered outcrop`);
        }
      }
      assertGrassRootsOutsideSources(project, asset.slug);
      const centeredBounds = worldXZBounds(stoneSources);
      const centerX = (centeredBounds.minX + centeredBounds.maxX) * .5;
      const centerZ = (centeredBounds.minZ + centeredBounds.maxZ) * .5;
      assert(Math.abs(centerX) < .12 && Math.abs(centerZ) < .12, `${asset.slug} should remain centered, got ${centerX}, ${centerZ}`);
      assert(project.pluginData["geometry-nodes"].graphs.every(graph => graph.generatedIds.length === 0));

      const reloadPage = await context.newPage();
      reloadPage.on("dialog", dialog => dialog.accept());
      await reloadPage.goto(`http://127.0.0.1:4173/?geometry-${asset.slug}-reload-qa=2`);
      await reloadPage.waitForFunction(() => !!window.ModelerStudio);
      await reloadPage.locator("#importProjectFile").setInputFiles(projectPath);
      await reloadPage.waitForFunction(label => document.querySelector("#sceneTree")?.textContent.includes(label), asset.sourceLabel, { timeout: 120000 });
      if (!await reloadPage.locator("#geometryNodesBody").isVisible()) await reloadPage.locator("#geometryNodesToggle").click();
      const reloadPopupPromise = reloadPage.waitForEvent("popup");
      await reloadPage.locator("#geometryNodeDetachBtn").click();
      const reloadPopup = await reloadPopupPromise;
      await reloadPopup.waitForLoadState("load");
      for (const nodeId of asset.cluster.graph.nodeOrder) assert.equal(await reloadPopup.locator(`[data-geometry-node="${nodeId}"]`).count(), 1, `${nodeId} must survive project reload`);
      await context.close();
    }
    console.log("PASS: centered natural boulders, supported cairn, packed dry-stone wall, crack-aware moss, exclusion-masked grass, and PBR normal preview UI built, baked, saved, and reloaded.");
  } finally {
    await browser.close();
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
