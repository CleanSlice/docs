# CleanSlice Documentation

The official documentation site for [CleanSlice](https://github.com/cleanslice) — a Clean Architecture framework for building full-stack applications with NestJS and Nuxt.

Built with [VitePress](https://vitepress.dev/).

## Quick Start

```bash
# Install dependencies
npm install

# Start dev server
npm run docs:dev

# Build for production
npm run docs:build

# Preview production build
npm run docs:preview
```

The dev server runs at `http://localhost:5173` by default.

## Structure

```
docs/
├── .vitepress/
│   └── config.ts            # Site config, navigation, sidebar
├── guide/                   # Getting started & core concepts
│   ├── introduction.md
│   ├── getting-started.md
│   ├── core-concepts.md
│   ├── project-structure.md
│   └── setup-slices.md
├── architecture/            # Clean Architecture & slices
│   ├── overview.md
│   ├── layers.md
│   ├── slices.md
│   └── dependency-flow.md
├── backend/                 # NestJS patterns & setup
│   ├── getting-started.md
│   ├── database.md
│   ├── api-docs.md
│   ├── slice-structure.md
│   ├── controllers.md
│   ├── gateways.md
│   ├── mappers.md
│   ├── dtos.md
│   ├── services.md
│   ├── types.md
│   └── error-handling.md
├── frontend/                # Nuxt patterns & setup
│   ├── getting-started.md
│   ├── slice-structure.md
│   ├── state-management.md
│   ├── api-integration.md
│   ├── ui-components.md
│   ├── dependency-injection.md
│   ├── i18n.md
│   ├── error-handling.md
│   └── navigation.md
├── standards/               # Code conventions
│   ├── typescript.md
│   ├── nestjs.md
│   ├── nuxt.md
│   └── git.md
├── examples/                # Walkthroughs
│   └── user-slice.md
├── public/                  # Static assets
└── index.md                 # Landing page
```

## Adding Pages

1. Create a `.md` file in the appropriate section folder
2. Add the page to the sidebar in [.vitepress/config.ts](.vitepress/config.ts)
3. Use VitePress [markdown extensions](https://vitepress.dev/guide/markdown) for tips, warnings, and code groups

### Writing Conventions

- Write for developers adopting the framework
- Use second person ("you"), present tense, active voice
- Use `::: tip` and `::: warning` containers for callouts
- Label code blocks with filenames: `` ```typescript [user.service.ts] ``
- End each page with a "What's Next?" section linking to related pages
- Cross-link with absolute paths: `[Gateways](/backend/gateways)`

## Deployment

The production build outputs to `.vitepress/dist/`. Deploy this folder to any static hosting provider (Netlify, Vercel, GitHub Pages, Cloudflare Pages, etc.).

```bash
npm run docs:build
# Deploy .vitepress/dist/
```
