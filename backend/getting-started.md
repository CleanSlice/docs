# Getting Started

CleanSlice uses NestJS as its backend framework. This page walks you through project setup, Docker configuration, environment variables, and the two most important files: `main.ts` and `app.module.ts`.

## Project Structure

```
api/
├── src/
│   ├── slices/
│   │   ├── setup/
│   │   │   ├── prisma/
│   │   │   ├── error/
│   │   │   └── health/
│   │   ├── user/
│   │   ├── team/
│   │   └── file/
│   ├── app.module.ts
│   └── main.ts
├── prisma/
│   └── schema.prisma
├── docker-compose.yml
├── .env.example
├── .env.dev
├── .nvmrc
└── package.json
```

Every feature lives inside `src/slices/`. Infrastructure slices go under `setup/`, and your business features sit alongside them as siblings.

## Prerequisites

Make sure you have Docker, Node.js 24+, and npm installed. Create an `.nvmrc` file at the project root to lock the Node version:

```
24
```

Then run:

```bash
nvm use        # Switches to the version in .nvmrc
nvm install    # Installs it if not available
```

## Docker Compose

Local development uses Docker for PostgreSQL, S3-compatible storage, and Redis. Create a `docker-compose.yml` at the project root:

```yaml [docker-compose.yml]
version: '3.8'

services:
  postgres-local:
    image: postgres:latest
    container_name: cleanslice-postgres
    ports:
      - '5432:5432'
    environment:
      POSTGRES_USER: postgres
      POSTGRES_PASSWORD: root
      POSTGRES_DB: cleanslice-api-local-database
    volumes:
      - postgres-data:/var/lib/postgresql/data
    healthcheck:
      test: ['CMD-SHELL', 'pg_isready -U postgres']
      interval: 5s
      timeout: 5s
      retries: 5

  s3-local:
    image: luofuxiang/local-s3:latest
    container_name: cleanslice-s3
    ports:
      - '19025:80'
    volumes:
      - s3-data:/data

  redis-local:
    image: redis:alpine
    container_name: cleanslice-redis
    ports:
      - '6379:6379'
    volumes:
      - redis-data:/data

volumes:
  postgres-data:
  s3-data:
  redis-data:
```

Start everything with:

```bash
docker-compose up -d
```

## Environment Configuration

Create separate `.env` files for each environment. Copy the example to get started:

```bash
cp .env.example .env.dev
```

::: tip
CleanSlice loads the env file matching `NODE_ENV`. Running with `NODE_ENV=dev` loads `.env.dev`, `NODE_ENV=staging` loads `.env.staging`, and so on.
:::

Here is a full `.env.example` for reference:

```bash [.env.example]
# APPLICATION
NODE_ENV=dev
PORT=3000
CORS_ORIGIN=http://localhost:3001,http://localhost:3002

# DATABASE (PostgreSQL)
DATABASE_URL=postgresql://postgres:root@localhost:5432/cleanslice-api-local-database

# STORAGE (S3)
S3_ENDPOINT=http://localhost:19025
S3_BUCKET_NAME=cleanslice-bucket
S3_REGION=us-east-1
S3_ACCESS_KEY_ID=local
S3_SECRET_ACCESS_KEY=local

# AUTHENTICATION
JWT_SECRET=your-super-secret-jwt-key-change-in-production
JWT_EXPIRES_IN=7d
```

Access environment variables in any service through `ConfigService`:

```typescript [some.service.ts]
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class SomeService {
  constructor(private config: ConfigService) {}

  doSomething() {
    const dbUrl = this.config.get<string>('DATABASE_URL');
    const port = this.config.get<number>('PORT', 3000); // with default
  }
}
```

## app.module.ts

The root module imports all slice modules. NestJS handles dependency injection and module lifecycle automatically -- there is no separate `registerSlices.ts` like on the frontend.

```typescript [src/app.module.ts]
import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';

// Setup slices
import { PrismaModule } from './slices/setup/prisma/prisma.module';
import { HealthModule } from './slices/setup/health/health.module';

// Feature slices
import { UserModule } from './slices/user/user.module';
import { TeamModule } from './slices/team/team.module';
import { FileModule } from './slices/file/file.module';

@Module({
  imports: [
    // Global configuration - loads environment variables
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: `.env.${process.env.NODE_ENV || 'dev'}`,
    }),

    // Setup slices (order matters for dependencies)
    PrismaModule,
    HealthModule,

    // Feature slices
    UserModule,
    TeamModule,
    FileModule,
  ],
})
export class AppModule {}
```

A few things to note:

- **ConfigModule** uses `isGlobal: true` so every module can inject `ConfigService` without importing `ConfigModule` again.
- **Setup slices come first** because feature slices depend on them (Prisma, error handling, etc.).
- Each feature slice is a self-contained NestJS module.

## main.ts

The entry point configures Swagger, global interceptors, validation, and CORS:

```typescript [src/main.ts]
import { NestFactory, Reflector } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import * as fs from 'fs';

import { AppModule } from './app.module';
import { ErrorHandlingInterceptor } from './slices/setup/error/error-handling.interceptor';
import { ResponseInterceptor } from './slices/setup/error/response.interceptor';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // Error handling - converts domain errors to HTTP responses
  app.useGlobalInterceptors(new ErrorHandlingInterceptor());

  // Validation - transforms and validates DTOs
  app.useGlobalPipes(
    new ValidationPipe({
      transform: true,
      whitelist: true,
      forbidNonWhitelisted: false,
    }),
  );

  // Response wrapper - standardizes API responses
  app.useGlobalInterceptors(new ResponseInterceptor(app.get(Reflector)));

  // CORS
  app.enableCors({
    origin: process.env.CORS_ORIGIN?.split(',') || '*',
    credentials: true,
  });

  // Swagger / OpenAPI
  const config = new DocumentBuilder()
    .setTitle('CleanSlice API')
    .setDescription('API documentation')
    .setVersion('1.0')
    .addBearerAuth(
      {
        description: 'JWT Bearer token',
        name: 'Authorization',
        bearerFormat: 'Bearer',
        scheme: 'Bearer',
        type: 'http',
        in: 'Header',
      },
      'defaultBearerAuth',
    )
    .build();

  const document = SwaggerModule.createDocument(app, config);

  // Export OpenAPI spec for frontend SDK generation
  fs.writeFileSync('swagger-spec.json', JSON.stringify(document));

  SwaggerModule.setup('api', app, document);

  // Start server
  const port = process.env.PORT || 3000;
  await app.listen(port);

  console.log(`Application running on: http://localhost:${port}`);
  console.log(`Swagger UI: http://localhost:${port}/api`);
}

bootstrap();
```

::: warning Interceptor order matters
1. **ErrorHandlingInterceptor** runs first and catches all errors from downstream.
2. **ValidationPipe** validates incoming requests against your DTOs.
3. **ResponseInterceptor** runs last and wraps successful responses in `{ data, success }`.
:::

The `swagger-spec.json` file is generated on startup and used by the frontend to generate a type-safe API client with `@hey-api/openapi-ts`.

## TypeScript Configuration

Configure path aliases so you can import slices cleanly:

```json [tsconfig.json]
{
  "compilerOptions": {
    "module": "commonjs",
    "emitDecoratorMetadata": true,
    "experimentalDecorators": true,
    "target": "es2017",
    "sourceMap": true,
    "outDir": "./dist",
    "baseUrl": "./",
    "skipLibCheck": true,
    "resolveJsonModule": true,
    "paths": {
      "#": ["src/slices"],
      "#*": ["src/slices/*"]
    }
  }
}
```

The `#` alias lets you replace deeply nested relative imports with clean paths:

```typescript
// Instead of this:
import { UserService } from '../../../slices/user/domain/user.service';

// Write this:
import { UserService } from '#/user/domain/user.service';
```

::: tip Why # instead of @?
The `@` symbol is already used for scoped npm packages like `@nestjs/common`. Using `#` makes it immediately clear that the import points to an internal slice.
:::

## Quick Start

```bash
# 1. Install dependencies
npm install

# 2. Copy environment file
cp .env.example .env.dev

# 3. Start Docker services
docker-compose up -d

# 4. Run database migrations
npm run migrate

# 5. Start development server
npm run start:dev

# 6. Open Swagger UI
open http://localhost:3000/api
```

## What's Next?

- [Database](/backend/database) -- Set up Prisma with distributed schemas across slices
- [API Docs](/backend/api-docs) -- Configure Swagger and OpenAPI for SDK generation
- [Slice Structure](/backend/slice-structure) -- Understand the anatomy of a backend slice
