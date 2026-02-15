# API Docs

CleanSlice uses Swagger (OpenAPI) to generate interactive API documentation and, more importantly, to export a specification file that powers type-safe SDK generation on the frontend.

## Why This Matters

Swagger serves two purposes in CleanSlice:

1. **Interactive documentation** at `/api` for testing endpoints during development.
2. **SDK generation** -- the exported `swagger-spec.json` file feeds `@hey-api/openapi-ts` to create a fully typed TypeScript client for your frontend.

This means that every controller endpoint and every DTO property must be properly decorated. Missing decorators mean missing types in the generated SDK.

## Installation

```bash
npm install @nestjs/swagger swagger-ui-express
```

## Setup in main.ts

Swagger configuration lives in `main.ts`. Here is a complete setup:

```typescript [src/main.ts]
import { NestFactory, Reflector } from '@nestjs/core';
import { ClassSerializerInterceptor, ValidationPipe } from '@nestjs/common';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { AppModule } from './app.module';
import * as fs from 'fs';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  app.enableCors();
  app.useGlobalInterceptors(new ClassSerializerInterceptor(app.get(Reflector)));
  app.useGlobalPipes(new ValidationPipe({ transform: true, whitelist: true }));

  const config = new DocumentBuilder()
    .setTitle('CleanSlice API')
    .setDescription('REST API documentation')
    .setVersion('1.0')
    .addBearerAuth(
      { type: 'http', in: 'header', scheme: 'bearer', bearerFormat: 'JWT' },
      'defaultBearerAuth',
    )
    .addApiKey(
      { type: 'apiKey', name: 'api-key', in: 'header', description: 'API Key' },
      'api-key',
    )
    .build();

  const document = SwaggerModule.createDocument(app, config);

  SwaggerModule.setup('api', app, document, {
    swaggerOptions: { persistAuthorization: true },
  });

  // Export spec for frontend SDK generation
  fs.writeFileSync('swagger-spec.json', JSON.stringify(document));

  await app.listen(process.env.PORT ?? 3000);
}

bootstrap();
```

The `swagger-spec.json` is written to disk on every startup. Your frontend project reads this file to generate the SDK.

## The operationId Requirement

Every endpoint must include an `operationId` in its `@ApiOperation` decorator. The `operationId` becomes the method name in the generated SDK.

```typescript
// With operationId -- SDK generates: client.getUserById({ id })
@ApiOperation({
  summary: 'Get user by ID',
  operationId: 'getUserById',
})

// Without operationId -- SDK generates: client.usersControllerGetUser({ id })
@ApiOperation({
  summary: 'Get user by ID',
})
```

::: warning
If you omit `operationId`, the SDK generator falls back to a concatenation of the controller class name and method name. These auto-generated names are ugly and unstable -- they break if you rename a class.
:::

### Naming Convention

| HTTP Method | Pattern | Example |
|---|---|---|
| `GET /users` | `get{Entities}` | `getUsers` |
| `GET /users/:id` | `get{Entity}ById` | `getUserById` |
| `POST /users` | `create{Entity}` | `createUser` |
| `PUT /users/:id` | `update{Entity}` | `updateUser` |
| `DELETE /users/:id` | `delete{Entity}` | `deleteUser` |
| `POST /users/:id/activate` | `{action}{Entity}` | `activateUser` |
| `GET /auth/me` | descriptive verb | `me` |

## Controller Decorators

### Class-Level

```typescript [user.controller.ts]
@ApiTags('Users')                         // Groups endpoints in Swagger UI
@ApiBearerAuth('defaultBearerAuth')       // Marks all endpoints as requiring JWT
@Controller('users')
export class UserController {
  // ...
}
```

### Endpoint-Level

```typescript
@ApiOperation({
  summary: 'Create a new user',
  operationId: 'createUser',
})
@ApiResponse({ status: 201, description: 'User created', type: UserDto })
@ApiResponse({ status: 400, description: 'Validation error' })
@ApiResponse({ status: 409, description: 'User already exists' })
@Post()
async createUser(@Body() data: CreateUserDto): Promise<UserDto> {
  return this.userService.createUser(data);
}
```

## DTO Decorators

Every property on a DTO must have an `@ApiProperty()` or `@ApiPropertyOptional()` decorator. Without it, the property is invisible to Swagger and missing from the generated SDK types.

```typescript [dtos/user.dto.ts]
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class UserDto {
  @ApiProperty({ example: 'usr_123abc' })
  id: string;

  @ApiProperty({ example: 'john@example.com' })
  email: string;

  @ApiProperty({ example: 'John Doe' })
  name: string;

  @ApiPropertyOptional({ example: '+1234567890' })
  phone?: string;

  @ApiProperty({ example: '2025-01-01T00:00:00.000Z' })
  createdAt: Date;
}
```

::: tip
Always include `example` values. They populate the Swagger UI "Try it out" feature and make the documentation self-documenting.
:::

## Custom Response Decorators

CleanSlice provides two custom decorators that standardize how responses appear in the Swagger schema.

### ApiSingleResponse

Wraps a single item in the standard `{ data, success }` envelope:

```typescript [slices/setup/decorators/ApiSingleResponse.ts]
import { Type, applyDecorators } from '@nestjs/common';
import { ApiExtraModels, ApiOkResponse, ApiProperty, getSchemaPath } from '@nestjs/swagger';

export class SingleModel<T> {
  public readonly data: T;

  @ApiProperty({ example: true })
  public readonly success: boolean;
}

export const ApiSingleResponse = <TModel extends Type<any>>(model: TModel) => {
  return applyDecorators(
    ApiExtraModels(SingleModel, model),
    ApiOkResponse({
      description: 'Successfully received model',
      schema: {
        allOf: [
          { $ref: getSchemaPath(SingleModel) },
          { properties: { data: { $ref: getSchemaPath(model) } } },
        ],
      },
    }),
  );
};
```

### ApiPaginatedResponse

Wraps a list with pagination metadata:

```typescript [slices/setup/decorators/ApiPaginatedResponse.ts]
import { Type, applyDecorators } from '@nestjs/common';
import { ApiExtraModels, ApiOkResponse, ApiProperty, getSchemaPath } from '@nestjs/swagger';

export class MetaListDto {
  @ApiProperty({ example: 100 })
  total: number;

  @ApiProperty({ example: 5 })
  lastPage: number;

  @ApiProperty({ example: 1 })
  currentPage: number;

  @ApiProperty({ example: 20 })
  perPage: number;
}

export class PaginationModel<T> {
  public readonly data: T[];

  @ApiProperty()
  public readonly meta: MetaListDto;
}

export const ApiPaginatedResponse = <TModel extends Type<any>>(model: TModel) => {
  return applyDecorators(
    ApiExtraModels(PaginationModel, model),
    ApiOkResponse({
      description: 'Successfully received paginated list',
      schema: {
        allOf: [
          { $ref: getSchemaPath(PaginationModel) },
          { properties: { data: { type: 'array', items: { $ref: getSchemaPath(model) } } } },
        ],
      },
    }),
  );
};
```

### Using Custom Decorators

```typescript
@ApiOperation({ summary: 'Get user by ID', operationId: 'getUserById' })
@ApiSingleResponse(UserDto)
@Get(':id')
async getUser(@Param('id') id: string) {
  return this.userService.getUser(id);
}

@ApiOperation({ summary: 'List all users', operationId: 'getUsers' })
@ApiPaginatedResponse(UserDto)
@Get()
async getUsers(@Query() query: FilterUserDto) {
  return this.userService.getUsers(query);
}
```

## Decorator Reference

| Decorator | Purpose | When to Use |
|---|---|---|
| `@ApiTags()` | Groups endpoints in Swagger UI | Every controller |
| `@ApiBearerAuth()` | Marks as requiring JWT auth | Protected controllers |
| `@ApiOperation()` | Describes endpoint with `operationId` | Every endpoint |
| `@ApiResponse()` | Documents response status codes | Every endpoint |
| `@ApiBody()` | Documents request body | POST/PUT endpoints |
| `@ApiParam()` | Documents URL parameters | Endpoints with `:id` etc. |
| `@ApiQuery()` | Documents query parameters | Endpoints with query filters |
| `@ApiProperty()` | Documents required DTO property | Every DTO field |
| `@ApiPropertyOptional()` | Documents optional DTO property | Optional DTO fields |

## What's Next?

- [Controllers](/backend/controllers) -- Full controller pattern with Swagger integration
- [DTOs](/backend/dtos) -- Request and response DTOs with validation and Swagger decorators
- [Getting Started](/backend/getting-started) -- Complete main.ts setup
