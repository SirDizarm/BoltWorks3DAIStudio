(() => {
  "use strict";

  if (window.BoltWorksSelection) return;

  const ACTION_ATTRIBUTE = "data-boltworks-selection-action";
  const actions = Object.freeze({
    "select all": "select-all",
    deselect: "deselect",
    "hide all": "hide-all",
    "un hide all": "unhide-all",
    "unhide all": "unhide-all",
    group: "group",
    ungroup: "ungroup",
    "merge mesh": "merge-mesh",
    duplicate: "duplicate"
  });

  const normalize = (value) =>
    String(value || "").replace(/\s+/g, " ").trim().toLowerCase();

  function actionFor(button) {
    return actions[normalize(button.textContent)] || "";
  }

  function refresh(root = document) {
    root.querySelectorAll("button").forEach((button) => {
      const action = actionFor(button);
      if (action) button.setAttribute(ACTION_ATTRIBUTE, action);
    });
  }

  function buttonsFor(action) {
    return Array.from(
      document.querySelectorAll(
        "[" + ACTION_ATTRIBUTE + '="' + action + '"]'
      )
    );
  }

  function invoke(action) {
    const button = buttonsFor(action)[0];
    if (!button || button.disabled) return false;
    button.click();
    return true;
  }

  function onClick(event) {
    const button = event.target.closest(
      "button[" + ACTION_ATTRIBUTE + "]"
    );
    if (!button) return;

    const action = button.getAttribute(ACTION_ATTRIBUTE);
    queueMicrotask(() => {
      window.dispatchEvent(
        new CustomEvent("boltworks:selection-action", {
          detail: { action, button }
        })
      );
    });
  }

  refresh();
  document.addEventListener("click", onClick);

  const observer = new MutationObserver(() => refresh());
  observer.observe(document.documentElement, {
    childList: true,
    subtree: true
  });

  window.BoltWorksSelection = Object.freeze({
    actions: Object.freeze(Array.from(new Set(Object.values(actions)))),
    refresh,
    buttonsFor,
    invoke,
    dispose() {
      observer.disconnect();
      document.removeEventListener("click", onClick);
    }
  });
})();
