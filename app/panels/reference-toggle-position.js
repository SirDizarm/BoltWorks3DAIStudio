(() => {
  const button = document.getElementById('referenceViewportsToggleBtn');
  const viewport = button?.closest('.viewport');
  const references = viewport?.querySelector('.reference-viewports');
  if (!button || !viewport || !references) return;
  function align() {
    const host = viewport.getBoundingClientRect();
    const panel = references.getBoundingClientRect();
    const inset = panel.width > 0 ? host.right - panel.left - viewport.clientLeft : 0;
    button.style.right = Math.max(0, inset) + 'px';
  }
  const observer = new ResizeObserver(align);
  observer.observe(viewport);
  observer.observe(references);
  window.addEventListener('resize', align);
  align();
})();
