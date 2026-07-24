import { defineConfig } from 'astro/config';
import remarkMermaid from './src/lib/remark-mermaid.mjs';

// IMPORTANT: adjust `site` and `base` below to match your actual GitHub
// Pages URL. For a project page (https://<user>.github.io/<repo>/) both
// need the repo name. For a user/org root site (https://<user>.github.io/)
// set base to '/' and drop the repo name from `site`.
export default defineConfig({
  site: 'https://rodrigosiviero.github.io',
  base: '/aws-study-hub',
  devToolbar: { enabled: false },
  markdown: {
    remarkPlugins: [remarkMermaid],
    shikiConfig: {
      theme: 'github-dark',
    },
  },
});
