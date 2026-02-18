# Project Structure

This page covers the complete folder layout, naming conventions, and file organization rules for a CleanSlice project.

## Top-Level Layout

```
my-project/
├── api/                          # Backend (NestJS)
│   ├── src/
│   │   ├── slices/               # All features and setup modules
│   │   ├── app.module.ts         # Root module
│   │   └── main.ts               # Entry point
│   ├── prisma/
│   │   └── schema.prisma         # Database schema
│   ├── tsconfig.json
│   └── package.json
│
├── app/                          # Frontend (Nuxt)
│   ├── slices/                   # All features and setup modules
│   │   ├── setup/                # Infrastructure slices
│   │   └── {feature}/            # Feature slices
│   ├── nuxt.config.ts            # Root config (registers slices)
│   └── package.json
│
└── docker-compose.yml            # Local services (Postgres, Redis, etc.)
```

## Backend Slice Structure

Each backend feature slice follows this layout:

```
api/src/slices/{entity}/
├── {entity}.module.ts                # Module definition
├── {entity}.controller.ts            # HTTP endpoints
├── domain/
│   ├── index.ts                      # Barrel exports
│   ├── {entity}.types.ts             # IEntityData, ICreateEntityData
│   ├── {entity}.gateway.ts           # Abstract gateway class
│   └── {entity}.service.ts           # Business logic (optional)
├── data/
│   ├── {entity}.gateway.ts           # Concrete gateway (Prisma)
│   └── {entity}.mapper.ts            # Data transformation
└── dtos/
    ├── index.ts                      # Barrel exports
    ├── {entity}.dto.ts               # Response DTO
    ├── create{Entity}.dto.ts         # Create request DTO
    ├── update{Entity}.dto.ts         # Update request DTO
    └── filter{Entity}.dto.ts         # Query filter DTO
```

### Data flow through the layers

```
HTTP Request
    ↓
Controller              validates input with DTOs
    ↓
Service (optional)      orchestrates business logic
    ↓
Gateway (abstract)      domain contract
    ↓
Gateway (concrete)      Prisma queries
    ↓
Mapper                  transforms Prisma → domain types
    ↓
HTTP Response
```

## Frontend Slice Structure

Each frontend feature slice is a Nuxt layer:

```
app/slices/{entity}/
├── nuxt.config.ts                    # Slice configuration + aliases
├── pages/
│   ├── {entities}.vue                # List page (plural route)
│   ├── {entities}/[id].vue           # Detail page
│   └── {entities}/create.vue         # Create page
├── components/
│   └── {entity}/                     # Component group (one level deep)
│       ├── Provider.vue              # Data fetching + bootstrapping
│       ├── Item.vue                  # Display component
│       └── Form.vue                  # Edit form
├── stores/
│   └── {entity}.ts                   # Pinia store
└── locales/
    ├── en.json                       # English translations
    └── fr.json                       # French translations
```

::: warning Component Nesting
Components are organized one level deep inside a named folder. Do not nest further. Each component folder should contain a `Provider.vue` that handles data fetching and bootstrapping.
:::

## Naming Conventions

### Folders and Files

| What | Convention | Example |
|------|-----------|---------|
| Slice folder | singular, lowercase | `user/`, `project/`, `chat/` |
| DTO files | camelCase | `createUser.dto.ts`, `filterProject.dto.ts` |
| Type files | dot notation | `user.types.ts`, `project.gateway.ts` |
| Component folders | camelCase | `user/`, `userList/`, `projectCard/` |

### TypeScript Naming

| What | Convention | Example |
|------|-----------|---------|
| Interfaces | `I` prefix | `IUserData`, `ICreateUserData` |
| Gateway interfaces | `I` prefix + `Gateway` | `IUserGateway` |
| Enums | `Types` suffix | `RoleTypes`, `StatusTypes` |
| Domain types | `Data` suffix | `IUserData`, `IProjectData` |
| Create types | `ICreate` + `Data` | `ICreateUserData` |

### Routes

| What | Convention | Example |
|------|-----------|---------|
| Controller routes | **plural** | `@Controller('users')` |
| Page file names | **plural** | `pages/projects.vue` |
| Slice folders | **singular** | `slices/user/` |

::: tip The Singular Rule
Slice folders are always singular (`user/`, not `users/`). Routes and page files are always plural (`/users`, `projects.vue`). This distinction is consistent throughout the framework.
:::

## Path Aliases

### Backend (`#` alias)

Configure in `api/tsconfig.json`:

```json
{
  "compilerOptions": {
    "paths": {
      "#": ["src/slices"],
      "#*": ["src/slices/*"]
    }
  }
}
```

Usage:

```typescript
import { PrismaService } from '#prisma';
import { IUserGateway } from '#user/domain';
import { CreateUserDto } from '#user/dtos';
```

### Frontend (per-slice aliases)

Each slice defines its own alias in `nuxt.config.ts`:

```typescript
// slices/user/nuxt.config.ts
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const currentDir = dirname(fileURLToPath(import.meta.url));

export default defineNuxtConfig({
  alias: {
    '#user': currentDir,
  },
});
```

The API setup slice exposes the generated SDK:

```typescript
import { UsersService, ProjectsService } from '#api';
```

## Module Registration

### Backend

Import all slice modules in `api/src/app.module.ts`:

```typescript
import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { PrismaModule } from '#prisma';
import { UserModule } from '#user/user.module';
import { ProjectModule } from '#project/project.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    PrismaModule,
    UserModule,
    ProjectModule,
  ],
})
export class AppModule {}
```

### Frontend

Register slices as Nuxt layers in `app/nuxt.config.ts`:

```typescript
export default defineNuxtConfig({
  extends: [
    // Setup slices first (order matters)
    './slices/setup/theme',
    './slices/setup/pinia',
    './slices/setup/api',
    './slices/setup/error',
    './slices/setup/i18n',
    // Feature slices
    './slices/user',
    './slices/project',
  ],
});
```

## Auto-Imports

Nuxt auto-imports Vue APIs and composables. You should not manually import them:

```typescript
// Don't do this
import { ref, computed, onMounted } from 'vue';
import { useAsyncData } from '#imports';

// Just use them directly
const count = ref(0);
const doubled = computed(() => count.value * 2);
const { data } = await useAsyncData('key', () => fetchData());
```

Pinia stores defined in any slice's `stores/` folder are also auto-imported when the Pinia setup slice is configured.

## What's Next?

- [Setup Slices](/guide/setup-slices) — Configure the infrastructure slices your features depend on
- [Backend Slice Structure](/backend/slice-structure) — Detailed backend patterns
- [Frontend Slice Structure](/frontend/slice-structure) — Detailed frontend patterns
