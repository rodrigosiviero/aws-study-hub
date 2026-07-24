# AWS Study Hub — Astro

Migração da versão estática (HTML + JS vanilla) para [Astro](https://astro.build). Mesmo visual,
mesmo deploy no GitHub Pages — só troca o "motor" por trás.

## O que mudou em relação à versão anterior

- **Conteúdo é build-time, não runtime.** Antes o navegador buscava o `.md` via `fetch()` e
  renderizava na hora com `marked.js`. Agora o Astro já gera o HTML final no build — mais rápido,
  funciona sem JS, e dá pra ver o conteúdo no "ver código-fonte" (bom pra SEO/compartilhamento).
- **URLs viraram páginas de verdade.** `?cert=dea` virou `/dea/`. Voltar/avançar do navegador,
  compartilhar link direto pra um guia, tudo funciona nativamente — sem JS de rota customizado.
- **Sidebar/TOC/weight-bar** são geradas a partir dos headings que o próprio Astro já extrai do
  Markdown (com `id` via `github-slugger`), em vez de um regex de slug feito à mão — elimina a
  classe inteira de bug "id do menu não bate com o id do heading" que a gente caçou na versão
  anterior.
- **Scroll suave nativo.** `scroll-behavior: smooth` + `scroll-margin-top` no CSS fazem o scroll
  do clique no menu funcionar sem nenhum JavaScript de clique customizado (não tem mais risco de
  dois listeners brigando entre si).
- **Mermaid vira SVG real com zoom e pan.** Os diagramas agora têm uma barra de zoom (+/−/reset),
  arrastar com o mouse, e um botão "Expandir" que abre em tela cheia — via `svg-pan-zoom`.
- **Tailwind CDN saiu.** O CSS já cobria quase tudo sozinho; o pouco que dependia do Tailwind
  virou CSS puro em `src/styles/global.css`.

## Rodando localmente

```bash
npm install
npm run dev        # http://localhost:4321
npm run build      # gera ./dist
npm run preview    # serve o ./dist gerado, pra conferir antes de publicar
```

## ⚠️ Antes do primeiro deploy: ajuste o `base`

Abra `astro.config.mjs` e troque:

```js
site: 'https://your-username.github.io',
base: '/data-engineer',
```

- Se o repositório se chama `data-engineer` e o Pages publica em
  `https://SEU-USUARIO.github.io/data-engineer/`, só troque `your-username`.
- Se for um repositório de **usuário/organização** (`SEU-USUARIO.github.io`, publicado na raiz),
  troque `base` para `'/'`.

Sem isso, os links e assets vão apontar pro caminho errado em produção.

## Deploy

O workflow em `.github/workflows/deploy.yml` já faz tudo: instala dependências, builda com
`npm run build` e publica `./dist` no GitHub Pages. Só habilitar Pages → "GitHub Actions" como
source nas configurações do repositório (Settings → Pages).

## Adicionando conteúdo

Cada certificação é um arquivo em `src/content/certs/`, com frontmatter:

```md
---
title: "AWS Certified Solutions Architect – Associate"
code: "SAA-C03"
status: "coming-soon"   # ou "complete"
description: "..."
order: 2
---

# conteúdo em markdown normal daqui pra baixo
```

- `##` viram domínios (a barra de peso só aparece se o título terminar em `(NN%)`).
- `###` viram tasks na sidebar.
- Blocos de código com \`\`\`mermaid viram diagramas com zoom/pan automaticamente.

## Estrutura

```
src/
  content/certs/       ← os guias (markdown + frontmatter)
  layouts/BaseLayout.astro
  components/          ← Sidebar, PipelineHero, CertGrid
  lib/
    toc.ts              ← monta a sidebar/weight-bar a partir dos headings
    remark-mermaid.mjs  ← transforma ```mermaid em diagramas com toolbar, no build
  scripts/
    mermaid-zoom.js     ← renderiza mermaid + liga o zoom/pan/fullscreen
    page.js             ← barra de progresso + scroll-spy
  pages/
    index.astro         ← home
    [slug]/index.astro  ← rota dinâmica: /dea/, /saa/, /dva/, /soa/
```
