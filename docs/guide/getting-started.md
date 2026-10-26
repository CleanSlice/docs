# Getting Started

This guide walks you through creating a new CleanSlice project from scratch.

## Prerequisites

- [Bun](https://bun.sh/) — the package manager CleanSlice uses everywhere, see [Bun](/standards/bun)
- [Node.js](https://nodejs.org/) v18 or later — still the production runtime for the api
- [Docker](https://www.docker.com/) (for PostgreSQL and other services)
- A code editor (VS Code recommended)

## Create the Project

The fastest way to start is with the CLI:

```bash
bunx create-cleanslice my-app
cd my-app
```

This scaffolds a complete project with NestJS backend, Nuxt frontend, and all CleanSlice conventions pre-configured.

### Verify the structure

You should now have:

```
my-project/
├── api/                # NestJS backend
│   └── src/
│       └── slices/     # All backend features go here
└── app/                # Nuxt frontend
    └── slices/         # All frontend features go here
```

## Configure the Backend

### Path aliases

Add the `#` alias to your `api/tsconfig.json` so slices can import from each other cleanly:

```json
{
  "compilerOptions": {
    "paths": {
      "#": ["src/slices"],
      "#*": ["src/slices/*"]
    }
  }
}
```

This lets you write imports like:

```typescript
import { PrismaService } from '#prisma';
import { IUserGateway } from '#user/domain';
```

### Prisma setup

CleanSlice runs on Prisma 8. Install the pinned packages:

```bash
cd api
bun add --exact @prisma/orm-postgres@8.0.0-rc.14 pg@8.23.1
bun add --exact --dev prisma@8.0.0-rc.19 @types/pg@8.23.1
```

Then add the pieces the [Database](/backend/database) page describes: `prisma.config.ts` (it globs `src/slices/**/*.prisma`), the `postinstall` / `prisma:emit` / `db:*` scripts and `overrides` in `package.json`, `scripts/migrate.mjs`, `"module": "nodenext"` in `tsconfig.json`, and `generated/` in `.gitignore`. There is no `prisma init`, no `schema.prisma` and no `prisma generate`.

Copy the Prisma setup slice (`prisma.service.ts`, `prisma.types.ts`, `prisma.errors.ts`, `prisma.module.ts`, `index.ts`) from the [starter kit](https://github.com/CleanSlice/nest-nuxt-starter-kit/tree/main/api/src/slices/setup/prisma) into `api/src/slices/setup/prisma/`. `PrismaModule` is `@Global()`:

```typescript [prisma.module.ts]
import { Module, Global } from '@nestjs/common';
import { PrismaService } from './prisma.service';

@Global()
@Module({
  providers: [PrismaService],
  exports: [PrismaService],
})
export class PrismaModule {}
```

### Swagger setup

Install Swagger for API documentation:

```bash
bun add @nestjs/swagger
```

Configure it in `api/src/main.ts`:

```typescript
import { NestFactory } from '@nestjs/core';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  const config = new DocumentBuilder()
    .setTitle('My API')
    .setVersion('1.0')
    .addBearerAuth()
    .build();

  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api', app, document);

  await app.listen(4000);
}
bootstrap();
```

### Register modules

Update `api/src/app.module.ts`:

```typescript
import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { PrismaModule } from '#prisma';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    PrismaModule,
    // Add feature modules here as you create them
  ],
})
export class AppModule {}
```

## Configure the Frontend

### Setup slices

Create the infrastructure slices that feature slices depend on:

```bash
mkdir -p app/slices/setup/{theme,pinia,api,error,i18n}
```

Each setup slice is a Nuxt layer with its own `nuxt.config.ts`. See the [Setup Slices](/guide/setup-slices) guide for detailed configuration of each one.

### Register slices

In your root `app/nuxt.config.ts`, register all slices using the `extends` property:

```typescript
export default defineNuxtConfig({
  extends: [
    // Setup slices (order matters — dependencies first)
    './slices/setup/theme',
    './slices/setup/pinia',
    './slices/setup/api',
    './slices/setup/error',
    './slices/setup/i18n',
    // Feature slices
    './slices/user',
    './slices/project',
  ],
});
```

## Create Your First Slice

Let's create a simple `project` slice to see the pattern in action.

### Backend slice

```bash
mkdir -p api/src/slices/project/{domain,data,dtos}
```

Create the domain types:

```typescript
// api/src/slices/project/domain/project.types.ts
export interface IProjectData {
  id: string;
  name: string;
  description: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface ICreateProjectData {
  name: string;
  description: string;
}
```

Create the gateway interface:

```typescript
// api/src/slices/project/domain/project.gateway.ts
import { IProjectData, ICreateProjectData } from './project.types';

export abstract class IProjectGateway {
  abstract create(data: ICreateProjectData): Promise<IProjectData>;
  abstract findById(id: string): Promise<IProjectData | null>;
  abstract findAll(): Promise<IProjectData[]>;
}
```

Add the model at the slice root and migrate:

```prisma
// use prisma-8
// api/src/slices/project/project.prisma
model Project {
  id          String @id // minted by the gateway: formatId('project')
  name        String
  description String
  createdAt   TimestamptzJsDate(3) @default(now())
  updatedAt   temporal.timestamptzJsDate(3, onCreate: now, onUpdate: now)
}
```

```bash
bun run prisma:emit
bun run db:plan -- --name project
bunx prisma migration ref set deploy <hash>   # the "to" hash the plan printed
bun run db:deploy
```

Implement the gateway with Prisma:

```typescript
// api/src/slices/project/data/project.gateway.ts
import { Injectable } from '@nestjs/common';
import { PrismaService } from '#prisma';
import { formatId, withIdRetry } from '#setup/id';
import { IProjectGateway } from '../domain/project.gateway';
import { IProjectData, ICreateProjectData } from '../domain/project.types';
import { ProjectMapper } from './project.mapper';

@Injectable()
export class ProjectGateway extends IProjectGateway {
  constructor(
    private readonly prisma: PrismaService,
    private readonly mapper: ProjectMapper,
  ) {
    super();
  }

  private get projects() {
    return this.prisma.db.public.Project;
  }

  async create(data: ICreateProjectData): Promise<IProjectData> {
    const createData = this.mapper.toCreate(data);
    const project = await withIdRetry(
      () => this.projects.create({ id: formatId('project'), ...createData }),
      this.prisma.inTransaction,
    );
    return this.mapper.toData(project);
  }

  async findById(id: string): Promise<IProjectData | null> {
    const project = await this.projects.first({ id });
    return project ? this.mapper.toData(project) : null;
  }

  async findAll(): Promise<IProjectData[]> {
    const projects = await this.projects.orderBy((p) => p.createdAt.desc()).all();
    return projects.map((p) => this.mapper.toData(p));
  }
}
```

Create the controller, DTOs, mapper, and module to complete the slice. See the [Backend Slice Structure](/backend/slice-structure) guide for the full pattern.

### Frontend slice

```bash
mkdir -p app/slices/project/{pages,components/project,stores}
```

Create a Pinia store:

```typescript
// app/slices/project/stores/project.ts
import { defineStore } from 'pinia';
import { ProjectsService } from '#api';

export const useProjectStore = defineStore('project', () => {
  const projects = ref([]);
  const loading = ref(false);

  async function fetchAll() {
    loading.value = true;
    try {
      const response = await ProjectsService.findAll();
      projects.value = response.data;
    } finally {
      loading.value = false;
    }
  }

  return { projects, loading, fetchAll };
});
```

Create a list page:

```vue
<!-- app/slices/project/pages/projects.vue -->
<script setup lang="ts">
const store = useProjectStore();
await store.fetchAll();
</script>

<template>
  <div class="container mx-auto p-6">
    <h1 class="text-2xl font-bold mb-4">Projects</h1>
    <div v-for="project in store.projects" :key="project.id" class="p-4 border rounded mb-2">
      <h2 class="font-semibold">{{ project.name }}</h2>
      <p class="text-muted-foreground">{{ project.description }}</p>
    </div>
  </div>
</template>
```

## What's Next?

- [Project Structure](/guide/project-structure) — Full breakdown of folder conventions and naming rules
- [Core Concepts](/guide/core-concepts) — Understand layers, the gateway pattern, and dependency flow
- [Backend Setup](/backend/getting-started) — Detailed backend configuration guide
- [Frontend Setup](/frontend/getting-started) — Detailed frontend configuration guide
