# Error Handling

CleanSlice uses a centralized error handling system. You define domain-specific error classes in each slice, throw them from services and gateways, and a global interceptor catches everything and returns standardized HTTP responses. Controllers never need try/catch blocks.

## How Errors Flow

```
Controller                        (no try/catch needed)
    │
    ▼
Service (domain layer)            throws UserNotFoundError, etc.
    │
    ▼
Gateway (data layer)              catches Prisma errors, throws domain errors
    │
    ▼
ErrorHandlingInterceptor          catches all errors globally
    │
    ▼
Standardized JSON response        { code, statusCode, message, timestamp, path }
```

Errors bubble up through the layers. The `ErrorHandlingInterceptor` (registered globally in `main.ts`) catches them all and formats a consistent response.

## The Setup: Base Error Infrastructure

The `setup/error` slice provides the foundation that all other slices build on.

### BaseError Class

Every domain error extends `BaseError`, which itself extends NestJS `HttpException`:

```typescript [slices/setup/error/domain/base.error.ts]
import { HttpException } from '@nestjs/common';
import { ErrorCodes } from './error.types';

export abstract class BaseError extends HttpException {
  public code: ErrorCodes = ErrorCodes.UNEXPECTED_ERROR;
  public override cause: Error;

  constructor(
    message: string,
    statusCode: number = 500,
    options?: { cause?: Error },
  ) {
    super(message, statusCode, { cause: options?.cause });
    this.cause = options?.cause || new Error(message);
    this.name = this.constructor.name;

    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, this.constructor);
    }
  }

  getStatus(): number {
    return super.getStatus();
  }

  getCode(): ErrorCodes {
    return this.code;
  }

  getCause(): Error {
    return this.cause || new Error('No cause provided');
  }
}
```

### ErrorCodes Enum

Define all error codes in a central enum. Generic codes live in the setup slice; domain-specific codes can be added as your application grows:

```typescript [slices/setup/error/domain/error.types.ts]
export enum ErrorCodes {
  // Generic errors
  UNEXPECTED_ERROR = 'UNEXPECTED_ERROR',
  VALIDATION_ERROR = 'VALIDATION_ERROR',
  NOT_FOUND = 'NOT_FOUND',
  UNAUTHORIZED = 'UNAUTHORIZED',
  FORBIDDEN = 'FORBIDDEN',
  CONFLICT = 'CONFLICT',
  BAD_REQUEST = 'BAD_REQUEST',

  // Domain-specific errors (add yours here)
  USER_NOT_FOUND = 'USER_NOT_FOUND',
  USER_NOT_AUTHORIZED = 'USER_NOT_AUTHORIZED',
  USER_EXISTS = 'USER_EXISTS',
  USER_BANNED = 'USER_BANNED',
}

export interface IErrorResponse {
  code: string;
  statusCode: number;
  message: string;
  timestamp: string;
  path?: string;
  details?: unknown;
}
```

### Error Handling Interceptor

This interceptor is registered globally and catches every thrown error:

```typescript [slices/setup/error/interceptors/error-handling.interceptor.ts]
import {
  CallHandler, ExecutionContext, Injectable, NestInterceptor,
  HttpException, HttpStatus, Logger,
} from '@nestjs/common';
import { catchError, Observable, throwError } from 'rxjs';
import { Response } from 'express';
import { BaseError } from '../domain/base.error';
import { IErrorResponse } from '../domain/error.types';

@Injectable()
export class ErrorHandlingInterceptor implements NestInterceptor {
  private readonly logger = new Logger(ErrorHandlingInterceptor.name);

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    return next.handle().pipe(
      catchError((error) => {
        const ctx = context.switchToHttp();
        const response = ctx.getResponse<Response>();
        const request = ctx.getRequest();

        const statusCode =
          error instanceof HttpException || error instanceof BaseError
            ? error.getStatus()
            : HttpStatus.INTERNAL_SERVER_ERROR;

        const message =
          error.response?.message || error.message || 'An unexpected error occurred';

        const code =
          error instanceof BaseError
            ? error.getCode()
            : error.code || 'UNEXPECTED_ERROR';

        const errorResponse: IErrorResponse = {
          code,
          statusCode,
          message,
          timestamp: new Date().toISOString(),
          path: request.url,
        };

        if (error.details) {
          errorResponse.details = error.details;
        }

        this.logger.error(
          `[${code}] ${message}`,
          error.stack,
          JSON.stringify({ path: request.url, method: request.method, statusCode }),
        );

        response.status(statusCode).json(errorResponse);
        return throwError(() => error);
      }),
    );
  }
}
```

## Creating Domain Errors

Each slice defines its own errors in `domain/errors/`. Every error extends `BaseError` and sets an appropriate HTTP status code and error code.

### Error with Dynamic Message

```typescript [domain/errors/userNotFound.error.ts]
import { BaseError } from '#/setup/error';
import { ErrorCodes } from '#/setup/error';
import { HttpStatus } from '@nestjs/common';

export class UserNotFoundError extends BaseError {
  public readonly code = ErrorCodes.USER_NOT_FOUND;

  constructor(userId: string, options?: { cause: Error }) {
    super(
      `User with ID '${userId}' was not found.`,
      HttpStatus.NOT_FOUND,
      options,
    );
  }
}
```

### Error with Default Message

```typescript [domain/errors/userNotAuthorized.error.ts]
import { BaseError } from '#/setup/error';
import { ErrorCodes } from '#/setup/error';
import { HttpStatus } from '@nestjs/common';

export class UserNotAuthorizedError extends BaseError {
  public readonly code = ErrorCodes.USER_NOT_AUTHORIZED;

  constructor(message?: string, options?: { cause: Error }) {
    super(
      message ?? 'Username or password was incorrect.',
      HttpStatus.BAD_REQUEST,
      options,
    );
  }
}
```

### Error with Details

For validation errors that carry structured detail data:

```typescript [domain/errors/validation.error.ts]
import { BaseError } from '#/setup/error';
import { ErrorCodes } from '#/setup/error';
import { HttpStatus } from '@nestjs/common';

export class ValidationError extends BaseError {
  public readonly code = ErrorCodes.VALIDATION_ERROR;
  public readonly details: unknown;

  constructor(message: string, details?: unknown, options?: { cause: Error }) {
    super(message, HttpStatus.BAD_REQUEST, options);
    this.details = details;
  }
}
```

## Error File Structure

```
slices/user/
├── domain/
│   ├── user.types.ts
│   ├── user.service.ts
│   ├── user.gateway.ts
│   └── errors/
│       ├── index.ts
│       ├── userNotFound.error.ts
│       ├── userNotAuthorized.error.ts
│       ├── userExists.error.ts
│       └── userBanned.error.ts
└── data/
    └── user.gateway.ts
```

**Naming:** File is `{errorName}.error.ts` (camelCase). Class is `{ErrorName}Error` (PascalCase). Error codes are `SCREAMING_SNAKE_CASE`.

## Throwing Errors in Services

Services throw domain errors for business rule violations. This is the primary place errors originate:

```typescript [domain/user.service.ts]
import { Injectable } from '@nestjs/common';
import { IUserGateway } from './user.gateway';
import { IUserData } from './user.types';
import { UserNotFoundError } from './errors/userNotFound.error';
import { UserAlreadyExistsError } from './errors/userExists.error';

@Injectable()
export class UserService {
  constructor(private readonly userGateway: IUserGateway) {}

  async getUserById(id: string): Promise<IUserData> {
    const user = await this.userGateway.getUser(id);
    if (!user) {
      throw new UserNotFoundError(id);
    }
    return user;
  }

  async createUser(data: ICreateUserData): Promise<IUserData> {
    const existing = await this.userGateway.getUserByEmail(data.email);
    if (existing) {
      throw new UserAlreadyExistsError(data.email);
    }
    return this.userGateway.createUser(data);
  }
}
```

## Throwing Errors in Gateways

Gateways catch raw database/external errors and convert them to domain errors. This prevents Prisma-specific errors from leaking into the domain layer:

```typescript [data/user.gateway.ts]
import { Injectable } from '@nestjs/common';
import { PrismaService } from '#/setup/prisma';
import { UserNotFoundError } from '../domain/errors/userNotFound.error';
import { UserMapper } from './user.mapper';

@Injectable()
export class UserGateway extends IUserGateway {
  constructor(
    private prisma: PrismaService,
    private mapper: UserMapper,
  ) {
    super();
  }

  async deleteUser(id: string): Promise<boolean> {
    try {
      await this.prisma.user.delete({ where: { id } });
      return true;
    } catch (error) {
      if (error.code === 'P2025') {
        // Prisma "Record not found" error
        throw new UserNotFoundError(id, { cause: error as Error });
      }
      throw error;
    }
  }
}
```

::: tip
Pass the original error as `cause` when converting errors. This preserves the stack trace for debugging while presenting a clean domain error to the consumer.
:::

## Controllers: No Error Handling

Controllers do not catch errors. The interceptor handles everything:

```typescript [user.controller.ts]
@Controller('users')
export class UserController {
  constructor(private readonly userService: UserService) {}

  @Get(':id')
  @ApiOperation({ operationId: 'getUserById' })
  async getUser(@Param('id') id: string) {
    // If user not found, UserNotFoundError propagates
    // to the ErrorHandlingInterceptor automatically
    return this.userService.getUserById(id);
  }
}
```

## Response Format

All errors produce the same JSON structure:

```json
{
  "code": "USER_NOT_FOUND",
  "statusCode": 404,
  "message": "User with ID 'usr_123' was not found.",
  "timestamp": "2025-01-15T10:30:00.000Z",
  "path": "/users/usr_123"
}
```

## HTTP Status Code Reference

| Status | When to Use | Example Errors |
|---|---|---|
| 400 | Bad request / validation failure | `ValidationError`, `UserNotAuthorizedError` |
| 401 | Missing or invalid authentication | `UnauthorizedError` |
| 403 | Authenticated but not permitted | `UserBannedError`, `ForbiddenError` |
| 404 | Resource not found | `UserNotFoundError` |
| 409 | Conflict (duplicate resource) | `UserAlreadyExistsError` |
| 500 | Unexpected server error | `DatabaseError`, unhandled exceptions |

## Module Registration

Register the interceptor globally, either in `main.ts` or through a module:

```typescript [slices/setup/error/error.module.ts]
import { Module } from '@nestjs/common';
import { APP_INTERCEPTOR } from '@nestjs/core';
import { ErrorHandlingInterceptor } from './interceptors/error-handling.interceptor';

@Module({
  providers: [
    {
      provide: APP_INTERCEPTOR,
      useClass: ErrorHandlingInterceptor,
    },
  ],
})
export class ErrorModule {}
```

Then import it in `app.module.ts`:

```typescript
@Module({
  imports: [
    ErrorModule,
    // ... other modules
  ],
})
export class AppModule {}
```

## Barrel Export

```typescript [domain/errors/index.ts]
export * from './userNotFound.error';
export * from './userNotAuthorized.error';
export * from './userExists.error';
export * from './userBanned.error';
```

## What's Next?

- [Services](/backend/services) -- Where most domain errors are thrown
- [Gateways](/backend/gateways) -- Where database errors are caught and converted
- [Controllers](/backend/controllers) -- The layer that lets errors propagate
- [Slice Structure](/backend/slice-structure) -- Where error files fit in the slice layout
