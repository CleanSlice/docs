# Architecture Overview

CleanSlice combines two architectural patterns: **Clean Architecture** for layer separation and **Vertical Slices** for feature organization. Together, they create a codebase that scales without becoming tangled.

## Clean Architecture

Clean Architecture, introduced by Robert C. Martin, organizes code into concentric layers where dependencies always point inward — from outer infrastructure toward inner business logic.

CleanSlice adapts this into three practical layers:

```
┌─────────────────────────────────────────────┐
│  Presentation                               │
│  (Controllers, DTOs, Pages, Components)     │
└──────────────────┬──────────────────────────┘
                   │
                   ▼
┌─────────────────────────────────────────────┐
│  Domain                                     │
│  (Services, Types, Gateway Interfaces)      │
└──────────────────┬──────────────────────────┘
                   │
                   ▼
┌─────────────────────────────────────────────┐
│  Data                                       │
│  (Gateway Implementations, Mappers)         │
└─────────────────────────────────────────────┘
```

The key principle: **the domain layer has no external dependencies**. It doesn't know about HTTP, databases, or UI frameworks. This makes business logic portable, testable, and resilient to infrastructure changes.

## Vertical Slices

Instead of grouping all controllers together, all services together, and all repositories together, CleanSlice groups code by **feature**. Each feature (user management, projects, chat, etc.) is a self-contained "slice" with its own layers.

This means:

- Adding a feature = adding a folder
- Removing a feature = removing a folder
- Understanding a feature = reading one folder
- Features don't interfere with each other

## Combining Both Patterns

Each slice contains its own three-layer architecture:

```
slices/
├── user/                          # User feature
│   ├── user.controller.ts         #   Presentation
│   ├── domain/                    #   Domain
│   │   ├── user.types.ts
│   │   ├── user.gateway.ts
│   │   └── user.service.ts
│   └── data/                      #   Data
│       ├── user.gateway.ts
│       └── user.mapper.ts
│
├── project/                       # Project feature
│   ├── project.controller.ts      #   Presentation
│   ├── domain/                    #   Domain
│   └── data/                      #   Data
│
└── prisma/                        # Setup slice (infrastructure)
    ├── prisma.module.ts
    └── prisma.service.ts
```

## Design Principles

### 1. Dependencies Point Inward

The domain layer never imports from the data layer. Instead, it defines abstract interfaces (gateways) that the data layer implements. Dependency injection connects them at runtime.

### 2. Framework Isolation

Domain types and business logic are plain TypeScript. They work independently of NestJS, Prisma, Vue, or any other framework. This means you can test them without spinning up a server or a database.

### 3. Explicit Boundaries

Each layer has a clear responsibility:
- **Presentation** handles input/output formatting
- **Domain** contains business rules
- **Data** handles external communication

Code in one layer doesn't reach into another layer's internals.

### 4. Slice Independence

Slices interact through their public domain interfaces, not through internal implementation details. If the `project` slice needs user data, it imports from `#user/domain`, not from `#user/data`.

## What's Next?

- [Layers](/architecture/layers) — Detailed breakdown of each layer's responsibilities
- [Slices](/architecture/slices) — How to structure and compose slices
- [Dependency Flow](/architecture/dependency-flow) — Import rules and dependency injection
