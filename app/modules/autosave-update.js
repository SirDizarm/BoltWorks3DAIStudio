const BWS_RECOVERY_DB_NAME = "boltworks-studio-recovery";
const BWS_RECOVERY_STORE = "projects";
const BWS_RECOVERY_KEY = "latest-project";
const BWS_AUTO_SAVE_DELAY_MS = 1200;
const BWS_UPDATE_CHECK_MS = 45000;
const bwsAutoSaveStatus = document.querySelector("#autoSaveStatus");
const bwsUpdateAvailableBtn = document.querySelector("#updateAvailableBtn");
const bwsCurrentVersion = (document.querySelector('meta[name="application-version"]')?.content.match(/v?(\d+(?:\.\d+)+)/)?.[1]) || "0";
let bwsAutoSaveTimer = null;
let bwsAutoSavePromise = Promise.resolve(false);
let bwsRecoveryDatabasePromise = null;
let bwsUpdateVersion = null;

function setBwsAutoSaveStatus(message, kind = "") {
  if (!bwsAutoSaveStatus) return;
  bwsAutoSaveStatus.textContent = message;
  bwsAutoSaveStatus.classList.toggle("saved", kind === "saved");
  bwsAutoSaveStatus.classList.toggle("problem", kind === "problem");
}

function openBwsRecoveryDatabase() {
  if (bwsRecoveryDatabasePromise) return bwsRecoveryDatabasePromise;
  bwsRecoveryDatabasePromise = new Promise((resolve, reject) => {
    const request = indexedDB.open(BWS_RECOVERY_DB_NAME, 1);
    request.onupgradeneeded = () => {
      const database = request.result;
      if (!database.objectStoreNames.contains(BWS_RECOVERY_STORE)) database.createObjectStore(BWS_RECOVERY_STORE, { keyPath: "id" });
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error || new Error("Could not open recovery storage."));
  });
  return bwsRecoveryDatabasePromise;
}

async function writeBwsRecoveryRecord(project) {
  const database = await openBwsRecoveryDatabase();
  return new Promise((resolve, reject) => {
    const transaction = database.transaction(BWS_RECOVERY_STORE, "readwrite");
    transaction.objectStore(BWS_RECOVERY_STORE).put({
      id: BWS_RECOVERY_KEY,
      appVersion: bwsCurrentVersion,
      savedAt: new Date().toISOString(),
      project
    });
    transaction.oncomplete = () => resolve(true);
    transaction.onerror = () => reject(transaction.error || new Error("Could not write the recovery save."));
    transaction.onabort = () => reject(transaction.error || new Error("Recovery save was interrupted."));
  });
}

async function readBwsRecoveryRecord() {
  const database = await openBwsRecoveryDatabase();
  return new Promise((resolve, reject) => {
    const transaction = database.transaction(BWS_RECOVERY_STORE, "readonly");
    const request = transaction.objectStore(BWS_RECOVERY_STORE).get(BWS_RECOVERY_KEY);
    request.onsuccess = () => resolve(request.result || null);
    request.onerror = () => reject(request.error || new Error("Could not read the recovery save."));
  });
}

async function clearBwsRecoveryRecord() {
  if (bwsAutoSaveTimer) {
    clearTimeout(bwsAutoSaveTimer);
    bwsAutoSaveTimer = null;
  }
  const database = await openBwsRecoveryDatabase();
  return new Promise((resolve, reject) => {
    const transaction = database.transaction(BWS_RECOVERY_STORE, "readwrite");
    transaction.objectStore(BWS_RECOVERY_STORE).delete(BWS_RECOVERY_KEY);
    transaction.oncomplete = () => resolve(true);
    transaction.onerror = () => reject(transaction.error || new Error("Could not clear the recovery save."));
    transaction.onabort = () => reject(transaction.error || new Error("Clearing the recovery save was interrupted."));
  });
}

function saveProjectAutoRecoveryNow() {
  if (bwsAutoSaveTimer) {
    clearTimeout(bwsAutoSaveTimer);
    bwsAutoSaveTimer = null;
  }
  if (isProjectLoading || isRestoring || !objects.length) return Promise.resolve(false);
  const project = projectState();
  setBwsAutoSaveStatus("Saving recovery…");
  bwsAutoSavePromise = bwsAutoSavePromise
    .catch(() => false)
    .then(() => writeBwsRecoveryRecord(project))
    .then(() => {
      const time = new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
      setBwsAutoSaveStatus(`Auto-saved ${time}`, "saved");
      return true;
    })
    .catch(error => {
      console.warn("BoltWorks recovery save failed", error);
      setBwsAutoSaveStatus("Recovery save unavailable", "problem");
      return false;
    });
  return bwsAutoSavePromise;
}

function scheduleProjectAutoSave() {
  if (isProjectLoading || isRestoring || !objects.length) return;
  if (bwsAutoSaveTimer) clearTimeout(bwsAutoSaveTimer);
  setBwsAutoSaveStatus("Unsaved changes…");
  bwsAutoSaveTimer = setTimeout(saveProjectAutoRecoveryNow, BWS_AUTO_SAVE_DELAY_MS);
}

async function restoreAutoSavedProjectIfBlank() {
  if (objects.length) return false;
  try {
    const recovery = await readBwsRecoveryRecord();
    if (!recovery?.project?.scene?.objects?.length || objects.length) return false;
    loadProjectData(recovery.project, `Automatic recovery (${recovery.savedAt || "latest"})`);
    const time = recovery.savedAt ? new Date(recovery.savedAt).toLocaleString() : "latest save";
    setBwsAutoSaveStatus(`Recovered ${time}`, "saved");
    return true;
  } catch (error) {
    console.warn("BoltWorks recovery restore failed", error);
    setBwsAutoSaveStatus("Recovery storage unavailable", "problem");
    return false;
  }
}

function compareBwsVersions(left, right) {
  const a = String(left).split(".").map(value => Number(value) || 0);
  const b = String(right).split(".").map(value => Number(value) || 0);
  for (let index = 0; index < Math.max(a.length, b.length); index += 1) {
    if ((a[index] || 0) !== (b[index] || 0)) return (a[index] || 0) - (b[index] || 0);
  }
  return 0;
}

async function checkForBwsUpdate() {
  if (!/^https?:$/.test(location.protocol)) return null;
  try {
    const checkUrl = new URL(location.pathname || "/", location.href);
    checkUrl.searchParams.set("__bws_version_check", String(Date.now()));
    const response = await fetch(checkUrl.href, { cache: "no-store", headers: { Accept: "text/html" } });
    if (!response.ok) return null;
    const html = await response.text();
    const available = html.match(/<meta\s+name=["']application-version["']\s+content=["']v?(\d+(?:\.\d+)+)/i)?.[1];
    if (!available || compareBwsVersions(available, bwsCurrentVersion) <= 0) return null;
    bwsUpdateVersion = available;
    if (bwsUpdateAvailableBtn) {
      bwsUpdateAvailableBtn.hidden = false;
      bwsUpdateAvailableBtn.textContent = `Update to v${available}`;
      bwsUpdateAvailableBtn.title = "Save a recovery copy, reload BoltWorks, and restore this project in the new version";
    }
    return available;
  } catch (error) {
    console.debug("BoltWorks update check skipped", error);
    return null;
  }
}

bwsUpdateAvailableBtn?.addEventListener("click", async () => {
  bwsUpdateAvailableBtn.disabled = true;
  bwsUpdateAvailableBtn.textContent = "Saving before update…";
  await saveProjectAutoRecoveryNow();
  const nextUrl = new URL(location.href);
  nextUrl.searchParams.set("bwsUpdated", bwsUpdateVersion || String(Date.now()));
  location.replace(nextUrl.href);
});

document.addEventListener("visibilitychange", () => {
  if (document.visibilityState === "hidden") saveProjectAutoRecoveryNow();
});

setTimeout(checkForBwsUpdate, 5000);
setInterval(checkForBwsUpdate, BWS_UPDATE_CHECK_MS);
