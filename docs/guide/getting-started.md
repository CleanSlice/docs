# Getting Started

This guide walks you through creating a new CleanSlice project from scratch.

## Prerequisites

- [Node.js](https://nodejs.org/) v18 or later
- [Docker](https://www.docker.com/) (for PostgreSQL and other services)
- A code editor (VS Code recommended)

## Create the Project

The fastest way to start is with the CLI:

```bash
npx create-cleanslice my-app
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

Install Prisma and initialize it:

```bash
cd api
npm install @prisma/client
npm install -D prisma
npx prisma init
```

Create the Prisma setup slice at `api/src/slices/prisma/`:

::: code-group
```typescript [prisma.service.ts]
import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  async onModuleInit() {
    await this.$connect();
  }

  async onModuleDestroy() {
    await this.$disconnect();
  }
}
```

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

```typescript [index.ts]
export { PrismaModule } from './prisma.module';
export { PrismaService } from './prisma.service';
```
:::

### Swagger setup

Install Swagger for API documentation:

```bash
npm install @nestjs/swagger
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

Implement the gateway with Prisma:

```typescript
// api/src/slices/project/data/project.gateway.ts
import { Injectable } from '@nestjs/common';
import { PrismaService } from '#prisma';
import { IProjectGateway } from '../domain/project.gateway';
import { IProjectData, ICreateProjectData } from '../domain/project.types';
import { ProjectMapper } from './project.mapper';

@Injectable()
export class ProjectGateway implements IProjectGateway {
  constructor(
    private readonly prisma: PrismaService,
    private readonly mapper: ProjectMapper,
  ) {}

  async create(data: ICreateProjectData): Promise<IProjectData> {
    const project = await this.prisma.project.create({ data });
    return this.mapper.toDomain(project);
  }

  async findById(id: string): Promise<IProjectData | null> {
    const project = await this.prisma.project.findUnique({ where: { id } });
    return project ? this.mapper.toDomain(project) : null;
  }

  async findAll(): Promise<IProjectData[]> {
    const projects = await this.prisma.project.findMany();
    return projects.map((p) => this.mapper.toDomain(p));
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
