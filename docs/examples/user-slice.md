# Example: Building a User Slice

This walkthrough builds a complete user management feature from scratch — backend and frontend — following all CleanSlice patterns. By the end, you'll have a working API with CRUD endpoints and a frontend that displays, creates, and manages users.

## What You'll Build

- **Backend:** A `user` slice with controller, gateway, mapper, DTOs, and domain types
- **Frontend:** A `user` slice with pages, components, a Pinia store, and i18n
- **Database:** A Prisma schema for the `User` model

## Step 1: Database Schema

Add the User model to your Prisma schema:

```prisma
// api/prisma/schema.prisma
model User {
  id        String   @id @default(uuid())
  email     String   @unique
  name      String
  status    String   @default("active")
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
}
```

Run the migration:

```bash
cd api
npx prisma migrate dev --name add-user
```

## Step 2: Backend — Domain Layer

Create the domain folder and define your types and gateway contract.

### Types

```typescript
// api/src/slices/user/domain/user.types.ts
export enum UserStatusTypes {
  Active = 'active',
  Inactive = 'inactive',
  Pending = 'pending',
}

export interface IUserData {
  id: string;
  email: string;
  name: string;
  status: UserStatusTypes;
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
  status?: UserStatusTypes;
}

export interface IUserFilter {
  search?: string;
  status?: UserStatusTypes;
  page?: number;
  perPage?: number;
}
```

### Gateway Interface

```typescript
// api/src/slices/user/domain/user.gateway.ts
import { IUserData, ICreateUserData, IUpdateUserData, IUserFilter } from './user.types';

export abstract class IUserGateway {
  abstract findAll(filter?: IUserFilter): Promise<IUserData[]>;
  abstract findById(id: string): Promise<IUserData | null>;
  abstract create(data: ICreateUserData): Promise<IUserData>;
  abstract update(id: string, data: IUpdateUserData): Promise<IUserData>;
  abstract delete(id: string): Promise<void>;
}
```

### Barrel Export

```typescript
// api/src/slices/user/domain/index.ts
export { IUserGateway } from './user.gateway';
export type { IUserData, ICreateUserData, IUpdateUserData, IUserFilter } from './user.types';
export { UserStatusTypes } from './user.types';
```

## Step 3: Backend — Data Layer

### Mapper

```typescript
// api/src/slices/user/data/user.mapper.ts
import { Injectable } from '@nestjs/common';
import { User as PrismaUser } from '@prisma/client';
import { IUserData, ICreateUserData, IUpdateUserData, UserStatusTypes } from '../domain';

@Injectable()
export class UserMapper {
  toDomain(user: PrismaUser): IUserData {
    return {
      id: user.id,
      email: user.email,
      name: user.name,
      status: user.status as UserStatusTypes,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
    };
  }

  toCreate(data: ICreateUserData): { email: string; name: string } {
    return {
      email: data.email.toLowerCase().trim(),
      name: data.name.trim(),
    };
  }

  toUpdate(data: IUpdateUserData): Record<string, unknown> {
    const result: Record<string, unknown> = {};
    if (data.email !== undefined) result.email = data.email.toLowerCase().trim();
    if (data.name !== undefined) result.name = data.name.trim();
    if (data.status !== undefined) result.status = data.status;
    return result;
  }
}
```

### Gateway Implementation

```typescript
// api/src/slices/user/data/user.gateway.ts
import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '#prisma';
import { IUserGateway } from '../domain/user.gateway';
import { IUserData, ICreateUserData, IUpdateUserData, IUserFilter } from '../domain';
import { UserMapper } from './user.mapper';

@Injectable()
export class UserGateway extends IUserGateway {
  constructor(
    private readonly prisma: PrismaService,
    private readonly mapper: UserMapper,
  ) {
    super();
  }

  async findAll(filter?: IUserFilter): Promise<IUserData[]> {
    const where: Prisma.UserWhereInput = {};

    if (filter?.search) {
      where.OR = [
        { name: { contains: filter.search, mode: 'insensitive' } },
        { email: { contains: filter.search, mode: 'insensitive' } },
      ];
    }
    if (filter?.status) {
      where.status = filter.status;
    }

    const users = await this.prisma.user.findMany({
      where,
      skip: filter?.page && filter?.perPage ? (filter.page - 1) * filter.perPage : undefined,
      take: filter?.perPage,
      orderBy: { createdAt: 'desc' },
    });

    return users.map((u) => this.mapper.toDomain(u));
  }

  async findById(id: string): Promise<IUserData | null> {
    const user = await this.prisma.user.findUnique({ where: { id } });
    return user ? this.mapper.toDomain(user) : null;
  }

  async create(data: ICreateUserData): Promise<IUserData> {
    const user = await this.prisma.user.create({
      data: this.mapper.toCreate(data),
    });
    return this.mapper.toDomain(user);
  }

  async update(id: string, data: IUpdateUserData): Promise<IUserData> {
    const user = await this.prisma.user.update({
      where: { id },
      data: this.mapper.toUpdate(data),
    });
    return this.mapper.toDomain(user);
  }

  async delete(id: string): Promise<void> {
    await this.prisma.user.delete({ where: { id } });
  }
}
```

## Step 4: Backend — DTOs

```typescript
// api/src/slices/user/dtos/createUser.dto.ts
import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsString, MinLength } from 'class-validator';

export class CreateUserDto {
  @ApiProperty({ example: 'john@example.com' })
  @IsEmail()
  email: string;

  @ApiProperty({ example: 'John Doe' })
  @IsString()
  @MinLength(2)
  name: string;
}
```

```typescript
// api/src/slices/user/dtos/updateUser.dto.ts
import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsEmail, IsString, IsOptional, IsEnum, MinLength } from 'class-validator';
import { UserStatusTypes } from '../domain';

export class UpdateUserDto {
  @ApiPropertyOptional({ example: 'john@example.com' })
  @IsEmail()
  @IsOptional()
  email?: string;

  @ApiPropertyOptional({ example: 'John Doe' })
  @IsString()
  @MinLength(2)
  @IsOptional()
  name?: string;

  @ApiPropertyOptional({ enum: UserStatusTypes })
  @IsEnum(UserStatusTypes)
  @IsOptional()
  status?: UserStatusTypes;
}
```

```typescript
// api/src/slices/user/dtos/user.dto.ts
import { ApiProperty } from '@nestjs/swagger';
import { IUserData, UserStatusTypes } from '../domain';

export class UserDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  email: string;

  @ApiProperty()
  name: string;

  @ApiProperty({ enum: UserStatusTypes })
  status: UserStatusTypes;

  @ApiProperty()
  createdAt: string;

  constructor(user: IUserData) {
    this.id = user.id;
    this.email = user.email;
    this.name = user.name;
    this.status = user.status;
    this.createdAt = user.createdAt.toISOString();
  }
}
```

```typescript
// api/src/slices/user/dtos/index.ts
export { CreateUserDto } from './createUser.dto';
export { UpdateUserDto } from './updateUser.dto';
export { UserDto } from './user.dto';
```

## Step 5: Backend — Controller

```typescript
// api/src/slices/user/user.controller.ts
import { Controller, Get, Post, Patch, Delete, Param, Body, Query } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { IUserGateway } from './domain';
import { CreateUserDto, UpdateUserDto, UserDto } from './dtos';

@ApiTags('users')
@Controller('users')
export class UserController {
  constructor(private readonly gateway: IUserGateway) {}

  @ApiOperation({ operationId: 'getUsers', summary: 'List all users' })
  @Get()
  async findAll(): Promise<UserDto[]> {
    const users = await this.gateway.findAll();
    return users.map((u) => new UserDto(u));
  }

  @ApiOperation({ operationId: 'getUser', summary: 'Get user by ID' })
  @Get(':id')
  async findOne(@Param('id') id: string): Promise<UserDto> {
    const user = await this.gateway.findById(id);
    if (!user) throw new Error('User not found');
    return new UserDto(user);
  }

  @ApiOperation({ operationId: 'createUser', summary: 'Create a new user' })
  @Post()
  async create(@Body() dto: CreateUserDto): Promise<UserDto> {
    const user = await this.gateway.create(dto);
    return new UserDto(user);
  }

  @ApiOperation({ operationId: 'updateUser', summary: 'Update a user' })
  @Patch(':id')
  async update(@Param('id') id: string, @Body() dto: UpdateUserDto): Promise<UserDto> {
    const user = await this.gateway.update(id, dto);
    return new UserDto(user);
  }

  @ApiOperation({ operationId: 'deleteUser', summary: 'Delete a user' })
  @Delete(':id')
  async remove(@Param('id') id: string): Promise<void> {
    await this.gateway.delete(id);
  }
}
```

## Step 6: Backend — Module

```typescript
// api/src/slices/user/user.module.ts
import { Module } from '@nestjs/common';
import { UserController } from './user.controller';
import { IUserGateway } from './domain/user.gateway';
import { UserGateway } from './data/user.gateway';
import { UserMapper } from './data/user.mapper';

@Module({
  controllers: [UserController],
  providers: [
    { provide: IUserGateway, useClass: UserGateway },
    UserMapper,
  ],
  exports: [
    { provide: IUserGateway, useClass: UserGateway },
  ],
})
export class UserModule {}
```

Register it in `api/src/app.module.ts`:

```typescript
import { UserModule } from '#user/user.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    PrismaModule,
    UserModule,  // Add this
  ],
})
export class AppModule {}
```

## Step 7: Frontend — Store

```typescript
// app/slices/user/stores/user.ts
import { defineStore } from 'pinia';
import { UsersService, type UserDto, type CreateUserDto } from '#api';

export const useUserStore = defineStore('user', () => {
  const users = ref<UserDto[]>([]);
  const currentUser = ref<UserDto | null>(null);
  const loading = ref(false);

  async function fetchAll(): Promise<void> {
    loading.value = true;
    try {
      const response = await UsersService.getUsers();
      users.value = response.data;
    } finally {
      loading.value = false;
    }
  }

  async function fetchById(id: string): Promise<void> {
    loading.value = true;
    try {
      const response = await UsersService.getUser({ id });
      currentUser.value = response.data;
    } finally {
      loading.value = false;
    }
  }

  async function create(data: CreateUserDto): Promise<UserDto> {
    const response = await UsersService.createUser({ requestBody: data });
    users.value.unshift(response.data);
    return response.data;
  }

  async function remove(id: string): Promise<void> {
    await UsersService.deleteUser({ id });
    users.value = users.value.filter((u) => u.id !== id);
    if (currentUser.value?.id === id) currentUser.value = null;
  }

  return { users, currentUser, loading, fetchAll, fetchById, create, remove };
});
```

## Step 8: Frontend — Components

### Provider

```vue
<!-- app/slices/user/components/userList/Provider.vue -->
<script setup lang="ts">
const store = useUserStore();
await store.fetchAll();
</script>

<template>
  <div v-if="store.loading" class="flex justify-center p-8">
    <span class="text-muted-foreground">Loading users...</span>
  </div>
  <div v-else-if="store.users.length === 0" class="text-center p-8">
    <p class="text-muted-foreground">No users yet.</p>
  </div>
  <div v-else class="space-y-3">
    <UserListThumb
      v-for="user in store.users"
      :key="user.id"
      :user="user"
      @delete="store.remove(user.id)"
    />
  </div>
</template>
```

### List Item

```vue
<!-- app/slices/user/components/userList/Thumb.vue -->
<script setup lang="ts">
import type { UserDto } from '#api';

defineProps<{ user: UserDto }>();
defineEmits<{ delete: [] }>();
</script>

<template>
  <div class="flex items-center justify-between p-4 border rounded-lg">
    <div>
      <h3 class="font-semibold">{{ user.name }}</h3>
      <p class="text-sm text-muted-foreground">{{ user.email }}</p>
    </div>
    <div class="flex items-center gap-2">
      <span class="text-xs px-2 py-1 rounded-full bg-muted">{{ user.status }}</span>
      <NuxtLink :to="`/users/${user.id}`" class="text-sm text-primary hover:underline">
        View
      </NuxtLink>
      <button class="text-sm text-destructive hover:underline" @click="$emit('delete')">
        Delete
      </button>
    </div>
  </div>
</template>
```

## Step 9: Frontend — Pages

```vue
<!-- app/slices/user/pages/users.vue -->
<script setup lang="ts">
definePageMeta({ layout: 'default' });
</script>

<template>
  <div class="container mx-auto p-6">
    <div class="flex items-center justify-between mb-6">
      <h1 class="text-2xl font-bold">Users</h1>
      <NuxtLink to="/users/create">
        <Button>Create User</Button>
      </NuxtLink>
    </div>
    <UserListProvider />
  </div>
</template>
```

```vue
<!-- app/slices/user/pages/users/[id].vue -->
<script setup lang="ts">
const route = useRoute();
const id = route.params.id as string;

const store = useUserStore();
await store.fetchById(id);
</script>

<template>
  <div class="container mx-auto p-6">
    <NuxtLink to="/users" class="text-sm text-muted-foreground hover:underline mb-4 block">
      &larr; Back to Users
    </NuxtLink>
    <div v-if="store.currentUser" class="max-w-lg">
      <h1 class="text-2xl font-bold mb-2">{{ store.currentUser.name }}</h1>
      <p class="text-muted-foreground mb-4">{{ store.currentUser.email }}</p>
      <dl class="grid grid-cols-2 gap-4">
        <div>
          <dt class="text-sm font-medium text-muted-foreground">Status</dt>
          <dd>{{ store.currentUser.status }}</dd>
        </div>
        <div>
          <dt class="text-sm font-medium text-muted-foreground">Created</dt>
          <dd>{{ store.currentUser.createdAt }}</dd>
        </div>
      </dl>
    </div>
  </div>
</template>
```

## Step 10: Frontend — Slice Config

```typescript
// app/slices/user/nuxt.config.ts
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const currentDir = dirname(fileURLToPath(import.meta.url));

export default defineNuxtConfig({
  alias: {
    '#user': currentDir,
  },
});
```

Register the slice in the root config:

```typescript
// app/nuxt.config.ts
export default defineNuxtConfig({
  extends: [
    './slices/setup/theme',
    './slices/setup/pinia',
    './slices/setup/api',
    './slices/setup/error',
    './slices/setup/i18n',
    './slices/user',       // Add this
  ],
});
```

## Final Structure

```
api/src/slices/user/
├── user.module.ts
├── user.controller.ts
├── domain/
│   ├── index.ts
│   ├── user.types.ts
│   └── user.gateway.ts
├── data/
│   ├── user.gateway.ts
│   └── user.mapper.ts
└── dtos/
    ├── index.ts
    ├── user.dto.ts
    ├── createUser.dto.ts
    └── updateUser.dto.ts

app/slices/user/
├── nuxt.config.ts
├── pages/
│   ├── users.vue
│   └── users/[id].vue
├── components/
│   └── userList/
│       ├── Provider.vue
│       └── Thumb.vue
└── stores/
    └── user.ts
```

## Verification

1. Start the API: `cd api && npm run start:dev`
2. Check Swagger: Open `http://localhost:4000/api` — you should see all user endpoints
3. Generate the SDK: `npx @hey-api/openapi-ts -i http://localhost:4000/api-json -o app/slices/setup/api/data/repositories/api -c axios`
4. Start the app: `cd app && npm run dev`
5. Visit `http://localhost:3000/users` — the user list page should render

## What's Next?

- [Backend Patterns](/backend/controllers) — Explore more controller and gateway patterns
- [Frontend Patterns](/frontend/state-management) — Advanced store and component patterns
- [Architecture](/architecture/overview) — Understand the principles behind this structure
