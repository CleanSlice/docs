# Dependency Injection

The default data path in a CleanSlice app is short: a `Provider.vue` calls a Pinia store, and the store calls the generated API SDK from `#api`. Most slices need nothing more. See [State Management](/frontend/state-management) and [API Integration](/frontend/api-integration).

Dependency injection is the optional layer on top of that path. CleanSlice uses [InversifyJS](https://inversify.io/) for it. You reach for DI when a slice needs a **swappable adapter**: a mock gateway for development and tests, an offline implementation, a second transport, or a client-side domain service that carries real business policy and must be unit-tested without the network.

```
Default (no DI)          With DI
---------------          -------
Provider.vue             Provider.vue
   |                        |
Pinia store                Pinia store
   |                        |
#api SDK                 IUserGateway (interface, domain/)
                            |
                   +--------+--------+
                   |                 |
             UserGateway       MockUserGateway
             (#api SDK)        (in-memory)
```

The store depends on the gateway *interface*. At startup the container binds the implementation, and nothing above the store changes when the binding does.

::: tip When not to use it
If a slice has one real implementation and no client-side policy, do not add a gateway interface for symmetry. The SDK already is the typed contract; an interface over it that is never swapped is a second copy of the same shape.
:::

## Installation

```bash
bun add inversify reflect-metadata
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

The DI system spans two layers: the `setup/di` slice provides the container and tokens, while each feature slice that uses DI registers its own bindings.

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
│   │   ├── user.service.ts      # Optional: client-side business policy
│   │   └── user.types.ts        # Domain types
│   ├── data/
│   │   ├── user.gateway.ts      # Real implementation over the #api SDK
│   │   └── mock.gateway.ts      # Mock implementation
│   ├── plugins/
│   │   └── di.ts                # Registers user bindings
│   ├── stores/
│   │   └── user.ts              # Resolves the gateway from the container
│   └── components/
│       └── userList/
│           └── Provider.vue     # Calls the store
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
    return import.meta.env.DEV;
  }

  static useMocks(): boolean {
    return import.meta.env.VITE_USE_MOCKS === 'true';
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
}

export default defineNuxtPlugin(() => {
  registerSetupDI();
  return { provide: { container } };
});
```

## Step 2: Feature Slice with DI

### Gateway Interface (Domain Layer)

The gateway interface defines what operations are available. It knows nothing about HTTP:

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
  createdAt: string;
  updatedAt: string;
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

::: tip
Date-time fields arrive from the SDK as ISO strings (`format: date-time` maps to `string`). Keep them as strings in domain types and convert at the point of display.
:::

### Real Gateway (Data Layer)

The concrete implementation wraps the generated SDK. It is the only file in the slice that imports from `#api`:

```typescript [slices/user/data/user.gateway.ts]
import { injectable } from 'inversify';
import {
  getUsers,
  getUser,
  createUser,
  updateUser,
  deleteUser,
  type UserDto,
} from '#api';
import type { IUserGateway } from '../domain/user.gateway';
import type {
  IUserData,
  ICreateUserData,
  IUpdateUserData,
} from '../domain/user.types';

function toDomain(dto: UserDto): IUserData {
  return {
    id: dto.id,
    email: dto.email,
    name: dto.name,
    createdAt: dto.createdAt,
    updatedAt: dto.updatedAt,
  };
}

@injectable()
export class UserGateway implements IUserGateway {
  async findAll(): Promise<IUserData[]> {
    const { data } = await getUsers();
    return (data?.data ?? []).map(toDomain);
  }

  async findById(id: string): Promise<IUserData | null> {
    const { data } = await getUser({ path: { id } });
    return data ? toDomain(data) : null;
  }

  async create(input: ICreateUserData): Promise<IUserData> {
    const { data } = await createUser({ body: input });
    return toDomain(data!);
  }

  async update(id: string, input: IUpdateUserData): Promise<IUserData> {
    const { data } = await updateUser({ path: { id }, body: input });
    return toDomain(data!);
  }

  async delete(id: string): Promise<void> {
    await deleteUser({ path: { id } });
  }
}
```

### Mock Gateway

For development and tests, an in-memory implementation with simulated delays:

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
      createdAt: '2024-01-01T00:00:00.000Z',
      updatedAt: '2024-01-01T00:00:00.000Z',
    },
    {
      id: '2',
      email: 'jane@example.com',
      name: 'Jane Smith',
      createdAt: '2024-01-02T00:00:00.000Z',
      updatedAt: '2024-01-02T00:00:00.000Z',
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
    const now = new Date().toISOString();
    const newUser: IUserData = {
      id: String(Date.now()),
      ...data,
      createdAt: now,
      updatedAt: now,
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
      updatedAt: new Date().toISOString(),
    };
    return this.users[index];
  }

  async delete(id: string): Promise<void> {
    await this.delay(200);
    this.users = this.users.filter((u) => u.id !== id);
  }
}
```

### Domain Service (Optional)

Add a client-side service only when there is real policy to hold: normalization rules, decisions that must not live in a component, logic you want to unit-test against a mocked gateway. The service depends on the gateway interface via `@inject`. A slice with no such policy skips this file and the store calls the gateway directly.

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
import type { IUserGateway } from '../domain/user.gateway';
import { UserGateway } from '../data/user.gateway';
import { MockUserGateway } from '../data/mock.gateway';

export function registerUserDI(useMocks: boolean = false): void {
  if (container.isBound(TYPES.UserGateway)) return;

  container
    .bind<IUserGateway>(TYPES.UserGateway)
    .to(useMocks ? MockUserGateway : UserGateway)
    .inSingletonScope();

  // Only when the slice has a domain service:
  // container.bind<UserService>(TYPES.UserService).to(UserService).inSingletonScope();
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

  return { provide: { container } };
});
```

### Environment Configuration

Toggle mocks via the public runtime variable:

```bash [.env.development]
NUXT_PUBLIC_USE_MOCKS=true
```

```bash [.env.production]
NUXT_PUBLIC_USE_MOCKS=false
```

## Step 4: The Store Resolves the Gateway

State stays in Pinia, exactly as in a slice without DI. The only difference is where the store gets its data: from the container instead of importing `#api` directly. Resolve inside actions, not at module scope, so the store does not touch the container before the plugin has populated it.

```typescript [slices/user/stores/user.ts]
import { container, TYPES } from '#di';
import type { IUserGateway } from '../domain/user.gateway';
import type { IUserData, ICreateUserData } from '../domain/user.types';

export const useUserStore = defineStore('user', () => {
  const users = ref<IUserData[]>([]);
  const loading = ref(false);
  const error = ref<Error | null>(null);
  const userCount = computed(() => users.value.length);

  const gateway = () => container.get<IUserGateway>(TYPES.UserGateway);

  async function fetchUsers(): Promise<void> {
    loading.value = true;
    error.value = null;
    try {
      users.value = await gateway().findAll();
    } catch (e) {
      error.value = e instanceof Error ? e : new Error('Failed');
      throw e;
    } finally {
      loading.value = false;
    }
  }

  async function createUser(data: ICreateUserData): Promise<IUserData> {
    const created = await gateway().create(data);
    users.value.push(created);
    return created;
  }

  function clearError() {
    error.value = null;
  }

  return { users, loading, error, userCount, fetchUsers, createUser, clearError };
});
```

::: warning
Do not hold list state in a composable. A composable returns fresh refs on every call, so two components calling `useUser()` would each own a separate copy of the list. Shared state is a store; see [State Management](/frontend/state-management).
:::

## Step 5: Use in Components

The Provider is unchanged by DI. It loads through `useAsyncData`, which is SSR-safe and deduplicates by key, rather than through `onMounted`:

```vue [slices/user/components/userList/Provider.vue]
<script setup lang="ts">
const store = useUserStore();
const { users, loading, error, userCount } = storeToRefs(store);

// `.then(() => true)`: useAsyncData treats an undefined result as "nothing cached"
// and would re-run the request on every hydration.
await useAsyncData('users', () => store.fetchUsers().then(() => true));
</script>

<template>
  <div>
    <h2>Users ({{ userCount }})</h2>
    <div v-if="error" class="text-destructive">
      {{ error.message }}
      <Button variant="ghost" size="sm" @click="store.clearError">
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

The payoff of DI is testability. You create a fresh container per test and bind a mock gateway. The example tests the optional domain service; a store is tested the same way, with `setActivePinia(createPinia())` before `useUserStore()`.

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
      createdAt: '2024-01-01T00:00:00.000Z',
      updatedAt: '2024-01-01T00:00:00.000Z',
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

- [API Integration](/frontend/api-integration) -- The generated SDK that the real gateway wraps
- [State Management](/frontend/state-management) -- Stores are the same with or without DI
- [Error Handling](/frontend/error-handling) -- Handle errors from gateways consistently
