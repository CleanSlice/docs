# Slice Structure

Every frontend slice in CleanSlice is a [Nuxt Layer](https://nuxt.com/docs/getting-started/layers) -- a self-contained module with its own configuration, components, stores, pages, and translations. This page explains how slices are organized and the conventions that make auto-import and composition work seamlessly.

## Why Slices as Layers?

Nuxt layers solve a real organizational problem: as an app grows, a flat `components/` or `pages/` directory becomes unmanageable. By making each feature a layer, you get:

- **Isolation** -- Each slice owns its own code and config
- **Auto-import** -- Components, stores, and composables are discovered automatically
- **Independent i18n** -- Each slice manages its own translations
- **Easy removal** -- Delete the folder and the feature is gone

## Anatomy of a Slice

Here is the full structure a feature slice can have. Not every slice needs every folder -- use only what you need:

```
slices/{feature}/
├── nuxt.config.ts          # Required -- registers the layer
├── components/
│   ├── {entity}/
│   │   ├── Provider.vue    # Data fetching wrapper
│   │   ├── Item.vue        # Display component
│   │   ├── Form.vue        # Create/edit form
│   │   └── Menu.vue        # Navigation menu
│   ├── {entity}List/
│   │   ├── Provider.vue    # List data fetching
│   │   └── Thumb.vue       # List item card
│   └── {entity}Create/
│       ├── Provider.vue    # Create form wrapper
│       └── Form.vue        # Create form
├── pages/
│   ├── index.vue           # Route: /{feature}
│   └── [id].vue            # Route: /{feature}/:id
├── stores/
│   └── {feature}.ts        # Pinia store
├── composables/
│   └── use{Feature}.ts     # Composable functions
├── locales/
│   ├── en.json             # English translations
│   └── fr.json             # French translations
├── domain/                 # Clean Architecture domain layer
│   ├── {feature}.gateway.ts
│   ├── {feature}.service.ts
│   └── {feature}.types.ts
├── data/                   # Clean Architecture data layer
│   ├── {feature}.gateway.ts
│   └── mock.gateway.ts
└── plugins/
    ├── di.ts               # DI registration
    └── menu.ts             # Menu registration
```

## The Slice nuxt.config.ts

Every slice needs a `nuxt.config.ts` to be recognized as a Nuxt layer. This is the minimum viable config:

```typescript [slices/{feature}/nuxt.config.ts]
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const currentDir = dirname(fileURLToPath(import.meta.url));

export default defineNuxtConfig({
  alias: {
    '#feature': currentDir,
  },
});
```

To add translations, register the i18n module:

```typescript [slices/{feature}/nuxt.config.ts]
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const currentDir = dirname(fileURLToPath(import.meta.url));

export default defineNuxtConfig({
  alias: {
    '#feature': currentDir,
  },
  modules: ['@nuxtjs/i18n'],
  i18n: {
    langDir: './locales',
    locales: [
      { code: 'en', file: 'en.json' },
      { code: 'fr', file: 'fr.json' },
    ],
  },
});
```

The `#feature` alias lets other slices import from this slice using a clean path like `#feature/domain/types`.

## Auto-Import Rules

Nuxt auto-imports are one of the framework's best features, and understanding what is and is not auto-imported saves you from unnecessary import statements.

| What | Auto-Imported? | Example |
|------|---------------|---------|
| Vue APIs | Yes | `ref()`, `computed()`, `watch()` |
| Nuxt composables | Yes | `useRoute()`, `useFetch()`, `useAsyncData()` |
| Components | Yes | `<Button />`, `<AccountProvider />` |
| Pinia stores | Yes | `useAuthStore()`, `useMenuStore()` |
| API SDK types/services | No -- use `#api` | `import { UserDto } from '#api/data'` |
| External libraries | No | `import { useForm } from 'vee-validate'` |
| Alias utilities | No | `import { cn } from '#theme/utils'` |

::: tip
A good rule of thumb: if it comes from Vue, Nuxt, or a slice's `components/`, `composables/`, or `stores/` folder, it is auto-imported. Everything else needs an explicit import.
:::

## Component Standards

### The Provider Pattern

Every component folder has a `Provider.vue` file. The Provider is the data-fetching wrapper that passes data down to child components via props:

```vue [components/account/Provider.vue]
<script lang="ts" setup>
import { AuthService } from '#api/data';

const { data, pending, error, refresh } = useAsyncData('account', () =>
  AuthService.me()
);
</script>

<template>
  <div>
    <AccountForm v-if="!pending" :user="data?.data" @update="refresh" />
    <div class="mb-5"></div>
    <AccountItem :pending="pending" :user="data?.data" />
  </div>
</template>
```

The child components (`AccountItem`, `AccountForm`) are pure display and interaction components -- they receive data as props and emit events, but they do not fetch data themselves.

### Item Component

Receives data via props. Handles display only:

```vue [components/account/Item.vue]
<script lang="ts" setup>
import type { UserDto } from '#api/data';

defineProps<{ user: UserDto; pending: boolean }>();
</script>

<template>
  <div class="py-2">
    <div class="font-bold">Name</div>
    <Skeleton v-if="!user && pending" class="h-3 mt-2 w-[150px]" />
    <div v-if="user" class="text-sm text-muted-foreground">
      {{ user.name }}
    </div>
  </div>
</template>
```

### Form Component

Handles user input with validation. Emits `update` on success so the Provider can refresh:

```vue [components/account/Form.vue]
<script lang="ts" setup>
import { useForm } from 'vee-validate';
import { toTypedSchema } from '@vee-validate/zod';
import * as z from 'zod';
import { UsersService, type UpdateUserDto, type UserDto } from '#api/data';

const props = defineProps<{ user: UserDto }>();
const emits = defineEmits<{ (e: 'update', value: any): void }>();
const loading = ref(false);
const isOpen = ref(false);

const formSchema = z.object({
  name: z.string().describe('Name').default(props.user.name),
  email: z.string().describe('Email').default(props.user.email),
});

const form = useForm({ validationSchema: toTypedSchema(formSchema) });

const submit = form.handleSubmit(async (values) => {
  loading.value = true;
  try {
    const result = await UsersService.updateUser({
      id: props.user.id,
      requestBody: values as UpdateUserDto,
    });
    isOpen.value = false;
    emits('update', result);
  } finally {
    loading.value = false;
  }
});
</script>

<template>
  <Dialog v-model:open="isOpen">
    <DialogTrigger><Button>Edit Profile</Button></DialogTrigger>
    <DialogScrollContent>
      <DialogHeader><DialogTitle>Edit Account</DialogTitle></DialogHeader>
      <form class="space-y-6" @submit="submit">
        <FormField v-slot="{ componentField }" name="name" :value="user.name">
          <FormItem>
            <FormLabel>Name</FormLabel>
            <FormControl>
              <Input v-bind="componentField" type="text" />
            </FormControl>
            <FormMessage />
          </FormItem>
        </FormField>
        <Button type="submit" :loading="loading">Save</Button>
      </form>
    </DialogScrollContent>
  </Dialog>
</template>
```

### Component Naming Convention

Nuxt auto-imports components using the pattern `{FolderName}{FileName}` in PascalCase:

| File Path | Auto-Import Name |
|-----------|-----------------|
| `account/Provider.vue` | `AccountProvider` |
| `account/Item.vue` | `AccountItem` |
| `account/Form.vue` | `AccountForm` |
| `accountList/Provider.vue` | `AccountListProvider` |
| `accountList/Thumb.vue` | `AccountListThumb` |

::: warning
Component folders are limited to one level of nesting. Use combined names (`teamList/`) instead of nested folders (`team/list/`).
:::

### Using Components in Pages

Pages are thin -- they set metadata and render a Provider:

```vue [pages/account.vue]
<script lang="ts" setup>
definePageMeta({
  layout: 'dashboard',
  auth: { public: false },
});
</script>

<template>
  <AccountProvider />
</template>
```

## Component Type Reference

| Type | Purpose |
|------|---------|
| `Provider.vue` | Data fetching and orchestration. Passes data to children via props. |
| `Item.vue` | Displays a single entity. Receives props, no data fetching. |
| `Form.vue` | Create/edit forms with validation. Emits `update` on success. |
| `Thumb.vue` | List item card, typically clickable. |
| `Menu.vue` | Navigation sub-menu for the entity. |
| `Dropdown.vue` | Selector dropdown component. |

## What's Next?

- [State Management](/frontend/state-management) -- Define Pinia stores within slices
- [API Integration](/frontend/api-integration) -- Generate type-safe SDK services
- [UI Components](/frontend/ui-components) -- Use shadcn-vue components across slices
- [Dependency Injection](/frontend/dependency-injection) -- Add domain services with InversifyJS
