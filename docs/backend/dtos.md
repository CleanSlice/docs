# DTOs

DTOs (Data Transfer Objects) define the shape of your API's input and output. They sit at the boundary between external clients and your application, handling validation for incoming data and documentation for outgoing data.

## Why DTOs and Not Just Types?

Domain types (in `domain/`) define data shapes for your internal business logic. DTOs add two things on top:

1. **Validation** -- `class-validator` decorators that reject malformed requests before they reach your service.
2. **API documentation** -- `@ApiProperty` decorators that generate Swagger schemas and feed the frontend SDK generator.

DTOs implement domain interfaces, which keeps them in sync with the rest of the slice.

## DTO Types

| Type | Purpose | Implements | Has Validation | Example |
|---|---|---|---|---|
| Response | API response shape | `IUserData` | No | `UserDto` |
| Create | Create request body | `ICreateUserData` | Yes | `CreateUserDto` |
| Update | Update request body | `IUpdateUserData` | Yes | `UpdateUserDto` |
| Filter | Query parameters | `IUserFilter` | Yes | `FilterUserDto` |

## File Location

```
slices/user/
├── domain/
│   └── user.types.ts          # IUserData, ICreateUserData, etc.
└── dtos/
    ├── index.ts               # Barrel export
    ├── user.dto.ts            # Response DTO
    ├── createUser.dto.ts      # Create request DTO
    ├── updateUser.dto.ts      # Update request DTO
    └── filterUser.dto.ts      # Filter/query DTO
```

## Response DTO

Response DTOs define what the API sends back. They implement the domain data interface and use `@ApiProperty` for Swagger documentation. They do not need validation decorators.

```typescript [dtos/user.dto.ts]
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IUserData, RoleTypes } from '../domain';

export class UserDto implements IUserData {
  @ApiProperty({ example: 'usr_123abc' })
  id: string;

  @ApiProperty({ example: 'john@example.com' })
  email: string;

  @ApiProperty({ example: 'John Doe' })
  name: string;

  @ApiProperty({ enum: RoleTypes, isArray: true, example: ['user'] })
  roles: RoleTypes[];

  @ApiProperty({ example: '2025-01-01T00:00:00.000Z' })
  createdAt: Date;

  @ApiProperty({ example: '2025-01-01T00:00:00.000Z' })
  updatedAt: Date;
}
```

::: tip
Always include `example` values. They make the Swagger UI useful for manual testing and serve as inline documentation for frontend developers reading the generated types.
:::

### Masking Sensitive Data

Use `@Transform` from `class-transformer` to mask fields like API keys or tokens:

```typescript
import { Transform } from 'class-transformer';

export class ApiKeyDto implements IApiKeyData {
  @ApiProperty({ example: 'secret-****-4567' })
  @Transform(({ value }) => `${value.slice(0, 7)}****${value.slice(-4)}`)
  secret: string;
}
```

## Create DTO

Create DTOs validate incoming data for new entity creation. Every field that accepts user input needs both a Swagger decorator and validation decorators.

```typescript [dtos/createUser.dto.ts]
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsEmail, IsNotEmpty, MinLength, IsArray, IsOptional } from 'class-validator';
import { ICreateUserData, RoleTypes } from '../domain';

export class CreateUserDto implements ICreateUserData {
  @ApiProperty({ example: 'john@example.com' })
  @IsEmail()
  @IsNotEmpty()
  email: string;

  @ApiProperty({ example: 'John Doe', minLength: 2 })
  @IsString()
  @IsNotEmpty()
  @MinLength(2)
  name: string;

  @ApiPropertyOptional({ enum: RoleTypes, isArray: true, example: ['user'] })
  @IsArray()
  @IsOptional()
  roles?: RoleTypes[];
}
```

## Update DTO

Update DTOs have all fields optional since partial updates are typical. Pair `@ApiPropertyOptional` with `@IsOptional()`:

```typescript [dtos/updateUser.dto.ts]
import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsOptional, MinLength, IsArray, IsBoolean } from 'class-validator';
import { IUpdateUserData, RoleTypes } from '../domain';

export class UpdateUserDto implements IUpdateUserData {
  @ApiPropertyOptional({ example: 'Jane Doe' })
  @IsString()
  @IsOptional()
  @MinLength(2)
  name?: string;

  @ApiPropertyOptional({ enum: RoleTypes, isArray: true })
  @IsArray()
  @IsOptional()
  roles?: RoleTypes[];

  @ApiPropertyOptional({ example: true })
  @IsBoolean()
  @IsOptional()
  verified?: boolean;
}
```

## Filter DTO

Filter DTOs define query parameters for list endpoints. Numeric query params come in as strings, so use `@Type(() => Number)` from `class-transformer` to convert them:

```typescript [dtos/filterUser.dto.ts]
import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, IsInt, Min, Max, IsEnum } from 'class-validator';
import { Type } from 'class-transformer';
import { IUserFilter, UserStatusTypes } from '../domain';

export class FilterUserDto implements IUserFilter {
  @ApiPropertyOptional({ example: 'john@example.com' })
  @IsOptional()
  @IsString()
  email?: string;

  @ApiPropertyOptional({ example: 'John' })
  @IsOptional()
  @IsString()
  search?: string;

  @ApiPropertyOptional({ enum: UserStatusTypes })
  @IsOptional()
  @IsEnum(UserStatusTypes)
  status?: UserStatusTypes;

  @ApiPropertyOptional({ example: 1, minimum: 1 })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Type(() => Number)
  page?: number;

  @ApiPropertyOptional({ example: 20, minimum: 1, maximum: 100 })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(100)
  @Type(() => Number)
  perPage?: number;
}
```

## Common Validation Decorators

Here is a quick reference of the most-used `class-validator` decorators:

```typescript
// Strings
@IsString() @IsNotEmpty() @MinLength(2) @MaxLength(50)
name: string;

@IsEmail()
email: string;

@IsString() @MinLength(8)
@Matches(/^(?=.*[A-Z])(?=.*[0-9])/, { message: 'Must contain uppercase and number' })
password: string;

// Numbers
@IsInt() @Min(0) @Max(10000)
quantity: number;

@IsOptional() @IsInt() @Type(() => Number)  // For query params
page?: number;

// Booleans (from query string)
@IsOptional() @IsBoolean()
@Transform(({ value }) => value === 'true' || value === true)
isActive?: boolean;

// Arrays
@IsArray() @ArrayMinSize(1) @ArrayMaxSize(10) @IsString({ each: true })
tags: string[];

// Enums
@IsEnum(UserRoleTypes)
role: UserRoleTypes;

// Nested objects
@ValidateNested() @Type(() => AddressDto)
address: AddressDto;
```

## Barrel Export

Export all DTOs from a single index file:

```typescript [dtos/index.ts]
export * from './user.dto';
export * from './createUser.dto';
export * from './updateUser.dto';
export * from './filterUser.dto';
```

## Using DTOs in Controllers

```typescript [user.controller.ts]
import { Controller, Get, Post, Body, Query, Param } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { ApiSingleResponse, ApiPaginatedResponse } from '#/setup/decorators';
import { UserService } from './domain/user.service';
import { UserDto, CreateUserDto, FilterUserDto } from './dtos';

@ApiTags('Users')
@Controller('users')
export class UserController {
  constructor(private readonly userService: UserService) {}

  @Get()
  @ApiOperation({ operationId: 'getUsers', summary: 'List users' })
  @ApiPaginatedResponse(UserDto)
  async getUsers(@Query() filter: FilterUserDto) {
    return this.userService.getUsers(filter);
  }

  @Post()
  @ApiOperation({ operationId: 'createUser', summary: 'Create user' })
  @ApiSingleResponse(UserDto)
  async createUser(@Body() data: CreateUserDto) {
    return this.userService.createUser(data);
  }
}
```

::: warning
Use `@ApiPropertyOptional()` for optional fields. Avoid `@ApiProperty({ required: false })` -- it does not work correctly with the Swagger schema generator.
:::

## What's Next?

- [Types](/backend/types) -- Domain interfaces that DTOs implement
- [Controllers](/backend/controllers) -- Where DTOs are used for input/output
- [API Docs](/backend/api-docs) -- Swagger setup and custom response decorators
