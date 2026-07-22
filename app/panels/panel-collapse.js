// Register panel collapsing before the 3D application starts. This keeps the
// editor chrome usable even if a later renderer or import feature fails.
const panelCollapseStoragePrefix = "boltworks.panel.collapsed.";

function restorePersistedPanelStates() {
  document.querySelectorAll(".section[data-collapse-persist]").forEach(function (section) {
    const key = section.dataset.collapsePersist;
    const toggle = section.querySelector(":scope > .section-header");
    if (!key || !toggle) return;
    try {
      const saved = localStorage.getItem(panelCollapseStoragePrefix + key);
      const collapsed = saved == null ? section.classList.contains("collapsed") : saved === "true";
      section.classList.toggle("collapsed", collapsed);
      toggle.setAttribute("aria-expanded", String(!collapsed));
    } catch (_) {
      // Local storage can be unavailable for some direct file:// browser modes.
    }
  });
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", restorePersistedPanelStates, { once: true });
} else {
  restorePersistedPanelStates();
}

document.addEventListener("click", function (event) {
  const toggle = event.target.closest && event.target.closest(".section-header");
  if (!toggle) return;
  const section = toggle.closest(".section");
  if (!section) return;
  const collapsed = section.classList.toggle("collapsed");
  toggle.setAttribute("aria-expanded", String(!collapsed));
  const persistKey = section.dataset.collapsePersist;
  if (persistKey) {
    try {
      localStorage.setItem(panelCollapseStoragePrefix + persistKey, String(collapsed));
    } catch (_) {
      // Collapsing still works when persistence is unavailable.
    }
  }
  event.__boltworksSectionHandled = true;
}, true);
