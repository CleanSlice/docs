# Gateways

Gateways abstract your data sources from your business logic. The abstract class (interface) lives in `domain/`. The concrete implementation lives in `data/`. They connect through dependency injection, and nothing in the domain layer ever sees the implementation.

## Why Gateways

Without gateways, your services would import Prisma directly. That means every service is coupled to your database ORM. If you need to swap to a different database, add caching, or write unit tests with mocks, you are changing business logic files.

Gateways fix this by defining a contract (what data operations you need) separately from the implementation (how those operations happen). The service depends on the contract. The module wires in the implementation at runtime.

## Gateway vs Repository

CleanSlice distinguishes between gateways and repositories:

| Need | Use | Example |
|---|---|---|
| Database access | **Gateway** | `UserGateway` uses `PrismaService` |
| External API wrapper | **Repository** | `S3Repository` wraps `@aws-sdk/s3` |

Prisma already provides a repository-level abstraction (generated client with typed methods). Adding another repository layer on top of Prisma is redundant. Use a gateway directly with Prisma.

## Repositories Are Self-Contained

A repository is a **self-contained black box**. It wraps exactly one concrete source or capability — an external SDK, an HTTP client, a pure computation — and exposes it with its own plain types. A repository **must not import the slice's `domain/`**: no domain contracts, no domain types. It knows nothing about the abstraction it will eventually satisfy.

The **gateway** is the single class that connects repositories to the domain. It implements the domain contract (the abstract `I{X}Gateway`) and **adapts** each repository's raw shape into domain types. The dependency arrow points one way: a repository depends on nothing in the slice; the gateway depends on the domain contract and on the repositories.

```
Service (domain)  ->  IGateway (domain contract)
                          ^ implements
                      Gateway (data)   <- the only data class that touches the domain
                          | adapts
              +-----------+-----------+
         RepoA (data)  RepoB (data)  RepoC (data)   <- self-contained, no domain imports
```

::: warning
If a repository imports from `domain/`, it is no longer a self-contained adapter — it has quietly become a second gateway. Move the domain-facing logic into the gateway and keep the repository a plain wrapper.
:::

## Gateway Over a Registry of Repositories

The table above shows the 1:1 case (one gateway, one Prisma-backed source). A gateway can also **orchestrate a set of repositories** — the same contract satisfied by many self-contained repositories, collected through a multi-provider token and adapted by the gateway.

This fits any homogeneous capability set: a toolset an LLM can call, a group of notification channels, a set of import sources. Each capability is a self-contained repository; the gateway presents them to the domain.

```typescript [domain/tool.types.ts]
// The domain-facing shape the gateway produces. The repositories do NOT import this.
export interface ITool {
  def: { name: string; description: string; inputSchema: object };
  execute(input: unknown): Promise<unknown>;
}

// A multi-provider DI token that collects every tool repository.
export const TOOL_REPOSITORIES = Symbol('TOOL_REPOSITORIES');
```

```typescript [data/repositories/calculatorTool.repository.ts]
import { Injectable } from '@nestjs/common';

// Self-contained: imports nothing from the slice's domain. Its own fields, its own types.
@Injectable()
export class CalculatorToolRepository {
  readonly name = 'calculator';
  readonly description = 'Evaluate an arithmetic expression.';
  readonly inputSchema = { type: 'object', properties: { expr: { type: 'string' } } };

  async run(input: { expr: string }): Promise<number> {
    return evaluate(input.expr);
  }
}
```

```typescript [domain/tool.gateway.ts]
import { ITool } from './tool.types';

export abstract class IToolGateway {
  abstract all(): ITool[];
  abstract find(name: string): ITool | undefined;
}
```

```typescript [data/tool.gateway.ts]
import { Inject, Injectable } from '@nestjs/common';
import { IToolGateway } from '../domain/tool.gateway';
import { ITool, TOOL_REPOSITORIES } from '../domain/tool.types';

// A local, structural shape for the self-contained repos — kept in data, not domain.
type ToolRepository = {
  readonly name: string;
  readonly description: string;
  readonly inputSchema: object;
  run(input: unknown): Promise<unknown>;
};

// The ONE place repositories meet the domain: it adapts each repo into an ITool.
@Injectable()
export class ToolGateway extends IToolGateway {
  constructor(@Inject(TOOL_REPOSITORIES) private readonly repos: ToolRepository[]) {
    super();
  }

  all(): ITool[] {
    return this.repos.map((r) => ({
      def: { name: r.name, description: r.description, inputSchema: r.inputSchema },
      execute: (input) => r.run(input),
    }));
  }

  find(name: string): ITool | undefined {
    return this.all().find((t) => t.def.name === name);
  }
}
```

```typescript [tool.module.ts]
const repos = [CurrentTimeToolRepository, CalculatorToolRepository, TextStatsToolRepository];

@Module({
  providers: [
    ...repos,
    { provide: TOOL_REPOSITORIES, useFactory: (...t) => t, inject: repos },
    { provide: IToolGateway, useClass: ToolGateway },
    ToolService, // the service injects IToolGateway, never the repositories
  ],
  exports: [IToolGateway, ToolService],
})
export class ToolModule {}
```

Adding a capability is one new self-contained repository plus one entry in the token's `inject` list. The gateway, the service, and every consumer stay untouched.

## File Structure

```
slices/user/
├── user.module.ts
├── user.controller.ts
├── domain/
│   ├── user.gateway.ts          # Abstract class (contract)
│   ├── user.types.ts
│   ├── user.service.ts
│   └── index.ts
└── data/
    ├── user.gateway.ts          # Concrete implementation
    ├── user.mapper.ts
    └── index.ts
```

The same file name (`user.gateway.ts`) appears in both `domain/` and `data/`. The domain version is the abstract contract; the data version is the Prisma implementation.

## Abstract Gateway (domain/)

Define the gateway as an **abstract class** with the `I` prefix. Abstract classes exist at runtime (unlike TypeScript interfaces), so they work directly as NestJS dependency injection tokens.

```typescript [domain/user.gateway.ts]
import { IUserData, ICreateUserData, IUpdateUserData } from './user.types';
import { IMetaResponse } from '#/setup/response';

export interface IUserFilter {
  email?: string;
  search?: string;
  ids?: string[];
  page?: number;
  perPage?: number;
}

export abstract class IUserGateway {
  abstract getUsers(filter?: IUserFilter): Promise<{ data: IUserData[]; meta: IMetaResponse }>;
  abstract getUser(id: string): Promise<IUserData | null>;
  abstract createUser(data: ICreateUserData): Promise<IUserData>;
  abstract updateUser(id: string, data: IUpdateUserData): Promise<IUserData>;
  abstract deleteUser(id: string): Promise<boolean>;
}
```

::: tip Why abstract class instead of interface?
TypeScript interfaces are erased at compile time. NestJS dependency injection runs at runtime and needs a token it can reference. An abstract class with the `I` prefix gives you the best of both worlds: compile-time type checking and a runtime-available DI token.
:::

## Concrete Gateway (data/)

The implementation extends the abstract class, injects `PrismaService` and a [Mapper](/backend/mappers), and handles all database operations:

```typescript [data/user.gateway.ts]
import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '#/setup/prisma';
import { IUserGateway, IUserFilter } from '../domain/user.gateway';
import { IUserData, ICreateUserData, IUpdateUserData } from '../domain/user.types';
import { UserMapper } from './user.mapper';
import { IMetaResponse } from '#/setup/response';

@Injectable()
export class UserGateway extends IUserGateway {
  constructor(
    private prisma: PrismaService,
    private map: UserMapper,
  ) {
    super();
  }

  async getUsers(filter?: IUserFilter): Promise<{ data: IUserData[]; meta: IMetaResponse }> {
    const where: Prisma.UserWhereInput = {};

    if (filter?.email) {
      where.email = { contains: filter.email, mode: 'insensitive' };
    }
    if (filter?.search) {
      where.OR = [
        { name: { contains: filter.search } },
        { email: { contains: filter.search } },
      ];
    }
    if (filter?.ids) {
      where.id = { in: filter.ids };
    }

    const perPage = filter?.perPage ?? 20;
    const currentPage = filter?.page ?? 1;

    const [results, total] = await Promise.all([
      this.prisma.user.findMany({
        where,
        take: perPage,
        skip: (currentPage - 1) * perPage,
      }),
      this.prisma.user.count({ where }),
    ]);

    return {
      data: results.map((r) => this.map.toData(r)),
      meta: {
        total,
        lastPage: Math.ceil(total / perPage),
        currentPage,
        perPage,
      },
    };
  }

  async getUser(id: string): Promise<IUserData | null> {
    const result = await this.prisma.user.findUnique({ where: { id } });
    return result ? this.map.toData(result) : null;
  }

  async createUser(data: ICreateUserData): Promise<IUserData> {
    const result = await this.prisma.user.create({
      data: this.map.toCreate(data),
    });
    return this.map.toData(result);
  }

  async updateUser(id: string, data: IUpdateUserData): Promise<IUserData> {
    const result = await this.prisma.user.update({
      where: { id },
      data: this.map.toUpdate(data),
    });
    return this.map.toData(result);
  }

  async deleteUser(id: string): Promise<boolean> {
    try {
      await this.prisma.user.delete({ where: { id } });
      return true;
    } catch {
      return false;
    }
  }
}
```

## Module Wiring

The module connects the abstract class to its implementation:

```typescript [user.module.ts]
import { Module } from '@nestjs/common';
import { UserController } from './user.controller';
import { UserService } from './domain/user.service';
import { IUserGateway } from './domain/user.gateway';
import { UserGateway } from './data/user.gateway';
import { UserMapper } from './data/user.mapper';
import { PrismaModule } from '#/setup/prisma';

@Module({
  imports: [PrismaModule],
  controllers: [UserController],
  providers: [
    UserService,
    UserMapper,
    { provide: IUserGateway, useClass: UserGateway },
  ],
  exports: [UserService],
})
export class UserModule {}
```

Because `IUserGateway` is an abstract class (not an interface), you use it directly as the `provide` token. No string tokens or symbols needed.

## Using the Gateway in a Service

The service injects the abstract gateway. It has no knowledge of Prisma, SQL, or any implementation detail:

```typescript [domain/user.service.ts]
import { Injectable } from '@nestjs/common';
import { IUserGateway } from './user.gateway';
import { IUserData, ICreateUserData, IUpdateUserData } from './user.types';
import { UserNotFoundError } from './errors/userNotFound.error';

@Injectable()
export class UserService {
  constructor(private readonly userGateway: IUserGateway) {}

  async getUserById(id: string): Promise<IUserData> {
    const user = await this.userGateway.getUser(id);
    if (!user) {
      throw new UserNotFoundError(id);
    }
    return user;
  }

  async createUser(data: ICreateUserData): Promise<IUserData> {
    const normalizedData = {
      ...data,
      email: data.email.toLowerCase().trim(),
    };
    return this.userGateway.createUser(normalizedData);
  }

  async updateUser(id: string, data: IUpdateUserData): Promise<IUserData> {
    await this.getUserById(id); // Throws if not found
    return this.userGateway.updateUser(id, data);
  }

  async deleteUser(id: string): Promise<boolean> {
    await this.getUserById(id); // Throws if not found
    return this.userGateway.deleteUser(id);
  }
}
```

::: warning
The service imports from `./user.gateway` (the domain file), not from `../data/user.gateway`. The domain layer must not depend on the data layer.
:::

## Conditional Implementations

You can swap gateway implementations based on environment or configuration:

```typescript [auth.module.ts]
@Module({
  providers: [
    {
      provide: IAuthGateway,
      useClass: process.env.AUTH_TYPE === 'cognito'
        ? CognitoAuthGateway
        : BasicAuthGateway,
    },
  ],
})
export class AuthModule {}
```

## What's Next?

- [Mappers](/backend/mappers) -- Data transformation between Prisma and domain types
- [Services](/backend/services) -- Business logic that uses gateway interfaces
- [Slice Structure](/backend/slice-structure) -- Full slice layout with domain/ and data/
- [Types](/backend/types) -- Domain types returned by gateways
