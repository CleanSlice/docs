# Mappers

Mappers transform data between layers. They convert Prisma database models into domain types and prepare domain data for database writes. Mappers live in the `data/` folder and contain pure, synchronous transformations with no business logic.

## Why Mappers Exist

Prisma generates its own types based on your database schema. Your domain layer defines its own types based on business needs. These two sets of types are similar but rarely identical -- Prisma types include database-specific details, your domain types use typed enums, and some fields need reshaping.

Mappers keep this translation logic in one place instead of scattering it across gateways and services.

## File Location

```
slices/user/
├── domain/
│   └── user.types.ts           # IUserData, ICreateUserData, etc.
└── data/
    ├── user.gateway.ts         # Uses the mapper
    └── user.mapper.ts          # Mapper lives here
```

**Naming:** `{entity}.mapper.ts` (singular file), `{Entity}Mapper` (singular class).

## Standard Methods

Every mapper has up to three methods:

| Method | Input | Output | Purpose |
|---|---|---|---|
| `toData()` | Prisma model | Domain type | Database response to domain |
| `toCreate()` | Create input | Prisma create input | Prepare data for insert |
| `toUpdate()` | Update input | Prisma update input | Prepare data for update |

## Complete Example

```typescript [data/user.mapper.ts]
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import DB, { Prisma } from '@prisma/client';
import { v4 as uuid } from 'uuid';
import { IUserData, ICreateUserData, IUpdateUserData, RoleTypes } from '../domain';

// Type aliases for Prisma types
export type IUserResponse = DB.User;
export type IUserCreateRequest = Prisma.XOR<
  Prisma.UserCreateInput,
  Prisma.UserUncheckedCreateInput
>;
export type IUserUpdateRequest = Prisma.XOR<
  Prisma.UserUpdateInput,
  Prisma.UserUncheckedUpdateInput
>;

@Injectable()
export class UserMapper {
  constructor(private configService: ConfigService) {}

  toData(data: IUserResponse): IUserData {
    return {
      id: data.id,
      name: data.name,
      email: data.email,
      roles: data.roles as RoleTypes[],
      verified: data.verified,
      banned: data.banned,
      createdAt: data.createdAt,
      updatedAt: data.updatedAt,
    };
  }

  toCreate(data: ICreateUserData): IUserCreateRequest {
    const id = `user-${uuid()}`;
    return {
      id,
      name: data.name,
      email: data.email,
      roles: data.roles,
      verified: this.configService.get('IS_USER_VERIFIED') === 'true',
    };
  }

  toUpdate(data: IUpdateUserData): IUserUpdateRequest {
    return {
      name: data.name,
      roles: data.roles,
      verified: data.verified,
      banned: data.banned,
    };
  }
}
```

## Rules for Mappers

### Mappers Are Synchronous

Mapper methods are pure transformations. They receive data in, return data out, and make no async calls.

```typescript
// Correct -- synchronous transformation
toData(user: PrismaUser): IUserData {
  return { id: user.id, name: user.name };
}

// Wrong -- async and fetching data
async toData(userId: string): Promise<IUserData> {
  const user = await this.prisma.user.findUnique({ where: { id: userId } });
  return { id: user.id, name: user.name };
}
```

### No Database Calls

If a transformation needs related data, pass it as a parameter from the gateway:

```typescript
// Wrong -- mapper fetches related data
toData(user: PrismaUser): IUserData {
  const roles = await this.prisma.role.findMany({ where: { userId: user.id } });
  return { ...user, roles };
}

// Correct -- related data passed in
toData(user: PrismaUser, roles: PrismaRole[]): IUserData {
  return { ...user, roles: roles.map(r => r.name) };
}
```

### No Business Logic

Validation, error throwing, and business rules belong in the [Service](/backend/services). Mappers only reshape data.

```typescript
// Wrong -- business logic in mapper
toData(user: PrismaUser): IUserData {
  if (user.status === 'banned') {
    throw new UserBannedError(user.id);
  }
  return { id: user.id, name: user.name };
}

// Correct -- pure transformation
toData(user: PrismaUser): IUserData {
  return {
    id: user.id,
    name: user.name,
    status: user.status as UserStatusTypes,
  };
}
```

## Handling Complex Transformations

### Relations

When your gateway uses Prisma's `include`, define a type for the enriched result and create a dedicated mapper method:

```typescript
type UserWithPosts = Prisma.UserGetPayload<{
  include: { posts: true };
}>;

toDataWithPosts(user: UserWithPosts): IUserWithPosts {
  return {
    ...this.toData(user),
    posts: user.posts.map((post) => ({
      id: post.id,
      title: post.title,
      createdAt: post.createdAt,
    })),
  };
}
```

### Enum Casting

Prisma stores enums as strings. Cast them to your domain enum types in the mapper:

```typescript
toData(user: PrismaUser): IUserData {
  return {
    id: user.id,
    status: user.status as UserStatusTypes,
    role: user.role as UserRoleTypes,
    permissions: user.permissions as PermissionTypes[],
  };
}
```

### JSON Fields

```typescript
toData(user: PrismaUser): IUserData {
  return {
    id: user.id,
    settings: user.settings as IUserSettings,
    metadata: (user.metadata as IUserMetadata) ?? {},
  };
}

toCreate(data: ICreateUserData): Prisma.UserCreateInput {
  return {
    name: data.name,
    settings: data.settings as Prisma.JsonObject,
  };
}
```

### ID Generation

Generate prefixed IDs in the `toCreate` method:

```typescript
import { v4 as uuid } from 'uuid';

toCreate(data: ICreateUserData): Prisma.UserCreateInput {
  return {
    id: `user-${uuid()}`,
    ...data,
  };
}
```

Common prefixes: `user-`, `team-`, `file-`, `api-key-`.

## Cross-Mapper Composition

When an entity includes related data from another slice, inject that slice's mapper:

```typescript [data/apiKey.mapper.ts]
import { Injectable } from '@nestjs/common';
import DB, { Prisma } from '@prisma/client';
import { IApiKeyData, ICreateApiKeyData } from '../domain';
import { TeamMapper } from '#/user/team/data/team.mapper';
import { v4 as uuid } from 'uuid';

export type IApiKeyResponse = DB.ApiKey & {
  team: DB.Team;
};

@Injectable()
export class ApiKeyMapper {
  constructor(private readonly teamMapper: TeamMapper) {}

  toData(data: IApiKeyResponse): IApiKeyData {
    return {
      id: data.id,
      teamId: data.teamId,
      team: this.teamMapper.toData(data.team),
      name: data.name,
      secret: data.secret,
      createdAt: data.createdAt,
      updatedAt: data.updatedAt,
    };
  }

  toCreate(data: ICreateApiKeyData): Prisma.ApiKeyUncheckedCreateInput {
    return {
      id: `api-key-${uuid()}`,
      teamId: data.teamId,
      name: data.name,
      secret: `secret-${uuid()}`,
    };
  }
}
```

The gateway must use `include` to load the relation:

```typescript
async getApiKey(id: string): Promise<IApiKeyData | null> {
  const result = await this.prisma.apiKey.findUnique({
    where: { id },
    include: { team: true },
  });
  return result ? this.mapper.toData(result) : null;
}
```

## Using the Mapper in a Gateway

```typescript [data/user.gateway.ts]
import { Injectable } from '@nestjs/common';
import { PrismaService } from '#/setup/prisma';
import { IUserGateway } from '../domain/user.gateway';
import { IUserData, ICreateUserData, IUpdateUserData } from '../domain/user.types';
import { UserMapper } from './user.mapper';

@Injectable()
export class UserGateway extends IUserGateway {
  constructor(
    private prisma: PrismaService,
    private mapper: UserMapper,
  ) {
    super();
  }

  async getUser(id: string): Promise<IUserData | null> {
    const result = await this.prisma.user.findUnique({ where: { id } });
    return result ? this.mapper.toData(result) : null;
  }

  async createUser(data: ICreateUserData): Promise<IUserData> {
    const result = await this.prisma.user.create({
      data: this.mapper.toCreate(data),
    });
    return this.mapper.toData(result);
  }

  async updateUser(id: string, data: IUpdateUserData): Promise<IUserData> {
    const result = await this.prisma.user.update({
      where: { id },
      data: this.mapper.toUpdate(data),
    });
    return this.mapper.toData(result);
  }
}
```

## Module Registration

Register the mapper as a provider in the module:

```typescript [user.module.ts]
import { Module } from '@nestjs/common';
import { UserGateway } from './data/user.gateway';
import { UserMapper } from './data/user.mapper';

@Module({
  providers: [
    UserMapper,
    { provide: IUserGateway, useClass: UserGateway },
  ],
})
export class UserModule {}
```

## What's Next?

- [Gateways](/backend/gateways) -- Where mappers are used for data access
- [Types](/backend/types) -- Domain types that mappers convert to and from
- [DTOs](/backend/dtos) -- API-facing types that parallel domain types
