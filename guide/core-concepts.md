# Core Concepts

This page explains the foundational ideas behind CleanSlice: vertical slices, the three-layer architecture, the gateway pattern, and how dependency injection ties it all together.

## Vertical Slices

Traditional projects organize code by technical concern — all controllers in one folder, all services in another, all models in a third. This works for small apps but creates problems as the codebase grows: adding a feature means touching files in many different directories, and it becomes hard to understand what belongs to what.

CleanSlice organizes code by **feature** instead. Each feature gets its own folder (a "slice") containing everything it needs:

```
# Traditional (by layer)              # CleanSlice (by feature)
src/                                  src/slices/
├── controllers/                      ├── user/
│   ├── user.controller.ts            │   ├── user.controller.ts
│   └── project.controller.ts         │   ├── domain/
├── services/                         │   ├── data/
│   ├── user.service.ts               │   └── dtos/
│   └── project.service.ts            └── project/
├── repositories/                         ├── project.controller.ts
│   ├── user.repository.ts                ├── domain/
│   └── project.repository.ts             ├── data/
└── models/                               └── dtos/
```

Each slice is self-contained. You can understand a feature by looking at one folder, and you can add or remove features without affecting unrelated parts of the codebase.

::: tip Naming Convention
Slice folders use **singular** names: `user/`, `project/`, `chat/`. The only exception is controller routes, which are plural: `@Controller('users')`.
:::

## The Three Layers

Within each slice, code is organized into three layers with strict dependency rules:

```
┌─────────────────────────────────────────────┐
│  Presentation Layer                         │
│  Controllers, DTOs, Pages, Components       │
│  Handles input/output                       │
└──────────────────┬──────────────────────────┘
                   │ calls
                   ▼
┌─────────────────────────────────────────────┐
│  Domain Layer                               │
│  Services, Types, Gateway Interfaces        │
│  Pure business logic, framework-agnostic    │
└──────────────────┬──────────────────────────┘
                   │ implements (via DI)
                   ▼
┌─────────────────────────────────────────────┐
│  Data Layer                                 │
│  Gateway Implementations, Mappers           │
│  Database access, external APIs             │
└─────────────────────────────────────────────┘
```

### Presentation Layer

The outer layer that handles external communication. On the backend, this means HTTP controllers and DTOs. On the frontend, this means pages and components.

- Receives input (HTTP requests, user events)
- Validates and transforms input/output
- Delegates to the domain layer
- Contains no business logic

### Domain Layer

The core of your slice. This is where business logic lives, and it should be **framework-agnostic** — pure TypeScript with no imports from NestJS, Prisma, or Vue.

- Defines types and interfaces (`IUserData`, `ICreateUserData`)
- Defines gateway contracts (abstract classes)
- Contains business rules and validation
- Can import from other slices' domain layers

### Data Layer

The inner layer that implements the contracts defined by the domain layer. This is where you interact with databases, external APIs, and other services.

- Implements gateway interfaces using Prisma, HTTP clients, etc.
- Transforms data between external formats and domain types using mappers
- Contains no business logic — only data operations

### Dependency Rules

The critical rule: **dependencies point inward toward the domain layer**.

| From → To | Allowed? |
|-----------|----------|
| Presentation → Domain | Yes |
| Presentation → Data | **No** |
| Domain → Data | **No** (use DI) |
| Data → Domain | Yes (implements interfaces) |

This means your domain layer never depends on database libraries, HTTP frameworks, or UI frameworks. You can swap out any external dependency without touching your business logic.

## The Gateway Pattern

The gateway pattern is how CleanSlice achieves separation between the domain and data layers. Instead of calling the database directly, you:

1. **Define an abstract gateway** in the domain layer (the contract)
2. **Implement it** in the data layer (the concrete implementation)
3. **Wire them together** using dependency injection in the module

### Example

Define the contract:

```typescript
// domain/user.gateway.ts
export abstract class IUserGateway {
  abstract findById(id: string): Promise<IUserData | null>;
  abstract create(data: ICreateUserData): Promise<IUserData>;
}
```

Implement it with Prisma:

```typescript
// data/user.gateway.ts
@Injectable()
export class UserGateway implements IUserGateway {
  constructor(private readonly prisma: PrismaService) {}

  async findById(id: string): Promise<IUserData | null> {
    const user = await this.prisma.user.findUnique({ where: { id } });
    return user ? UserMapper.toDomain(user) : null;
  }

  async create(data: ICreateUserData): Promise<IUserData> {
    const user = await this.prisma.user.create({ data });
    return UserMapper.toDomain(user);
  }
}
```

Wire them in the module:

```typescript
// user.module.ts
@Module({
  providers: [
    {
      provide: IUserGateway,
      useClass: UserGateway,
    },
  ],
})
export class UserModule {}
```

::: tip Why Abstract Classes Instead of Interfaces?
TypeScript interfaces are erased at runtime, so they can't be used as DI tokens. Abstract classes exist at runtime and serve as both the type definition and the injection token.
:::

### Benefits

- **Testability** — Replace the real gateway with a mock in tests
- **Flexibility** — Swap from PostgreSQL to MongoDB by changing only the data layer
- **Clarity** — Business logic never knows about database details

## Mappers

Mappers transform data between the database format and domain types. They live in the data layer and ensure that database-specific types (like Prisma models) don't leak into your domain.

```typescript
// data/user.mapper.ts
@Injectable()
export class UserMapper {
  toDomain(prismaUser: PrismaUser): IUserData {
    return {
      id: prismaUser.id,
      email: prismaUser.email,
      name: prismaUser.name,
      createdAt: prismaUser.createdAt,
      updatedAt: prismaUser.updatedAt,
    };
  }
}
```

Every gateway implementation should use a mapper rather than returning raw database objects.

## Setup Slices vs Feature Slices

CleanSlice has two kinds of slices:

**Feature slices** represent application features — `user/`, `project/`, `chat/`. They contain domain logic, data access, and UI specific to that feature.

**Setup slices** provide shared infrastructure that feature slices depend on:

| Backend Setup Slices | Purpose |
|---------------------|---------|
| `prisma/` | Database connection |
| `core/` | Shared decorators, interceptors, error handling |
| `aws/` | AWS service integrations |

| Frontend Setup Slices | Purpose |
|----------------------|---------|
| `setup/theme/` | Tailwind CSS and shadcn-vue components |
| `setup/pinia/` | State management configuration |
| `setup/api/` | Generated API SDK from OpenAPI spec |
| `setup/error/` | Centralized error handling |
| `setup/i18n/` | Internationalization |

Setup slices are registered before feature slices and are available globally across the application.

## What's Next?

- [Project Structure](/guide/project-structure) — Detailed folder layout and naming conventions
- [Setup Slices](/guide/setup-slices) — Configure the infrastructure slices
- [Architecture Overview](/architecture/overview) — Deeper dive into Clean Architecture principles
