---
layout: home

hero:
  name: CleanSlice
  text: Build Full-Stack Apps with Clean Architecture
  tagline: A slice-based framework for NestJS + Nuxt applications. Compose features as independent, self-contained vertical slices.
  image:
    src: /cleanslice-architecture.png
    alt: CleanSlice Logo
  actions:
    - theme: brand
      text: Get Started
      link: /guide/introduction
    - theme: alt
      text: View on GitHub
      link: https://github.com/cleanslice

features:
  - icon: 🧩
    title: Vertical Slices
    details: Each feature is a self-contained slice with its own API, UI, data models, and tests. Add or remove features without affecting the rest of the app.
  - icon: 🏛️
    title: Clean Architecture
    details: Three-layer structure (Presentation, Domain, Data) within every slice. Dependencies always point inward toward the domain.
  - icon: ⚡
    title: Fixed Stack, Zero Decisions
    details: NestJS + Nuxt + Prisma + Tailwind. No decision fatigue — just start building. The framework handles the architecture so you can focus on features.
  - icon: 🔌
    title: Setup Slices
    details: Pre-built infrastructure slices for themes, state management, API integration, error handling, and i18n. Plug them in and go.
  - icon: 🚪
    title: Gateway Pattern
    details: Abstract data access behind gateway interfaces. Swap implementations without touching business logic. Test with mocks effortlessly.
  - icon: 🛡️
    title: Type-Safe Throughout
    details: Strict TypeScript conventions, generated API SDKs from OpenAPI specs, and domain types that keep your entire stack in sync.
---
