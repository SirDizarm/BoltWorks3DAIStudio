// Shared workspace and plugin UI; no Minecraft authoring or exporter.
function bwsEscapeHtml(value) {
  return String(value ?? "").replace(/[&<>"']/g, character => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[character]);
}

function setWorkspace(name, { quiet = false } = {}) {
  const workspace = name === "scene" ? "scene" : "general";
  document.body.dataset.workspace = workspace;
  if (els.workspaceSelect) els.workspaceSelect.value = workspace === "scene" ? "general" : workspace;
  localStorage.setItem("boltworks.workspace", workspace);
  requestAnimationFrame(()=>{
    if(document.body.dataset.workspace!==workspace)return;
    if(workspace==="scene"){
      try{setAnimatorWorkspace(false);openBwsSceneStudio();}catch(error){console.error(error);setWorkspace("general",{quiet:true});alert("Scene Studio could not start: "+error.message);}
    }else if(bwsSceneStudio){bwsSceneStudio.host.hidden=true;window.dispatchEvent(new Event("resize"));}
  });
  if (!quiet) log(workspace === "scene" ? "Scene Studio workspace enabled." : "General 3D workspace enabled.");
}

function renderPluginManager() {
  bwsEnsurePluginInstallUi();
  const plugins = allPluginManifests();
  if (els.pluginCountLabel) els.pluginCountLabel.textContent = String(plugins.length);
  if (!els.pluginList) return;
  els.pluginList.innerHTML = plugins.map(plugin => `<div class="plugin-row" data-plugin-row="${bwsEscapeHtml(plugin.id)}"><div class="plugin-summary"><strong>${bwsEscapeHtml(plugin.name)}</strong><span>${bwsEscapeHtml(plugin.id)} · v${bwsEscapeHtml(plugin.version)} · ${plugin.bundled ? "Included compatibility module" : "Installed package"}</span></div><div class="plugin-actions"><span class="plugin-ready">${plugin.enabled ? "On" : "Off"}</span><button type="button" data-plugin-toggle="${bwsEscapeHtml(plugin.id)}">${plugin.enabled ? "Disable" : "Enable"}</button>${!plugin.bundled && plugin.enabled && plugin.runtime === "sandbox-html" ? `<button type="button" data-plugin-open="${bwsEscapeHtml(plugin.id)}">Open</button>` : ""}${plugin.bundled ? "" : `<button type="button" class="danger" data-plugin-remove="${bwsEscapeHtml(plugin.id)}">Remove</button>`}</div></div>`).join("");
}

function downloadPluginTemplate() {
  download("boltworks-plugin-template.bwsplugin", JSON.stringify(pluginTemplate(), null, 2), "application/json");
  log("Created an editable BoltWorks .bwsplugin package template.");
}

async function importPluginManifest(file) {
 if(file.size>4_000_000)throw Error("Plugin package must be smaller than 4 MB.");
 return bwsReviewPluginInstall(await file.text(),"Local file: "+file.name);
}

function initializeWorkspaceTools(){
  setWorkspace(localStorage.getItem("boltworks.workspace")||"general",{quiet:true});
  renderPluginManager();
  els.workspaceSelect?.addEventListener("change",event=>setWorkspace(event.target.value));
  els.animationSequenceAddBtn?.addEventListener("click", () => {
    if (typeof hasBwsAnimationClips === "function" && hasBwsAnimationClips()) { addBwsAnimationSequenceClip(els.animationSequenceClipSelect?.value); return; }
    const clipIndex = Number(els.animationSequenceClipSelect?.value);
    if (!Number.isInteger(clipIndex) || !minecraftAnimationClips[clipIndex]) return;
    minecraftAnimationSequence.push(clipIndex);
    renderMinecraftAnimationSequence();
  });
  els.animationSequenceClearBtn?.addEventListener("click", () => { if (typeof hasBwsAnimationClips === "function" && hasBwsAnimationClips()) { bwsAnimationSequence = []; renderBwsAnimationSequence(); return; } cancelMinecraftAnimationSequencePreview(); minecraftAnimationSequence = []; renderMinecraftAnimationSequence(); });
  els.animationSequencePreviewBtn?.addEventListener("click", () => {
    if (typeof hasBwsAnimationClips === "function" && hasBwsAnimationClips()) previewBwsAnimationSequence();
    else if (els.animationSequencePreviewBtn.textContent.includes("Stop")) cancelMinecraftAnimationSequencePreview();
    else previewMinecraftAnimationSequence();
  });
  els.animationSequenceList?.addEventListener("click", event => {
    const remove = event.target.closest("[data-sequence-remove]");
    if (remove) { minecraftAnimationSequence.splice(Number(remove.dataset.sequenceRemove), 1); renderMinecraftAnimationSequence(); return; }
    const move = event.target.closest("[data-sequence-move]");
    if (!move) return;
    const from = Number(move.dataset.sequenceIndex), to = from + Number(move.dataset.sequenceMove);
    if (from < 0 || to < 0 || from >= minecraftAnimationSequence.length || to >= minecraftAnimationSequence.length) return;
    [minecraftAnimationSequence[from], minecraftAnimationSequence[to]] = [minecraftAnimationSequence[to], minecraftAnimationSequence[from]];
    renderMinecraftAnimationSequence();
  });
  els.pluginTemplateBtn?.addEventListener("click", downloadPluginTemplate);
  els.pluginImportBtn?.addEventListener("click", () => els.pluginImportFile?.click());
  els.pluginImportFile?.addEventListener("change", async event => {
    const file = event.target.files?.[0]; if (!file) return;
    try { await importPluginManifest(file); } catch (error) { log(`Plugin import failed: ${error.message}`); }
    event.target.value = "";
  });
  els.pluginList?.addEventListener("click", async event => {
    const open=event.target.closest("[data-plugin-open]");if(open){try{bwsOpenPluginWorkspace(open.dataset.pluginOpen);}catch(error){log(error.message);}return;}
    const toggle = event.target.closest("[data-plugin-toggle]");
    if (toggle) {
      const id = toggle.dataset.pluginToggle;
      const plugin = pluginManifestById(id);
      if (!plugin || !await setPluginEnabled(id, !plugin.enabled)) return;
      applyPluginAvailability(els);
      renderPluginManager();
      log(`${plugin.name} ${plugin.enabled ? "disabled" : "enabled"}.`);
      return;
    }
    const remove = event.target.closest("[data-plugin-remove]");
    if (!remove) return;
    const plugin = pluginManifestById(remove.dataset.pluginRemove);
    if (!plugin || !await removeInstalledPlugin(plugin.id)) return;
    applyPluginAvailability(els);
    renderPluginManager();
    log(`Removed plugin package ${plugin.name}.`);
  });
}
