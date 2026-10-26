# UI Components

CleanSlice uses [shadcn-vue](https://www.shadcn-vue.com/) for UI components and [Tailwind CSS v4](https://tailwindcss.com/) for styling. The `setup/theme` slice is the design system foundation: it registers Tailwind, hosts every shared UI component, and defines the CSS variables that drive theming and dark mode.

## Why a Theme Slice?

UI components are shared infrastructure, not feature code. By centralizing them in a single theme slice, you get:

- **Consistency** -- Every feature slice uses the same Button, Card, Input, etc.
- **Single source of truth** -- Color tokens, radius, and typography live in one place
- **Dark mode for free** -- CSS variables swap values when the `.dark` class is toggled
- **Auto-import** -- The `shadcn-nuxt` module registers all UI components globally
- **Swappable themes** -- A theme is one CSS file; `components.json` names the active one

## Installation

```bash
# Tailwind v4 and shadcn
bun add -d tailwindcss @tailwindcss/vite tw-animate-css shadcn-nuxt

# Runtime dependencies
bun add reka-ui class-variance-authority clsx tailwind-merge lucide-vue-next

# Color mode (root module, see Dark Mode below)
bun add -d @nuxtjs/color-mode
```

Tailwind v4 is configured in CSS, not in a `tailwind.config.js`. There is no `@nuxtjs/tailwindcss` module; the `@tailwindcss/vite` plugin does the work.

## Slice Structure

```
slices/setup/theme/
├── nuxt.config.ts            # shadcn-nuxt + Tailwind Vite plugin + alias
├── assets/
│   ├── css/
│   │   └── tailwind.css      # Tailwind import, token wiring, base layer
│   └── themes/
│       ├── default.css       # One theme = one file of CSS variables
│       └── cleanslice.css
├── components/
│   └── ui/                   # shadcn-vue components
│       ├── button/
│       │   ├── Button.vue
│       │   └── index.ts      # exports Button + buttonVariants (cva)
│       ├── card/
│       ├── input/
│       └── ...
├── utils/
│   ├── index.ts
│   └── cn.ts                 # Class name merge utility
└── index.ts
```

`components.json` lives at the **app root**, not in the slice. The shadcn CLI reads it there, and the theme slice reads the `theme` key from it to pick the active theme file.

## Configuration

### Theme Slice nuxt.config.ts

```typescript [slices/setup/theme/nuxt.config.ts]
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';
import { readFileSync } from 'fs';
import tailwindcss from '@tailwindcss/vite';

const currentDir = dirname(fileURLToPath(import.meta.url));
const appRoot = resolve(currentDir, '../../..');

// Read the active theme name from components.json
const componentsJson = JSON.parse(
  readFileSync(resolve(appRoot, 'components.json'), 'utf-8'),
);
const themeName = componentsJson.tailwind?.theme || 'default';
const themeCss = `#theme/assets/themes/${themeName}.css`;

export default defineNuxtConfig({
  modules: ['shadcn-nuxt'],
  css: [themeCss, '#theme/assets/css/tailwind.css'],
  alias: {
    '#theme': currentDir,
  },
  vite: {
    plugins: [tailwindcss()],
  },
  shadcn: {
    prefix: '',
    componentDir: './slices/setup/theme/components/ui',
  },
  components: {
    dirs: [],
  },
});
```

The `shadcn-nuxt` module auto-imports every component inside `componentDir`. You use `<Button>`, `<Card>`, `<Input>` directly in templates without any import. The theme CSS is listed before `tailwind.css` so the variables exist when the token wiring reads them.

### tailwind.css

Tailwind v4 reads its design tokens from CSS. The `@theme inline` block maps every semantic token to a CSS variable that the theme file defines:

```css [slices/setup/theme/assets/css/tailwind.css]
@import "tailwindcss";
@import "tw-animate-css";

@custom-variant dark (&:is(.dark *));

@theme inline {
  --color-background: var(--background);
  --color-foreground: var(--foreground);
  --color-card: var(--card);
  --color-card-foreground: var(--card-foreground);
  --color-popover: var(--popover);
  --color-popover-foreground: var(--popover-foreground);
  --color-primary: var(--primary);
  --color-primary-foreground: var(--primary-foreground);
  --color-secondary: var(--secondary);
  --color-secondary-foreground: var(--secondary-foreground);
  --color-muted: var(--muted);
  --color-muted-foreground: var(--muted-foreground);
  --color-accent: var(--accent);
  --color-accent-foreground: var(--accent-foreground);
  --color-destructive: var(--destructive);
  --color-destructive-foreground: var(--destructive-foreground);
  --color-border: var(--border);
  --color-input: var(--input);
  --color-ring: var(--ring);
  --color-chart-1: var(--chart-1);
  /* ... chart-2..5, sidebar-* follow the same pattern */

  --font-sans: var(--font-sans);
  --font-mono: var(--font-mono);

  --radius-sm: calc(var(--radius) - 4px);
  --radius-md: calc(var(--radius) - 2px);
  --radius-lg: var(--radius);
  --radius-xl: calc(var(--radius) + 4px);
}

@layer base {
  * {
    @apply border-border outline-ring/50;
  }
  body {
    @apply bg-background text-foreground;
  }
}
```

Every `--color-*` entry becomes a utility family: `bg-primary`, `text-muted-foreground`, `border-border`. Adding a token means adding a variable to the theme file and one line here.

### Theme Files

A theme is a single CSS file with light values on `:root` and dark values on `.dark`. Colors use `oklch`, which is what shadcn-vue generates for Tailwind v4:

```css [slices/setup/theme/assets/themes/default.css]
:root {
  --radius: 0.625rem;
  --background: oklch(1 0 0);
  --foreground: oklch(0.145 0 0);
  --card: oklch(1 0 0);
  --card-foreground: oklch(0.145 0 0);
  --popover: oklch(1 0 0);
  --popover-foreground: oklch(0.145 0 0);
  --primary: oklch(0.205 0 0);
  --primary-foreground: oklch(0.985 0 0);
  --secondary: oklch(0.97 0 0);
  --secondary-foreground: oklch(0.205 0 0);
  --muted: oklch(0.97 0 0);
  --muted-foreground: oklch(0.556 0 0);
  --accent: oklch(0.97 0 0);
  --accent-foreground: oklch(0.205 0 0);
  --destructive: oklch(0.577 0.245 27.325);
  --border: oklch(0.922 0 0);
  --input: oklch(0.922 0 0);
  --ring: oklch(0.708 0 0);
  --chart-1: oklch(0.646 0.222 41.116);
  /* ... */
  --sidebar: oklch(0.985 0 0);
  --sidebar-foreground: oklch(0.145 0 0);
  /* ... */
}

.dark {
  --background: oklch(0.145 0 0);
  --foreground: oklch(0.985 0 0);
  --card: oklch(0.205 0 0);
  --primary: oklch(0.922 0 0);
  --primary-foreground: oklch(0.205 0 0);
  --border: oklch(1 0 0 / 10%);
  --input: oklch(1 0 0 / 15%);
  /* ... every token gets its dark value */
}
```

To switch themes, change `tailwind.theme` in `components.json`. To add one, drop a new file into `assets/themes/` and name it there. Generate a palette at [shadcn-vue.com/themes](https://www.shadcn-vue.com/themes) or [tweakcn](https://tweakcn.com/) and paste the variables.

### components.json

At the app root. It tells the shadcn CLI where components and utilities live, and names the active theme:

```json [components.json]
{
  "$schema": "https://shadcn-vue.com/schema.json",
  "style": "new-york",
  "typescript": true,
  "tailwind": {
    "config": "",
    "css": "slices/setup/theme/assets/css/tailwind.css",
    "baseColor": "neutral",
    "cssVariables": true,
    "prefix": "",
    "theme": "cleanslice"
  },
  "iconLibrary": "lucide",
  "aliases": {
    "components": "#theme/components",
    "utils": "#theme/utils",
    "ui": "#theme/components/ui",
    "lib": "#theme/utils",
    "composables": "#theme/composables"
  }
}
```

`tailwind.config` is empty on purpose: Tailwind v4 has no config file. The `theme` key is CleanSlice's addition and is read by the theme slice's `nuxt.config.ts`.

## Color Token Reference

| Token | Usage |
|-------|-------|
| `background` / `foreground` | Page background, default text |
| `card` / `card-foreground` | Card surfaces |
| `popover` / `popover-foreground` | Popovers, dropdowns |
| `primary` / `primary-foreground` | Primary actions, links |
| `secondary` / `secondary-foreground` | Secondary actions |
| `muted` / `muted-foreground` | Muted surfaces and text |
| `accent` / `accent-foreground` | Hover and highlight surfaces |
| `destructive` / `destructive-foreground` | Errors, delete actions |
| `border`, `input`, `ring` | Borders, input borders, focus rings |
| `chart-1` … `chart-5` | Data visualization series |
| `sidebar`, `sidebar-foreground`, `sidebar-primary`, `sidebar-accent`, `sidebar-border`, `sidebar-ring` | Sidebar surfaces |

Need a `success` or `warning` token? Add `--success` to each theme file and `--color-success: var(--success)` to `@theme inline`. Never write a raw color in a component; a color that is not a token cannot follow the theme or dark mode.

## The cn() Utility

The `cn()` function merges Tailwind classes intelligently, resolving conflicts (e.g., `p-2` vs `p-4`):

```typescript [slices/setup/theme/utils/cn.ts]
import type { ClassValue } from 'clsx';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
```

Inside a theme component it merges the variant classes with whatever the caller passes:

```vue
<script setup lang="ts">
import { cn } from '#theme/utils';

const props = defineProps<{ class?: string }>();
</script>

<template>
  <div :class="cn('rounded-lg border p-4', props.class)">
    <slot />
  </div>
</template>
```

### Variants with cva

Each component folder exports its variants from `index.ts` with `class-variance-authority`. Visual differences are variants, so a feature slice picks `variant="outline"` or `size="sm"` instead of restyling the component with classes:

```typescript [slices/setup/theme/components/ui/button/index.ts]
import type { VariantProps } from 'class-variance-authority';
import { cva } from 'class-variance-authority';

export { default as Button } from './Button.vue';

export const buttonVariants = cva(
  'inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50',
  {
    variants: {
      variant: {
        default: 'bg-primary text-primary-foreground hover:bg-primary/90',
        destructive: 'bg-destructive text-destructive-foreground hover:bg-destructive/90',
        outline: 'border border-input bg-background hover:bg-accent hover:text-accent-foreground',
        secondary: 'bg-secondary text-secondary-foreground hover:bg-secondary/80',
        ghost: 'hover:bg-accent hover:text-accent-foreground',
        link: 'text-primary underline-offset-4 hover:underline',
      },
      size: {
        default: 'h-10 px-4 py-2',
        sm: 'h-9 rounded-md px-3',
        lg: 'h-11 rounded-md px-8',
        icon: 'h-10 w-10',
      },
    },
    defaultVariants: { variant: 'default', size: 'default' },
  },
);

export type ButtonVariants = VariantProps<typeof buttonVariants>;
```

## Adding Components

### shadcn-vue CLI

With `components.json` at the app root, the CLI installs straight into the theme slice:

```bash
# Single component
bunx shadcn-vue@latest add button

# Multiple components at once
bunx shadcn-vue@latest add card input textarea dialog sonner
```

Check the catalog first. A component that exists in shadcn-vue is installed, not hand-written; a custom component goes into `components/ui/` only when the catalog has no equivalent, and it is built from the same primitives (`reka-ui`, `cva`, `cn`).

### Common Components to Install

```bash
bunx shadcn-vue@latest add button card input textarea select \
  checkbox switch form dropdown-menu navigation-menu tabs \
  breadcrumb alert alert-dialog sonner dialog sheet drawer \
  popover tooltip table avatar badge separator scroll-area
```

Browse the full list at [shadcn-vue.com/docs/components](https://www.shadcn-vue.com/docs/components).

## Using Components

### In Templates (Auto-Imported)

All UI components from the theme slice are auto-imported:

```vue
<template>
  <Card>
    <CardHeader>
      <CardTitle>User Profile</CardTitle>
    </CardHeader>
    <CardContent>
      <Input placeholder="Enter your name" />
      <Button class="mt-4">Save</Button>
    </CardContent>
  </Card>
</template>
```

`class="mt-4"` positions the button relative to its parent. That is layout and belongs to the caller. What the button looks like is a variant and belongs to the theme.

### Icons with Lucide

Import icons from `lucide-vue-next`:

```vue
<script setup lang="ts">
import { User, Settings, LogOut } from 'lucide-vue-next';
</script>

<template>
  <div class="flex gap-4">
    <User class="h-5 w-5" />
    <Settings class="h-5 w-5" />
    <LogOut class="h-5 w-5" />
  </div>
</template>
```

## Dark Mode

Dark mode is the `.dark` class on `<html>`. `tailwind.css` declares `@custom-variant dark (&:is(.dark *))`, so every `dark:` utility and every `.dark { ... }` token block follows that class.

The class is managed by `@nuxtjs/color-mode`, registered in the root `nuxt.config.ts` with an empty class suffix so the class is exactly `dark`:

```typescript [nuxt.config.ts]
export default defineNuxtConfig({
  modules: ['@nuxtjs/color-mode'],
  colorMode: {
    classSuffix: '',
    preference: 'system',
    fallback: 'system',
  },
});
```

A toggle reads and writes the module's composable; there is no hand-written dark-mode composable:

```vue
<script setup lang="ts">
import { Sun, Moon } from 'lucide-vue-next';

const colorMode = useColorMode();
const isDark = computed(() => colorMode.value === 'dark');

function toggle() {
  colorMode.preference = isDark.value ? 'light' : 'dark';
}
</script>

<template>
  <Button variant="ghost" size="icon" @click="toggle">
    <Sun v-if="isDark" class="h-5 w-5" />
    <Moon v-else class="h-5 w-5" />
  </Button>
</template>
```

The module persists the preference and applies the class before hydration, so there is no flash of the wrong theme.

::: tip
All UI components live exclusively in the theme slice. Feature slices use these components but do not define their own UI primitives. If you need a custom component that is shared across slices, add it to the theme slice.
:::

## What's Next?

- [Error Handling](/frontend/error-handling) -- Toast notifications use theme components
- [i18n](/frontend/i18n) -- Internationalize your UI text
- [Slice Structure](/frontend/slice-structure) -- Understand how theme components are consumed
