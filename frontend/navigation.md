# Navigation

CleanSlice uses a centralized menu system where each slice registers its own navigation items. The menu store lives in the `common` slice, UI components render the sidebar and top navigation, and feature slices contribute menu items through Nuxt plugins.

## Architecture

The navigation system has three parts:

1. **Menu Store** (`common/stores/menu.ts`) -- Holds all menu items in central state
2. **Menu Components** (`common/components/menu/`) -- Render the sidebar and top nav
3. **Slice Plugins** (`{slice}/plugins/menu.ts`) -- Each slice registers its items

```
slices/
├── common/
│   ├── stores/
│   │   └── menu.ts              # Central menu store
│   ├── components/
│   │   └── menu/
│   │       ├── Top.vue          # Top navigation bar
│   │       └── Sidebar.vue      # Sidebar navigation
│   └── index.ts                 # Exports for #common alias
├── user/
│   └── plugins/
│       └── menu.ts              # Registers user menu items
├── chat/
│   └── plugins/
│       └── menu.ts              # Registers chat menu items
└── files/
    └── plugins/
        └── menu.ts              # Registers files menu items
```

This design means a feature slice is fully self-contained -- it brings its own pages, components, stores, *and* navigation entries.

## Menu Store

The menu store manages two lists: `sidebar` items (grouped navigation) and `items` (top nav links). Both include duplicate prevention for SSR safety.

```typescript [slices/common/stores/menu.ts]
import { defineStore } from 'pinia';

export enum MenuGroupTypes {
  Project = 'project',
  Playground = 'playground',
  Account = 'account',
  Resources = 'resources',
}

export type IMenuData = {
  id: string;
  group?: MenuGroupTypes;
  title: string;
  link: string;
  active: boolean;
  icon: string;
  sortOrder: number;
  isPolling: boolean;
};

export const useMenuStore = defineStore('menu', {
  state: () => ({
    sidebar: [] as IMenuData[],
    items: [] as IMenuData[],
  }),

  getters: {
    getSidebar: (state) => {
      return state.sidebar
        .sort((a, b) => a.sortOrder - b.sortOrder)
        .map((item) => {
          const route = useRoute();
          if (route?.name) {
            item.active = route.name.toString() === item.link;
          }
          return item;
        });
    },

    getItems: (state) => {
      return state.items
        .sort((a, b) => a.sortOrder - b.sortOrder)
        .map((item) => {
          const route = useRoute();
          if (route?.name) {
            item.active = route.name.toString() === item.link;
          }
          return item;
        });
    },
  },

  actions: {
    addSidebar(item: IMenuData) {
      const itemExists = this.sidebar.some(
        (existing) =>
          existing.id === item.id && existing.group === item.group
      );
      if (!itemExists) {
        this.sidebar.push(item);
      }
    },

    addItem(item: IMenuData) {
      const itemExists = this.items.some(
        (existing) => existing.id === item.id
      );
      if (!itemExists) {
        this.items.push(item);
      }
    },
  },
});
```

Export the store and types from the common slice:

```typescript [slices/common/index.ts]
export * from './stores/menu';
```

## Menu Item Properties

| Property | Type | Description |
|----------|------|-------------|
| `id` | `string` | Unique identifier (use the slice name for clarity) |
| `group` | `MenuGroupTypes` | Sidebar group for visual organization |
| `title` | `string` | Display text (supports i18n keys via `$t()`) |
| `link` | `string` | Nuxt route name to navigate to |
| `active` | `boolean` | Whether the item is currently active (auto-calculated by getter) |
| `icon` | `string` | Icon name (e.g., Lucide icon name) |
| `sortOrder` | `number` | Position within the group (lower numbers appear first) |
| `isPolling` | `boolean` | Shows a pulsing indicator when `true` |

::: tip
Use gaps in `sortOrder` values (10, 20, 30 instead of 1, 2, 3) so you can insert new items later without renumbering everything.
:::

## Registering Menu Items from Slices

Each feature slice registers its menu items through a Nuxt plugin. This keeps navigation config co-located with the feature it represents.

### Basic Plugin

```typescript [slices/chat/plugins/menu.ts]
import { MenuGroupTypes } from '#common';

export default defineNuxtPlugin(async () => {
  const menu = useMenuStore();

  menu.addSidebar({
    id: 'chat',
    group: MenuGroupTypes.Project,
    title: 'Chat',
    link: 'teams-teamId-chats',
    active: false,
    icon: 'MessageCircle',
    isPolling: false,
    sortOrder: 3,
  });
});
```

### Conditional Registration

You can check store state before adding items -- for example, only show a menu item if the user is authenticated:

```typescript [slices/user/plugins/menu.ts]
import { MenuGroupTypes } from '#common';

export default defineNuxtPlugin(async () => {
  const menu = useMenuStore();
  const userStore = useUserStore();

  if (userStore.isAuthenticated) {
    menu.addSidebar({
      id: 'profile',
      group: MenuGroupTypes.Account,
      title: 'Profile',
      link: 'profile',
      active: false,
      icon: 'User',
      isPolling: false,
      sortOrder: 1,
    });
  }
});
```

### Multiple Items from One Slice

```typescript [slices/files/plugins/menu.ts]
import { MenuGroupTypes } from '#common';

export default defineNuxtPlugin(() => {
  const menu = useMenuStore();

  menu.addSidebar({
    id: 'files',
    group: MenuGroupTypes.Resources,
    title: 'Files',
    link: 'files',
    active: false,
    icon: 'File',
    isPolling: false,
    sortOrder: 1,
  });
});
```

## Menu Components

### Top Navigation

A horizontal menu for the top bar:

```vue [slices/common/components/menu/Top.vue]
<script setup lang="ts">
const menu = useMenuStore();
</script>

<template>
  <div class="flex space-x-4">
    <nuxt-link
      v-for="item in menu.getItems"
      :key="item.id"
      :to="{ name: item.link }"
      class="rounded-md px-3 py-2 text-sm text-gray-700 cursor-pointer"
      :class="{ 'font-bold': item.active }"
    >
      {{ $t(item.title) }}
    </nuxt-link>
  </div>
</template>
```

### Sidebar Navigation

A grouped sidebar with icons and sections:

```vue [slices/common/components/menu/Sidebar.vue]
<script setup lang="ts">
import { MenuGroupTypes } from '#common/stores/menu';

const menu = useMenuStore();
const route = useRoute();

const getSidebarByGroup = (group: MenuGroupTypes) => {
  return menu.getSidebar.filter((item) => item.group === group);
};
</script>

<template>
  <div
    v-for="group in [
      MenuGroupTypes.Project,
      MenuGroupTypes.Playground,
      MenuGroupTypes.Account,
      MenuGroupTypes.Resources,
    ]"
    :key="group"
    class="mb-4"
  >
    <h4
      class="mb-1 rounded-md px-2 py-1 text-xs font-semibold uppercase tracking-wider text-slate-400"
    >
      {{ group }}
    </h4>

    <div class="grid grid-flow-row auto-rows-max text-sm">
      <nuxt-link
        v-for="item in getSidebarByGroup(group)"
        :key="item.id"
        :to="{
          name: item.link,
          params: { teamId: route.params.teamId },
        }"
        class="group flex w-full items-center rounded-md border border-transparent px-2 py-1 text-muted-foreground"
        :class="{
          '!font-semibold !text-foreground': item.active,
        }"
      >
        <Icon
          :name="item.icon"
          class="mr-2"
          :class="{
            'animate-pulse text-orange-400': item.isPolling,
          }"
        />
        {{ $t(item.title) }}
      </nuxt-link>
    </div>
  </div>
</template>
```

## Using Menu Components in Layouts

Add the menu components to your layout files. Since they live in the `common` slice, they are auto-imported:

```vue [layouts/default.vue]
<template>
  <div class="flex h-screen">
    <aside class="w-64 border-r p-4">
      <CommonMenuSidebar />
    </aside>
    <div class="flex-1">
      <header class="border-b p-4">
        <CommonMenuTop />
      </header>
      <main class="p-6">
        <slot />
      </main>
    </div>
  </div>
</template>
```

The component names follow the Nuxt auto-import convention: `common/components/menu/Top.vue` becomes `CommonMenuTop`, and `common/components/menu/Sidebar.vue` becomes `CommonMenuSidebar`.

## Adding New Menu Groups

To add a new group (for example, an Admin section), update the `MenuGroupTypes` enum:

```typescript
export enum MenuGroupTypes {
  Project = 'project',
  Playground = 'playground',
  Account = 'account',
  Resources = 'resources',
  Admin = 'admin', // New group
}
```

Then add the new group to the iteration array in `Sidebar.vue`:

```vue
<div
  v-for="group in [
    MenuGroupTypes.Project,
    MenuGroupTypes.Playground,
    MenuGroupTypes.Account,
    MenuGroupTypes.Resources,
    MenuGroupTypes.Admin,
  ]"
  :key="group"
  class="mb-4"
>
```

## Best Practices

- **Unique IDs** -- Use the slice name as the `id` to prevent duplicates
- **i18n titles** -- Use translation keys for `title` so labels change with the locale
- **Sort order gaps** -- Use 10, 20, 30 instead of 1, 2, 3 for easier future insertions
- **SSR safety** -- The store's `addSidebar` and `addItem` methods check for duplicates, which prevents double entries during SSR hydration
- **Active state** -- The store getters automatically calculate `active` based on the current route, so you do not need to manage it manually

## What's Next?

- [State Management](/frontend/state-management) -- The menu store follows Pinia conventions
- [i18n](/frontend/i18n) -- Menu titles use translation keys
- [Slice Structure](/frontend/slice-structure) -- See how plugins fit in slice anatomy
- [Getting Started](/frontend/getting-started) -- Full project setup overview
