# Slices

A slice is a self-contained feature module. It owns everything related to one feature: API endpoints, UI components, state management, types, and data access. This page explains how slices are structured, how they interact, and the difference between feature slices and setup slices.

## Anatomy of a Slice

### Backend (NestJS)

```
api/src/slices/user/
├── user.module.ts                # NestJS module definition
├── user.controller.ts            # HTTP endpoints (@Controller('users'))
├── domain/
│   ├── index.ts                  # Barrel exports
│   ├── user.types.ts             # IUserData, ICreateUserData
│   ├── user.gateway.ts           # Abstract IUserGateway
│   └── user.service.ts           # Business logic (optional)
├── data/
│   ├── user.gateway.ts           # Concrete gateway (Prisma)
│   └── user.mapper.ts            # Prisma → domain type conversion
└── dtos/
    ├── index.ts                  # Barrel exports
    ├── user.dto.ts               # Response DTO
    ├── createUser.dto.ts         # Create request DTO
    └── updateUser.dto.ts         # Update request DTO
```

### Frontend (Nuxt)

```
app/slices/user/
├── nuxt.config.ts                # Slice config with #alias
├── pages/
│   ├── users.vue                 # List page (plural route)
│   └── users/[id].vue            # Detail page
├── components/
│   └── user/                     # Component group
│       ├── Provider.vue          # Data fetching + bootstrapping
│       ├── Item.vue              # Display component
│       └── Form.vue              # Edit form
├── stores/
│   └── user.ts                   # Pinia store
└── locales/
    ├── en.json                   # English translations
    └── fr.json                   # French translations
```

## Feature Slices vs Setup Slices

### Feature Slices

Feature slices represent application functionality — user management, projects, chat, billing, etc. They contain domain logic, data access, and UI specific to that feature.

Examples: `user/`, `project/`, `chat/`, `billing/`

### Setup Slices

Setup slices provide shared infrastructure that feature slices depend on. They have no domain logic of their own — they configure tools, libraries, and cross-cutting concerns.

**Backend setup slices** (`api/src/slices/`):

| Slice | Purpose |
|-------|---------|
| `prisma/` | Database ORM connection |
| `core/` | Shared decorators, interceptors, errors |
| `aws/` | AWS service integrations |
| `redis/` | Cache and session storage |
| `health/` | Health check endpoint |

**Frontend setup slices** (`app/slices/setup/`):

| Slice | Purpose |
|-------|---------|
| `theme/` | Tailwind CSS, shadcn-vue components |
| `pinia/` | State management configuration |
| `api/` | Generated API SDK from OpenAPI spec |
| `error/` | Centralized error handling |
| `i18n/` | Internationalization |

## Slice Naming Rules

| What | Rule | Example |
|------|------|---------|
| Slice folder | **Singular** | `user/`, `project/`, `chat/` |
| Controller route | **Plural** | `@Controller('users')` |
| Page filename | **Plural** | `pages/projects.vue` |
| DTO files | **camelCase** | `createUser.dto.ts` |
| Component folders | **camelCase** | `user/`, `userList/` |

::: warning
The singular vs plural distinction is important. Slice folders are always singular (`user/`, not `users/`). Routes and page files are always plural (`/users`, `projects.vue`).
:::

## Slice Communication

Slices can communicate with each other, but only through their public domain interfaces.

### Allowed

```typescript
// project.service.ts can import user domain types
import { IUserData } from '#user/domain';
```

### Not Allowed

```typescript
// project.service.ts cannot import user data layer
import { UserGateway } from '#user/data/user.gateway'; // wrong
```

### Cross-Slice Dependencies

When one slice needs data from another, it should go through the other slice's public service or gateway interface:

```typescript
// project/domain/project.service.ts
@Injectable()
export class ProjectService {
  constructor(
    @Inject('IProjectGateway')
    private readonly projectGateway: IProjectGateway,
    private readonly userService: UserService,  // Import the service
  ) {}

  async getProjectWithOwner(id: string) {
    const project = await this.projectGateway.findById(id);
    const owner = await this.userService.findById(project.ownerId);
    return { ...project, owner };
  }
}
```

## Registering Slices

### Backend

Import slice modules in `api/src/app.module.ts`:

```typescript
@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    // Setup slices
    PrismaModule,
    CoreModule,
    // Feature slices
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
    // Setup slices (order matters)
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

## What's Next?

- [Dependency Flow](/architecture/dependency-flow) — How dependency injection connects layers
- [Backend Slice Structure](/backend/slice-structure) — Detailed backend patterns
- [Frontend Slice Structure](/frontend/slice-structure) — Detailed frontend patterns
