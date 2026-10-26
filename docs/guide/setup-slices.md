# Setup Slices

Setup slices provide shared infrastructure that feature slices depend on. They handle concerns like database connections, theming, state management, API client configuration, error handling, and internationalization.

## Overview

```
App Setup Slices (Nuxt)
┌─────────┬─────────┬───────┬─────────┬────────┐
│  theme  │  pinia  │  api  │  error  │  i18n  │
└─────────┴─────────┴───────┴─────────┴────────┘

API Setup Slices (NestJS)
┌─────────┬────────┬───────┬─────────┬──────────┐
│  prisma │  core  │  aws  │  redis  │  health  │
└─────────┴────────┴───────┴─────────┴──────────┘
```

## Frontend Setup Slices

Located at `app/slices/setup/`. Each is a Nuxt layer registered in the root `nuxt.config.ts`.

### Theme

**Purpose:** UI component library with Tailwind CSS v4 and shadcn-vue.

```
app/slices/setup/theme/
├── nuxt.config.ts
├── assets/css/tailwind.css     # @import tailwindcss + @theme inline token wiring
├── assets/themes/*.css         # one theme = one file of CSS variables
├── components/ui/              # shadcn-vue components
└── utils/cn.ts                 # className merge utility
```

```typescript
// nuxt.config.ts
import tailwindcss from '@tailwindcss/vite';

export default defineNuxtConfig({
  alias: { '#theme': currentDir },
  modules: ['shadcn-nuxt'],
  css: [`#theme/assets/themes/${themeName}.css`, '#theme/assets/css/tailwind.css'],
  vite: { plugins: [tailwindcss()] },
  shadcn: {
    prefix: '',
    componentDir: `${currentDir}/components/ui`,
  },
});
```

Tailwind v4 has no `tailwind.config.js`; `components.json` at the app root names the active theme. See [UI Components](/frontend/ui-components).

Key dependencies: `tailwindcss`, `@tailwindcss/vite`, `tw-animate-css`, `shadcn-nuxt`, `reka-ui`, `class-variance-authority`, `clsx`, `tailwind-merge`, `lucide-vue-next`

### Pinia

**Purpose:** State management with automatic store discovery across all slices.

```
app/slices/setup/pinia/
└── nuxt.config.ts
```

```typescript
// nuxt.config.ts
export default defineNuxtConfig({
  alias: { '#pinia': currentDir },
  modules: ['@pinia/nuxt'],
  pinia: {
    storesDirs: [
      'stores/**',
      'slices/*/stores/**',
      'slices/*/*/stores/**',
    ],
  },
});
```

Once configured, stores defined in any slice's `stores/` folder are auto-imported. Use them directly without manual imports:

```typescript
const authStore = useAuthStore();
const projectStore = useProjectStore();
```

### API

**Purpose:** Generated TypeScript SDK from your backend's OpenAPI specification.

```
app/slices/setup/api/
├── nuxt.config.ts                  # #api alias
├── plugins/api.ts                  # sets baseURL from runtimeConfig + error interceptor
└── data/repositories/api/          # Generated SDK (do not edit)
    ├── index.ts
    ├── sdk.gen.ts
    └── types.gen.ts
```

```typescript
// plugins/api.ts
import { client } from '../data/repositories/api/client.gen';

export default defineNuxtPlugin(() => {
  const { apiUrl } = useRuntimeConfig().public;
  client.setConfig({ baseURL: apiUrl as string });
});
```

The default `apiUrl` lives in the root `nuxt.config.ts` under `runtimeConfig.public`; override it at runtime with `NUXT_PUBLIC_API_URL`.

Generate the SDK from your running backend:

```bash
bunx @hey-api/openapi-ts \
  -i http://localhost:4000/api-json \
  -o app/slices/setup/api/data/repositories/api \
  -c axios
```

Use the generated services in your code:

```typescript
import { UsersService } from '#api';
const users = await UsersService.findAll();
```

::: warning
The files in `data/repositories/api/` are auto-generated. Do not edit them manually — they will be overwritten on the next SDK generation.
:::

### Error

**Purpose:** Centralized error handling with toast notifications and i18n support.

```
app/slices/setup/error/
├── nuxt.config.ts
├── stores/error.ts
├── composables/useError.ts
├── utils/handleError.ts
└── locales/en.json
```

The error slice provides a `useError` composable for wrapping async operations:

```typescript
const { handleAsync } = useError();

const result = await handleAsync(
  () => UsersService.createUser(data),
  { showToast: true, errorKey: 'createUser' }
);
```

It automatically catches errors, displays toast notifications, and stores error state that components can check.

### i18n

**Purpose:** Multi-language support with browser detection and lazy loading.

```
app/slices/setup/i18n/
├── nuxt.config.ts
├── i18n.config.ts
└── locales/
    ├── en.json
    ├── fr.json
    └── es.json
```

```typescript
// nuxt.config.ts
export default defineNuxtConfig({
  alias: { '#i18n': currentDir },
  modules: ['@nuxtjs/i18n'],
  i18n: {
    locales: [
      { code: 'en', file: 'en.json', name: 'English' },
      { code: 'fr', file: 'fr.json', name: 'Français' },
    ],
    lazy: true,
    langDir: `${currentDir}/locales`,
    defaultLocale: 'en',
    strategy: 'no_prefix',
  },
});
```

Feature slices add their own translations in their `locales/` folders. The i18n module merges them automatically.

## Backend Setup Slices

Located at `api/src/slices/`.

### Prisma

**Purpose:** Database ORM (Prisma 8) and connection management. See [Database](/backend/database) for detailed setup.

```
api/src/slices/setup/prisma/
├── prisma.module.ts      # @Global()
├── prisma.service.ts     # db.public.<Model>, transaction(), raw SQL
├── prisma.types.ts       # PrismaRow / PrismaCreate / PrismaUpdate
├── prisma.errors.ts      # isUniqueViolation, sqlState, …
└── index.ts
```

The `PrismaModule` is registered globally — all feature slices can inject `PrismaService` without importing the module. It has no `.prisma` file of its own: there is no datasource or generator block in Prisma 8.

### Core

**Purpose:** Shared decorators, interceptors, and error handling infrastructure.

```
api/src/slices/core/
├── core.module.ts
├── decorators/
│   ├── api-response.decorator.ts   # Swagger response wrappers
│   ├── public.decorator.ts         # Mark routes as public
│   └── user.decorator.ts           # Extract user from request
├── interceptors/
│   ├── response.interceptor.ts     # Wrap responses in { data, success }
│   └── error.interceptor.ts        # Standardize error responses
├── errors/
│   ├── base.error.ts               # Abstract BaseError class
│   └── error-codes.ts              # Error code enum
└── types/
    └── meta.types.ts               # Pagination metadata types
```

### AWS

**Purpose:** AWS service integrations organized as submodules.

```
api/src/slices/aws/
├── aws.module.ts
├── s3/
│   ├── s3.module.ts
│   └── s3.repository.ts
├── cognito/
│   ├── cognito.module.ts
│   └── cognito.repository.ts
└── bedrock/
    ├── bedrock.module.ts
    └── bedrock.repository.ts
```

### Redis

**Purpose:** Cache and session storage with a simple key-value interface.

```
api/src/slices/redis/
├── redis.module.ts
└── redis.repository.ts
```

### Health

**Purpose:** Health check endpoint for monitoring.

```
api/src/slices/health/
├── health.module.ts
└── health.controller.ts
```

Exposes `GET /health` returning `{ status: 'ok' }`.

### Mail

**Purpose:** The one place the API sends email from. See [Email](/backend/email) for the full slice.

```
api/src/slices/setup/mail/
├── mail.module.ts                  # @Global; binds IMailGateway to SmtpMailGateway
├── domain/
│   ├── mail.types.ts               # IMailMessage, IMailResult
│   ├── mail.gateway.ts             # abstract IMailGateway
│   ├── mail.service.ts             # MailService: default sender, delegates
│   └── mail.errors.ts
└── data/
    ├── mail.gateway.ts             # SmtpMailGateway
    ├── mail.mapper.ts
    └── repositories/smtp/          # nodemailer transport from SMTP_* env
```

Feature slices inject `MailService`. Locally the SMTP repository points at Mailpit from `docker-compose.yml`, so every message lands in `http://localhost:8025` instead of a real mailbox.

## Registration Order

### Frontend

Setup slices must be registered before feature slices in `app/nuxt.config.ts`. Within setup slices, the order matters — dependencies should come first:

```typescript
export default defineNuxtConfig({
  extends: [
    // 1. Theme first (UI components used everywhere)
    './slices/setup/theme',
    // 2. Pinia (stores used by other slices)
    './slices/setup/pinia',
    // 3. API (services used by stores)
    './slices/setup/api',
    // 4. Error (depends on pinia and i18n)
    './slices/setup/error',
    // 5. i18n
    './slices/setup/i18n',
    // Feature slices (any order)
    './slices/user',
    './slices/project',
  ],
});
```

### Backend

Import all modules in `api/src/app.module.ts`:

```typescript
@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    PrismaModule,
    CoreModule,
    // Optional infrastructure
    AwsModule,
    RedisModule,
    HealthModule,
    MailModule,
    // Feature modules
    UserModule,
    ProjectModule,
  ],
})
export class AppModule {}
```

## What's Next?

- [Backend Getting Started](/backend/getting-started) — Detailed backend project setup
- [Frontend Getting Started](/frontend/getting-started) — Detailed frontend project setup
- [Architecture Overview](/architecture/overview) — Understanding the layer system
