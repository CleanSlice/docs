# Introduction

CleanSlice is an architecture framework for building full-stack applications with **NestJS** (backend) and **Nuxt** (frontend). It organizes your entire codebase into **vertical slices** — self-contained feature modules that each follow **Clean Architecture** principles.

## Why CleanSlice?

Most full-stack projects start simple but quickly become tangled. Business logic leaks into controllers. Database queries appear in UI components. Adding a new feature means touching files scattered across dozens of folders.

CleanSlice solves this by enforcing two structural rules:

1. **Every feature lives in its own slice** — a folder containing everything that feature needs: API endpoints, UI components, data access, types, and state management.
2. **Every slice follows three layers** — Presentation, Domain, and Data — with strict dependency rules that keep your code decoupled and testable.

The result is a codebase where you can add, remove, or modify features independently, without unintended side effects.

## Technology Stack

CleanSlice uses a fixed technology stack. This eliminates decision fatigue and ensures all patterns work together seamlessly.

| Layer | Technology |
|-------|-----------|
| Backend | [NestJS](https://nestjs.com/) |
| Frontend | [Nuxt 3](https://nuxt.com/) + [Vue 3](https://vuejs.org/) |
| Database | [Prisma](https://www.prisma.io/) + PostgreSQL |
| Styling | [Tailwind CSS](https://tailwindcss.com/) + [shadcn-vue](https://www.shadcn-vue.com/) |
| State | [Pinia](https://pinia.vuejs.org/) |

## How It Works

A CleanSlice project has two main applications — `api/` and `app/` — each containing a `slices/` folder where all features live:

```
my-project/
├── api/                      # Backend (NestJS)
│   └── src/slices/
│       ├── user/             # User feature slice
│       ├── project/          # Project feature slice
│       └── prisma/           # Setup slice (database)
│
└── app/                      # Frontend (Nuxt)
    └── slices/
        ├── user/             # User feature slice
        ├── project/          # Project feature slice
        └── setup/            # Infrastructure slices
            ├── theme/
            ├── pinia/
            └── api/
```

Each feature slice contains everything it needs. A `user` slice on the backend might look like:

```
slices/user/
├── user.module.ts            # Module definition
├── user.controller.ts        # HTTP endpoints
├── domain/                   # Business logic & contracts
│   ├── user.types.ts
│   ├── user.gateway.ts       # Abstract gateway (interface)
│   └── user.service.ts
├── data/                     # Data access implementation
│   ├── user.gateway.ts       # Concrete gateway (Prisma)
│   └── user.mapper.ts
└── dtos/                     # Request/response validation
    ├── createUser.dto.ts
    └── user.dto.ts
```

## Key Concepts

### Slices
A slice is a self-contained feature module. It owns its own routes, components, stores, types, and data access logic. Slices are either **feature slices** (like `user/`, `project/`) or **setup slices** (like `theme/`, `prisma/`) that provide shared infrastructure.

### Three Layers
Every slice is internally organized into three layers:
- **Presentation** — Controllers and DTOs (backend), Pages and Components (frontend)
- **Domain** — Business logic, type definitions, and gateway interfaces. Framework-agnostic.
- **Data** — Gateway implementations, mappers, and external service integrations.

### Gateway Pattern
Instead of calling the database directly from your business logic, you define an abstract gateway interface in the domain layer and implement it in the data layer. This keeps your domain logic pure and makes testing straightforward.

### Setup Slices
Infrastructure concerns like database connections, theming, API client configuration, and error handling are packaged as setup slices. Feature slices depend on them but don't need to know their internal details.

## What's Next?

- [Getting Started](/guide/getting-started) — Set up your first CleanSlice project
- [Core Concepts](/guide/core-concepts) — Deep dive into slices, layers, and the gateway pattern
- [Project Structure](/guide/project-structure) — Understand the full folder layout and naming conventions
