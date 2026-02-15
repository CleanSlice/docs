# Database

CleanSlice uses Prisma as its ORM with PostgreSQL. The key innovation is **prisma-import**, which lets each slice define its own `.prisma` schema file. These files are merged into a single `schema.prisma` at build time, keeping database models close to the domain logic that uses them.

## How It Works

```
Slice Prisma Files                    Merged Schema
─────────────────                     ─────────────
slices/user/user.prisma     ─┐
slices/user/team.prisma      ├──▶  prisma/schema.prisma (generated)
slices/file/file.prisma     ─┘              │
                                            ▼
                                    @prisma/client
                                    (auto-generated types)
```

You edit the per-slice `.prisma` files. The `prisma-import` tool merges them. Prisma generates the client from the merged schema.

## Installation

```bash
npm install @prisma/client
npm install -D prisma prisma-import
```

Install the **Prisma Import** VSCode extension (`ajmnz.prisma-import`) for syntax highlighting and IntelliSense in split schema files.

## Package Configuration

Add the prisma-import config and scripts to your `package.json`:

```json [package.json]
{
  "scripts": {
    "generate": "npx prisma-import --force",
    "premigrate": "npx prisma-import --force",
    "migrate": "dotenv -e .env.dev -- npx prisma migrate dev && dotenv -e .env.dev -- npx prisma generate",
    "migrate:prod": "dotenv -e .env.prod -- npx prisma migrate deploy",
    "studio": "dotenv -e .env.dev -- npx prisma studio",
    "docker": "docker compose up -d",
    "predev": "npm run docker && npm run migrate"
  },
  "prisma": {
    "import": {
      "schemas": "./src/**/!(schema).prisma",
      "output": "./prisma/schema.prisma"
    }
  }
}
```

The `schemas` glob finds all `.prisma` files in your source tree (excluding `schema.prisma` itself). The `output` is where the merged schema lands.

## Base Prisma Configuration

Create the datasource and generator configuration in the setup slice:

```prisma [src/slices/setup/prisma/prisma.prisma]
datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

generator client {
  provider        = "prisma-client-js"
  previewFeatures = ["views"]
  binaryTargets   = ["native", "darwin-arm64", "rhel-openssl-3.0.x"]
}
```

::: tip
The `binaryTargets` array includes `rhel-openssl-3.0.x` for AWS Lambda/ECS deployments alongside `native` and `darwin-arm64` for local macOS development.
:::

## PrismaService

The PrismaService wraps the Prisma client and integrates it with the NestJS lifecycle:

```typescript [src/slices/setup/prisma/prisma.service.ts]
import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

@Injectable()
export class PrismaService
  extends PrismaClient
  implements OnModuleInit, OnModuleDestroy
{
  async onModuleInit() {
    await this.$connect();
  }

  async onModuleDestroy() {
    await this.$disconnect();
  }
}
```

## PrismaModule

Mark the module as `@Global()` so every slice can inject `PrismaService` without importing `PrismaModule` explicitly:

```typescript [src/slices/setup/prisma/prisma.module.ts]
import { Global, Module } from '@nestjs/common';
import { PrismaService } from './prisma.service';

@Global()
@Module({
  providers: [PrismaService],
  exports: [PrismaService],
})
export class PrismaModule {}
```

```typescript [src/slices/setup/prisma/index.ts]
export * from './prisma.service';
export * from './prisma.module';
```

## Defining Models

Each slice defines its Prisma models in `.prisma` files at the **slice root** (not inside subfolders):

```
slices/
├── setup/
│   └── prisma/
│       └── prisma.prisma          # datasource + generator only
├── user/
│   ├── user.prisma                # User model
│   ├── team.prisma                # Team model
│   └── user/
│       ├── domain/
│       └── data/
└── file/
    ├── file.prisma                # File model
    └── file/
        └── ...
```

::: warning
Always place `.prisma` files at the root of each slice directory, not inside `data/` or `domain/` subfolders. The `prisma-import` glob pattern expects this layout.
:::

### User Model

```prisma [src/slices/user/user.prisma]
import { Team } from "./team"

model User {
  id        String   @id
  name      String
  email     String
  roles     String[] @default([])
  verified  Boolean  @default(false)
  banned    Boolean  @default(false)
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  teams     Team[]
}
```

### Team Model (with Relations)

```prisma [src/slices/user/team.prisma]
import { User } from "./user"
import { File } from "../file/file"

model Team {
  id        String   @id
  name      String
  userId    String
  user      User     @relation(fields: [userId], references: [id])
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  files     File[]
}
```

### Cross-Slice Relations

```prisma [src/slices/file/file.prisma]
import { Team } from "../user/team"

model File {
  id          String   @id
  teamId      String
  team        Team     @relation(fields: [teamId], references: [id])
  name        String
  contentType String
  path        String
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt
}
```

## Prisma Import Syntax

```prisma
// Same slice (sibling files at slice root)
import { User } from "./user"
import { Role } from "./role"

// Different slice
import { File } from "../file/file"
import { Team } from "../user/team"
```

Import paths reference the `.prisma` file without the extension, using relative paths from the importing file's location. The model name in braces must match exactly.

## Migration Workflow

When you change a model:

```bash
# 1. Edit the slice .prisma file
# 2. Merge schemas and create migration
npm run migrate
# 3. View data in Prisma Studio (optional)
npm run studio
```

The `premigrate` hook runs `prisma-import --force` automatically before each migration, so you only need one command.

## Environment Variables

```bash [.env.dev]
DATABASE_URL=postgres://postgres:root@127.0.0.1:5432/cleanslice-api-local-database
```

```bash [.env.prod]
# Typically injected via Terraform or AWS Secrets Manager
DATABASE_URL=postgres://admin:${RDS_PASSWORD}@myproject.xxxx.us-east-1.rds.amazonaws.com:5432/myproject
```

## Using PrismaService in Gateways

Inject `PrismaService` in your gateway implementations:

```typescript [src/slices/user/data/user.gateway.ts]
import { Injectable } from '@nestjs/common';
import { PrismaService } from '#/setup/prisma';
import { IUserGateway, IUserData, ICreateUserData } from '../domain';
import { UserMapper } from './user.mapper';

@Injectable()
export class UserGateway implements IUserGateway {
  constructor(
    private prisma: PrismaService,
    private map: UserMapper,
  ) {}

  async getUsers(): Promise<IUserData[]> {
    const results = await this.prisma.user.findMany();
    return results.map((result) => this.map.toData(result));
  }

  async createUser(data: ICreateUserData): Promise<IUserData> {
    const result = await this.prisma.user.create({
      data: this.map.toCreate(data),
    });
    return this.map.toData(result);
  }
}
```

::: tip
The generated `prisma/schema.prisma` is auto-generated and will be overwritten. Edit only the per-slice `.prisma` files.
:::

## What's Next?

- [Gateways](/backend/gateways) -- See how gateways use PrismaService for data access
- [Mappers](/backend/mappers) -- Learn how mappers transform Prisma types to domain types
- [Slice Structure](/backend/slice-structure) -- Understand where Prisma files fit in the slice layout
