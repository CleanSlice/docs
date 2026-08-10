# Slice Structure

Every backend feature in CleanSlice is a self-contained **slice** -- a NestJS module with a predictable internal layout. This page explains the anatomy of a backend slice and what goes where.

## Why Slices Have Internal Layers

A slice is not just a flat folder of files. It mirrors Clean Architecture internally: a **domain** layer for business logic and contracts, a **data** layer for implementations, and a **dtos** folder for API-facing types. This separation makes it possible to change your database, swap an API, or refactor business logic without cascading changes across the codebase.

## Slice Anatomy

```
slices/user/
├── user.prisma                # Prisma model (at slice root)
├── user.module.ts             # NestJS module definition
├── user.controller.ts         # HTTP endpoints
├── user.guard.ts              # Optional auth guard
├── domain/
│   ├── index.ts               # Barrel exports
│   ├── user.types.ts          # Interfaces and enums
│   ├── user.gateway.ts        # Abstract gateway (contract)
│   └── user.service.ts        # Business logic (optional)
├── data/
│   ├── user.gateway.ts        # Concrete gateway (Prisma implementation)
│   └── user.mapper.ts         # Data transformation
└── dtos/
    ├── index.ts               # Barrel exports
    ├── user.dto.ts            # Response DTO
    ├── createUser.dto.ts      # Create request DTO
    ├── updateUser.dto.ts      # Update request DTO
    └── filterUser.dto.ts      # Query params DTO
```

## Layer Responsibilities

| Layer | Folder | Contains | Depends On |
|---|---|---|---|
| Presentation | root (`*.controller.ts`) | Controllers, guards | domain/ and dtos/ |
| Domain | `domain/` | Types, gateway interfaces, services | Nothing external |
| Data | `data/` | Gateway implementations, mappers | domain/ and Prisma |
| DTOs | `dtos/` | Request/response DTOs | domain/ types |

The dependency direction is strict: **data/ depends on domain/**, but **domain/ depends on nothing outside itself**. This is dependency inversion in action.

## The Module File

The module wires everything together using NestJS dependency injection:

```typescript [user.module.ts]
import { Module } from '@nestjs/common';
import { PrismaModule } from '#/setup/prisma';
import { UserController } from './user.controller';
import { UserService } from './domain/user.service';
import { IUserGateway } from './domain/user.gateway';
import { UserGateway } from './data/user.gateway';
import { UserMapper } from './data/user.mapper';

@Module({
  imports: [PrismaModule],
  controllers: [UserController],
  providers: [
    UserService,
    UserMapper,
    { provide: IUserGateway, useClass: UserGateway },
  ],
  exports: [
    UserService,
    { provide: IUserGateway, useClass: UserGateway },
  ],
})
export class UserModule {}
```

Key points about the module:

- **Gateway binding** uses `{ provide: IUserGateway, useClass: UserGateway }` to connect the abstract class to its concrete implementation.
- **Exports** list what other modules can access. Only export what is actually needed externally.
- **Imports** only the modules this slice depends on.

## The domain/ Folder

This is the heart of the slice. It contains everything that defines **what** the slice does, without any knowledge of **how**.

### Types (`domain/user.types.ts`)

All interfaces and enums that define the shape of data:

```typescript
export interface IUserData {
  id: string;
  name: string;
  email: string;
  roles: RoleTypes[];
  createdAt?: Date;
  updatedAt?: Date;
}

export interface ICreateUserData {
  name: string;
  email: string;
  roles?: RoleTypes[];
}

export interface IUpdateUserData {
  name?: string;
  roles?: RoleTypes[];
}
```

### Abstract Gateway (`domain/user.gateway.ts`)

Defines the data access contract as an abstract class:

```typescript
export abstract class IUserGateway {
  abstract getUsers(filter?: IUserFilter): Promise<{ data: IUserData[]; meta: IMetaResponse }>;
  abstract getUser(id: string): Promise<IUserData>;
  abstract createUser(data: ICreateUserData): Promise<IUserData>;
  abstract updateUser(id: string, data: IUpdateUserData): Promise<IUserData>;
  abstract deleteUser(id: string): Promise<boolean>;
}
```

### Service (`domain/user.service.ts`)

Optional business logic layer. See [Services](/backend/services) for when to use it and when to skip it.

### Barrel Export (`domain/index.ts`)

```typescript
export * from './user.types';
export * from './user.gateway';
export * from './user.service';
```

## The data/ Folder

Contains the concrete implementations that the domain layer defines as contracts.

### Gateway (`data/user.gateway.ts`)

Implements the abstract gateway using Prisma:

```typescript
@Injectable()
export class UserGateway implements IUserGateway {
  constructor(
    private prisma: PrismaService,
    private map: UserMapper,
  ) {}

  async getUser(id: string): Promise<IUserData> {
    const result = await this.prisma.user.findUnique({ where: { id } });
    return this.map.toData(result);
  }
}
```

### Mapper (`data/user.mapper.ts`)

Transforms data between Prisma types and domain types:

```typescript
@Injectable()
export class UserMapper {
  toData(data: User): IUserData {
    return {
      id: data.id,
      name: data.name,
      email: data.email,
      roles: data.roles as RoleTypes[],
      createdAt: data.createdAt,
      updatedAt: data.updatedAt,
    };
  }
}
```

### Slices Without a Data Source

Not every slice talks to a database. A slice whose job is pure logic or a set of in-process capabilities has **no Prisma model and no data gateway** — gateways abstract *data sources*, and there is nothing to abstract. Such a slice still follows the same layers: a **service** (its business logic or engine) in `domain/`, and, when it provides a set of capabilities, a **gateway** over self-contained **repositories** in `data/` (see [Gateways -> Gateway Over a Registry of Repositories](/backend/gateways)). Do not add an empty `.gateway.ts` just to match the CRUD shape — model what the slice actually is.

## The dtos/ Folder

DTOs sit at the API boundary. They define what goes in (request DTOs) and what comes out (response DTOs), with validation and Swagger decorators.

```typescript [dtos/user.dto.ts]
export class UserDto implements IUserData {
  @ApiProperty() id: string;
  @ApiProperty() name: string;
  @ApiProperty() email: string;
  @ApiProperty({ enum: RoleTypes, isArray: true }) roles: RoleTypes[];
}
```

```typescript [dtos/index.ts]
export * from './user.dto';
export * from './createUser.dto';
export * from './updateUser.dto';
export * from './filterUser.dto';
```

## Naming Conventions

| Item | File Name | Class Name | Convention |
|---|---|---|---|
| Module | `user.module.ts` | `UserModule` | Singular |
| Controller | `user.controller.ts` | `UserController` | Singular class, plural route |
| Service | `user.service.ts` | `UserService` | Singular |
| Gateway (abstract) | `user.gateway.ts` | `IUserGateway` | I-prefix |
| Gateway (concrete) | `user.gateway.ts` | `UserGateway` | Singular |
| Mapper | `user.mapper.ts` | `UserMapper` | Singular |
| Types | `user.types.ts` | `IUserData` etc. | I-prefix for interfaces |
| Response DTO | `user.dto.ts` | `UserDto` | Singular |
| Create DTO | `createUser.dto.ts` | `CreateUserDto` | camelCase file |
| Update DTO | `updateUser.dto.ts` | `UpdateUserDto` | camelCase file |
| Filter DTO | `filterUser.dto.ts` | `FilterUserDto` | camelCase file |

## Submodule Pattern

For infrastructure slices that group related functionality (like AWS services), use a parent module that re-exports submodules:

```typescript [slices/aws/aws.module.ts]
@Module({
  imports: [S3Module, CognitoModule, BedrockModule],
  exports: [S3Module, CognitoModule, BedrockModule],
})
export class AwsModule {}
```

```
slices/aws/
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

## Import Aliases

Use the `#` path alias for cross-slice imports:

```typescript
import { IUserGateway, IUserData } from '#/user/domain';
import { UserDto } from '#/user/dtos';
import { PrismaService } from '#/setup/prisma';
```

## What's Next?

- [Controllers](/backend/controllers) -- The presentation layer in detail
- [Gateways](/backend/gateways) -- Abstract and concrete gateways
- [Services](/backend/services) -- When you need a service layer
- [Types](/backend/types) -- Domain type conventions
