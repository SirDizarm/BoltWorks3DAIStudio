(() => {
  const own = document.currentScript;
  const root = new URL(own?.dataset.bwsLegacy === 'true' ? '../' : './', location.href);
  try { localStorage.setItem('boltworks.edition.choice.v1', 'new'); } catch {}
  const capturedPointers = new Map();
  window.addEventListener('gotpointercapture', event => capturedPointers.set(event.pointerId, event.target), true);
  window.addEventListener('lostpointercapture', event => capturedPointers.delete(event.pointerId), true);
  const releaseCursor = () => {
    if (!window.BwsStartupDialogOpen) return;
    if (document.pointerLockElement) document.exitPointerLock?.();
    for (const [id, target] of capturedPointers) {
      try { if (target.hasPointerCapture(id)) target.releasePointerCapture(id); } catch {}
    }
    capturedPointers.clear();
  };
  document.addEventListener('pointerlockchange', releaseCursor);
  window.addEventListener('focus', releaseCursor);
  window.addEventListener('gotpointercapture', releaseCursor, true);
  let activeDialog;
  let notice;
  window.BwsEditionRestoreError = (message, { startup = false } = {}) => {
    activeDialog?.remove();
    notice?.remove();
    const previousFocus = document.activeElement;
    const dialog = document.createElement('dialog');
    activeDialog = dialog;
    dialog.style.cssText = 'max-width:520px;padding:24px;background:#172426;color:#eee5d3;border:1px solid #738b77;border-radius:8px';
    const title = document.createElement('h2'), text = document.createElement('p'), retry = document.createElement('button'), close = document.createElement('button');
    title.id = 'bws-startup-error-title';
    dialog.setAttribute('aria-labelledby', title.id);
    title.textContent = startup ? 'BWS could not start' : 'Workspace recovery needs attention';
    text.textContent = startup
      ? message + ' Your saved workspace has not been changed. Reload to try again. Closing this message will not start the editor.'
      : 'Your backup has not been reset. ' + message;
    retry.textContent = startup ? 'Reload BWS' : 'Retry recovery';
    retry.onclick = () => location.reload();
    close.textContent = 'Close';
    close.style.marginLeft = '8px';
    close.onclick = () => dialog.close();
    // Keep editor/gameplay keyboard shortcuts out of this modal, including Escape.
    dialog.addEventListener('keydown', event => event.stopPropagation());
    dialog.addEventListener('keyup', event => event.stopPropagation());
    const dismiss = () => {
      if (activeDialog !== dialog) return;
      window.BwsStartupDialogOpen = false;
      activeDialog = null;
      dialog.remove();
      if (previousFocus?.isConnected) previousFocus.focus();
      notice = document.createElement('button');
      notice.textContent = startup ? 'BWS did not start — show details' : 'Workspace recovery incomplete — show details';
      notice.style.cssText = 'position:fixed;bottom:28px;left:16px;z-index:10000;max-width:90vw';
      notice.onclick = () => window.BwsEditionRestoreError(message, { startup });
      document.body.append(notice);
      // Gameplay keeps its normal click-to-reconnect behavior after dismissal.
    };
    dialog.addEventListener('close', dismiss);
    dialog.addEventListener('cancel', event => { event.preventDefault(); dialog.close(); });
    dialog.append(title, text, retry, close);
    document.body.append(dialog);
    window.BwsStartupDialogOpen = true;
    releaseCursor();
    dialog.showModal();
  };
  if (own?.dataset.bwsLegacy === 'true') {
    location.replace(new URL('index.html', root).href);
    return;
  }
  const bundle = own?.dataset.bwsBundle;
  if (!bundle) return;
  const script = document.createElement('script');
  script.src = bundle;
  script.onerror = () => window.BwsEditionRestoreError('The application script could not be loaded: ' + script.src, { startup: true });
  document.body.append(script);
})();
