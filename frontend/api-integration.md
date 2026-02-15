# API Integration

CleanSlice generates a fully typed API client from your backend's OpenAPI/Swagger specification using [`@hey-api/openapi-ts`](https://github.com/hey-api/openapi-ts). This means your frontend SDK -- service classes, TypeScript types, and request/response schemas -- stays in sync with your NestJS API automatically.

## How It Works

The flow is straightforward:

1. Your NestJS API generates a `swagger-spec.json` file at startup
2. You run `npm run build:api` in the Nuxt app
3. `@hey-api/openapi-ts` reads the spec and generates TypeScript code
4. Feature slices import the generated services and types via the `#api` alias

```
NestJS API                    Nuxt App
─────────                     ────────
swagger-spec.json  ──build:api──>  slices/setup/api/data/repositories/api/
                                    ├── client.gen.ts    (Axios client)
                                    ├── sdk.gen.ts       (Service classes)
                                    ├── types.gen.ts     (TypeScript interfaces)
                                    └── schemas.gen.ts   (JSON schemas)
```

## Installation

```bash
# Code generator (dev dependency)
npm install -D @hey-api/openapi-ts

# Runtime client
npm install @hey-api/client-axios axios
```

Add the build script to your `package.json`:

```json [package.json]
{
  "scripts": {
    "build:api": "openapi-ts",
    "dev": "npm run build:api && nuxt dev",
    "build": "npm run build:api && nuxt build"
  }
}
```

## Configuration

### openapi-ts.config.ts

This root-level config tells the generator where to find the spec and where to write the output:

```typescript [openapi-ts.config.ts]
import { defineConfig } from '@hey-api/openapi-ts';

export default defineConfig({
  name: 'ApiClient',

  // Path to your API's OpenAPI spec
  // For local dev, this points to the neighboring api folder
  input: '../api/swagger-spec.json',

  output: {
    format: 'prettier',
    lint: 'eslint',
    path: './slices/setup/api/data/repositories/api',
  },

  plugins: [
    {
      // Use Axios as the HTTP client
      name: '@hey-api/client-axios',
      runtimeConfigPath: './slices/setup/api/api.config.ts',
    },
    {
      // Generate TypeScript enums
      enums: 'typescript',
      name: '@hey-api/typescript',
    },
    {
      // Generate JSON schemas
      name: '@hey-api/schemas',
      type: 'json',
    },
    {
      // Generate class-based service SDK
      name: '@hey-api/sdk',
      asClass: true,
    },
  ],
});
```

### api.config.ts

The client configuration sets the base URL for all API requests:

```typescript [slices/setup/api/api.config.ts]
import type { CreateClientConfig } from './data/repositories/api/client.gen';

export const createClientConfig: CreateClientConfig = (config) => ({
  ...config,
  baseURL: process.env.API_URL ?? 'http://localhost:3333',
});
```

### Slice nuxt.config.ts

The API slice registers the `#api` alias so other slices can import from it cleanly:

```typescript [slices/setup/api/nuxt.config.ts]
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const currentDir = dirname(fileURLToPath(import.meta.url));

export default defineNuxtConfig({
  alias: {
    '#api': currentDir,
  },
});
```

### Environment Variables

Set `API_URL` in your `.env` file:

```bash [.env]
API_URL=http://localhost:3333
```

For production builds, pass it as a build argument:

```bash
API_URL=https://api.yourapp.com npm run build
```

## Generated SDK Structure

Each API controller tag generates a service class:

| API Tag | Generated Class | Example Methods |
|---------|-----------------|-----------------|
| `Auth` | `AuthService` | `login()`, `register()`, `me()` |
| `Users` | `UsersService` | `getUsers()`, `getUser()`, `createUser()` |
| `Files` | `FilesService` | `uploadFile()`, `getFiles()`, `deleteFile()` |

The generated files:

```
slices/setup/api/data/repositories/api/
├── client.gen.ts       # Axios client instance
├── sdk.gen.ts          # Service classes (AuthService, UsersService, etc.)
├── types.gen.ts        # All DTOs and response types
├── schemas.gen.ts      # JSON schemas for validation
└── index.ts            # Barrel export
```

::: warning
The files in `data/repositories/api/` are auto-generated. Any manual edits are overwritten the next time you run `npm run build:api`.
:::

## Barrel Exports

The API slice re-exports generated code through barrel files so you can import everything from `#api/data`:

```typescript [slices/setup/api/data/index.ts]
export * from './repositories';
```

```typescript [slices/setup/api/data/repositories/index.ts]
export * from './api';
```

```typescript [slices/setup/api/index.ts]
export * from './data';
```

## Using the API SDK

### Importing Services and Types

Always use the `#api` alias. The generated types and services need explicit imports (they are not auto-imported):

```typescript
// Correct -- use the alias
import { AuthService, UsersService, type UserDto } from '#api/data';

// Wrong -- relative paths break when slices move
import { AuthService } from '../../../setup/api/data/repositories/api';
```

### Calling API Methods

```typescript
import { AuthService, UsersService, type UserDto } from '#api/data';

// Login
const loginResponse = await AuthService.login({
  body: {
    email: 'user@example.com',
    password: 'password123',
  },
});

// Get current user
const meResponse = await AuthService.me();
const user: UserDto = meResponse.data?.data;

// List users with pagination
const usersResponse = await UsersService.getUsers({
  query: { page: 1, limit: 10 },
});
```

### Using in Stores

```typescript [slices/user/auth/stores/auth.ts]
import { defineStore } from 'pinia';
import { AuthService, type AuthDto, type LoginUserDto } from '#api/data';
import { handleApiAuthentication } from '#api/utils/handleApiAuthentication';

export const useAuthStore = defineStore('auth', {
  state: () => ({
    auth: null as AuthDto | null,
    loading: false,
  }),

  actions: {
    async login(credentials: LoginUserDto): Promise<boolean> {
      try {
        this.loading = true;
        const response = await AuthService.login({
          body: credentials,
        });

        const authData = response.data?.data;
        if (authData) {
          this.auth = authData;
          handleApiAuthentication(authData.accessToken);
          return true;
        }
        return false;
      } catch (e) {
        console.error('Login failed', e);
        return false;
      } finally {
        this.loading = false;
      }
    },

    logout() {
      this.auth = null;
      handleApiAuthentication(); // Clears the auth header
    },
  },
});
```

### Using in Components

```vue [components/userList/Provider.vue]
<script setup lang="ts">
import { UsersService, type UserDto } from '#api/data';

const { data, pending } = useAsyncData('users', () =>
  UsersService.getUsers()
);

const users = computed<UserDto[]>(() => data.value?.data?.data || []);
</script>

<template>
  <div v-if="pending">Loading...</div>
  <ul v-else>
    <li v-for="user in users" :key="user.id">
      {{ user.name }} - {{ user.email }}
    </li>
  </ul>
</template>
```

## Authentication

### Setting the Auth Header

The `handleApiAuthentication` utility adds or removes the `Authorization` header on the Axios client:

```typescript [slices/setup/api/utils/handleApiAuthentication.ts]
import { client } from '../data/repositories/api/client.gen';

export const handleApiAuthentication = (token?: string) => {
  if (token) {
    client.instance.defaults.headers.common['Authorization'] =
      `Bearer ${token}`;
  } else {
    delete client.instance.defaults.headers.common['Authorization'];
  }
};
```

### API Interceptor Plugin

The API plugin sets up Axios interceptors that catch errors globally and route them through the [error handling](/frontend/error-handling) system:

```typescript [slices/setup/api/plugins/api.ts]
import { client } from '../data/repositories/api/client.gen';
import { defineNuxtPlugin } from '#app';
import type {
  AxiosError,
  AxiosResponse,
  InternalAxiosRequestConfig,
} from 'axios';

export default defineNuxtPlugin((nuxtApp) => {
  client.instance.interceptors.request.use(
    (config: InternalAxiosRequestConfig) => config,
    (error: AxiosError) => handleError(error)
  );

  client.instance.interceptors.response.use(
    (response: AxiosResponse) => response,
    (error: AxiosError) => handleError(error)
  );

  return { provide: { client } };
});
```

The `handleError` function is auto-imported from the error slice. It handles 401 token refresh, translates error codes via i18n, and shows toast notifications.

## Available Type Exports

The generated SDK exports all DTOs, response types, error types, and enums:

```typescript
import {
  // DTOs
  type UserDto,
  type CreateUserDto,
  type UpdateUserDto,
  type LoginUserDto,
  type RegisterUserDto,
  type AuthDto,

  // Response types
  type GetUsersResponse,
  type GetUserResponse,
  type LoginResponse,

  // Enums
  UserRole,
  UserStatus,
} from '#api/data';
```

## Regenerating the SDK

Run `npm run build:api` whenever:

- Backend API endpoints change
- DTOs are added or modified
- New controllers are added
- Swagger decorators are updated

### Development Workflow

```bash
# Terminal 1: Run the API (generates swagger-spec.json on start)
cd api && npm run start:dev

# Terminal 2: Run the app (regenerates SDK, then starts Nuxt)
cd app && npm run dev
```

::: tip
For CI/CD pipelines, you can fetch the spec from a URL instead of a local file:

```typescript
input: process.env.SWAGGER_URL || '../api/swagger-spec.json',
```
:::

## What's Next?

- [Error Handling](/frontend/error-handling) -- How API errors are caught and displayed
- [State Management](/frontend/state-management) -- Use API services inside Pinia stores
- [Dependency Injection](/frontend/dependency-injection) -- Wrap API calls in gateway abstractions
