# State Management

CleanSlice uses [Pinia](https://pinia.vuejs.org/) for state management. The `setup/pinia` slice configures Pinia once, and every feature slice defines its own stores in a `stores/` folder. Thanks to auto-import, you call `useAuthStore()` or `useProductStore()` anywhere in your app without writing a single import statement.

## How It Works

The Pinia setup slice registers the `@pinia/nuxt` module and configures auto-import to scan all `stores/` directories across every slice:

```
setup/pinia/nuxt.config.ts
  --> registers @pinia/nuxt
  --> configures imports.dirs to scan slices/**/stores/

slices/user/auth/stores/auth.ts       --> useAuthStore()
slices/user/account/stores/account.ts --> useAccountStore()
slices/setup/error/stores/error.ts    --> useErrorStore()
slices/product/stores/product.ts      --> useProductStore()
```

All stores are globally available. No import needed.

## Installation

```bash
npm install @pinia/nuxt pinia
```

## Pinia Slice Configuration

The setup slice has a single file -- `nuxt.config.ts` -- that does two things: registers the Pinia module and configures auto-import paths:

```typescript [slices/setup/pinia/nuxt.config.ts]
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const currentDir = dirname(fileURLToPath(import.meta.url));

export default defineNuxtConfig({
  modules: ['@pinia/nuxt'],
  alias: {
    '#pinia': currentDir,
  },
  imports: {
    /**
     * Auto-import stores from all slices.
     * This allows useAuthStore(), useErrorStore(), etc.
     * to work without imports.
     */
    dirs: ['../../../stores', '../../../slices/**/stores'],
  },
});
```

The glob pattern `../../../slices/**/stores` matches any `stores/` folder at any depth within the `slices/` directory.

## Store Naming Convention

Follow this naming pattern for consistency:

| Convention | Example |
|------------|---------|
| File name | `slices/{slice}/stores/{entity}.ts` |
| Store ID | `'{entity}'` (unique string) |
| Export name | `use{Entity}Store` |

```typescript
// File: slices/user/auth/stores/auth.ts
// Store ID: 'auth'
// Export: useAuthStore

export const useAuthStore = defineStore('auth', {
  // ...
});
```

::: warning
Store IDs must be unique across the entire app. If two slices both define a store with the ID `'user'`, they will conflict. Use descriptive, slice-specific names.
:::

## Writing Stores

### Options API Style

The Options API style separates state, getters, and actions into distinct sections. This is the recommended approach for most stores:

```typescript [slices/user/account/stores/account.ts]
import { defineStore } from 'pinia';
import { AuthService, type UserDto } from '#api/data';

export const useAccountStore = defineStore('account', {
  state: () => ({
    user: null as null | UserDto,
    loading: false,
  }),

  getters: {
    getUser: (state) => state.user,
    isLoading: (state) => state.loading,
  },

  actions: {
    async init() {
      await this.fetchAccount();
    },

    async fetchAccount() {
      try {
        this.loading = true;
        const response = await AuthService.me();
        if (response.data?.data) {
          this.user = response.data.data;
        }
      } catch (e) {
        console.error('Failed to fetch account', e);
      } finally {
        this.loading = false;
      }
    },
  },
});
```

### Setup Syntax (Composition API)

For stores that need more flexibility or feel more natural with the Composition API:

```typescript [slices/product/stores/product.ts]
import { defineStore } from 'pinia';
import type { ProductDto } from '#api/data';

export const useProductStore = defineStore('product', () => {
  // State
  const products = ref<ProductDto[]>([]);
  const loading = ref(false);
  const selectedId = ref<string | null>(null);

  // Getters
  const productCount = computed(() => products.value.length);
  const selectedProduct = computed(() =>
    products.value.find((p) => p.id === selectedId.value)
  );

  // Actions
  async function fetchProducts() {
    loading.value = true;
    try {
      // API call here
      products.value = [];
    } finally {
      loading.value = false;
    }
  }

  function selectProduct(id: string) {
    selectedId.value = id;
  }

  return {
    products,
    loading,
    selectedId,
    productCount,
    selectedProduct,
    fetchProducts,
    selectProduct,
  };
});
```

::: tip
With the Setup Syntax, remember that `ref` and `computed` are auto-imported by Nuxt -- you do not need to import them from `vue`.
:::

## Common State Patterns

These patterns appear frequently across stores:

| Pattern | Type | Usage |
|---------|------|-------|
| `loading` | `boolean` | Track async operation status |
| `error` | `string \| null` | Store error messages |
| `data` | `T \| null` | Main entity storage |
| `items` | `T[]` | Collection storage |
| `selectedId` | `string \| null` | Track selected item |

## Getter Patterns

```typescript
getters: {
  // Simple accessor
  getUser: (state) => state.user,

  // Computed boolean
  isAuthenticated: (state): boolean => Boolean(state.auth?.accessToken),

  // Parameterized getter (returns a function)
  getById: (state) => (id: string) => {
    return state.items.find(item => item.id === id);
  },

  // Getter that uses other getters
  displayName(state): string {
    return this.getUser?.name || 'Guest';
  },
}
```

## Action Patterns

```typescript
actions: {
  // Synchronous action
  setUser(user: UserDto) {
    this.user = user;
  },

  // Async action with loading state
  async fetchData() {
    this.loading = true;
    try {
      const response = await SomeService.getData();
      this.data = response.data;
    } catch (e) {
      this.error = 'Failed to fetch data';
    } finally {
      this.loading = false;
    }
  },

  // Action that calls another store
  async loginAndFetch(credentials: LoginDto) {
    const authStore = useAuthStore();
    const success = await authStore.login(credentials);
    if (success) {
      await this.fetchData();
    }
  },
}
```

## Using Stores

### In Components

Stores are auto-imported. Just call the composable:

```vue [components/account/Provider.vue]
<script setup lang="ts">
// No import needed -- stores are auto-imported
const authStore = useAuthStore();
const accountStore = useAccountStore();

const user = computed(() => accountStore.user);
const isAuthenticated = computed(() => authStore.isAuthenticated);

async function handleLogin(credentials: LoginDto) {
  const success = await authStore.login(credentials);
  if (success) {
    await accountStore.fetchAccount();
  }
}
</script>

<template>
  <div v-if="isAuthenticated">
    <p>Welcome, {{ user?.name }}</p>
  </div>
  <div v-else>
    <LoginForm @submit="handleLogin" />
  </div>
</template>
```

### In Other Stores

Access one store from another by calling the composable inside an action (not at the top level):

```typescript [slices/user/auth/stores/auth.ts]
import { defineStore } from 'pinia';

export const useAuthStore = defineStore('auth', {
  actions: {
    async login(credentials: LoginUserDto): Promise<boolean> {
      // Get the error store inside the action, not at the module level
      const errorStore = useErrorStore();
      try {
        // ... login logic
        return true;
      } catch (e) {
        errorStore.setApiError('auth_login', e, 'Failed to login');
        return false;
      }
    },
  },
});
```

### In Composables

```typescript [slices/user/composables/useAuth.ts]
export function useAuth() {
  const authStore = useAuthStore();
  const accountStore = useAccountStore();

  const isLoggedIn = computed(() => authStore.isAuthenticated);
  const currentUser = computed(() => accountStore.user);

  async function logout() {
    authStore.logout();
    navigateTo('/login');
  }

  return { isLoggedIn, currentUser, logout };
}
```

## File Organization

Stores always live in the `stores/` folder of their slice, never in `composables/` or at the root:

```
slices/
├── setup/
│   ├── pinia/
│   │   └── nuxt.config.ts    # Pinia config only
│   └── error/
│       └── stores/
│           └── error.ts       # Error store
├── user/
│   ├── auth/
│   │   └── stores/
│   │       └── auth.ts        # Auth store
│   └── account/
│       └── stores/
│           └── account.ts     # Account store
└── product/
    └── stores/
        └── product.ts         # Product store
```

## What's Next?

- [API Integration](/frontend/api-integration) -- Connect stores to generated API services
- [Error Handling](/frontend/error-handling) -- Use the error store for consistent error management
- [Slice Structure](/frontend/slice-structure) -- Understand where stores fit in slice anatomy
