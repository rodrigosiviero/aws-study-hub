# AWS Study Hub

Static study guides for AWS certifications, built with [Astro](https://astro.build/).

Content is sourced from official AWS exam guides and rendered at build time.
The DEA-C01 track also includes exam-focused, browser-native slide courses.

**Live:** https://rodrigosiviero.github.io/aws-study-hub/

## Certifications

| Code | Status |
|------|--------|
| DEA-C01 (Data Engineer) | ✅ Complete |
| SAA-C03 (Solutions Architect) | 🚧 Coming soon |
| DVA-C02 (Developer) | 🚧 Coming soon |
| SOA-C02 (SysOps) | 🚧 Coming soon |

## DEA-C01 Course

The Data Engineer – Associate track is available at
[`/courses/dea-c01/`](https://rodrigosiviero.github.io/aws-study-hub/courses/dea-c01/).
It contains four exam-focused domains:

| Domain | Weight | Focus |
|--------|-------:|-------|
| Data Ingestion and Transformation | 34% | Batch, streaming, ETL, Spark, and orchestration |
| Data Store Management | 26% | Storage selection, catalogs, lifecycle, models, and migration |
| Data Operations and Support | 22% | Automation, analytics, observability, recovery, and data quality |
| Data Security and Governance | 18% | Identity, authorization, encryption, audit, privacy, and governance |

Each course has keyboard navigation, a right-side additional-context panel,
exam traps, active-recall prompts, and native browser fullscreen support.

## Getting Started

```bash
npm install
npm run dev      # http://localhost:4321/aws-study-hub/
npm run build    # outputs to ./dist
npm run preview  # serve ./dist locally
```

## Project Structure

```
src/
  content/certs/          # One .md per certification (frontmatter + markdown)
  components/             # Shared UI, including the reusable CourseDeck
  layouts/BaseLayout.astro
  lib/
    toc.ts                # Builds sidebar TOC + weight bar from headings
    remark-mermaid.mjs    # Transforms ```mermaid blocks into zoomable diagrams
  pages/
    index.astro           # Home / cert picker
    [slug]/index.astro    # Dynamic route: /dea/, /saa/, etc.
    courses/dea-c01/      # DEA-C01 catalog and four domain courses
  styles/global.css
  scripts/
    page.js               # Progress bar + scroll spy
public/
  mermaid-zoom.js         # Mermaid + svg-pan-zoom via CDN (runtime)
  favicon.svg
```

## Adding a Certification Guide

1. Create `src/content/certs/<slug>.md`:

```md
---
title: "AWS Certified Solutions Architect – Associate"
code: "SAA-C03"
status: "coming-soon"   # "complete" or "coming-soon"
description: "Design resilient, high-performing, secure architectures on AWS."
order: 2
---

# Content here (standard markdown)
```

2. Set `status: "complete"` when done. The home page shows a badge accordingly.

### Content conventions

- `##` headings become domains in the sidebar. Append `(NN%)` to show a weight bar (e.g. `## Domain 1: Data Ingestion (34%)`).
- `###` headings become subsections.
- `` ```mermaid `` fenced blocks render as interactive diagrams with zoom, pan, and fullscreen.
- Practice questions use `<details><summary>Answer</summary>...</details>` for spoiler-style reveals.

## Contributing

1. Fork the repo.
2. Create a branch: `git checkout -b add-<cert-name>`.
3. Add or update content under `src/content/certs/`.
4. Run `npm run build` — it must pass with zero errors.
5. Open a PR against `main`.

### Content guidelines

- Source everything from official AWS exam guides or AWS documentation.
- Keep answers objective — no fluff.
- Use comparison tables over prose when contrasting services.
- Prefer concise diagrams, comparison tables, and service-selection scenarios.
- Course content must be in English and include exam traps or active recall.

## Deployment

GitHub Actions deploys to GitHub Pages on every push to `main`.

Workflow: `.github/workflows/deploy.yml` — checkout, npm ci, build, upload artifact, deploy.

No configuration needed beyond enabling Pages → Source: **GitHub Actions** in repo settings.

## Tech Stack

- **Astro 4** — static site generator
- **Mermaid 11** — diagrams (loaded via CDN at runtime)
- **svg-pan-zoom** — diagram zoom/pan
- **GitHub Actions** — CI/CD

## License

MIT
