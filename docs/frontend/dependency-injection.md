# Dependency Injection

CleanSlice uses [InversifyJS](https://inversify.io/) to bring dependency injection to the frontend. This lets you define gateway interfaces in a domain layer and swap implementations (real API, mock data, offline mode) without changing business logic or components.

## Why DI in the Frontend?

In a typical Vue/Nuxt app, components call API functions directly. This works for small apps, but as complexity grows you hit problems:

- **Testing** -- You cannot unit test business logic without hitting the network
- **Flexibility** -- Switching between real and mock data requires changing imports everywhere
- **Coupling** -- Components know about HTTP details, Axios, and API response shapes

Dependency injection solves these by introducing an abstraction layer:

```
Component  -->  Composable  -->  Service  -->  Gateway Interface
                                                    |
                                           +--------+--------+
                                           |                 |
                                     API Gateway       Mock Gateway
```

The service depends on a gateway *interface*, not a concrete implementation. At startup, the DI container wires the correct implementation.

## Installation

```bash
npm install inversify reflect-metadata
```

Your `tsconfig.json` must enable decorators (already done if you followed [Getting Started](/frontend/getting-started)):

```json [tsconfig.json]
{
  "compilerOptions": {
    "experimentalDecorators": true,
    "emitDecoratorMetadata": true,
    "verbatimModuleSyntax": false
  }
}
```

## Project Structure

The DI system spans two layers: the `setup/di` slice provides the container and tokens, while each feature slice registers its own bindings.

```
slices/
├── setup/
│   └── di/
│       ├── container.ts         # Singleton DI container
│       ├── types.ts             # Injection tokens (Symbols)
│       ├── index.ts             # Public exports
│       ├── nuxt.config.ts       # Slice config
│       └── plugins/
│           └── di.ts            # Nuxt plugin (creates container)
│
├── user/
│   ├── domain/
│   │   ├── user.gateway.ts      # Gateway interface
│   │   ├── user.service.ts      # Business logic
│   │   └── user.types.ts        # Domain types
│   ├── data/
│   │   ├── user.gateway.ts      # Real API implementation
│   │   └── mock.gateway.ts      # Mock implementation
│   ├── plugins/
│   │   └── di.ts                # Registers user bindings
│   └── composables/
│       └── useUser.ts           # Resolves from container
```

## Step 1: DI Setup Slice

### Injection Tokens

Tokens are unique symbols that identify what you are requesting from the container:

```typescript [slices/setup/di/types.ts]
export const TYPES = {
  // Core Infrastructure
  ApiClient: Symbol.for('ApiClient'),
  Logger: Symbol.for('Logger'),
  Config: Symbol.for('Config'),

  // User Slice
  UserGateway: Symbol.for('IUserGateway'),
  UserService: Symbol.for('UserService'),

  // Task Slice
  TaskGateway: Symbol.for('ITaskGateway'),
  TaskService: Symbol.for('TaskService'),

  // Auth Slice
  AuthGateway: Symbol.for('IAuthGateway'),
  AuthService: Symbol.for('AuthService'),
} as const;

export type TYPES = typeof TYPES;
```

::: tip
Add new tokens to this file whenever you create a new slice that uses DI. Keep them organized by slice.
:::

### Container

The container is a singleton that lives for the lifetime of the app:

```typescript [slices/setup/di/container.ts]
import 'reflect-metadata';
import { Container } from 'inversify';

class DIContainer {
  private static instance: Container | null = null;

  static getInstance(): Container {
    if (!DIContainer.instance) {
      DIContainer.instance = new Container({
        defaultScope: 'Singleton',
        autoBindInjectable: true,
      });
    }
    return DIContainer.instance;
  }

  static reset(): void {
    if (DIContainer.instance) {
      DIContainer.instance.unbindAll();
      DIContainer.instance = null;
    }
  }

  static isDevelopment(): boolean {
    return process.env.NODE_ENV === 'development';
  }

  static useMocks(): boolean {
    return process.env.NUXT_PUBLIC_USE_MOCKS === 'true';
  }
}

export const container = DIContainer.getInstance();
export { DIContainer };
```

### Public Exports

```typescript [slices/setup/di/index.ts]
export { container, DIContainer } from './container';
export { TYPES } from './types';
```

### Nuxt Config

```typescript [slices/setup/di/nuxt.config.ts]
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import type { Nitro } from 'nitropack';

const currentDir = dirname(fileURLToPath(import.meta.url));

export default defineNuxtConfig({
  alias: {
    '#di': currentDir,
  },
  hooks: {
    'nitro:build:before': (nitro: Nitro) => {
      nitro.options.moduleSideEffects.push('reflect-metadata');
    },
  },
  vite: {
    esbuild: {
      tsconfigRaw: {
        compilerOptions: {
          experimentalDecorators: true,
        },
      },
    },
  },
});
```

### Setup Plugin

```typescript [slices/setup/di/plugins/di.ts]
import { container } from '../container';

export function registerSetupDI(): void {
  // Register core infrastructure here: Logger, Config, ApiClient
  console.log('[DI] Setup slice registered');
}

export default defineNuxtPlugin(() => {
  registerSetupDI();
  return { provide: { container } };
});
```

## Step 2: Feature Slice with DI

### Gateway Interface (Domain Layer)

The gateway interface defines what operations are available. It knows nothing about HTTP or databases:

```typescript [slices/user/domain/user.gateway.ts]
import type {
  IUserData,
  ICreateUserData,
  IUpdateUserData,
} from './user.types';

export interface IUserGateway {
  findAll(): Promise<IUserData[]>;
  findById(id: string): Promise<IUserData | null>;
  create(data: ICreateUserData): Promise<IUserData>;
  update(id: string, data: IUpdateUserData): Promise<IUserData>;
  delete(id: string): Promise<void>;
}
```

### Domain Types

```typescript [slices/user/domain/user.types.ts]
export interface IUserData {
  id: string;
  email: string;
  name: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface ICreateUserData {
  email: string;
  name: string;
}

export interface IUpdateUserData {
  email?: string;
  name?: string;
}
```

### Real API Gateway (Data Layer)

The concrete implementation uses `$fetch` or the generated API SDK:

```typescript [slices/user/data/user.gateway.ts]
import { injectable } from 'inversify';
import type { IUserGateway } from '../domain/user.gateway';
import type {
  IUserData,
  ICreateUserData,
  IUpdateUserData,
} from '../domain/user.types';

@injectable()
export class UserGateway implements IUserGateway {
  private readonly baseUrl = '/api/users';

  async findAll(): Promise<IUserData[]> {
    return await $fetch<IUserData[]>(this.baseUrl);
  }

  async findById(id: string): Promise<IUserData | null> {
    try {
      return await $fetch<IUserData>(`${this.baseUrl}/${id}`);
    } catch (error: any) {
      if (error.statusCode === 404) return null;
      throw error;
    }
  }

  async create(data: ICreateUserData): Promise<IUserData> {
    return await $fetch<IUserData>(this.baseUrl, {
      method: 'POST',
      body: data,
    });
  }

  async update(id: string, data: IUpdateUserData): Promise<IUserData> {
    return await $fetch<IUserData>(`${this.baseUrl}/${id}`, {
      method: 'PATCH',
      body: data,
    });
  }

  async delete(id: string): Promise<void> {
    await $fetch(`${this.baseUrl}/${id}`, { method: 'DELETE' });
  }
}
```

### Mock Gateway

For development and testing, a mock implementation with simulated delays:

```typescript [slices/user/data/mock.gateway.ts]
import { injectable } from 'inversify';
import type { IUserGateway } from '../domain/user.gateway';
import type {
  IUserData,
  ICreateUserData,
  IUpdateUserData,
} from '../domain/user.types';

@injectable()
export class MockUserGateway implements IUserGateway {
  private users: IUserData[] = [
    {
      id: '1',
      email: 'john@example.com',
      name: 'John Doe',
      createdAt: new Date('2024-01-01'),
      updatedAt: new Date('2024-01-01'),
    },
    {
      id: '2',
      email: 'jane@example.com',
      name: 'Jane Smith',
      createdAt: new Date('2024-01-02'),
      updatedAt: new Date('2024-01-02'),
    },
  ];

  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  async findAll(): Promise<IUserData[]> {
    await this.delay(200);
    return [...this.users];
  }

  async findById(id: string): Promise<IUserData | null> {
    await this.delay(100);
    return this.users.find((u) => u.id === id) || null;
  }

  async create(data: ICreateUserData): Promise<IUserData> {
    await this.delay(300);
    const newUser: IUserData = {
      id: String(Date.now()),
      ...data,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    this.users.push(newUser);
    return newUser;
  }

  async update(id: string, data: IUpdateUserData): Promise<IUserData> {
    await this.delay(200);
    const index = this.users.findIndex((u) => u.id === id);
    if (index === -1) throw new Error('User not found');
    this.users[index] = {
      ...this.users[index],
      ...data,
      updatedAt: new Date(),
    };
    return this.users[index];
  }

  async delete(id: string): Promise<void> {
    await this.delay(200);
    this.users = this.users.filter((u) => u.id !== id);
  }
}
```

### Domain Service

The service contains business logic and depends on the gateway interface via `@inject`:

```typescript [slices/user/domain/user.service.ts]
import { injectable, inject } from 'inversify';
import { TYPES } from '#di';
import type { IUserGateway } from './user.gateway';
import type {
  IUserData,
  ICreateUserData,
  IUpdateUserData,
} from './user.types';

@injectable()
export class UserService {
  constructor(
    @inject(TYPES.UserGateway)
    private readonly userGateway: IUserGateway
  ) {}

  async getUsers(): Promise<IUserData[]> {
    return this.userGateway.findAll();
  }

  async getUserById(id: string): Promise<IUserData> {
    const user = await this.userGateway.findById(id);
    if (!user) throw new Error(`User with ID ${id} not found`);
    return user;
  }

  async createUser(data: ICreateUserData): Promise<IUserData> {
    const normalizedData = {
      ...data,
      email: data.email.toLowerCase().trim(),
      name: data.name.trim(),
    };
    return this.userGateway.create(normalizedData);
  }

  async updateUser(
    id: string,
    data: IUpdateUserData
  ): Promise<IUserData> {
    await this.getUserById(id); // Verify exists
    return this.userGateway.update(id, data);
  }

  async deleteUser(id: string): Promise<void> {
    await this.getUserById(id); // Verify exists
    return this.userGateway.delete(id);
  }
}
```

### Slice DI Registration Plugin

Each slice registers its own bindings via a plugin:

```typescript [slices/user/plugins/di.ts]
import { container, TYPES } from '#di';
import { UserService } from '../domain/user.service';
import type { IUserGateway } from '../domain/user.gateway';
import { UserGateway } from '../data/user.gateway';
import { MockUserGateway } from '../data/mock.gateway';

export function registerUserDI(useMocks: boolean = false): void {
  if (container.isBound(TYPES.UserGateway)) return;

  container
    .bind<IUserGateway>(TYPES.UserGateway)
    .to(useMocks ? MockUserGateway : UserGateway)
    .inSingletonScope();

  container
    .bind<UserService>(TYPES.UserService)
    .to(UserService)
    .inSingletonScope();

  console.log(`[DI] User slice registered (mocks: ${useMocks})`);
}
```

## Step 3: Wire Up All Slices

A root-level plugin calls all slice registration functions:

```typescript [plugins/di.client.ts]
import { container } from '#di';
import { registerUserDI } from '~/slices/user/plugins/di';
// import { registerTaskDI } from '~/slices/task/plugins/di';

export default defineNuxtPlugin(() => {
  const config = useRuntimeConfig();
  const useMocks = config.public.useMocks === 'true';

  registerUserDI(useMocks);
  // registerTaskDI(useMocks);

  console.log('[DI] All slices registered');

  return { provide: { container } };
});
```

### Environment Configuration

Toggle mocks via environment variables:

```bash [.env.development]
NUXT_PUBLIC_USE_MOCKS=true
```

```bash [.env.production]
NUXT_PUBLIC_USE_MOCKS=false
```

## Step 4: Composables Using DI

The composable resolves the service from the container and provides a reactive API:

```typescript [slices/user/composables/useUser.ts]
import { container, TYPES } from '#di';
import type { UserService } from '../domain/user.service';
import type {
  IUserData,
  ICreateUserData,
  IUpdateUserData,
} from '../domain/user.types';

export function useUser() {
  const userService = container.get<UserService>(TYPES.UserService);

  const users = ref<IUserData[]>([]);
  const currentUser = ref<IUserData | null>(null);
  const loading = ref(false);
  const error = ref<Error | null>(null);
  const userCount = computed(() => users.value.length);

  async function fetchUsers(): Promise<void> {
    loading.value = true;
    error.value = null;
    try {
      users.value = await userService.getUsers();
    } catch (e) {
      error.value = e instanceof Error ? e : new Error('Failed');
    } finally {
      loading.value = false;
    }
  }

  async function createUser(
    data: ICreateUserData
  ): Promise<IUserData | null> {
    loading.value = true;
    error.value = null;
    try {
      const newUser = await userService.createUser(data);
      users.value.push(newUser);
      return newUser;
    } catch (e) {
      error.value = e instanceof Error ? e : new Error('Failed');
      return null;
    } finally {
      loading.value = false;
    }
  }

  return {
    users,
    currentUser,
    loading,
    error,
    userCount,
    fetchUsers,
    createUser,
    clearError: () => {
      error.value = null;
    },
  };
}
```

## Step 5: Use in Components

```vue [slices/user/components/userList/Provider.vue]
<script setup lang="ts">
const {
  users,
  loading,
  error,
  userCount,
  fetchUsers,
  clearError,
} = useUser();

onMounted(() => fetchUsers());
</script>

<template>
  <div>
    <h2>Users ({{ userCount }})</h2>
    <div v-if="error" class="text-destructive">
      {{ error.message }}
      <Button variant="ghost" size="sm" @click="clearError">
        Dismiss
      </Button>
    </div>
    <div v-if="loading">Loading...</div>
    <div v-else-if="users.length === 0">No users found.</div>
    <ul v-else>
      <li v-for="user in users" :key="user.id">
        {{ user.name }} ({{ user.email }})
      </li>
    </ul>
  </div>
</template>
```

## Testing with DI

The biggest payoff of DI is testability. You create a fresh container per test and bind mock implementations:

```typescript [slices/user/domain/user.service.spec.ts]
import 'reflect-metadata';
import { Container } from 'inversify';
import { TYPES } from '#di';
import { UserService } from './user.service';
import type { IUserGateway } from './user.gateway';

describe('UserService', () => {
  let testContainer: Container;
  let userService: UserService;
  let mockGateway: jest.Mocked<IUserGateway>;

  beforeEach(() => {
    testContainer = new Container();

    mockGateway = {
      findAll: jest.fn(),
      findById: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    };

    testContainer
      .bind<IUserGateway>(TYPES.UserGateway)
      .toConstantValue(mockGateway);
    testContainer
      .bind<UserService>(TYPES.UserService)
      .to(UserService);

    userService = testContainer.get<UserService>(TYPES.UserService);
  });

  afterEach(() => testContainer.unbindAll());

  it('normalizes email on create', async () => {
    mockGateway.create.mockResolvedValue({
      id: '1',
      email: 'john@example.com',
      name: 'John',
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    await userService.createUser({
      email: '  JOHN@EXAMPLE.COM  ',
      name: '  John  ',
    });

    expect(mockGateway.create).toHaveBeenCalledWith({
      email: 'john@example.com',
      name: 'John',
    });
  });
});
```

## What's Next?

- [API Integration](/frontend/api-integration) -- Use the generated SDK inside gateway implementations
- [State Management](/frontend/state-management) -- Combine DI services with Pinia stores
- [Error Handling](/frontend/error-handling) -- Handle errors from DI services consistently
