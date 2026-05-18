# Subslices

A **subslice** is a slice nested inside a parent folder that acts as a namespace for a group of closely related features. Subslices let you organize a cohesive domain — such as user identity — into multiple focused slices without flattening them into the top-level `slices/` directory.

## What Subslices Are

Subslices are not a new pattern or a new layer. A subslice **is a regular slice**. The only difference is its location on disk: instead of living directly under `slices/`, it lives under a parent folder that groups related slices together.

```
slices/
├── user/                         # Parent folder (namespace only — no code of its own)
│   ├── user/                     # Subslice: profile, accounts, roles
│   │   ├── user.module.ts
│   │   ├── user.controller.ts
│   │   ├── user.prisma
│   │   ├── domain/
│   │   ├── data/
│   │   └── dtos/
│   │
│   ├── auth/                     # Subslice: login, JWT, guards
│   │   ├── auth.module.ts
│   │   ├── auth.controller.ts
│   │   ├── domain/
│   │   ├── dtos/
│   │   └── guards/
│   │
│   └── apiKey/                   # Subslice: API key issuance + scopes
│       ├── apiKey.module.ts
│       ├── apiKey.controller.ts
│       ├── apiKey.prisma
│       ├── domain/
│       ├── data/
│       └── dtos/
│
└── project/                      # A regular top-level slice (no subslices)
    ├── project.module.ts
    └── ...
```

Each subslice keeps the full slice anatomy: its own module, controller, `domain/`, `data/`, and `dtos/`. The parent folder (`user/`) is **purely a namespace** — it has no `user.module.ts` at its root, no controller, no domain code. It exists only to group its children on disk.

## When to Use Subslices

Reach for subslices when several slices belong to one bounded context and would otherwise pollute the top-level `slices/` directory.

Good candidates:

| Parent | Subslices | Why grouped |
|--------|-----------|-------------|
| `user/` | `user/`, `auth/`, `apiKey/` | All concern user identity |
| `billing/` | `subscription/`, `invoice/`, `payment/` | All concern monetary flows |
| `content/` | `post/`, `comment/`, `reaction/` | All concern published content |

Stay with flat top-level slices when:

- A feature stands alone (no natural sibling features).
- You only have one slice in the group — there is nothing to namespace yet.
- Slices in the group have no shared domain language; grouping them would be artificial.

::: tip
Subslices are an organizational convenience, not an architectural requirement. Start flat. Promote a group of slices into a subslice folder only when the top-level directory genuinely needs the structure.
:::

## Real Example: The `user/` Group

The Ranch API groups three slices under [`api/src/slices/user/`](https://github.com/cleanslice/ranch/tree/main/api/src/slices/user):

```
api/src/slices/user/
├── user/        # The user entity, profile, roles
├── auth/        # Authentication, JWT, guards, login/register
└── apiKey/      # Programmatic API keys with scopes
```

Each child is registered independently in `app.module.ts` — there is no aggregating module at `user/`:

```typescript
// api/src/app.module.ts
import { UserModule } from './slices/user/user/user.module';
import { AuthModule } from './slices/user/auth/auth.module';
import { ApiKeyModule } from './slices/user/apiKey/apiKey.module';

@Module({
  imports: [
    // Setup slices...
    UserModule,
    AuthModule,
    ApiKeyModule,
    // Other feature slices...
  ],
})
export class AppModule {}
```

Each subslice module looks exactly like a normal slice module:

```typescript
// slices/user/user/user.module.ts
@Module({
  imports: [forwardRef(() => AuthModule)],
  controllers: [UserController],
  providers: [
    UserMapper,
    { provide: IUserGateway, useClass: UserGateway },
  ],
  exports: [IUserGateway, UserMapper],
})
export class UserModule {}
```

## Naming Rules

Subslices follow the same naming rules as top-level slices:

| What | Rule | Example |
|------|------|---------|
| Parent folder | **Singular**, no suffix | `user/`, not `users/` or `userGroup/` |
| Subslice folder | **Singular** | `auth/`, `apiKey/` |
| Subslice module | `{name}.module.ts` | `auth.module.ts` |
| Subslice controller | `@Controller('{plural}')` | `@Controller('auth')`, `@Controller('api-keys')` |

A subslice may share the parent's name (`user/user/`). This is intentional and common: the "main" slice in the group keeps the parent name to signal that it is the primary domain owner.

## Cross-Subslice Communication

Subslices in the same parent group can — and often do — depend on each other. The rules are the same as for any other slice-to-slice communication: go through the domain public interface, never reach into another slice's `data/` folder.

### Allowed

```typescript
// slices/user/apiKey/apiKey.module.ts — imports the auth subslice
import { AuthModule } from '#/user/auth/auth.module';

@Module({
  imports: [forwardRef(() => AuthModule)],
  // ...
})
export class ApiKeyModule {}
```

```typescript
// slices/user/auth/auth.controller.ts — uses user domain types
import { IUserData } from '#/user/user/domain';
```

### Not Allowed

```typescript
// Reaching into another subslice's data layer — same rule as top-level slices
import { UserGateway } from '#/user/user/data/user.gateway'; // wrong
```

### Circular Imports

When two subslices in a group reference each other (`auth` ↔ `apiKey` is common), use `forwardRef()` the same way you would between any two NestJS modules. The grouping does not change the resolution rules — it only changes the import path.

## What the Parent Folder Does Not Contain

A common mistake is treating the parent folder as a slice itself. It is not.

❌ **Do not** add to the parent folder:

- `user.module.ts` aggregating child modules
- `user.controller.ts`
- A `domain/` or `data/` folder
- Shared types — those belong in whichever subslice owns them, exported via that subslice's `domain/index.ts`

If you find yourself wanting shared code at the parent level, that is a signal you need a new subslice (for example, `user/common/`) rather than code in the namespace folder itself.

## Frontend Subslices

The same pattern applies on the frontend. Each subslice is its own Nuxt layer, registered individually in the root `nuxt.config.ts`:

```typescript
// app/nuxt.config.ts
export default defineNuxtConfig({
  extends: [
    // Setup slices...
    './slices/user/user',
    './slices/user/auth',
    './slices/user/apiKey',
    // ...
  ],
});
```

Pinia stores, components, locales, and pages from each subslice are auto-imported through the layer system just like top-level slices.

## Summary

- A subslice is a regular slice nested under a namespace folder.
- The parent folder owns **no code** — it only groups its children.
- Each subslice retains the full three-layer anatomy and is registered independently.
- Use subslices when several slices share a bounded context; stay flat otherwise.
- All slice rules — singular folder names, gateway pattern, no cross-data imports — apply unchanged.

## What's Next?

- [Slices](/architecture/slices) — Anatomy of a single slice
- [Dependency Flow](/architecture/dependency-flow) — Import rules and DI
- [Backend Slice Structure](/backend/slice-structure) — Detailed backend patterns
