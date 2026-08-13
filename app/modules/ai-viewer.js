(() => {
  const endpoint = "/__modeler/mcp/session";
  const pollIntervalMs = 1000;
  const timerIntervalMs = 250;
  const maxRenderedEvents = 400;
  const activeStatuses = new Set(["running", "paused"]);
  const viewer = {
    connection: "offline",
    session: null,
    events: [],
    eventKeys: new Set(),
    latestSequence: 0,
    reportAvailable: false,
    serverOffsetMs: 0,
    receivedAt: 0,
    polling: false,
    disposed: false,
    pollTimer: 0,
    timerTimer: 0
  };

  function finiteNumber(value, fallback = 0) {
    const number = Number(value);
    return Number.isFinite(number) ? number : fallback;
  }

  function timestampMs(value) {
    if (typeof value === "number" && Number.isFinite(value)) return value;
    const parsed = Date.parse(value || "");
    return Number.isFinite(parsed) ? parsed : NaN;
  }

  function responseError(payload, fallback) {
    const error = payload?.error;
    if (typeof error === "string" && error.trim()) return error;
    if (error && typeof error === "object" && typeof error.message === "string" && error.message.trim()) return error.message;
    if (typeof payload?.message === "string" && payload.message.trim()) return payload.message;
    return fallback;
  }

  function normalizedStatus(value) {
    const status = String(value || "idle").trim().toLowerCase().replace(/_/g, "-");
    if (status === "active") return "running";
    if (status === "complete" || status === "success") return "completed";
    if (status === "timeout" || status === "timedout") return "timed-out";
    return status || "idle";
  }

  function humanize(value) {
    return String(value || "")
      .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
      .replace(/[._:/_-]+/g, " ")
      .replace(/\s+/g, " ")
      .trim()
      .replace(/^./, character => character.toUpperCase());
  }

  function shortTime(value) {
    const time = timestampMs(value);
    if (!Number.isFinite(time)) return "--:--:--";
    return new Date(time).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" });
  }

  function formatDuration(milliseconds) {
    const totalSeconds = Math.max(0, Math.ceil(finiteNumber(milliseconds) / 1000));
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;
    if (hours > 0) return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
    return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
  }

  function isoDuration(milliseconds) {
    return `PT${Math.max(0, Math.ceil(finiteNumber(milliseconds) / 1000))}S`;
  }

  function currentRemainingMs() {
    const session = viewer.session;
    if (!session) return 0;
    const status = normalizedStatus(session.status);
    if (status === "running") {
      const deadline = timestampMs(session.deadlineAt);
      if (Number.isFinite(deadline)) return Math.max(0, deadline - (Date.now() + viewer.serverOffsetMs));
      const elapsed = Math.max(0, Date.now() - viewer.receivedAt);
      return Math.max(0, finiteNumber(session.remainingMs) - elapsed);
    }
    return Math.max(0, finiteNumber(session.remainingMs));
  }

  function eventKey(event, index) {
    const sequence = finiteNumber(event?.sequence, NaN);
    if (Number.isFinite(sequence)) return `sequence:${sequence}`;
    if (event?.id) return `id:${event.id}`;
    return [event?.timestamp, event?.type, event?.commandId, event?.method, event?.label, index].join("|");
  }

  function eventState(event) {
    const outcome = normalizedStatus(event?.outcome || event?.status || event?.type);
    if (event?.ok === false || /fail|error|reject|cancel|timeout/.test(outcome)) return "failed";
    if (event?.ok === true || /complete|success|applied|verified/.test(outcome)) return "completed";
    if (/pause/.test(outcome)) return "paused";
    if (/start|dispatch|accept|running/.test(outcome)) return "started";
    return "event";
  }

  function eventTitle(event) {
    const label = typeof event?.label === "string" ? event.label.trim() : "";
    const method = typeof event?.method === "string" ? humanize(event.method) : "";
    const type = typeof event?.type === "string" ? humanize(event.type) : "";
    return label || method || type || "Verified event";
  }

  function detailText(event) {
    const details = event?.details && typeof event.details === "object" ? event.details : {};
    const parts = [];
    const outcome = typeof event?.outcome === "string" ? humanize(event.outcome) : "";
    if (outcome && outcome.toLowerCase() !== eventTitle(event).toLowerCase()) parts.push(outcome);
    if (event?.method && !eventTitle(event).toLowerCase().includes(humanize(event.method).toLowerCase())) parts.push(event.method);

    const summary = [details.summary, details.message, details.result, details.reason, details.endReason]
      .find(value => typeof value === "string" && value.trim());
    if (summary) parts.push(summary.trim());

    const objectIds = eventObjectIds(event);
    if (objectIds?.length) {
      const sample = objectIds.slice(0, 3).map(String).join(", ");
      parts.push(`${objectIds.length} object${objectIds.length === 1 ? "" : "s"}${sample ? `: ${sample}${objectIds.length > 3 ? "..." : ""}` : ""}`);
    } else {
      const objectCount = finiteNumber(details.objectCount ?? details.objectsChanged ?? details.affectedObjects, 0);
      if (objectCount > 0) parts.push(`${objectCount} object${objectCount === 1 ? "" : "s"}`);
    }

    const elapsedMs = finiteNumber(event?.elapsedMs, 0);
    if (elapsedMs > 0) parts.push(`${Math.round(elapsedMs)} ms`);
    if (event?.code) parts.push(String(event.code));
    return parts.filter(Boolean).join(" | ") || "Recorded by the MCP session service.";
  }

  function eventObjectIds(event) {
    const details = event?.details && typeof event.details === "object" ? event.details : {};
    const ids = Array.isArray(event?.targetIds)
      ? event.targetIds
      : [details.objectIds, details.affectedObjectIds, details.changedObjectIds]
        .find(value => Array.isArray(value));
    return ids ? ids.map(String) : [];
  }

  function setPill(element, text, state) {
    if (!element) return;
    element.textContent = text;
    element.dataset.state = state;
  }

  function renderConnection() {
    const connected = viewer.connection === "connected";
    setPill(els.aiViewerConnectionStatus, connected ? "MCP connected" : "MCP offline", connected ? "connected" : "offline");
  }

  function renderSessionStatus() {
    const session = viewer.session;
    const status = normalizedStatus(session?.status);
    const statusText = session ? humanize(status) : "No session";
    setPill(els.aiViewerSessionStatus, statusText, session ? status : "idle");

    if (els.aiViewerHeaderState) {
      const headerState = viewer.connection !== "connected" ? "offline" : session ? status : "connected";
      els.aiViewerHeaderState.dataset.state = headerState;
      els.aiViewerHeaderState.textContent = viewer.connection !== "connected" ? "Offline" : session ? statusText : "Ready";
    }

    const active = activeStatuses.has(status);
    if (els.aiViewerStartBtn) els.aiViewerStartBtn.disabled = viewer.connection !== "connected" || active;
    if (els.aiViewerPauseBtn) els.aiViewerPauseBtn.disabled = status !== "running";
    if (els.aiViewerResumeBtn) els.aiViewerResumeBtn.disabled = status !== "paused";
    if (els.aiViewerExtendBtn) els.aiViewerExtendBtn.disabled = !active;
    if (els.aiViewerStopBtn) els.aiViewerStopBtn.disabled = !active;
    if (els.aiViewerClearBtn) els.aiViewerClearBtn.disabled = active || (!session && viewer.events.length === 0);
    if (els.aiViewerDownloadBtn) els.aiViewerDownloadBtn.disabled = !(viewer.reportAvailable || session || viewer.events.length);

    if (session?.goal && els.aiViewerGoalInput && document.activeElement !== els.aiViewerGoalInput) {
      els.aiViewerGoalInput.value = session.goal;
    }
  }

  function renderTimer() {
    if (!els.aiViewerTimer) return;
    const status = normalizedStatus(viewer.session?.status);
    if (viewer.session?.unlimited === true) {
      els.aiViewerTimer.textContent = "∞";
      els.aiViewerTimer.title = "No automatic time limit";
      els.aiViewerTimer.setAttribute("aria-label", "No automatic time limit");
      els.aiViewerTimer.dateTime = "";
      els.aiViewerTimer.dataset.state = viewer.connection === "connected" ? status : "error";
      return;
    }
    const remaining = currentRemainingMs();
    els.aiViewerTimer.textContent = formatDuration(remaining);
    els.aiViewerTimer.dateTime = isoDuration(remaining);
    els.aiViewerTimer.dataset.state = viewer.connection === "connected" ? status : "error";
  }

  function renderAttention() {
    const attention = viewer.session?.attention;
    const visible = Boolean(attention?.required);
    if (els.aiViewerAttention) {
      els.aiViewerAttention.hidden = !visible;
      els.aiViewerAttention.dataset.priority = visible ? String(attention.priority || "normal") : "none";
    }
    if (els.aiViewerAttentionMessage) {
      els.aiViewerAttentionMessage.textContent = visible ? String(attention.message || "Human attention requested.") : "";
    }
    if (els.aiViewerAttentionDirective) {
      els.aiViewerAttentionDirective.textContent = visible ? String(attention.aiDirective || "") : "";
    }
  }

  function metrics() {
    const counters = viewer.session?.counters || {};
    const uniqueObjects = new Set();
    viewer.events.forEach(event => eventObjectIds(event).forEach(id => uniqueObjects.add(id)));
    const completed = finiteNumber(counters.completed, viewer.events.filter(event => eventState(event) === "completed").length);
    const failed = finiteNumber(counters.failed)
      + finiteNumber(counters.rejected)
      + finiteNumber(counters.cancelled)
      + finiteNumber(counters.timedOut);
    return {
      events: viewer.events.length,
      completed,
      failed: failed || viewer.events.filter(event => eventState(event) === "failed").length,
      objects: uniqueObjects.size
    };
  }

  function renderMetrics() {
    const values = metrics();
    if (els.aiViewerMetricEvents) els.aiViewerMetricEvents.textContent = String(values.events);
    if (els.aiViewerMetricCompleted) els.aiViewerMetricCompleted.textContent = String(values.completed);
    if (els.aiViewerMetricFailed) els.aiViewerMetricFailed.textContent = String(values.failed);
    if (els.aiViewerMetricObjects) els.aiViewerMetricObjects.textContent = String(values.objects);
    if (els.aiViewerFeedCount) els.aiViewerFeedCount.textContent = `${values.events} event${values.events === 1 ? "" : "s"}`;
  }

  function renderCurrentAction() {
    if (!els.aiViewerCurrentAction) return;
    const latest = viewer.events.at(-1);
    if (latest) {
      const state = eventState(latest);
      els.aiViewerCurrentAction.textContent = `${eventTitle(latest)} - ${humanize(state)}`;
      return;
    }
    const status = normalizedStatus(viewer.session?.status);
    if (viewer.session?.goal && activeStatuses.has(status)) {
      els.aiViewerCurrentAction.textContent = `Session ${humanize(status).toLowerCase()}: ${viewer.session.goal}`;
      return;
    }
    els.aiViewerCurrentAction.textContent = viewer.connection === "connected" ? "Waiting for a verified MCP action." : "Session service is unavailable.";
  }

  function renderFeed() {
    const feed = els.aiViewerFeed;
    if (!feed) return;
    feed.replaceChildren();
    if (!viewer.events.length) {
      const empty = document.createElement("li");
      empty.className = "ai-viewer-empty";
      empty.textContent = "No verified events yet.";
      feed.append(empty);
      return;
    }

    const fragment = document.createDocumentFragment();
    const visibleEvents = viewer.events.slice(-maxRenderedEvents);
    visibleEvents.forEach(event => {
      const item = document.createElement("li");
      item.className = "ai-viewer-event";
      item.dataset.state = eventState(event);

      const time = document.createElement("time");
      time.className = "ai-viewer-event-time";
      time.dateTime = event.timestamp || "";
      time.textContent = shortTime(event.timestamp);

      const title = document.createElement("span");
      title.className = "ai-viewer-event-title";
      title.textContent = eventTitle(event);

      const detail = document.createElement("span");
      detail.className = "ai-viewer-event-detail";
      detail.textContent = detailText(event);

      item.append(time, title, detail);
      fragment.append(item);
    });
    feed.append(fragment);
    feed.scrollTop = feed.scrollHeight;
  }

  function renderAll({ feed = false } = {}) {
    renderConnection();
    renderSessionStatus();
    renderAttention();
    renderTimer();
    renderCurrentAction();
    renderMetrics();
    if (feed) renderFeed();
  }

  function resetEvents() {
    viewer.events = [];
    viewer.eventKeys.clear();
    viewer.latestSequence = 0;
  }

  function mergeEvents(events) {
    let changed = false;
    (Array.isArray(events) ? events : []).forEach((event, index) => {
      if (!event || typeof event !== "object") return;
      const key = eventKey(event, index);
      if (viewer.eventKeys.has(key)) return;
      viewer.eventKeys.add(key);
      viewer.events.push(event);
      const sequence = finiteNumber(event.sequence, 0);
      if (sequence > viewer.latestSequence) viewer.latestSequence = sequence;
      changed = true;
    });
    if (changed) {
      viewer.events.sort((a, b) => finiteNumber(a.sequence, Date.parse(a.timestamp || "")) - finiteNumber(b.sequence, Date.parse(b.timestamp || "")));
    }
    return changed;
  }

  function consumePayload(payload, { replace = false } = {}) {
    if (!payload || typeof payload !== "object") return;
    const priorSessionId = viewer.session?.id || null;
    const hasSession = Object.prototype.hasOwnProperty.call(payload, "session");
    const hasWorkSession = Object.prototype.hasOwnProperty.call(payload, "workSession");
    const sessionPayload = hasSession ? payload.session : hasWorkSession ? payload.workSession : undefined;
    const nextSession = sessionPayload && typeof sessionPayload === "object"
      ? { ...(viewer.session || {}), ...sessionPayload }
      : hasSession && sessionPayload === null
        ? null
        : viewer.session;
    const nextSessionId = nextSession?.id || null;
    if (replace || (priorSessionId && nextSessionId && priorSessionId !== nextSessionId)) resetEvents();

    const serverTime = timestampMs(payload.serverTime);
    if (Number.isFinite(serverTime)) viewer.serverOffsetMs = serverTime - Date.now();
    viewer.receivedAt = Date.now();
    viewer.session = nextSession || null;
    if (Object.prototype.hasOwnProperty.call(payload, "reportAvailable")) {
      viewer.reportAvailable = payload.reportAvailable === true;
    }
    const changed = mergeEvents(payload.events);

    const latestSequence = finiteNumber(payload.latestSequence, viewer.latestSequence);
    if (latestSequence < viewer.latestSequence && !payload.events?.length) {
      resetEvents();
    } else {
      viewer.latestSequence = Math.max(viewer.latestSequence, latestSequence);
    }
    renderAll({ feed: changed || replace });
  }

  async function pollSession({ reset = false } = {}) {
    if (viewer.disposed || viewer.polling) return;
    viewer.polling = true;
    try {
      if (reset) resetEvents();
      const since = reset ? 0 : viewer.latestSequence;
      const response = await fetch(`${endpoint}?sinceSequence=${encodeURIComponent(since)}`, {
        method: "GET",
        headers: { Accept: "application/json" },
        cache: "no-store"
      });
      if (!response.ok) throw new Error(`Session service returned HTTP ${response.status}.`);
      const payload = await response.json();
      if (payload?.ok === false) throw new Error(responseError(payload, "Session service rejected the request."));
      viewer.connection = "connected";
      consumePayload(payload, { replace: reset });
    } catch (error) {
      viewer.connection = "offline";
      renderAll();
      if (els.aiViewerCurrentAction) els.aiViewerCurrentAction.textContent = error?.message || "Session service is unavailable.";
    } finally {
      viewer.polling = false;
    }
  }

  async function sessionAction(action, fields = {}) {
    const buttonMap = {
      start: els.aiViewerStartBtn,
      pause: els.aiViewerPauseBtn,
      resume: els.aiViewerResumeBtn,
      extend: els.aiViewerExtendBtn,
      stop: els.aiViewerStopBtn,
      clear: els.aiViewerClearBtn
    };
    const button = buttonMap[action];
    if (button) button.disabled = true;
    if (els.aiViewerCurrentAction) els.aiViewerCurrentAction.textContent = `${humanize(action)} request sent...`;
    try {
      const response = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        cache: "no-store",
        body: JSON.stringify({ action, ...fields })
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok || payload?.ok === false) throw new Error(responseError(payload, `Session action returned HTTP ${response.status}.`));
      viewer.connection = "connected";
      if (action === "start" || action === "clear") resetEvents();
      if (action === "clear") viewer.reportAvailable = false;
      consumePayload(payload, { replace: action === "clear" });
      await pollSession({ reset: action === "start" });
    } catch (error) {
      if (els.aiViewerCurrentAction) els.aiViewerCurrentAction.textContent = error?.message || `${humanize(action)} failed.`;
      renderSessionStatus();
    }
  }

  function startSession() {
    const goal = String(els.aiViewerGoalInput?.value || "").trim();
    const durationText = String(els.aiViewerDurationInput?.value ?? "").trim();
    const unlimited = durationText === "";
    const minutes = unlimited
      ? null
      : Math.max(1, Math.min(1440, Math.round(finiteNumber(durationText, 15))));
    if (els.aiViewerDurationInput && !unlimited) els.aiViewerDurationInput.value = String(minutes);
    sessionAction("start", unlimited
      ? { goal, unlimited: true }
      : { goal, durationMs: minutes * 60 * 1000 });
  }

  function downloadBlob(blob, fileName) {
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = fileName;
    document.body.append(anchor);
    anchor.click();
    anchor.remove();
    setTimeout(() => URL.revokeObjectURL(url), 0);
  }

  function dispositionFileName(response) {
    const disposition = response.headers.get("content-disposition") || "";
    const utfMatch = disposition.match(/filename\*=UTF-8''([^;]+)/i);
    if (utfMatch) return decodeURIComponent(utfMatch[1].replace(/["']/g, ""));
    const plainMatch = disposition.match(/filename="?([^";]+)"?/i);
    return plainMatch?.[1] || "boltworks-ai-session-report.json";
  }

  async function downloadReport() {
    if (els.aiViewerDownloadBtn) els.aiViewerDownloadBtn.disabled = true;
    try {
      const response = await fetch(`${endpoint}?download=1`, {
        method: "GET",
        headers: { Accept: "application/json" },
        cache: "no-store"
      });
      if (!response.ok) throw new Error(`Report download returned HTTP ${response.status}.`);
      downloadBlob(await response.blob(), dispositionFileName(response));
      if (els.aiViewerCurrentAction) els.aiViewerCurrentAction.textContent = "Downloaded the factual session report.";
    } catch (error) {
      if (els.aiViewerCurrentAction) els.aiViewerCurrentAction.textContent = error?.message || "Could not download the session report.";
    } finally {
      renderSessionStatus();
    }
  }

  function bindControls() {
    els.aiViewerStartBtn?.addEventListener("click", startSession);
    els.aiViewerPauseBtn?.addEventListener("click", () => sessionAction("pause"));
    els.aiViewerResumeBtn?.addEventListener("click", () => sessionAction("resume"));
    els.aiViewerExtendBtn?.addEventListener("click", () => sessionAction("extend", { extendMs: 5 * 60 * 1000 }));
    els.aiViewerStopBtn?.addEventListener("click", () => sessionAction("stop", { reason: "Stopped from the Human AI Viewer." }));
    els.aiViewerClearBtn?.addEventListener("click", () => sessionAction("clear"));
    els.aiViewerDownloadBtn?.addEventListener("click", downloadReport);
    els.aiViewerGoalInput?.addEventListener("keydown", event => {
      if ((event.ctrlKey || event.metaKey) && event.key === "Enter") startSession();
    });
    document.addEventListener("visibilitychange", () => {
      if (!document.hidden) pollSession();
    });
  }

  function schedulePolling() {
    viewer.pollTimer = window.setInterval(() => pollSession(), pollIntervalMs);
    viewer.timerTimer = window.setInterval(renderTimer, timerIntervalMs);
  }

  function dispose() {
    viewer.disposed = true;
    window.clearInterval(viewer.pollTimer);
    window.clearInterval(viewer.timerTimer);
  }

  function init() {
    if (!els.aiViewerSection || !els.aiViewerFeed) return;
    bindControls();
    renderAll({ feed: true });
    pollSession({ reset: true });
    schedulePolling();
    window.addEventListener("pagehide", dispose, { once: true });
    window.BoltWorksAiViewer = Object.freeze({
      refresh: () => pollSession(),
      snapshot: () => ({
        connection: viewer.connection,
        session: viewer.session
          ? {
              ...viewer.session,
              attention: viewer.session.attention ? { ...viewer.session.attention } : null
            }
          : null,
        latestSequence: viewer.latestSequence,
        eventCount: viewer.events.length,
        remainingMs: currentRemainingMs()
      })
    });
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init, { once: true });
  else init();
})();
