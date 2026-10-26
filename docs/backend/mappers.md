# Mappers

Mappers transform data between layers. They convert Prisma database models into domain types and prepare domain data for database writes. Mappers live in the `data/` folder and contain pure, synchronous transformations with no business logic.

## Why Mappers Exist

Prisma's row types come from the database contract (`PrismaRow<'User'>` and friends, derived from the emitted contract in `#setup/prisma`). Your domain layer defines its own types based on business needs. These two sets of types are similar but rarely identical -- rows carry database details (`readonly` lists, plain strings where the domain has enums), and some fields need reshaping.

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
| `toData()` | `PrismaRow<'User'>` | Domain type | Database row to domain |
| `toCreate()` | Create input | `Omit<PrismaCreate<'User'>, 'id'>` | Prepare data for insert |
| `toUpdate()` | Update input | `PrismaUpdate<'User'>` | Prepare data for update |

## Complete Example

```typescript [data/user.mapper.ts]
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { PrismaCreate, PrismaRow, PrismaUpdate } from '#setup/prisma';
import { IUserData, ICreateUserData, IUpdateUserData, RoleTypes } from '../domain';

// The row and write shapes, derived from the Prisma contract
export type IUserResponse = PrismaRow<'User'>;
export type IUserCreateRequest = PrismaCreate<'User'>;
export type IUserUpdateRequest = PrismaUpdate<'User'>;

@Injectable()
export class UserMapper {
  constructor(private configService: ConfigService) {}

  toData(data: IUserResponse): IUserData {
    return {
      id: data.id,
      name: data.name,
      email: data.email,
      roles: [...data.roles] as RoleTypes[],
      verified: data.verified,
      banned: data.banned,
      createdAt: data.createdAt,
      updatedAt: data.updatedAt,
    };
  }

  /** Everything but the id: the gateway mints that with formatId(USER_ID_PREFIX). */
  toCreate(data: ICreateUserData): Omit<IUserCreateRequest, 'id'> {
    return {
      name: data.name,
      email: data.email,
      password: data.password,
      roles: data.roles ?? [],
      verified: this.configService.get('IS_USER_VERIFIED') === 'true',
    };
  }

  /** Only the fields that were given: an absent field is left as it is. */
  toUpdate(data: IUpdateUserData): IUserUpdateRequest {
    return {
      ...(data.name !== undefined && { name: data.name }),
      ...(data.roles !== undefined && { roles: data.roles }),
      ...(data.verified !== undefined && { verified: data.verified }),
      ...(data.banned !== undefined && { banned: data.banned }),
    };
  }
}
```

## Rules for Mappers

### Mappers Are Synchronous

Mapper methods are pure transformations. They receive data in, return data out, and make no async calls.

```typescript
// Correct -- synchronous transformation
toData(user: PrismaRow<'User'>): IUserData {
  return { id: user.id, name: user.name };
}

// Wrong -- async and fetching data
async toData(userId: string): Promise<IUserData> {
  const user = await this.prisma.db.public.User.first({ id: userId });
  return { id: user.id, name: user.name };
}
```

### No Database Calls

If a transformation needs related data, pass it as a parameter from the gateway:

```typescript
// Wrong -- mapper fetches related data
toData(user: PrismaRow<'User'>): IUserData {
  const roles = await this.prisma.db.public.Role.where({ userId: user.id }).all();
  return { ...user, roles };
}

// Correct -- related data passed in
toData(user: PrismaRow<'User'>, roles: PrismaRow<'Role'>[]): IUserData {
  return { ...user, roles: roles.map(r => r.name) };
}
```

### No Business Logic

Validation, error throwing, and business rules belong in the [Service](/backend/services). Mappers only reshape data.

```typescript
// Wrong -- business logic in mapper
toData(user: PrismaRow<'User'>): IUserData {
  if (user.status === 'banned') {
    throw new UserBannedError(user.id);
  }
  return { id: user.id, name: user.name };
}

// Correct -- pure transformation
toData(user: PrismaRow<'User'>): IUserData {
  return {
    id: user.id,
    name: user.name,
    status: user.status as UserStatusTypes,
  };
}
```

## Handling Complex Transformations

### Relations

When your gateway uses `.include('posts')`, type the enriched row as the row plus its relation and create a dedicated mapper method:

```typescript
type UserWithPosts = PrismaRow<'User'> & { posts: PrismaRow<'Post'>[] };

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

Enum-like columns are plain `String` columns. Cast them to your domain enum types in the mapper:

```typescript
toData(user: PrismaRow<'User'>): IUserData {
  return {
    id: user.id,
    status: user.status as UserStatusTypes,
    role: user.role as UserRoleTypes,
    permissions: [...user.permissions] as PermissionTypes[],
  };
}
```

### JSON Fields

```typescript
toData(user: PrismaRow<'User'>): IUserData {
  return {
    id: user.id,
    settings: user.settings as IUserSettings,
    metadata: (user.metadata as IUserMetadata) ?? {},
  };
}

toCreate(data: ICreateUserData): Omit<PrismaCreate<'User'>, 'id'> {
  return {
    name: data.name,
    settings: data.settings as JsonObject, // JsonObject from '#setup/prisma'; the column is Jsonb
  };
}
```

### ID Generation

Mappers do **not** generate IDs. The gateway mints the primary key inside the write with `formatId(prefix)` and repeats the write on a collision with `withIdRetry`:

```typescript [data/user.gateway.ts]
const createData = this.mapper.toCreate(data);
const user = await withIdRetry(
  () => this.prisma.db.public.User.create({ id: formatId(USER_ID_PREFIX), ...createData }),
  this.prisma.inTransaction,
);
```

The format, the prefix rules and the retry rules are the [Identifiers](/standards/identifiers) standard. Never `uuid()`, `cuid()` or a Prisma `@default` for a primary key.

## Cross-Mapper Composition

When an entity includes related data from another slice, inject that slice's mapper:

```typescript [data/apiKey.mapper.ts]
import { Injectable } from '@nestjs/common';
import type { PrismaCreate, PrismaRow } from '#setup/prisma';
import { IApiKeyData, ICreateApiKeyData } from '../domain';
import { randomBytes } from 'node:crypto';
import { TeamMapper } from '#/user/team/data/team.mapper';

export type IApiKeyResponse = PrismaRow<'ApiKey'> & {
  team: PrismaRow<'Team'>;
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

  /** The id is minted by the gateway (formatId(API_KEY_ID_PREFIX)); the secret is not an id. */
  toCreate(data: ICreateApiKeyData): Omit<PrismaCreate<'ApiKey'>, 'id'> {
    return {
      teamId: data.teamId,
      name: data.name,
      secret: `secret-${randomBytes(32).toString('base64url')}`,
    };
  }
}
```

The gateway must use `.include(...)` to load the relation:

```typescript
async getApiKey(id: string): Promise<IApiKeyData | null> {
  const result = await this.prisma.db.public.ApiKey.include('team').first({ id });
  return result ? this.mapper.toData(result) : null;
}
```

## Using the Mapper in a Gateway

```typescript [data/user.gateway.ts]
import { Injectable } from '@nestjs/common';
import { PrismaService } from '#setup/prisma';
import { formatId, withIdRetry } from '#setup/id';
import { IUserGateway } from '../domain/user.gateway';
import { IUserData, ICreateUserData, IUpdateUserData, USER_ID_PREFIX } from '../domain/user.types';
import { UserNotFoundError } from '../domain/user.errors';
import { UserMapper } from './user.mapper';

@Injectable()
export class UserGateway extends IUserGateway {
  constructor(
    private readonly prisma: PrismaService,
    private readonly mapper: UserMapper,
  ) {
    super();
  }

  private get users() {
    return this.prisma.db.public.User;
  }

  async getUser(id: string): Promise<IUserData | null> {
    const result = await this.users.first({ id });
    return result ? this.mapper.toData(result) : null;
  }

  async createUser(data: ICreateUserData): Promise<IUserData> {
    const createData = this.mapper.toCreate(data);
    const result = await withIdRetry(
      () => this.users.create({ id: formatId(USER_ID_PREFIX), ...createData }),
      this.prisma.inTransaction,
    );
    return this.mapper.toData(result);
  }

  async updateUser(id: string, data: IUpdateUserData): Promise<IUserData> {
    const changes = this.mapper.toUpdate(data);
    const result =
      Object.keys(changes).length === 0
        ? await this.users.first({ id })
        : await this.users.where({ id }).update(changes);
    if (!result) throw new UserNotFoundError(id); // update answers null for a missing row
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
