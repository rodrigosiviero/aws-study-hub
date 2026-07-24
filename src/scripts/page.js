function setupProgressBar() {
  const fill = document.getElementById('progress-fill');
  if (!fill) return;
  const onScroll = () => {
    const doc = document.documentElement;
    const scrollable = doc.scrollHeight - doc.clientHeight;
    const pct = scrollable > 0 ? (window.scrollY / scrollable) * 100 : 0;
    fill.style.width = `${Math.min(100, Math.max(0, pct))}%`;
  };
  window.addEventListener('scroll', onScroll, { passive: true });
  window.addEventListener('resize', onScroll);
  onScroll();
}

function setupScrollSpy() {
  const links = document.querySelectorAll('[data-toc-link]');
  if (links.length === 0) return;
  const headers = Array.from(document.querySelectorAll('.markdown-body h3[id]'));
  if (headers.length === 0) return;

  const onScroll = () => {
    let currentId = null;
    const probe = window.scrollY + 120;
    headers.forEach((h) => {
      const top = h.getBoundingClientRect().top + window.scrollY;
      if (top <= probe) currentId = h.id;
    });
    links.forEach((l) => {
      l.classList.toggle('active', l.dataset.tocLink === currentId);
    });
  };

  window.addEventListener('scroll', onScroll, { passive: true });
  onScroll();
}

setupProgressBar();
setupScrollSpy();
