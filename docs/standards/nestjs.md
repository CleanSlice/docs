# NestJS Standards

These conventions apply to all backend code in the `api/` project. They build on the [TypeScript Standards](/standards/typescript) with NestJS-specific patterns.

## Layer Responsibilities

| Layer | Responsibility | Injects |
|-------|---------------|---------|
| Controller | HTTP endpoints, validation | Gateway or Service |
| Gateway (abstract) | Interface contract | — |
| Gateway (concrete) | Data access, Prisma queries | `PrismaService`, `Mapper` |
| Mapper | Data transformation | — |
| Service | Cross-module facade (optional) | Gateway |

## Module Structure

Every slice is a NestJS module:

```
slices/{entity}/
├── {entity}.module.ts                # Module definition
├── {entity}.controller.ts            # HTTP endpoints
├── domain/
│   ├── index.ts                      # Barrel exports
│   ├── {entity}.types.ts             # Interfaces and types
│   ├── {entity}.gateway.ts           # Abstract gateway class
│   └── {entity}.service.ts           # Optional service facade
├── data/
│   ├── {entity}.gateway.ts           # Concrete gateway
│   └── {entity}.mapper.ts            # Data transformation
└── dtos/
    ├── index.ts                      # Barrel exports
    ├── {entity}.dto.ts               # Response DTO
    ├── create{Entity}.dto.ts         # Create request DTO
    ├── update{Entity}.dto.ts         # Update request DTO
    └── filter{Entity}.dto.ts         # Query filter DTO
```

## Module Definition

Wire the abstract gateway to its concrete implementation using the `provide`/`useClass` pattern:

```typescript
@Module({
  imports: [PrismaModule],
  controllers: [UserController],
  providers: [
    { provide: IUserGateway, useClass: UserGateway },
    UserMapper,
    UserService,  // optional
  ],
  exports: [
    { provide: IUserGateway, useClass: UserGateway },
    UserService,
  ],
})
export class UserModule {}
```

::: tip Abstract Classes as DI Tokens
Use the abstract class directly as the `provide` token instead of string tokens. This gives you type safety without needing `@Inject()` decorators.
:::

## Controller Conventions

Controllers handle HTTP concerns only — no business logic:

```typescript
@ApiTags('users')
@Controller('users')  // Plural route name
export class UserController {
  constructor(private readonly gateway: IUserGateway) {}

  @ApiOperation({ operationId: 'getUsers' })  // operationId is required
  @Get()
  async findAll(@Query() filter: FilterUserDto): Promise<UserDto[]> {
    const users = await this.gateway.findAll(filter);
    return users.map((u) => new UserDto(u));
  }

  @ApiOperation({ operationId: 'createUser' })
  @Post()
  async create(@Body() dto: CreateUserDto): Promise<UserDto> {
    const user = await this.gateway.create(dto);
    return new UserDto(user);
  }
}
```

Key rules:
- Route name is **plural** (`'users'`, not `'user'`)
- Every endpoint needs `@ApiOperation({ operationId })` for SDK generation
- Controllers inject the abstract gateway, not the concrete one
- Response data is wrapped in DTOs

## Gateway Pattern

The abstract gateway lives in `domain/`, the implementation in `data/`:

```typescript
// domain/user.gateway.ts — the contract
export abstract class IUserGateway {
  abstract findAll(filter?: IUserFilter): Promise<IUserData[]>;
  abstract findById(id: string): Promise<IUserData | null>;
  abstract create(data: ICreateUserData): Promise<IUserData>;
  abstract update(id: string, data: IUpdateUserData): Promise<IUserData>;
  abstract delete(id: string): Promise<void>;
}

// data/user.gateway.ts — the implementation
@Injectable()
export class UserGateway extends IUserGateway {
  constructor(
    private readonly prisma: PrismaService,
    private readonly mapper: UserMapper,
  ) { super(); }

  async findById(id: string): Promise<IUserData | null> {
    const user = await this.prisma.user.findUnique({ where: { id } });
    return user ? this.mapper.toDomain(user) : null;
  }
  // ...
}
```

::: warning
Prisma IS the repository layer. You don't need a separate repository class — the gateway talks to Prisma directly. The gateway provides the abstraction that makes your domain testable.
:::

## DTO Conventions

DTOs use `class-validator` for validation and `@nestjs/swagger` decorators for documentation:

```typescript
// dtos/createUser.dto.ts
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

DTO file naming uses camelCase: `createUser.dto.ts`, `filterProject.dto.ts`.

## Barrel Exports

Every `domain/` and `dtos/` folder has an `index.ts` that re-exports its public API:

```typescript
// domain/index.ts
export { IUserGateway } from './user.gateway';
export { UserService } from './user.service';
export type { IUserData, ICreateUserData, IUpdateUserData } from './user.types';
```

Other slices import from the barrel:

```typescript
import { IUserData, UserService } from '#user/domain';
```

## Submodules

For complex integrations (like AWS services), use submodules within a parent module:

```
slices/aws/
├── aws.module.ts
├── s3/
│   ├── s3.module.ts
│   └── s3.repository.ts
├── cognito/
│   ├── cognito.module.ts
│   └── cognito.repository.ts
└── bedrock/
    ├── bedrock.module.ts
    └── bedrock.repository.ts
```

The parent module imports and re-exports all submodules:

```typescript
@Module({
  imports: [S3Module, CognitoModule, BedrockModule],
  exports: [S3Module, CognitoModule, BedrockModule],
})
export class AwsModule {}
```

## Global Modules

Use `@Global()` sparingly — only for infrastructure that every module needs:

```typescript
@Global()
@Module({
  providers: [PrismaService],
  exports: [PrismaService],
})
export class PrismaModule {}
```

Good candidates for global modules: `PrismaModule`, `CoreModule`, `RedisModule`.

## What's Next?

- [Backend Slice Structure](/backend/slice-structure) — Detailed file layout
- [Controllers](/backend/controllers) — Controller patterns
- [Gateways](/backend/gateways) — Gateway pattern deep dive
- [TypeScript Standards](/standards/typescript) — General TS conventions
