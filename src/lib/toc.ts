export interface MarkdownHeading {
  depth: number;
  slug: string;
  text: string;
}

export interface TocTask {
  slug: string;
  title: string;
}

export interface TocSection {
  slug: string;
  title: string;
  weight: number | null;
  subsections: TocTask[];
}

/**
 * Builds the sidebar TOC + domain-weight-bar structure straight from the
 * headings Astro already parsed out of the markdown (ids included, via
 * github-slugger — no hand-rolled slugify needed, no risk of it drifting
 * out of sync with the actual rendered heading ids).
 */
export function buildToc(headings: MarkdownHeading[]): TocSection[] {
  const toc: TocSection[] = [];
  let current: TocSection | null = null;

  for (const h of headings) {
    if (h.depth === 2) {
      const weightMatch = h.text.match(/\((\d+)%\)\s*$/);
      const title = h.text
        .replace(/^\d+\.\s*/, '')
        .replace(/\(\d+%\)\s*$/, '')
        .trim();
      current = {
        slug: h.slug,
        title,
        weight: weightMatch ? parseInt(weightMatch[1], 10) : null,
        subsections: [],
      };
      toc.push(current);
    } else if (h.depth === 3 && current && /^Task\s+\d/.test(h.text)) {
      const title = h.text
        .replace(/^\d+\.\d+\s*/, '')
        .replace(/:.+$/, '')
        .trim();
      if (title) current.subsections.push({ slug: h.slug, title });
    }
  }

  return toc;
}

export const domainColors = ['#FF9900', '#14B8A6', '#6366F1', '#E85D6F', '#B8600A', '#0D7A6F'];
