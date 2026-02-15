# TypeScript Standards

These TypeScript conventions apply to all code in both the backend (NestJS) and frontend (Nuxt) projects. They ensure type safety, consistency, and readability across the entire codebase.

## Quick Reference

| Rule | Correct | Incorrect |
|------|---------|-----------|
| Interface prefix | `IUserData` | `UserData` |
| Enum suffix | `UserStatusTypes` | `UserStatus` |
| No `any` | `unknown` with type guard | `any` |
| Return types | `function(): string` | `function()` (inferred) |
| Optional props | `name?: string` | `name: string \| undefined` |

## No `any`

The `any` type disables type checking and should never be used. Use proper types, `unknown` with type guards, or generics instead.

```typescript
// Use a proper interface
function processData(data: IUserData): string {
  return data.name;
}

// Use unknown + type guard for truly unknown data
function processData(data: unknown): string {
  if (typeof data === 'object' && data !== null && 'name' in data) {
    return (data as { name: string }).name;
  }
  throw new Error('Invalid data');
}

// Use generics for flexible functions
function processData<T extends { name: string }>(data: T): string {
  return data.name;
}
```

| Situation | Use Instead of `any` |
|-----------|---------------------|
| Unknown API response | `unknown` + type guard |
| Dynamic object keys | `Record<string, T>` |
| Multiple possible types | Union type `A \| B \| C` |
| Complex generic | Proper generic constraints |

## Interface Naming

All interfaces use the `I` prefix. This makes it immediately clear what's an interface vs a class, and it's consistent with the gateway pattern where `IUserGateway` is the abstract contract and `UserGateway` is the implementation.

```typescript
export interface IUserData {
  id: string;
  email: string;
  name: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface ICreateUserData {
  email: string;
  name: string;
}
```

### Naming Patterns

| Type | Pattern | Example |
|------|---------|---------|
| Base entity | `I{Entity}Data` | `IUserData`, `IProjectData` |
| Create input | `ICreate{Entity}Data` | `ICreateUserData` |
| Update input | `IUpdate{Entity}Data` | `IUpdateUserData` |
| Filter/Query | `I{Entity}Filter` | `IUserFilter` |
| Gateway | `I{Entity}Gateway` | `IUserGateway` |
| With relations | `I{Entity}With{Extra}` | `IUserWithTeams` |

## Enum Naming

All enums end with the `Types` suffix and use string values:

```typescript
export enum UserStatusTypes {
  Active = 'active',
  Inactive = 'inactive',
  Pending = 'pending',
}

export enum RoleTypes {
  Admin = 'admin',
  User = 'user',
  Guest = 'guest',
}
```

::: warning
Always use string enum values, not numeric ones. String values are readable in JSON, database records, and logs. Numeric enums are fragile and hard to debug.
:::

## Type Aliases vs Interfaces

Use interfaces for object shapes and type aliases for unions, utilities, and function signatures:

```typescript
// Interfaces for object shapes
export interface IUserData {
  id: string;
  name: string;
}

// Type aliases for everything else
export type UserRole = 'admin' | 'user' | 'guest';
export type UserId = string;
export type Nullable<T> = T | null;
export type UserValidator = (user: IUserData) => boolean;
```

## Return Types

Always declare explicit return types for functions and methods:

```typescript
function getUser(id: string): IUserData {
  return { id, name: 'John', /* ... */ };
}

async function fetchUser(id: string): Promise<IUserData> {
  return await this.gateway.findById(id);
}

async function findUser(id: string): Promise<IUserData | null> {
  return await this.gateway.findById(id);
}
```

## Optional Properties

Use `?` for optional properties, not `| undefined`:

```typescript
export interface IUpdateUserData {
  name?: string;
  email?: string;
}

function greet(name: string, title?: string): string {
  return title ? `${title} ${name}` : name;
}
```

## Null vs Undefined

Use `null` for intentional absence (API responses, cleared values) and `undefined` for unset optional fields:

```typescript
// null = intentionally empty
export interface IUserData {
  avatarUrl: string | null;  // User explicitly has no avatar
}

// undefined = not provided
export interface IUpdateUserData {
  name?: string;  // Field not included in update
}

// Function returning nullable
async function findUser(id: string): Promise<IUserData | null> {
  const user = await this.db.find(id);
  return user ?? null;
}
```

## Import Organization

Organize imports in this order, separated by blank lines:

```typescript
// 1. Framework / Node.js built-ins
import { Injectable } from '@nestjs/common';

// 2. External packages
import { v4 as uuid } from 'uuid';

// 3. Slice aliases (cross-slice imports)
import { PrismaService } from '#prisma';
import { IUserData } from '#user/domain';

// 4. Relative imports (same slice only)
import { UserMapper } from './user.mapper';
```

::: tip Slice Aliases
Always use `#` aliases for cross-slice imports (`#prisma`, `#user/domain`). Use relative paths only within the same slice. This makes dependencies explicit and refactoring safe.
:::

## Named Exports

Use named exports everywhere. Avoid default exports unless required by a framework (like `defineNuxtConfig`):

```typescript
// Correct — named exports
export interface IUserData { /* ... */ }
export class UserService { /* ... */ }

// Correct — named imports
import { IUserData, UserService } from './user.types';

// Avoid — default exports
export default class UserService { /* ... */ }
```

## Async/Await

Always use async/await instead of raw Promise chains:

```typescript
// Correct
async function getUser(id: string): Promise<IUserData> {
  const user = await this.gateway.findById(id);
  if (!user) throw new UserNotFoundError(id);
  return user;
}

// Correct — parallel operations
async function getUserWithTeam(userId: string): Promise<IUserWithTeam> {
  const [user, team] = await Promise.all([
    this.userGateway.findById(userId),
    this.teamGateway.findByUserId(userId),
  ]);
  return { ...user, team };
}
```

## Class Properties

Use `private readonly` for injected dependencies:

```typescript
@Injectable()
export class UserService {
  constructor(
    private readonly userGateway: IUserGateway,
    private readonly logger: LoggerService,
  ) {}

  async getUser(id: string): Promise<IUserData> {
    return await this.userGateway.findById(id);
  }
}
```

## What's Next?

- [NestJS Standards](/standards/nestjs) — Backend-specific conventions
- [Nuxt Standards](/standards/nuxt) — Frontend-specific conventions
- [Types Pattern](/backend/types) — How domain types are organized
