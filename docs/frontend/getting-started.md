# Getting Started with Nuxt

CleanSlice organizes frontend code into **slices** -- self-contained feature modules that are registered as [Nuxt Layers](https://nuxt.com/docs/getting-started/layers). Each slice has its own configuration, components, stores, and pages, but they all compose together into a single application.

This page walks you through setting up a new Nuxt app with CleanSlice's slice-based architecture.

## Project Structure

A CleanSlice Nuxt app has no root-level `components/`, `pages/`, or `stores/` directories. Everything lives inside `slices/`:

```
app/
├── nuxt.config.ts          # Root config -- registers all slices
├── registerSlices.ts        # Auto-discovers and orders slices
├── app.vue                  # Root component
├── tsconfig.json
├── openapi-ts.config.ts     # API SDK generation config
├── .nvmrc                   # Node version (24)
├── package.json
└── slices/
    ├── setup/               # Infrastructure slices
    │   ├── pinia/           # State management
    │   ├── di/              # Dependency injection
    │   ├── i18n/            # Internationalization
    │   ├── theme/           # UI components + Tailwind
    │   ├── error/           # Error handling
    │   └── api/             # Generated API client
    ├── user/                # User feature slices
    ├── common/              # Shared utilities + menu
    └── {feature}/           # Your feature slices
```

## Prerequisites

Set your Node.js version by placing a `.nvmrc` file in the app root:

```
24
```

```bash
nvm use
```

## TypeScript Configuration

CleanSlice uses decorators for dependency injection. Your `tsconfig.json` extends the auto-generated Nuxt config and enables the required compiler options:

```json [tsconfig.json]
{
  "extends": "./.nuxt/tsconfig.json",
  "compilerOptions": {
    "allowJs": false,
    "experimentalDecorators": true,
    "emitDecoratorMetadata": true,
    "verbatimModuleSyntax": false
  }
}
```

## Slice Registration

Every slice is a Nuxt layer with its own `nuxt.config.ts`. The root config registers all slices via the `extends` array. CleanSlice provides a `registerSlices.ts` utility that auto-discovers slice directories and orders them correctly.

### registerSlices.ts

This function scans the `slices/` directory, processes special slices first (setup, user, common), then discovers the rest:

```typescript [registerSlices.ts]
import * as fs from 'fs';
import * as path from 'path';

export const registerSlices = (): string[] => {
  const settings = {
    specialSlices: ['./slices/setup', './slices/user', './slices/common'],
  };

  const slices = fs.readdirSync('./slices').filter((entry) => {
    const fullPath = path.join('./slices', entry);
    return fs.statSync(fullPath).isDirectory();
  });

  if (!slices.length) return [];

  const result: string[] = [];

  const collectSlices = (path: string) => {
    if (fs.existsSync(`${path}/nuxt.config.ts`)) {
      if (!result.includes(path)) {
        result.push(path);
      }
    } else {
      const subPaths = fs.readdirSync(path).filter((entry) => {
        const fullPath = `${path}/${entry}`;
        return fs.statSync(fullPath).isDirectory();
      });
      for (const subPath of subPaths) {
        collectSlices(`${path}/${subPath}`);
      }
    }
  };

  for (const specialSlice of settings.specialSlices) {
    collectSlices(specialSlice);
  }

  for (const slice of slices) {
    const slicePath = `./slices/${slice}`;
    collectSlices(slicePath);
  }

  return result;
};
```

### Root nuxt.config.ts

The root config imports `registerSlices` and spreads the result into `extends`:

```typescript [nuxt.config.ts]
import { registerSlices } from './registerSlices';

export default defineNuxtConfig({
  devtools: { enabled: false },
  extends: [...registerSlices()],
  ssr: false,
  vite: {
    define: {
      'process.env': process.env,
      __VUE_I18N_FULL_INSTALL__: true,
      __VUE_I18N_LEGACY_API__: false,
      __INTLIFY_PROD_DEVTOOLS__: false,
    },
  },
  modules: ['@nuxt/image'],
  compatibilityDate: '2024-10-04',
});
```

::: tip
You rarely need to touch `registerSlices.ts`. To add a new feature, just create a folder under `slices/` with a `nuxt.config.ts` -- it gets picked up automatically.
:::

## Setup Slice Loading Order

The order in which setup slices load matters because some depend on others. The `specialSlices` array in `registerSlices.ts` ensures setup slices always load first:

| Order | Slice | Purpose | Depends On |
|-------|-------|---------|------------|
| 1 | `setup/pinia` | State management | -- |
| 2 | `setup/di` | Dependency injection | -- |
| 3 | `setup/i18n` | Translations | -- |
| 4 | `setup/theme` | UI components + Tailwind | -- |
| 5 | `setup/error` | Error handling | theme, i18n |
| 6 | `setup/api` | API client | error |
| 7 | `user/*` | Authentication, accounts | api, error |
| 8 | `common` | Shared utilities, menu | theme |
| 9 | `{feature}` | Your feature slices | all of the above |

::: warning
If your error toasts are not appearing or translations are missing, check that your setup slices load in the correct order. The error slice depends on the theme slice (for toast components) and the i18n slice (for translated error messages).
:::

## Setup Slices Overview

Each setup slice provides a piece of core infrastructure:

| Slice | Purpose | Alias | Key Files |
|-------|---------|-------|-----------|
| `pinia` | State management | -- | `nuxt.config.ts` |
| `di` | Dependency injection (InversifyJS) | `#di` | `container.ts`, `types.ts` |
| `i18n` | Internationalization | `#i18n` | `nuxt.config.ts`, `i18n.config.ts` |
| `theme` | UI components (shadcn-vue) | `#theme` | `components/ui/`, `tailwind.config.js` |
| `error` | Global error handling | `#error` | `utils/handleError.ts`, `stores/error.ts` |
| `api` | Backend API SDK (hey-api) | `#api` | `api.config.ts`, `data/repositories/api/` |

## Post-Installation Cleanup

If you scaffold a new Nuxt app with `npx nuxi init`, remove the default directories that CleanSlice replaces:

```bash
rm -rf components composables pages layouts middleware plugins assets
```

All of these now live inside individual slices.

## Docker Deployment

Build and run your app in production using Docker:

```dockerfile [Dockerfile]
FROM node:22-alpine AS builder
WORKDIR /usr/src/app
COPY package*.json ./
RUN npm install
COPY . .
ARG API_URL
RUN API_URL=${API_URL} npm run build
EXPOSE 3000
CMD ["npm", "run", "start"]
```

```bash
docker build --build-arg API_URL=https://api.example.com -t app .
docker run -p 3000:3000 app
```

## Quick Reference

| Task | Where to Look |
|------|---------------|
| Add a new feature slice | Create `slices/{feature}/nuxt.config.ts` |
| Add a state store | `slices/{feature}/stores/{name}.ts` |
| Add translations | `slices/{feature}/locales/{lang}.json` + nuxt.config.ts |
| Add a UI component | Use from `#theme/components/ui/` |
| Configure API base URL | `slices/setup/api/api.config.ts` |
| Handle API errors | `slices/setup/error/utils/handleError.ts` |

## What's Next?

- [Slice Structure](/frontend/slice-structure) -- Learn the anatomy of a frontend slice
- [State Management](/frontend/state-management) -- Set up Pinia stores
- [API Integration](/frontend/api-integration) -- Generate a type-safe API client
- [UI Components](/frontend/ui-components) -- Configure shadcn-vue and Tailwind
