(function () {
  "use strict";

  const params = new URLSearchParams(window.location.search);
  const forcedMobile = params.get("mobile");
  const compactViewport = window.matchMedia("(max-width: 820px)").matches;
  const mobileEnabled = forcedMobile === "1" || (forcedMobile !== "0" && compactViewport);

  if (!mobileEnabled) return;

  document.documentElement.classList.add("mobile-layout");

  window.addEventListener("DOMContentLoaded", () => {
    const app = document.querySelector(".app");
    if (!app) return;

    document.body.classList.add("mobile-studio");

    // Desktop keeps these windows inside the inspector column. On mobile that
    // column becomes a translated drawer, which would also move a fixed tool
    // window off-screen. Hoist only the floating tool windows to the page so
    // their fixed positioning is relative to the phone/tablet viewport.
    window.setTimeout(() => {
      ["modelToolsWindow", "surfaceEditorWindow", "outputToolsWindow"].forEach(id => {
        const windowElement = document.getElementById(id);
        if (windowElement) document.body.appendChild(windowElement);
      });
    }, 0);

    const backdrop = document.createElement("button");
    backdrop.type = "button";
    backdrop.className = "mobile-panel-backdrop";
    backdrop.setAttribute("aria-label", "Close mobile panel");

    const nav = document.createElement("nav");
    nav.className = "mobile-workspace-nav";
    nav.setAttribute("aria-label", "Mobile workspace");
    nav.innerHTML = `
      <button type="button" data-mobile-action="scene" aria-pressed="false"><span>☰</span>Scene</button>
      <button type="button" data-mobile-action="view" aria-pressed="false"><span>◆</span>View</button>
      <button type="button" data-mobile-action="edit" aria-pressed="false"><span>✎</span>Edit</button>
      <button type="button" data-mobile-action="animate" aria-pressed="false"><span>▶</span>Animate</button>
      <button type="button" data-mobile-action="more" aria-pressed="false"><span>•••</span>More</button>
    `;

    const commandSheet = document.createElement("section");
    commandSheet.className = "mobile-command-sheet";
    commandSheet.setAttribute("aria-label", "Mobile tools");
    commandSheet.innerHTML = `
      <header><strong>Tools &amp; project</strong><button type="button" data-mobile-close aria-label="Close">×</button></header>
      <div class="mobile-command-grid">
        <button type="button" data-mobile-selector="#toolbarTransformGroup [data-mode='translate']">Move</button>
        <button type="button" data-mobile-target="objectRotateBtn">Rotate</button>
        <button type="button" data-mobile-selector="#toolbarTransformGroup [data-mode='scale']">Scale</button>
        <button type="button" data-mobile-target="pivotBtn">Edit Pivot</button>
        <button type="button" data-mobile-target="centerPivotBtn">Center Pivot</button>
        <button type="button" data-mobile-selector="[data-flip-axis='x']">Flip X</button>
        <button type="button" data-mobile-selector="[data-flip-axis='y']">Flip Y</button>
        <button type="button" data-mobile-selector="[data-flip-axis='z']">Flip Z</button>
        <button type="button" data-mobile-target="flipFromCenterInput">Flip From Center</button>
        <button type="button" data-mobile-target="modelToolsOpenBtn">Model Tools</button>
        <button type="button" data-mobile-target="surfaceEditorOpenBtn">Surface Edit</button>
        <button type="button" data-mobile-target="cameraControlsOpenBtn">Camera</button>
        <button type="button" data-mobile-target="outputToolsOpenBtn">Files &amp; Output</button>
        <button type="button" data-mobile-target="saveProjectBtn">Save Project</button>
        <button type="button" data-mobile-target="loadProjectBtn">Load Project</button>
        <button type="button" data-mobile-target="loadProjectUrlBtn">Load URL</button>
      </div>
    `;

    document.body.append(backdrop, commandSheet, nav);

    const buttons = [...nav.querySelectorAll("button[data-mobile-action]")];
    const setActive = action => {
      buttons.forEach(button => {
        const active = button.dataset.mobileAction === action;
        button.classList.toggle("active", active);
        button.setAttribute("aria-pressed", String(active));
      });
    };

    const closeDrawers = () => {
      app.classList.remove("mobile-left-open", "mobile-right-open");
      commandSheet.classList.remove("visible");
      backdrop.classList.remove("visible");
    };

    const setReferenceViewsVisible = visible => {
      app.classList.toggle("mobile-reference-views-open", !!visible);
    };

    const openDrawer = side => {
      closeDrawers();
      app.classList.add(side === "left" ? "mobile-left-open" : "mobile-right-open");
      backdrop.classList.add("visible");
    };

    const leaveAnimator = () => {
      if (app.classList.contains("animator-mode")) {
        document.querySelector("#animatorWorkspaceOpenBtn")?.click();
      }
    };

    nav.addEventListener("click", event => {
      const button = event.target.closest("button[data-mobile-action]");
      if (!button) return;
      const action = button.dataset.mobileAction;

      if (button.classList.contains("active")) {
        if (action === "animate") leaveAnimator();
        if (action === "view") setReferenceViewsVisible(false);
        closeDrawers();
        setActive(null);
        return;
      }

      if (action !== "view") setReferenceViewsVisible(false);

      if (action === "scene") {
        leaveAnimator();
        openDrawer("left");
      } else if (action === "view") {
        leaveAnimator();
        closeDrawers();
        setReferenceViewsVisible(true);
      } else if (action === "edit") {
        if (app.classList.contains("animator-mode")) {
          closeDrawers();
          app.classList.add("mobile-right-open");
          backdrop.classList.add("visible");
          document.querySelector("#bonePlacementSection")?.scrollIntoView({ block: "start" });
        } else {
          openDrawer("right");
          document.querySelector("#inspectorSection")?.scrollIntoView({ block: "start" });
        }
      } else if (action === "animate") {
        closeDrawers();
        if (!app.classList.contains("animator-mode")) {
          document.querySelector("#animatorWorkspaceOpenBtn")?.click();
        }
      } else if (action === "more") {
        leaveAnimator();
        closeDrawers();
        commandSheet.classList.add("visible");
        backdrop.classList.add("visible");
      }

      setActive(action);
    });

    commandSheet.addEventListener("click", event => {
      if (event.target.closest("[data-mobile-close]")) {
        closeDrawers();
        setActive(null);
        return;
      }
      const launcher = event.target.closest("[data-mobile-target], [data-mobile-selector]");
      if (!launcher) return;
      const target = launcher.dataset.mobileTarget
        ? document.getElementById(launcher.dataset.mobileTarget)
        : document.querySelector(launcher.dataset.mobileSelector);
      const targetId = target?.id || launcher.dataset.mobileTarget || "";
      closeDrawers();
      target?.click();
      const floatingWindowId = {
        modelToolsOpenBtn: "modelToolsWindow",
        surfaceEditorOpenBtn: "surfaceEditorWindow",
        outputToolsOpenBtn: "outputToolsWindow"
      }[targetId];
      if (floatingWindowId) {
        const floatingWindow = document.getElementById(floatingWindowId);
        floatingWindow?.classList.remove("collapsed");
        floatingWindow?.querySelector("[aria-expanded]")?.setAttribute("aria-expanded", "true");
      }
      if (targetId === "cameraControlsOpenBtn") {
        openDrawer("right");
        setActive("edit");
      } else {
        setActive(null);
      }
    });

    backdrop.addEventListener("click", () => {
      closeDrawers();
      setActive(app.classList.contains("animator-mode") ? "animate" : null);
    });

    document.addEventListener("keydown", event => {
      if (event.key === "Escape") {
        closeDrawers();
        setActive(app.classList.contains("animator-mode") ? "animate" : null);
      }
    });

    const animatorObserver = new MutationObserver(() => {
      if (app.classList.contains("animator-mode")) setActive("animate");
    });
    animatorObserver.observe(app, { attributes: true, attributeFilter: ["class"] });

    window.addEventListener("orientationchange", () => {
      closeDrawers();
      setReferenceViewsVisible(false);
      setActive(app.classList.contains("animator-mode") ? "animate" : null);
    });
  });
})();
