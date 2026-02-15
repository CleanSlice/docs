# Nuxt Standards

These conventions apply to all frontend code in the `app/` project. They build on the [TypeScript Standards](/standards/typescript) with Nuxt-specific patterns.

## Auto-Imports

Nuxt auto-imports Vue APIs, composables, components, and utilities. You should not manually import them.

### What's Auto-Imported

| Category | Examples | Manual Import Needed? |
|----------|---------|----------------------|
| Vue APIs | `ref()`, `computed()`, `watch()`, `onMounted()` | No |
| Nuxt composables | `useRoute()`, `useCookie()`, `useAsyncData()` | No |
| Components | `<Button />`, `<Card />` | No |
| Pinia stores | `useAuthStore()`, `useUserStore()` | No |
| Generated types | `UserDto`, `AuthService` from `#api` | **Yes** |

```typescript
// Correct — just use them
const count = ref(0);
const doubled = computed(() => count.value * 2);
const route = useRoute();
const { data } = await useAsyncData('key', () => fetchData());
const store = useAuthStore();

// Wrong — unnecessary imports
import { ref, computed } from 'vue';          // auto-imported
import { useRoute } from '#app';              // auto-imported
import { useAuthStore } from '../stores/auth'; // auto-imported by Pinia
```

::: warning
The one exception is generated types and services from the API SDK. These must be imported explicitly because they're generated code:
```typescript
import { UsersService, type UserDto } from '#api';
```
:::

## Slice Structure

Each frontend slice is a Nuxt layer:

```
slices/{entity}/
├── nuxt.config.ts              # Slice config + alias
├── pages/
│   ├── {entities}.vue          # List page (plural)
│   └── {entities}/[id].vue     # Detail page
├── components/
│   └── {entity}/               # Component group
│       ├── Provider.vue        # Data fetching (required)
│       ├── Item.vue            # Display component
│       └── Form.vue            # Edit form
├── stores/
│   └── {entity}.ts             # Pinia store
└── locales/
    ├── en.json
    └── fr.json
```

### Slice nuxt.config.ts

Every slice defines its own alias:

```typescript
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const currentDir = dirname(fileURLToPath(import.meta.url));

export default defineNuxtConfig({
  alias: {
    '#user': currentDir,
  },
});
```

## Provider Pattern

Every component folder contains a `Provider.vue` that handles data fetching and bootstrapping. Child components receive data via props or provide/inject:

```vue
<!-- components/user/Provider.vue -->
<script setup lang="ts">
const props = defineProps<{ id: string }>();

const store = useUserStore();
await store.fetchById(props.id);
</script>

<template>
  <UserItem v-if="store.currentUser" :user="store.currentUser" />
  <div v-else>Loading...</div>
</template>
```

```vue
<!-- components/user/Item.vue -->
<script setup lang="ts">
defineProps<{ user: IUserData }>();
</script>

<template>
  <div class="p-4 border rounded">
    <h2 class="font-semibold">{{ user.name }}</h2>
    <p class="text-muted-foreground">{{ user.email }}</p>
  </div>
</template>
```

::: tip
Components are organized one level deep inside a named folder. Don't nest further — `components/user/Item.vue` is correct, `components/user/profile/Item.vue` is not.
:::

## State Management

Use Pinia stores in the `stores/` folder. Stores are auto-imported across all slices:

```typescript
// stores/user.ts
export const useUserStore = defineStore('user', () => {
  const users = ref<IUserData[]>([]);
  const loading = ref(false);

  async function fetchAll(): Promise<void> {
    loading.value = true;
    try {
      const response = await UsersService.findAll();
      users.value = response.data;
    } finally {
      loading.value = false;
    }
  }

  return { users, loading, fetchAll };
});
```

::: warning
Use `stores/` for state management, not `composables/`. Composables should be used for reusable logic that doesn't manage state (formatters, utilities, etc.).
:::

## Page Conventions

Page filenames use **plural** names (matching the URL route):

```
pages/
├── users.vue              # /users
├── users/[id].vue         # /users/:id
└── users/create.vue       # /users/create
```

Pages should be thin — they render Provider components and handle routing:

```vue
<!-- pages/users/[id].vue -->
<script setup lang="ts">
const route = useRoute();
const id = route.params.id as string;
</script>

<template>
  <UserProvider :id="id" />
</template>
```

## Component Naming

Components inside slices are auto-imported with folder-aware naming:

```
components/
├── user/
│   ├── Provider.vue     → <UserProvider />
│   ├── Item.vue         → <UserItem />
│   └── Form.vue         → <UserForm />
└── userList/
    ├── Provider.vue     → <UserListProvider />
    └── Thumb.vue        → <UserListThumb />
```

## Post-Installation Cleanup

After creating a new Nuxt app, remove the default folders. All code should live inside `slices/`:

```bash
cd app
rm -rf components composables pages layouts middleware plugins assets
```

Your app root should only contain:

```
app/
├── slices/               # All code here
├── nuxt.config.ts        # Root config (extends slices)
└── app.vue               # Root component
```

## What's Next?

- [Frontend Getting Started](/frontend/getting-started) — Full setup guide
- [State Management](/frontend/state-management) — Pinia store patterns
- [UI Components](/frontend/ui-components) — shadcn-vue and Tailwind setup
- [TypeScript Standards](/standards/typescript) — General TS conventions
