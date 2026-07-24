import { visit } from 'unist-util-visit';

/**
 * Transforms ```mermaid fenced code blocks into raw HTML `<div class="mermaid">`
 * nodes at build time, so:
 *  - Shiki (Astro's default code highlighter) never touches mermaid source.
 *  - The client only needs to find `.mermaid` elements and call mermaid.run()
 *    on them — no regex/HTML-string surgery at runtime like the old vanilla
 *    site had to do (that's what broke last time).
 */
export default function remarkMermaid() {
  return (tree) => {
    let index = 0;
    visit(tree, 'code', (node) => {
      if (node.lang === 'mermaid') {
        index += 1;
        const escaped = node.value
          .replace(/&/g, '&amp;')
          .replace(/</g, '&lt;')
          .replace(/>/g, '&gt;');
        node.type = 'html';
        node.value = `<div class="mermaid-wrap" data-mermaid-id="mermaid-${index}">
  <div class="mermaid-toolbar">
    <button type="button" data-action="zoom-out" aria-label="Zoom out">−</button>
    <button type="button" data-action="zoom-reset" aria-label="Reset zoom">Reset</button>
    <button type="button" data-action="zoom-in" aria-label="Zoom in">+</button>
    <button type="button" data-action="fullscreen" aria-label="Fullscreen">⤢</button>
  </div>
  <div class="mermaid-canvas">
    <div class="mermaid">${escaped}</div>
  </div>
</div>`;
      }
    });
  };
}
