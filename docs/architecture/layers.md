# Layers

Every CleanSlice feature is organized into three layers. Each layer has a specific responsibility and strict rules about what it can import.

## Presentation Layer

**Location:** Slice root + `dtos/` folder (backend) | `pages/` + `components/` (frontend)

The presentation layer is the entry point for external interaction. On the backend, it handles HTTP requests. On the frontend, it renders UI and responds to user events.

### Backend (Controllers + DTOs)

```typescript
// user.controller.ts
@Controller('users')
export class UserController {
  constructor(private readonly userService: UserService) {}

  @Post()
  async create(@Body() dto: CreateUserDto): Promise<UserDto> {
    const user = await this.userService.create(dto);
    return new UserDto(user);
  }
}
```

```typescript
// dtos/createUser.dto.ts
import { IsEmail, IsString, MinLength } from 'class-validator';

export class CreateUserDto {
  @IsEmail()
  email: string;

  @IsString()
  @MinLength(2)
  name: string;
}
```

### Frontend (Pages + Components)

```vue
<!-- pages/users.vue -->
<script setup lang="ts">
const store = useUserStore();
await store.fetchAll();
</script>

<template>
  <div class="container mx-auto p-6">
    <UserList :users="store.users" />
  </div>
</template>
```

### Rules

- Can import from the **domain** layer (services, types)
- Cannot import from the **data** layer
- Contains no business logic
- Handles input validation and response formatting

## Domain Layer

**Location:** `domain/` folder

The domain layer is the heart of your slice. It contains business logic, type definitions, and gateway interfaces. Everything here is **pure TypeScript** — no framework imports.

### Types

```typescript
// domain/user.types.ts
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

### Gateway Interface

The gateway interface defines the contract for data access without specifying how it's implemented:

```typescript
// domain/user.gateway.ts
import { IUserData, ICreateUserData } from './user.types';

export abstract class IUserGateway {
  abstract findById(id: string): Promise<IUserData | null>;
  abstract findAll(): Promise<IUserData[]>;
  abstract create(data: ICreateUserData): Promise<IUserData>;
  abstract delete(id: string): Promise<void>;
}
```

::: tip Abstract Classes as Interfaces
CleanSlice uses abstract classes (with the `I` prefix) instead of TypeScript interfaces for gateway definitions. This is because interfaces are erased at runtime and can't be used as dependency injection tokens. Abstract classes exist at runtime and serve as both the type and the DI token.
:::

### Service (Optional)

Services contain business logic and orchestrate gateway calls:

```typescript
// domain/user.service.ts
@Injectable()
export class UserService {
  constructor(
    @Inject('IUserGateway')
    private readonly gateway: IUserGateway,
  ) {}

  async create(data: ICreateUserData): Promise<IUserData> {
    const normalized = { ...data, email: data.email.toLowerCase().trim() };
    return this.gateway.create(normalized);
  }
}
```

### Rules

- Pure TypeScript (no framework-specific imports in types)
- Defines contracts that the data layer implements
- Can import from other slices' domain layers
- Cannot import from any data layer

## Data Layer

**Location:** `data/` folder

The data layer implements the contracts defined by the domain layer. This is where you interact with databases, external APIs, and other services.

### Gateway Implementation

```typescript
// data/user.gateway.ts
@Injectable()
export class UserGateway implements IUserGateway {
  constructor(
    private readonly prisma: PrismaService,
    private readonly mapper: UserMapper,
  ) {}

  async findById(id: string): Promise<IUserData | null> {
    const user = await this.prisma.user.findUnique({ where: { id } });
    return user ? this.mapper.toDomain(user) : null;
  }

  async create(data: ICreateUserData): Promise<IUserData> {
    const user = await this.prisma.user.create({ data });
    return this.mapper.toDomain(user);
  }
}
```

### Mapper

Mappers transform data between the database format and domain types:

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

### Rules

- Implements interfaces from the domain layer
- Handles all external communication (database, APIs, file system)
- Uses mappers to transform data — never returns raw database types
- Contains no business logic

## Layer Dependency Summary

```
┌──────────────┐
│ Presentation │──── can import ────→ Domain
└──────┬───────┘
       │ CANNOT import
       ✗
┌──────┴───────┐
│    Domain    │──── can import ────→ Other slice domains
└──────┬───────┘
       │ CANNOT import (use DI)
       ✗
┌──────┴───────┐
│     Data     │──── can import ────→ Domain (implements)
└──────────────┘
```

| From | To | Allowed |
|------|----|---------|
| Presentation | Domain | Yes |
| Presentation | Data | No |
| Domain | Data | No (use dependency injection) |
| Data | Domain | Yes (implements interfaces) |
| Domain (slice A) | Domain (slice B) | Yes |
| Data (slice A) | Data (slice B) | Yes |
| Data (slice A) | Domain (slice B) | Yes |

## What's Next?

- [Slices](/architecture/slices) — How feature and setup slices work
- [Dependency Flow](/architecture/dependency-flow) — How DI connects the layers
- [Gateways](/backend/gateways) — Deep dive into the gateway pattern
