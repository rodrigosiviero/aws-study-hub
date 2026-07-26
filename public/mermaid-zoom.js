// ponytail: inline mermaid+svg-pan-zoom via CDN, no node_modules ESM needed at runtime
(function () {
  const MERMAID_CDN = 'https://cdn.jsdelivr.net/npm/mermaid@11/dist/mermaid.min.js';
  const PANZOOM_CDN = 'https://cdn.jsdelivr.net/npm/svg-pan-zoom@3.6.1/dist/svg-pan-zoom.min.js';

  function loadScript(src) {
    return new Promise((resolve, reject) => {
      if (document.querySelector(`script[src="${src}"]`)) { resolve(); return; }
      const s = document.createElement('script');
      s.src = src; s.onload = resolve; s.onerror = reject;
      document.head.appendChild(s);
    });
  }

  function attachPanZoom(svgEl) {
    const panZoom = svgPanZoom(svgEl, {
      zoomEnabled: true, panEnabled: true, controlIconsEnabled: false,
      fit: false, center: false, minZoom: 0.2, maxZoom: 5, zoomScaleSensitivity: 0.35,
    });
    panZoom.fit();
    panZoom.center();
    return panZoom;
  }

  function sizeCanvas(svgEl) {
    const box = svgEl.getBBox();
    const canvas = svgEl.closest('.mermaid-canvas');
    if (!box.width || !box.height || !canvas) return;
    const height = Math.max(180, Math.min(520, canvas.clientWidth * box.height / box.width));
    canvas.style.height = `${height}px`;
    svgEl.style.height = `${height}px`;
  }

  function wireToolbar(root, pz, onFullscreen) {
    root.querySelectorAll('[data-action]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const a = btn.dataset.action;
        if (a === 'zoom-in') pz.zoomIn();
        if (a === 'zoom-out') pz.zoomOut();
        if (a === 'zoom-reset') { pz.reset(); pz.fit(); pz.center(); }
        if (a === 'fullscreen') onFullscreen();
      });
    });
  }

  function openFullscreen(svgEl, title) {
    const backdrop = document.createElement('div');
    backdrop.className = 'mermaid-modal-backdrop';
    backdrop.innerHTML = `
      <div class="mermaid-modal">
        <div class="mermaid-toolbar">
          <span class="mermaid-modal-title">${title}</span>
          <div style="display:flex; gap:0.35rem;">
            <button type="button" data-action="zoom-out" aria-label="Zoom out">−</button>
            <button type="button" data-action="zoom-reset" aria-label="Reset zoom">Reset</button>
            <button type="button" data-action="zoom-in" aria-label="Zoom in">+</button>
            <button type="button" data-action="close" aria-label="Close">✕</button>
          </div>
        </div>
        <div class="mermaid-canvas"></div>
      </div>
    `;
    document.body.appendChild(backdrop);
    document.body.style.overflow = 'hidden';
    const canvas = backdrop.querySelector('.mermaid-canvas');
    const clone = svgEl.cloneNode(true);
    clone.removeAttribute('style');
    canvas.appendChild(clone);
    sizeCanvas(clone);
    const pz = attachPanZoom(clone);
    const close = () => { pz.destroy(); document.body.style.overflow = ''; backdrop.remove(); document.removeEventListener('keydown', onKey); };
    const onKey = (e) => { if (e.key === 'Escape') close(); };
    document.addEventListener('keydown', onKey);
    backdrop.addEventListener('click', (e) => { if (e.target === backdrop) close(); });
    wireToolbar(backdrop, pz, () => {});
    backdrop.querySelector('[data-action="close"]').addEventListener('click', close);
  }

  async function init() {
    const wraps = document.querySelectorAll('.mermaid-wrap');
    if (!wraps.length) return;
    await loadScript(MERMAID_CDN);
    await loadScript(PANZOOM_CDN);
    mermaid.initialize({
      startOnLoad: false, theme: 'base',
      themeVariables: {
        primaryColor: '#FFF3E0', primaryTextColor: '#141A22', primaryBorderColor: '#FF9900',
        lineColor: '#8894A3', secondaryColor: '#E6FBF8', tertiaryColor: '#EEF0FF',
        fontFamily: 'JetBrains Mono, monospace', fontSize: '13px',
      },
    });
    await mermaid.run({ querySelector: '.mermaid' });
    wraps.forEach((wrap, i) => {
      const svgEl = wrap.querySelector('.mermaid-canvas svg');
      if (!svgEl) return;
      svgEl.style.width = '100%';
      sizeCanvas(svgEl);
      const pz = attachPanZoom(svgEl);
      wireToolbar(wrap, pz, () => openFullscreen(svgEl, wrap.dataset.mermaidId || `Diagram ${i + 1}`));
    });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
