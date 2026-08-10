# Services

Services contain your business logic. They live in the `domain/` folder, depend only on gateway interfaces, and are the place where validation rules, data normalization, error handling, and orchestration happen.

## When to Use a Service

Services are **optional**. For simple CRUD slices with no business rules, the controller can inject the gateway directly. Add a service when you need:

- **Business validation** beyond what DTOs handle (e.g., checking if an email is already taken)
- **Data normalization** (e.g., trimming whitespace, lowercasing emails)
- **Orchestration** across multiple gateways (e.g., creating an order and processing payment)
- **Error handling** with domain-specific errors (e.g., `UserNotFoundError`)
- **Authorization logic** (e.g., checking if the user owns the resource)

If your controller method would just be `return this.gateway.getUser(id)` with nothing extra, skip the service.

## File Location

```
slices/user/
├── user.controller.ts
├── user.module.ts
├── domain/
│   ├── user.service.ts        # Service lives here
│   ├── user.gateway.ts        # Gateway interface
│   ├── user.types.ts
│   └── errors/
│       ├── userNotFound.error.ts
│       └── userAlreadyExists.error.ts
└── data/
    └── user.gateway.ts        # Gateway implementation
```

**Naming:** `{entity}.service.ts` (singular file), `{Entity}Service` (singular class), always inside `domain/`.

## Complete Example

```typescript [domain/user.service.ts]
import { Injectable } from '@nestjs/common';
import { IUserGateway, IUserFilter } from './user.gateway';
import {
  IUserData,
  ICreateUserData,
  IUpdateUserData,
  IPaginatedResult,
} from './user.types';
import { UserNotFoundError } from './errors/userNotFound.error';
import { UserAlreadyExistsError } from './errors/userAlreadyExists.error';

@Injectable()
export class UserService {
  constructor(private readonly userGateway: IUserGateway) {}

  // ---- Public methods ----

  async createUser(data: ICreateUserData): Promise<IUserData> {
    const normalizedData = this.normalizeUserData(data);

    const existingUser = await this.userGateway.getUser(normalizedData.email);
    if (existingUser) {
      throw new UserAlreadyExistsError(normalizedData.email);
    }

    return this.userGateway.createUser(normalizedData);
  }

  async getUserById(id: string): Promise<IUserData> {
    const user = await this.userGateway.getUser(id);
    if (!user) {
      throw new UserNotFoundError(id);
    }
    return user;
  }

  async getUsers(filter?: IUserFilter): Promise<IPaginatedResult<IUserData>> {
    const normalizedFilter = {
      ...filter,
      page: filter?.page || 1,
      perPage: Math.min(filter?.perPage || 20, 100),
      search: filter?.search?.trim(),
    };
    return this.userGateway.getUsers(normalizedFilter);
  }

  async updateUser(id: string, data: IUpdateUserData): Promise<IUserData> {
    await this.getUserById(id); // Throws UserNotFoundError if missing

    if (data.name) {
      data.name = data.name.trim();
    }

    return this.userGateway.updateUser(id, data);
  }

  async deleteUser(id: string): Promise<boolean> {
    await this.getUserById(id); // Throws UserNotFoundError if missing
    return this.userGateway.deleteUser(id);
  }

  // ---- Private methods ----

  private normalizeUserData(data: ICreateUserData): ICreateUserData {
    return {
      ...data,
      email: data.email.toLowerCase().trim(),
      name: data.name.trim(),
    };
  }
}
```

## Key Rules

### Depend on Gateway Interfaces

The service injects the abstract gateway, not the Prisma implementation. When the gateway is an abstract class (the recommended pattern), NestJS resolves it automatically:

```typescript
// Correct -- abstract class injection
constructor(private readonly userGateway: IUserGateway) {}

// Also correct -- string token injection
constructor(
  @Inject('IUserGateway')
  private readonly userGateway: IUserGateway,
) {}
```

::: warning
The service must import from `./user.gateway` (the domain file), not from `../data/user.gateway`. If you find yourself importing from `data/`, something is wrong with the architecture.
:::

### Return Domain Types

Services return domain interfaces like `IUserData`, not DTOs. The controller (presentation layer) is responsible for the API contract; the service is responsible for the business contract.

```typescript
// Correct -- returns domain type
async getUser(id: string): Promise<IUserData> {
  return this.userGateway.getUser(id);
}

// Wrong -- returns DTO (that is the controller's job)
async getUser(id: string): Promise<UserResponseDto> {
  const user = await this.userGateway.getUser(id);
  return new UserResponseDto(user);
}
```

### No Response Wrapping

The `ResponseInterceptor` handles `{ data, success }` wrapping globally. Services just return the data:

```typescript
// Wrong -- interceptor does this
async createUser(data: ICreateUserData) {
  const user = await this.userGateway.createUser(data);
  return { success: true, data: user };
}

// Correct
async createUser(data: ICreateUserData): Promise<IUserData> {
  return this.userGateway.createUser(data);
}
```

### Let Errors Propagate

Throw domain errors and let them bubble up to the `ErrorHandlingInterceptor`. There is no need for try/catch in most service methods:

```typescript
async getUserById(id: string): Promise<IUserData> {
  const user = await this.userGateway.getUser(id);
  if (!user) {
    throw new UserNotFoundError(id);
  }
  return user;
}
```

For cases where you need to catch and re-throw with context:

```typescript
async createUser(data: ICreateUserData): Promise<IUserData> {
  try {
    return await this.userGateway.createUser(data);
  } catch (error) {
    if (error.code === 'UNIQUE_VIOLATION') {
      throw new UserAlreadyExistsError(data.email);
    }
    throw error; // Re-throw unknown errors
  }
}
```

## Multiple Gateways

Services can orchestrate across multiple gateways when an operation spans concerns:

```typescript [domain/checkout.service.ts]
@Injectable()
export class CheckoutService {
  constructor(
    private readonly orderGateway: IOrderGateway,
    private readonly paymentGateway: IPaymentGateway,
    private readonly notificationGateway: INotificationGateway,
  ) {}

  async checkout(data: ICheckoutData): Promise<IOrderData> {
    const order = await this.orderGateway.create(data.order);

    await this.paymentGateway.processPayment({
      orderId: order.id,
      amount: order.total,
      method: data.paymentMethod,
    });

    await this.notificationGateway.sendOrderConfirmation(order);

    return order;
  }
}
```

## A Service Can Be an Engine

A service is not always a thin wrapper around CRUD. It is simply the slice's business logic, so it can be a stateful **engine** — a loop, an orchestrator, a state machine — that injects the gateway and drives it. A tool-loop that repeatedly calls a model and dispatches tools is a service; so is a pipeline that fans work across gateways. Name it as the slice's service (`{slice}.service.ts` / `{Slice}Service`) even when the class does far more than forward calls.

When such an engine is reusable by more than one consumer, put it **in the slice that owns the capability it drives, not in a consumer**. A tool-loop belongs in the `tool` slice, next to the tools it runs, so every consumer shares one engine instead of each re-implementing it — the consumer imports the service and calls it.

## Method Organization

Organize service methods with public methods first and private helpers last:

```typescript
@Injectable()
export class UserService {
  constructor(...) {}

  // 1. Public methods (alphabetical or by importance)
  async createUser(...) {}
  async deleteUser(...) {}
  async getUserById(...) {}
  async getUsers(...) {}
  async updateUser(...) {}

  // 2. Private methods last
  private normalizeUserData(...) {}
  private validateUserData(...) {}
}
```

## Module Wiring

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

- [Gateways](/backend/gateways) -- Data access interfaces that services depend on
- [Error Handling](/backend/error-handling) -- Domain errors that services throw
- [Controllers](/backend/controllers) -- Presentation layer that calls services
- [Types](/backend/types) -- Domain types that services work with
