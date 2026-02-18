# UI Components

CleanSlice uses [shadcn-vue](https://www.shadcn-vue.com/) for UI components and [Tailwind CSS](https://tailwindcss.com/) for styling. The `setup/theme` slice serves as the design system foundation -- it configures Tailwind, hosts all shared UI components, and defines CSS variables for theming and dark mode.

## Why a Theme Slice?

UI components are shared infrastructure, not feature code. By centralizing them in a single theme slice, you get:

- **Consistency** -- Every feature slice uses the same Button, Card, Input, etc.
- **Single source of truth** -- Color tokens, spacing, and typography live in one place
- **Dark mode for free** -- CSS variables swap values when the `.dark` class is toggled
- **Auto-import** -- The `shadcn-nuxt` module registers all UI components globally

## Installation

```bash
# Tailwind and shadcn
npm install -D @nuxtjs/tailwindcss shadcn-nuxt tailwindcss-animate
npm install -D @tailwindcss/typography sass sass-loader vite-svg-loader

# Runtime dependencies
npm install clsx tailwind-merge lucide-vue-next
npm install vee-validate @vee-validate/zod zod vaul-vue

# Optional: web fonts
npm install webfontloader
npm install -D @types/webfontloader
```

## Slice Structure

```
slices/setup/theme/
├── nuxt.config.ts            # Module registration + alias
├── tailwind.config.js        # Tailwind configuration
├── components.json           # shadcn-vue CLI config
├── assets/
│   ├── css/
│   │   └── tailwind.css      # Tailwind directives + CSS variables
│   └── scss/
│       └── main.scss         # Custom global styles
├── components/
│   └── ui/                   # shadcn-vue components
│       ├── button/
│       ├── card/
│       ├── input/
│       ├── dialog/
│       ├── toast/
│       └── ...
├── plugins/
│   └── fonts.ts              # Web font loading
├── utils/
│   ├── index.ts
│   └── cn.ts                 # Class name merge utility
└── index.ts
```

## Configuration

### Theme Slice nuxt.config.ts

```typescript [slices/setup/theme/nuxt.config.ts]
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import svgLoader from 'vite-svg-loader';

const currentDir = dirname(fileURLToPath(import.meta.url));

export default defineNuxtConfig({
  modules: ['@nuxtjs/tailwindcss', 'shadcn-nuxt'],
  css: ['#theme/assets/scss/main.scss'],
  alias: {
    '#theme': currentDir,
  },
  tailwindcss: {
    cssPath: '#theme/assets/css/tailwind.css',
    configPath: './tailwind.config',
  },
  vite: {
    plugins: [svgLoader()],
  },
  shadcn: {
    prefix: '',
    componentDir: './slices/setup/theme/components/ui',
  },
});
```

The `shadcn-nuxt` module auto-imports every component inside `componentDir`. You use `<Button>`, `<Card>`, `<Input>` directly in templates without any import.

### tailwind.config.js

The Tailwind config maps semantic color names to CSS variables, enabling dark mode and theme customization:

```javascript [slices/setup/theme/tailwind.config.js]
const animate = require('tailwindcss-animate');

/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: ['class'],
  safelist: ['dark'],

  theme: {
    container: {
      center: true,
      padding: '2rem',
      screens: { '2xl': '1400px' },
    },
    extend: {
      fontFamily: {
        manrope: ['Manrope', 'sans-serif'],
      },
      colors: {
        border: 'hsl(var(--border))',
        input: 'hsl(var(--input))',
        ring: 'hsl(var(--ring))',
        background: 'hsl(var(--background))',
        foreground: 'hsl(var(--foreground))',
        primary: {
          DEFAULT: 'hsl(var(--primary))',
          foreground: 'hsl(var(--primary-foreground))',
        },
        secondary: {
          DEFAULT: 'hsl(var(--secondary))',
          foreground: 'hsl(var(--secondary-foreground))',
        },
        destructive: {
          DEFAULT: 'hsl(var(--destructive))',
          foreground: 'hsl(var(--destructive-foreground))',
        },
        success: {
          DEFAULT: 'hsl(var(--success))',
          foreground: 'hsl(var(--success-foreground))',
        },
        warning: {
          DEFAULT: 'hsl(var(--warning))',
          foreground: 'hsl(var(--warning-foreground))',
        },
        info: {
          DEFAULT: 'hsl(var(--info))',
          foreground: 'hsl(var(--info-foreground))',
        },
        muted: {
          DEFAULT: 'hsl(var(--muted))',
          foreground: 'hsl(var(--muted-foreground))',
        },
        accent: {
          DEFAULT: 'hsl(var(--accent))',
          foreground: 'hsl(var(--accent-foreground))',
        },
        popover: {
          DEFAULT: 'hsl(var(--popover))',
          foreground: 'hsl(var(--popover-foreground))',
        },
        card: {
          DEFAULT: 'hsl(var(--card))',
          foreground: 'hsl(var(--card-foreground))',
        },
      },
      borderRadius: {
        xl: 'calc(var(--radius) + 4px)',
        lg: 'var(--radius)',
        md: 'calc(var(--radius) - 2px)',
        sm: 'calc(var(--radius) - 4px)',
      },
    },
  },
  plugins: [animate, require('@tailwindcss/typography')],
};
```

## CSS Variables

The CSS variables define your color palette. Light and dark themes are separate sets of values:

```css [slices/setup/theme/assets/css/tailwind.css]
@tailwind base;
@tailwind components;
@tailwind utilities;

@layer base {
  :root {
    --background: 0 0% 100%;
    --foreground: 222.2 84% 4.9%;
    --muted: 210 40% 96.1%;
    --muted-foreground: 215.4 16.3% 46.9%;
    --popover: 0 0% 100%;
    --popover-foreground: 222.2 84% 4.9%;
    --card: 0 0% 100%;
    --card-foreground: 222.2 84% 4.9%;
    --border: 214.3 31.8% 91.4%;
    --input: 214.3 31.8% 91.4%;
    --primary: 222.2 47.4% 11.2%;
    --primary-foreground: 210 40% 98%;
    --secondary: 210 40% 96.1%;
    --secondary-foreground: 222.2 47.4% 11.2%;
    --accent: 210 40% 96.1%;
    --accent-foreground: 222.2 47.4% 11.2%;
    --destructive: 0 84.2% 60.2%;
    --destructive-foreground: 210 40% 98%;
    --success: 120 60% 35%;
    --success-foreground: 120 40% 98%;
    --warning: 40 90% 50%;
    --warning-foreground: 40 60% 98%;
    --info: 200 85% 50%;
    --info-foreground: 200 40% 98%;
    --ring: 222.2 84% 4.9%;
    --radius: 0.5rem;

    /* Sidebar-specific tokens */
    --sidebar-background: 0 0% 98%;
    --sidebar-foreground: 240 5.3% 26.1%;
    --sidebar-primary: 240 5.9% 10%;
    --sidebar-primary-foreground: 0 0% 98%;
    --sidebar-accent: 240 4.8% 95.9%;
    --sidebar-accent-foreground: 240 5.9% 10%;
    --sidebar-border: 220 13% 91%;
    --sidebar-ring: 217.2 91.2% 59.8%;
  }

  /* Dark theme overrides go here with inverted values */
}

@layer base {
  * {
    @apply border-border;
  }
  body {
    @apply bg-background text-foreground font-manrope;
  }
}
```

## Color Token Reference

| Token | Usage | Sidebar Variant |
|-------|-------|-----------------|
| `background` | Page background | `sidebar-background` |
| `foreground` | Default text | `sidebar-foreground` |
| `primary` | Primary actions, links | `sidebar-primary` |
| `secondary` | Secondary actions | -- |
| `muted` | Muted backgrounds | -- |
| `accent` | Highlights | `sidebar-accent` |
| `destructive` | Errors, delete actions | -- |
| `success` | Success states | -- |
| `warning` | Warning states | -- |
| `info` | Informational states | -- |
| `card` | Card backgrounds | -- |
| `popover` | Popover/dropdown backgrounds | -- |
| `border` | Border colors | `sidebar-border` |
| `ring` | Focus rings | `sidebar-ring` |

## The cn() Utility

The `cn()` function merges Tailwind classes intelligently, resolving conflicts (e.g., `p-2` vs `p-4`):

```typescript [slices/setup/theme/utils/cn.ts]
import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
```

Use it in components to merge user-provided classes with defaults:

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

## Adding Components

### shadcn-vue CLI

Before running the CLI, copy the config file to your app root:

```bash
cp slices/setup/theme/components.json ./components.json
```

Then install components:

```bash
# Single component
npx shadcn-vue@latest add button

# Multiple components at once
npx shadcn-vue@latest add card input textarea dialog toast
```

### components.json

This file tells the shadcn CLI where to put components and where to find utilities:

```json [components.json]
{
  "$schema": "https://shadcn-vue.com/schema.json",
  "style": "default",
  "typescript": true,
  "tailwind": {
    "config": "tailwind.config.js",
    "css": "slices/setup/theme/assets/css/tailwind.css",
    "baseColor": "slate",
    "cssVariables": true
  },
  "framework": "nuxt",
  "aliases": {
    "components": "~/slices/setup/theme/components",
    "utils": "~/slices/setup/theme/utils/cn"
  }
}
```

### Common Components to Install

```bash
npx shadcn-vue@latest add button card input textarea select \
  checkbox switch form dropdown-menu navigation-menu tabs \
  breadcrumb alert alert-dialog toast sonner dialog sheet \
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

Dark mode is toggled by adding or removing the `.dark` class on the `<html>` element. The Tailwind config is set to `darkMode: ['class']`, so all `dark:` variants work automatically.

Here is a composable for managing dark mode:

```typescript [composables/useDarkMode.ts]
export function useDarkMode() {
  const isDark = ref(false);

  onMounted(() => {
    const stored = localStorage.getItem('darkMode');
    const prefersDark = window.matchMedia(
      '(prefers-color-scheme: dark)'
    ).matches;
    isDark.value = stored === 'true' || (stored === null && prefersDark);
    document.documentElement.classList.toggle('dark', isDark.value);
  });

  const toggle = () => {
    isDark.value = !isDark.value;
    document.documentElement.classList.toggle('dark', isDark.value);
    localStorage.setItem('darkMode', String(isDark.value));
  };

  return { isDark, toggle };
}
```

Use it in a toggle button:

```vue
<script setup lang="ts">
import { Sun, Moon } from 'lucide-vue-next';

const { isDark, toggle } = useDarkMode();
</script>

<template>
  <Button variant="ghost" size="icon" @click="toggle">
    <Sun v-if="isDark" class="h-5 w-5" />
    <Moon v-else class="h-5 w-5" />
  </Button>
</template>
```

## Font Loading

The theme slice includes a plugin for loading web fonts:

```typescript [slices/setup/theme/plugins/fonts.ts]
export default defineNuxtPlugin(async (nuxtApp) => {
  const webFontLoader = await import('webfontloader');

  webFontLoader.load({
    google: {
      families: ['Manrope:100,300,400,500,700,900&display=swap'],
    },
  });
});
```

::: tip
All UI components live exclusively in the theme slice. Feature slices use these components but do not define their own UI primitives. If you need a custom component that is shared across slices, add it to the theme slice.
:::

## What's Next?

- [Error Handling](/frontend/error-handling) -- Toast notifications use theme components
- [i18n](/frontend/i18n) -- Internationalize your UI text
- [Slice Structure](/frontend/slice-structure) -- Understand how theme components are consumed
