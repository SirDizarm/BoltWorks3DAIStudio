// Scene tools belong to enabled plugins, not the core editor.
function bwsRefreshScenesToolbar() {
  const plugins = allPluginManifests().filter(plugin =>
    plugin.enabled && !plugin.bundled && plugin.contributes?.toolbar === 'scenes' && plugin.runtime === 'sandbox-html'
  );
  let toolbar = document.getElementById('toolbarScenesGroup');
  let toggle = document.getElementById('toggleToolbarScenes');
  if (!plugins.length) {
    toolbar?.remove();
    toggle?.closest('label')?.remove();
    return;
  }
  if (!toolbar) {
    toolbar = document.createElement('div');
    toolbar.id = 'toolbarScenesGroup';
    toolbar.className = 'toolbar-group';
    toolbar.setAttribute('aria-label', 'Installed scene plugins');
    document.getElementById('toolbarProjectFilesGroup')?.after(toolbar);
    toggle = document.createElement('input');
    toggle.id = 'toggleToolbarScenes';
    toggle.type = 'checkbox';
    let shown = true;
    try { shown = localStorage.getItem('boltworks.toolbar.scenes.v1') !== 'false'; } catch {}
    toggle.checked = shown;
    toolbar.classList.toggle('toolbar-hidden', !shown);
    const label = document.createElement('label');
    label.append(toggle, document.createTextNode(' Scene plugins'));
    document.querySelector('#toolbarPicker .toolbar-picker-menu')?.append(label);
    toggle.onchange = () => {
      toolbar.classList.toggle('toolbar-hidden', !toggle.checked);
      try { localStorage.setItem('boltworks.toolbar.scenes.v1', String(toggle.checked)); } catch {}
    };
  }
  toolbar.replaceChildren();
  for (const plugin of plugins) {
    const button = document.createElement('button');
    button.type = 'button';
    button.textContent = plugin.name;
    button.onclick = () => {
      try { bwsOpenPluginWorkspace(plugin.id); } catch (error) { bwsPluginNotice(error.message); }
    };
    toolbar.append(button);
  }
}
bwsRefreshScenesToolbar();