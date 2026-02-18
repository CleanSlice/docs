# Controllers

Controllers are the entry point to your slice. They handle HTTP requests, validate input through DTOs, delegate work to the service or gateway, and produce Swagger documentation for SDK generation.

## The Controller's Role

A controller does three things and nothing more:

1. **Receives** HTTP requests and extracts parameters, body, and query data.
2. **Delegates** to a service (or gateway) for business logic.
3. **Documents** the endpoint with Swagger decorators for SDK generation.

Controllers contain zero business logic. No validation beyond what the DTO handles. No data transformation. No try/catch blocks.

```
HTTP Request
    │
    ▼
Controller (route handling, Swagger docs)
    │
    ▼
Service (business logic, error handling)
    │
    ▼
Gateway (data access)
```

## File Location

The controller sits at the root of the slice, not in a subfolder:

```
slices/user/
├── user.controller.ts          # Here, at the root
├── user.module.ts
├── domain/
│   └── user.service.ts         # Controller calls this
├── data/
│   └── user.gateway.ts         # Controller does not touch this
└── dtos/
    ├── createUser.dto.ts
    └── user.dto.ts
```

**Naming convention:** File is `{entity}.controller.ts` (singular). Class is `{Entity}Controller` (singular). The route decorator uses the **plural** form: `@Controller('users')`.

## Complete Example

```typescript [user.controller.ts]
import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  Query,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiParam,
  ApiQuery,
} from '@nestjs/swagger';

import { UserService } from './domain/user.service';
import { CreateUserDto } from './dtos/createUser.dto';
import { UpdateUserDto } from './dtos/updateUser.dto';
import { UserDto } from './dtos/user.dto';
import { FilterUserDto } from './dtos/filterUser.dto';
import { ApiSingleResponse, ApiPaginatedResponse } from '#/setup/decorators';

@ApiTags('Users')
@Controller('users')
export class UserController {
  constructor(private readonly userService: UserService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'Create a new user',
    operationId: 'createUser',
  })
  @ApiResponse({ status: 201, description: 'User created', type: UserDto })
  @ApiResponse({ status: 400, description: 'Validation error' })
  @ApiResponse({ status: 409, description: 'User already exists' })
  async createUser(@Body() data: CreateUserDto): Promise<UserDto> {
    return this.userService.createUser(data);
  }

  @Get(':id')
  @ApiOperation({
    summary: 'Get user by ID',
    operationId: 'getUserById',
  })
  @ApiParam({ name: 'id', description: 'User unique identifier', example: 'usr_123abc' })
  @ApiSingleResponse(UserDto)
  @ApiResponse({ status: 404, description: 'User not found' })
  async getUser(@Param('id') id: string): Promise<UserDto> {
    return this.userService.getUserById(id);
  }

  @Get()
  @ApiOperation({
    summary: 'Get all users',
    operationId: 'getUsers',
  })
  @ApiPaginatedResponse(UserDto)
  async getUsers(@Query() query: FilterUserDto) {
    return this.userService.getUsers(query);
  }

  @Put(':id')
  @ApiOperation({
    summary: 'Update user',
    operationId: 'updateUser',
  })
  @ApiParam({ name: 'id', description: 'User unique identifier' })
  @ApiSingleResponse(UserDto)
  @ApiResponse({ status: 404, description: 'User not found' })
  async updateUser(
    @Param('id') id: string,
    @Body() data: UpdateUserDto,
  ): Promise<UserDto> {
    return this.userService.updateUser(id, data);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({
    summary: 'Delete user',
    operationId: 'deleteUser',
  })
  @ApiParam({ name: 'id', description: 'User unique identifier' })
  @ApiResponse({ status: 204, description: 'User deleted' })
  @ApiResponse({ status: 404, description: 'User not found' })
  async deleteUser(@Param('id') id: string): Promise<void> {
    return this.userService.deleteUser(id);
  }
}
```

## operationId is Required

Every endpoint must have an `operationId` in `@ApiOperation`. This becomes the method name in the generated frontend SDK:

| HTTP Method | operationId | SDK Call |
|---|---|---|
| `GET /users` | `getUsers` | `client.getUsers()` |
| `GET /users/:id` | `getUserById` | `client.getUserById({ id })` |
| `POST /users` | `createUser` | `client.createUser({ body })` |
| `PUT /users/:id` | `updateUser` | `client.updateUser({ id, body })` |
| `DELETE /users/:id` | `deleteUser` | `client.deleteUser({ id })` |
| `POST /users/:id/activate` | `activateUser` | `client.activateUser({ id })` |

The pattern is `{verb}{Entity}[ByField]` in camelCase.

## Response Handling

You do not wrap responses manually. The `ResponseInterceptor` (registered globally in `main.ts`) automatically wraps your return value:

```typescript
// Your controller returns:
return { id: '1', name: 'John', email: 'john@example.com' };

// The interceptor wraps it as:
// { "data": { "id": "1", "name": "John", "email": "john@example.com" }, "success": true }
```

To opt out of wrapping for a specific endpoint, use the `@FlatResponse()` decorator:

```typescript
import { FlatResponse } from '#/setup/response';

@Get('health')
@FlatResponse()
async healthCheck() {
  return { status: 'ok' };
}
// Returns: { "status": "ok" } (no wrapper)
```

## Error Handling

Controllers do not handle errors. The `ErrorHandlingInterceptor` catches all thrown errors globally and formats them into standardized responses:

```typescript
// If the service throws UserNotFoundError, the interceptor returns:
// {
//   "code": "USER_NOT_FOUND",
//   "statusCode": 404,
//   "message": "User with ID 'xyz' not found",
//   "timestamp": "2025-01-01T10:30:00.000Z",
//   "path": "/users/xyz"
// }
```

You throw errors in [Services](/backend/services) and [Gateways](/backend/gateways). The controller simply calls the service and lets errors propagate.

## What to Inject

Controllers inject the **service** (when one exists) or the **abstract gateway** (for simple CRUD with no business logic):

```typescript
// With a service layer
constructor(private readonly userService: UserService) {}

// Without a service (simple pass-through)
constructor(private readonly userGateway: IUserGateway) {}
```

See [Services](/backend/services) for guidance on when you need a service layer versus direct gateway injection.

## Module Registration

```typescript [user.module.ts]
import { Module } from '@nestjs/common';
import { UserController } from './user.controller';
import { UserService } from './domain/user.service';
import { IUserGateway } from './domain/user.gateway';
import { UserGateway } from './data/user.gateway';
import { UserMapper } from './data/user.mapper';

@Module({
  controllers: [UserController],
  providers: [
    UserService,
    UserMapper,
    { provide: IUserGateway, useClass: UserGateway },
  ],
  exports: [UserService],
})
export class UserModule {}
```

## What's Next?

- [Services](/backend/services) -- Business logic layer that controllers delegate to
- [DTOs](/backend/dtos) -- Request and response DTOs with validation
- [API Docs](/backend/api-docs) -- Swagger setup and custom response decorators
- [Error Handling](/backend/error-handling) -- How errors flow from services to HTTP responses
