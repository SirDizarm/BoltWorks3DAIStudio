(() => {
  const own = document.currentScript;
  const root = new URL(own?.dataset.bwsLegacy === 'true' ? '../' : './', location.href);
  try { localStorage.setItem('boltworks.edition.choice.v1', 'new'); } catch {}
  window.BwsEditionRestoreError = message => {
    const dialog = document.createElement('dialog');
    dialog.style.cssText = 'max-width:520px;padding:24px;background:#172426;color:#eee5d3;border:1px solid #738b77;border-radius:8px';
    const title = document.createElement('h2'), text = document.createElement('p'), retry = document.createElement('button');
    title.textContent = 'Workspace recovery needs attention';
    text.textContent = 'Your backup is protected and has not been reset. ' + message;
    retry.textContent = 'Retry recovery';
    retry.onclick = () => location.reload();
    dialog.append(title, text, retry);
    document.body.append(dialog);
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
  script.onerror = () => window.BwsEditionRestoreError('BWS could not load. Please retry.');
  document.body.append(script);
})();