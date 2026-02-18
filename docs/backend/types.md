# Types

Domain types are the contract of your slice. They define the shape of data flowing through your application -- what a user looks like, what fields are required to create one, and what can be updated. Every layer in the slice references these types, making them the single source of truth.

## Why Types Live in domain/

Types belong in the `domain/` folder because they represent business concepts, not database schemas or API shapes. The domain layer is framework-agnostic: it knows nothing about Prisma, NestJS, or HTTP.

Other layers reference domain types:
- **DTOs** implement them to stay in sync with the business model.
- **Gateways** accept and return them as method signatures.
- **Mappers** convert database models into them.
- **Services** work with them exclusively.

## File Location

```
slices/user/
├── domain/
│   ├── user.types.ts          # All domain types for this slice
│   ├── user.gateway.ts
│   ├── user.service.ts
│   └── index.ts               # Re-exports types
├── data/
└── dtos/
```

**Naming:** `{entity}.types.ts` (singular), always inside `domain/`.

## Complete Example

```typescript [domain/user.types.ts]
// ---- Enums first ----

export enum UserStatusTypes {
  Active = 'active',
  Inactive = 'inactive',
  Pending = 'pending',
  Suspended = 'suspended',
}

export enum UserRoleTypes {
  Admin = 'admin',
  User = 'user',
  Guest = 'guest',
}

export enum SortOrderTypes {
  Asc = 'asc',
  Desc = 'desc',
}

// ---- Base entity interface ----

/** User data - the core entity shape */
export interface IUserData {
  id: string;
  email: string;
  name: string;
  status: UserStatusTypes;
  role: UserRoleTypes;
  avatarUrl?: string;
  createdAt: Date;
  updatedAt: Date;
  lastLoginAt?: Date;
}

// ---- Input interfaces ----

/** Data required to create a new user (omits auto-generated fields) */
export interface ICreateUserData {
  email: string;
  name: string;
  password: string;
  role?: UserRoleTypes;
  avatarUrl?: string;
}

/** Data for updating an existing user (all fields optional) */
export interface IUpdateUserData {
  email?: string;
  name?: string;
  password?: string;
  status?: UserStatusTypes;
  role?: UserRoleTypes;
  avatarUrl?: string;
}

// ---- Query interfaces ----

/** Filter options for user listing */
export interface IUserFilter {
  email?: string;
  search?: string;
  status?: UserStatusTypes;
  role?: UserRoleTypes;
  page?: number;
  perPage?: number;
}

/** Paginated result wrapper */
export interface IPaginatedResult<T> {
  data: T[];
  meta: {
    total: number;
    currentPage: number;
    perPage: number;
    lastPage: number;
  };
}

// ---- Extended types ----

/** User with additional computed data */
export interface IUserWithDetails extends IUserData {
  taskCount: number;
  teamCount: number;
  permissions: string[];
}
```

## Naming Conventions

### Interfaces Start with "I"

Every interface uses the `I` prefix. This makes it immediately clear when you are working with a type contract versus a class:

```typescript
// Correct
interface IUserData { ... }
interface ICreateUserData { ... }
interface IUserGateway { ... }

// Wrong
interface UserData { ... }       // Missing I prefix
type UserData = { ... }          // Use interface, not type alias
```

### Standard Naming Patterns

| Type | Pattern | Example |
|---|---|---|
| Base entity | `I{Entity}Data` | `IUserData` |
| Create input | `ICreate{Entity}Data` | `ICreateUserData` |
| Update input | `IUpdate{Entity}Data` | `IUpdateUserData` |
| Filter/query | `I{Entity}Filter` | `IUserFilter` |
| Extended entity | `I{Entity}With{Extra}` | `IUserWithDetails` |
| Gateway interface | `I{Entity}Gateway` | `IUserGateway` |
| Paginated result | `IPaginatedResult<T>` | (generic, shared) |

### Enum Naming

Enums use the `Types` suffix and PascalCase for both the enum name and its values:

```typescript
// Correct
export enum UserStatusTypes {
  Active = 'active',
  Inactive = 'inactive',
}

// Wrong -- missing Types suffix
export enum UserStatus {
  Active = 'active',
}

// Wrong -- numeric values (not human-readable in logs/DB)
export enum UserStatusTypes {
  Active,     // 0
  Inactive,   // 1
}
```

::: tip
Always use string values for enums. They are human-readable in database rows, API responses, and log output. Numeric enums cause confusion when debugging.
:::

## File Organization Order

Keep your types file organized in this order:

1. **Enums** at the top
2. **Base entity interface** (`IUserData`)
3. **Input interfaces** (`ICreateUserData`, `IUpdateUserData`)
4. **Query/filter interfaces** (`IUserFilter`)
5. **Result interfaces** (`IPaginatedResult`)
6. **Extended types** (`IUserWithDetails`)

## How Types Connect to Other Layers

### DTOs implement domain interfaces

```typescript [dtos/createUser.dto.ts]
import { ICreateUserData } from '../domain';

export class CreateUserDto implements ICreateUserData {
  @ApiProperty()
  @IsEmail()
  email: string;

  @ApiProperty()
  @IsString()
  name: string;

  @ApiProperty()
  @IsString()
  password: string;
}
```

### Gateways use domain types in their signatures

```typescript [domain/user.gateway.ts]
import { IUserData, ICreateUserData, IUpdateUserData, IUserFilter } from './user.types';

export abstract class IUserGateway {
  abstract getUser(id: string): Promise<IUserData | null>;
  abstract createUser(data: ICreateUserData): Promise<IUserData>;
  abstract updateUser(id: string, data: IUpdateUserData): Promise<IUserData>;
  abstract getUsers(filter?: IUserFilter): Promise<IPaginatedResult<IUserData>>;
}
```

### Mappers convert to domain types

```typescript [data/user.mapper.ts]
import { IUserData } from '../domain';

toData(prismaUser: PrismaUser): IUserData {
  return {
    id: prismaUser.id,
    email: prismaUser.email,
    name: prismaUser.name,
    status: prismaUser.status as UserStatusTypes,
    role: prismaUser.role as UserRoleTypes,
    createdAt: prismaUser.createdAt,
    updatedAt: prismaUser.updatedAt,
  };
}
```

### Services return domain types

```typescript [domain/user.service.ts]
import { IUserData, ICreateUserData } from './user.types';

async createUser(data: ICreateUserData): Promise<IUserData> {
  return this.userGateway.createUser(data);
}
```

## Barrel Export

Export everything from the domain index file:

```typescript [domain/index.ts]
export * from './user.types';
export * from './user.gateway';
export * from './user.service';
```

This lets other slices import with a clean path:

```typescript
import { IUserData, UserRoleTypes } from '#/user/domain';
```

## What's Next?

- [DTOs](/backend/dtos) -- How DTOs implement domain interfaces
- [Gateways](/backend/gateways) -- How gateways use domain types in their contracts
- [Mappers](/backend/mappers) -- How mappers convert to and from domain types
- [Services](/backend/services) -- How services work exclusively with domain types
