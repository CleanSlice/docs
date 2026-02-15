# Dependency Flow

This page explains how dependencies work in CleanSlice — the import rules between layers, how dependency injection connects abstract interfaces to concrete implementations, and how slices interact.

## The Inversion Principle

In a naive architecture, the service would directly import and instantiate the database client:

```typescript
// Naive approach — service depends on Prisma directly
import { PrismaClient } from '@prisma/client';

class UserService {
  private prisma = new PrismaClient();

  async findById(id: string) {
    return this.prisma.user.findUnique({ where: { id } });
  }
}
```

This creates a tight coupling: the service can't be tested without a database, and swapping to a different data source requires rewriting the service.

CleanSlice inverts this dependency. The domain layer defines an abstract interface, and the data layer provides the concrete implementation. A dependency injection container connects them at runtime:

```
Domain Layer                          Data Layer
┌─────────────────────┐              ┌─────────────────────┐
│  IUserGateway       │◄─implements──│  UserGateway        │
│  (abstract class)   │              │  (Prisma-based)     │
└─────────┬───────────┘              └─────────────────────┘
          │
          │ injected into
          ▼
┌─────────────────────┐
│  UserService        │
│  (uses interface)   │
└─────────────────────┘
```

The service only knows about the interface. It works the same whether the injected gateway talks to Prisma, an in-memory store, or a mock.

## Backend DI (NestJS)

NestJS has a built-in dependency injection container. You wire interfaces to implementations in the module:

```typescript
// user.module.ts
@Module({
  providers: [
    UserService,
    UserMapper,
    {
      provide: IUserGateway,    // The abstract class token
      useClass: UserGateway,     // The concrete implementation
    },
  ],
})
export class UserModule {}
```

The service injects the abstract class. NestJS resolves it to the concrete implementation at runtime:

```typescript
// domain/user.service.ts
@Injectable()
export class UserService {
  constructor(private readonly gateway: IUserGateway) {}

  async findById(id: string): Promise<IUserData> {
    return this.gateway.findById(id);
  }
}
```

::: tip Using Abstract Classes as Tokens
Because TypeScript interfaces don't exist at runtime, CleanSlice uses abstract classes with the `I` prefix as both the type and the DI token. This eliminates the need for string-based `@Inject()` decorators.
:::

### Swapping Implementations

You can swap implementations per environment without changing any service code:

```typescript
@Module({
  providers: [
    {
      provide: IUserGateway,
      useClass: process.env.NODE_ENV === 'test'
        ? MockUserGateway
        : UserGateway,
    },
  ],
})
export class UserModule {}
```

## Frontend DI (InversifyJS)

For complex frontend slices that benefit from dependency injection, CleanSlice uses InversifyJS. The pattern mirrors the backend approach.

### Define tokens

```typescript
// setup/di/types.ts
export const TYPES = {
  UserGateway: Symbol.for('IUserGateway'),
  UserService: Symbol.for('UserService'),
};
```

### Register implementations

```typescript
// user/plugins/di.ts
import { container, TYPES } from '#setup/di';

export function registerUserDI(useMocks = false): void {
  container
    .bind<IUserGateway>(TYPES.UserGateway)
    .to(useMocks ? MockUserGateway : UserGateway);
}
```

### Resolve in composables

```typescript
// user/composables/useUser.ts
export function useUser() {
  const service = container.get<UserService>(TYPES.UserService);
  // ... use service methods
}
```

::: tip When to Use Frontend DI
Not every frontend slice needs InversifyJS. For simple slices that just call the generated API SDK and manage state with Pinia, direct API calls are simpler and sufficient. Use DI when you need mock implementations for testing or offline mode.
:::

## Import Rules

### Within a Slice

| From | To | Allowed |
|------|----|---------|
| Controller/Page | Domain (service, types) | Yes |
| Controller/Page | Data (gateway impl) | **No** |
| Service | Gateway interface (domain) | Yes |
| Service | Gateway implementation (data) | **No** |
| Gateway impl | Domain types/interfaces | Yes |
| Mapper | Domain types | Yes |

### Across Slices

| From | To | Allowed |
|------|----|---------|
| Domain (slice A) | Domain (slice B) | Yes |
| Data (slice A) | Domain (slice B) | Yes |
| Data (slice A) | Data (slice B) | Yes |
| Domain (slice A) | Data (slice B) | **No** |
| Presentation (any) | Data (any) | **No** |

### Practical Examples

```typescript
// GOOD: Service imports gateway interface from its own domain
import { IUserGateway } from './user.gateway';

// GOOD: Service imports types from another slice's domain
import { IProjectData } from '#project/domain';

// GOOD: Gateway impl imports domain interface it implements
import { IUserGateway } from '../domain/user.gateway';

// BAD: Service imports concrete gateway from data layer
import { UserGateway } from '../data/user.gateway';

// BAD: Controller imports from data layer
import { UserMapper } from './data/user.mapper';
```

## Barrel Exports

Each layer uses an `index.ts` barrel file to control its public API:

```typescript
// domain/index.ts
export { IUserGateway } from './user.gateway';
export { UserService } from './user.service';
export type { IUserData, ICreateUserData } from './user.types';
```

Other slices import from the barrel, not from individual files:

```typescript
// From another slice
import { IUserData, UserService } from '#user/domain';
```

This makes it easy to refactor internals without breaking consumers.

## What's Next?

- [Gateways](/backend/gateways) — Deep dive into the gateway pattern
- [Backend Slice Structure](/backend/slice-structure) — Complete backend file layout
- [Frontend Dependency Injection](/frontend/dependency-injection) — InversifyJS setup guide
