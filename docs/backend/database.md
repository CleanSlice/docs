# Database

CleanSlice runs on **Prisma 8** with PostgreSQL. Each slice owns its `.prisma` file, so database models live next to the domain logic that uses them. `prisma.config.ts` globs those files into one **contract**, and `prisma contract emit` writes it to `generated/prisma`. There is no assembled `schema.prisma`, no `datasource` or `generator` block, no `prisma generate`, and no prisma-import.

The [starter kit](https://github.com/CleanSlice/nest-nuxt-starter-kit) is the reference implementation: `api/prisma.config.ts`, `api/scripts/migrate.mjs` and `api/src/slices/setup/prisma/`. Copy those files rather than writing them from scratch.

## How It Works

```
Slice model files                     Emitted contract (gitignored)
─────────────────                     ─────────────────────────────
slices/user/user/user.prisma   ─┐
slices/team/team/team.prisma    ├──▶  generated/prisma/contract.json
slices/setup/id/id.prisma      ─┘     generated/prisma/contract.d.ts
         │                                     │
         │ bun run db:plan                     │ read by PrismaService at start
         ▼                                     ▼
prisma/migrations/app/<ts>_<name>/     this.prisma.db.public.User
         │ bun run db:deploy
         ▼
     PostgreSQL
```

The contract is emitted by `postinstall`, `build`, `dev`, `typecheck` and `test`, so it always matches the slice files. Never commit `generated/`.

## Installation

Every CleanSlice project uses the same exact versions. Pin them with no caret and commit `bun.lock`.

| Package | Version | Where |
|---------|---------|-------|
| `@prisma/orm-postgres` | `8.0.0-rc.14` | `dependencies` (runtime) |
| `prisma` | `8.0.0-rc.19` | `devDependencies` (CLI) |
| `@prisma/orm-toolchain` | `8.0.0-rc.14` | `overrides` |
| `@prisma/orm-framework` | `8.0.0-rc.14` | `overrides` |
| `pg`, `@types/pg` | `8.23.1` | migration scripts, test setup |

```bash
bun add --exact @prisma/orm-postgres@8.0.0-rc.14 pg@8.23.1
bun add --exact --dev prisma@8.0.0-rc.19 @types/pg@8.23.1
```

### `package.json`

```json [package.json]
{
  "engines": { "node": ">=22.18" },
  "scripts": {
    "postinstall": "prisma contract emit --format human --quiet",
    "prisma:emit": "prisma contract emit --format human --quiet",
    "build": "prisma contract emit --format human --quiet && nest build",
    "typecheck": "prisma contract emit --format human --quiet && tsc --noEmit -p tsconfig.json",
    "predev": "bun run check && bun run docker && bun run db:deploy",
    "dev": "export PORT=${PORT:-4229}; prisma contract emit --format human --quiet && cross-env NODE_ENV=dev nest start --watch",
    "start:prod": "node scripts/migrate.mjs && node dist/main",
    "docker": "docker compose up -d --wait",
    "db:deploy": "node --env-file-if-exists=.env.dev --env-file-if-exists=.env scripts/migrate.mjs",
    "db:status": "node --env-file-if-exists=.env.dev --env-file-if-exists=.env node_modules/prisma/dist/prisma.js migration status --to deploy --format human",
    "db:plan": "node --env-file-if-exists=.env.dev --env-file-if-exists=.env node_modules/prisma/dist/prisma.js migration plan --from deploy --format human",
    "db:verify": "node --env-file-if-exists=.env.dev --env-file-if-exists=.env node_modules/prisma/dist/prisma.js db verify --format human",
    "test": "prisma contract emit --format human --quiet && NODE_OPTIONS=--experimental-vm-modules jest"
  },
  "trustedDependencies": ["bcrypt", "esbuild", "prisma"],
  "overrides": {
    "@prisma/orm-toolchain": "8.0.0-rc.14",
    "@prisma/orm-framework": "8.0.0-rc.14"
  }
}
```

::: warning
`trustedDependencies` replaces Bun's default allow-list. List every package whose install script you need (`bcrypt` in the kit); `bun pm untrusted` shows what was blocked.
:::

### `prisma.config.ts`

```typescript [prisma.config.ts]
import { definePrismaConfig } from 'prisma/config';
import { defineConfig as definePostgresConfig } from '@prisma/orm-postgres/config';

export default definePrismaConfig({
  orm: definePostgresConfig({
    contract: './src/slices/**/*.prisma',
    output: 'generated/prisma',
    migrations: { dir: 'prisma/migrations' },
    db: { connection: process.env['DATABASE_URL'] },
  }),
});
```

The connection is `DATABASE_URL`. It is optional here, so `contract emit` works without a database.

### `tsconfig.json`

The Prisma 8 runtime is **ESM-only**, and the Nest build stays CommonJS. With `nodenext` the build can load the runtime with a real `import()` and its types with `resolution-mode`:

```jsonc [tsconfig.json]
{
  "compilerOptions": {
    "module": "nodenext",
    "moduleResolution": "nodenext",
    "isolatedModules": true, // ts-jest requires it under nodenext
    "rootDir": "./src"
    // ...
  },
  "include": ["src/**/*"], // prisma.config.ts and the migration plans run on their own
  "exclude": ["node_modules", "dist", "generated"]
}
```

Add `generated/` to `.gitignore`, and add `**/*.tsbuildinfo` and `api/generated` to `.dockerignore`.

## Defining Models

Each slice keeps its models in `{slice}.prisma` at the **slice root**, not inside `data/` or `domain/`. The first line is always `// use prisma-8`. The primary key is `id String @id` with **no database default**: the gateway mints it with `formatId(prefix)`, as described in [Identifiers](/standards/identifiers).

```prisma [src/slices/user/user/user.prisma]
// use prisma-8
model User {
  id        String   @id // minted by the gateway: formatId(USER_ID_PREFIX)
  email     String   @unique
  name      String
  password  String
  roles     String[]
  verified  Boolean  @default(false)
  banned    Boolean  @default(false)
  createdAt TimestamptzJsDate(3) @default(now())
  updatedAt temporal.timestamptzJsDate(3, onCreate: now, onUpdate: now)
}
```

Relations need no import lines: every slice file belongs to the same contract.

```prisma [src/slices/team/team/team.prisma]
// use prisma-8
model Team {
  id        String       @id
  name      String
  members   Membership[]
  createdAt TimestamptzJsDate(3) @default(now())
}

model Membership {
  id     String @id
  teamId String
  userId String
  role   String
  team   Team   @relation(fields: [teamId], references: [id], onDelete: Cascade)
  user   User   @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@unique([teamId, userId])
  @@index([userId])
}
```

| Column | Prisma 8 type | Reads and writes as |
|--------|---------------|---------------------|
| created timestamp | `TimestamptzJsDate(3) @default(now())` | `Date` (`timestamptz(3)`) |
| updated timestamp | `temporal.timestamptzJsDate(3, onCreate: now, onUpdate: now)` | `Date` |
| JSON | `Jsonb` | `JsonValue` |
| money | `Numeric(12, 2)` | decimal string |
| calendar day | `DateString` | `'YYYY-MM-DD'` |
| list | `String[]` | `readonly string[]`, `NOT NULL` |
| enum-like value | `String` plus a union or enum in the domain | `string` |

## The Prisma Slice

```
src/slices/setup/prisma/
├── prisma.module.ts      # @Global(): every gateway injects PrismaService
├── prisma.service.ts     # the connection, db, transaction(), raw SQL
├── prisma.types.ts       # PrismaRow / PrismaCreate / PrismaUpdate, raw SQL types
├── prisma.errors.ts      # isUniqueViolation, sqlState, … (SQLSTATE)
├── tests/prisma.service.e2e-spec.ts
├── README.md
└── index.ts              # exported as #setup/prisma
```

`PrismaService` loads the runtime with `import('@prisma/orm-postgres/runtime')` at module init and reads `generated/prisma/contract.json`. Because `PrismaModule` is `@Global()`, slices inject `PrismaService` without importing the module.

| Member | Use |
|--------|-----|
| `db.public.<Model>` | the ORM, inside the current transaction if one is open |
| `transaction(work, options?)` | one unit of work: nested calls join, retries 40001/40P01, times out |
| `inTransaction` | true inside `transaction()`; pass it to `withIdRetry` |
| `sql` | the raw SQL tag; every `${value}` is a bound parameter |
| `rawRows(q)` / `rawExecute(q)` | run `.returnsRow({...})` / `.affectedCount()` statements |
| `param(value, codecId)` | a parameter whose codec cannot be inferred (null, `Date`, arrays, JSON) |
| `join`, `verbatim`, `condition` | join fragments, trusted text, a raw predicate inside `.where` |
| `rawExecuteUnsafe(text)` | trusted text without parameters: DDL, `TRUNCATE` |
| `and` / `or` / `not` | combinators for `.where((m) => …)` |
| `PrismaService.open({ url })` / `close()` | a client outside Nest: scripts, test setup |

Prisma 8 generates no per-model TypeScript types, so `prisma.types.ts` derives the names mappers use from the contract:

```typescript
import type { PrismaCreate, PrismaRow, PrismaUpdate } from '#setup/prisma';

toData(user: PrismaRow<'User'>): IUserData { /* … */ }
toCreate(data: ICreateUserData): Omit<PrismaCreate<'User'>, 'id'> { /* … */ }
toUpdate(data: IUpdateUserData): PrismaUpdate<'User'> { /* … */ }
```

## Using PrismaService in Gateways

```typescript [src/slices/user/user/data/user.gateway.ts]
import { Injectable } from '@nestjs/common';
import { PrismaService } from '#setup/prisma';
import { formatId, withIdRetry } from '#setup/id';
import { IUserGateway } from '../domain/user.gateway';
import { IUserData, ICreateUserData, IUpdateUserData, USER_ID_PREFIX } from '../domain/user.types';
import { UserNotFoundError } from '../domain/user.errors';
import { UserMapper } from './user.mapper';

@Injectable()
export class UserGateway extends IUserGateway {
  constructor(
    private readonly prisma: PrismaService,
    private readonly mapper: UserMapper,
  ) {
    super();
  }

  private get users() {
    return this.prisma.db.public.User;
  }

  async getUser(id: string): Promise<IUserData | null> {
    const user = await this.users.first({ id });
    return user ? this.mapper.toData(user) : null;
  }

  async createUser(data: ICreateUserData): Promise<IUserData> {
    const createData = this.mapper.toCreate(data);
    const user = await withIdRetry(
      () => this.users.create({ id: formatId(USER_ID_PREFIX), ...createData }),
      this.prisma.inTransaction,
    );
    return this.mapper.toData(user);
  }

  async updateUser(id: string, data: IUpdateUserData): Promise<IUserData> {
    const changes = this.mapper.toUpdate(data);
    // Nothing to write is a read: an empty update answers null.
    const user =
      Object.keys(changes).length === 0
        ? await this.users.first({ id })
        : await this.users.where({ id }).update(changes);
    if (!user) throw new UserNotFoundError(id); // a missing row is null, not an exception
    return this.mapper.toData(user);
  }

  async deleteUser(id: string): Promise<IUserData> {
    const user = await this.users.where({ id }).delete();
    if (!user) throw new UserNotFoundError(id);
    return this.mapper.toData(user);
  }
}
```

### Query Cheat Sheet

```typescript
const users = this.prisma.db.public.User;

await users.first({ id });                                  // Row | null
await users.where({ verified: true }).all();               // equality shorthand
await users.where((u) => u.email.ilike(pattern)).all();
await users.where((u) => this.prisma.or(u.name.ilike(p), u.email.ilike(p))).all();
await users
  .select('id', 'email')
  .orderBy([(u) => u.createdAt.desc(), (u) => u.id.desc()])
  .offset((page - 1) * perPage)
  .limit(perPage)
  .all();
await users.aggregate((a) => ({ n: a.count() }));          // { n: number }
await this.prisma.db.public.Team.include('members').first({ id });
await users.where({ id }).update({ name });                 // Row | null
await users.where({ id }).delete();                         // Row | null
await users.upsert({ create: { /* … */ }, update: { /* … */ }, conflictOn: { email } }); // default: primary key
```

- Field operators: `.eq`, `.neq`, `.lt`, `.lte`, `.gt`, `.gte`, `.like`, `.ilike`, `.in([...])`, `.isNull()`, `.isNotNull()`. For a case-insensitive search use `ilike`, and escape `%`, `_` and `\` in user input with `value.replace(/[\\%_]/g, '\\$&')`.
- There is no `.count()` terminal; use `aggregate((a) => ({ n: a.count() }))`.
- `.all()` has no implicit limit. Use `.first()` when you want one row.
- Take `and` / `or` / `not` from `PrismaService`. The `orm-client` module is ESM-only, and a static import breaks Jest.
- For anything the field proxy cannot express (an array membership, a JSON path), pass a raw predicate: ``.where(() => this.prisma.condition`${role} = ANY("roles")`)``.

### Errors

Prisma 8 passes PostgreSQL's own error through, with its SQLSTATE. Use the helpers from `#setup/prisma`:

```typescript
try {
  return await this.users.create({ id, ...data });
} catch (error) {
  if (isUniqueViolation(error, ['email'])) throw new UserExistsError(data.email);
  throw error;
}
```

| Situation | Helper | SQLSTATE |
|-----------|--------|----------|
| unique key collision | `isUniqueViolation(e, columns?)`, `uniqueViolationColumns(e)` | `23505` |
| missing parent / existing children | `isForeignKeyViolation(e)` | `23503` |
| serialization failure, deadlock | `isRetryable(e)` | `40001`, `40P01` |
| row not found on update/delete | none: the call answers `null` | |

## Raw SQL

Use raw SQL only for what the ORM cannot express, such as `FOR UPDATE SKIP LOCKED`, `ON CONFLICT … DO UPDATE` over many rows, or advisory locks. Every `${value}` becomes a bound parameter.

```typescript
const rows = await this.prisma.rawRows(
  this.prisma.sql`
    SELECT "id", "email" FROM "User"
    WHERE "verified" = ${true} AND "createdAt" > ${this.prisma.param(since, 'pg/timestamptz-date@1')}
    FOR UPDATE SKIP LOCKED`.returnsRow({ id: 'pg/text@1', email: 'pg/text@1' }),
);

const n = await this.prisma.rawExecute(
  this.prisma.sql`UPDATE "User" SET "verified" = true WHERE "id" = ANY(${this.prisma.param(ids, 'pg/text-array@1')})`
    .affectedCount(),
);
```

Common codecs are `pg/text@1`, `pg/int4@1`, `pg/int8@1` (bigint), `pg/bool@1`, `pg/jsonb@1`, `pg/timestamptz-date@1` and `pg/text-array@1`. A plain string, number, bigint or boolean infers its codec; `null`, `Date`, arrays and JSON go through `param(value, codecId)`. `rawExecuteUnsafe(text)` runs trusted text without parameters.

## Transactions

```typescript
await this.prisma.transaction(async () => {
  const team = await this.teamGateway.create(data); // gateways need no tx parameter
  await this.membershipGateway.add(team.id, ownerId, 'owner');
});
```

- **Ambient.** `transaction()` keeps the open transaction in an `AsyncLocalStorage`, and `db` and the raw helpers use it. Gateways neither opt in nor can forget to, and no Prisma type reaches a domain signature. The callback also receives the transaction's models: `async (db) => db.User.create(…)`.
- **Nested calls join** the transaction already in progress. There are no savepoints.
- **Retries.** The outermost call re-runs the whole callback on a serialization failure or deadlock (`maxRetries`, default 2), so keep side effects outside the database out of it.
- **Timeout.** After `timeoutMs` (default 30 s) the transaction rolls back with `TransactionTimeoutError`.
- **Isolation.** `{ isolationLevel: TransactionIsolationLevel.Serializable }`.
- **IDs.** Inside a transaction call `withIdRetry(work, this.prisma.inTransaction)`: a collision aborts the transaction, so its owner repeats the unit.

There is no batched form: use the callback. Where a transaction boundary belongs across slices is covered in [Transactions Across Slices](/architecture/transactions).

## Migrations

Migrations are TypeScript plans under `prisma/migrations/app/<timestamp>_<name>/` (`migration.ts`, `ops.json`, `migration.json`), with contract snapshots under `prisma/migrations/snapshots/` and the ref `prisma/migrations/app/refs/deploy.json`, which names the contract the next deploy brings a database to. `prisma/migrations/package.json` is `{ "type": "module" }`. Commit all of it. Migrations run forward only.

### Making a Change

```bash
# 1. Edit the slice .prisma file, then emit the contract
bun run prisma:emit
# 2. Plan from the deploy ref (the last shipped contract); prints the DDL
bun run db:plan -- --name add_team
# 3. Review prisma/migrations/app/<ts>_add_team/ops.json
# 4. SQL the planner cannot express goes in a guarded rawSql step in migration.ts, then:
node prisma/migrations/app/<ts>_add_team/migration.ts   # re-emits ops.json + migration.json
# 5. Point the deploy ref at the plan's "to" hash
bunx prisma migration ref set deploy <hash>
# 6. Apply
bun run db:deploy
```

The planner renders `migration.ts`. Edit only its `operations`, never the import line. A hand-written step looks like this:

```typescript
rawSql({
  id: 'user-email-lower', label: 'Case-insensitive unique email',
  operationClass: 'additive', target: { id: 'postgres' },
  precheck: [{ description: 'not there yet', sql: `SELECT to_regclass('public."User_email_lower"') IS NULL AS result`, params: [] }],
  execute: [{ description: 'create index', sql: `CREATE UNIQUE INDEX "User_email_lower" ON "User" (lower("email"))`, params: [] }],
  postcheck: [{ description: 'index exists', sql: `SELECT to_regclass('public."User_email_lower"') IS NOT NULL AS result`, params: [] }],
} as never),
```

### Applying: `scripts/migrate.mjs`

There is one way to bring a database up to date. `bun run dev` (through `predev`), the test global setup and the container start all call it:

```javascript [scripts/migrate.mjs]
import { spawnSync } from 'node:child_process';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const apiDir = join(dirname(fileURLToPath(import.meta.url)), '..');
const say = (line) => console.error(`migrate: ${line}`);

function run(command, args) {
  const result = spawnSync(command, args, { cwd: apiDir, stdio: 'inherit', env: process.env });
  if (result.error) throw result.error;
  if (result.status !== 0) {
    throw new Error(`${[command, ...args].join(' ')} exited with ${result.status ?? result.signal}`);
  }
}

function main() {
  if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL is not set');
  say('applying database migrations');
  // The CLI's own entry, run by this node: the runtime image has no Bun and no npx.
  const cli = join(apiDir, 'node_modules', 'prisma', 'dist', 'prisma.js');
  run(process.execPath, [cli, 'db', 'migrate', '--to', 'deploy', '--format', 'human']);
  say('done');
}

try {
  main();
} catch (error) {
  say(`failed: ${error instanceof Error ? error.message : String(error)}`);
  process.exitCode = 1;
}
```

Applied plans are skipped, so a second run does nothing. `bun run db:status` shows what is pending, and `bun run db:verify` checks the database against the contract.

A new project starts with one plan, `init`, and the `deploy` ref. To create the first plan yourself, run `bunx prisma migration plan --name init` (it plans from an empty database) and then `migration ref set deploy <hash>`.

## Environment Variables

```bash [.env.dev]
DATABASE_URL=postgresql://postgres:root@localhost:4230/cleanslice-api-local-database
```

In production `DATABASE_URL` comes from the environment (Terraform, a Kubernetes secret, the hosting platform). Any managed PostgreSQL works: RDS, Neon, Supabase.

## Docker

```dockerfile [Dockerfile]
# build stage
COPY api/package.json api/bun.lock ./
# postinstall (contract emit) needs the slices' *.prisma files, copied only below
RUN bun install --frozen-lockfile --ignore-scripts
COPY api/ ./
RUN bun run build   # emits the contract, then nest build

# runtime stage
COPY --from=api-builder /build/api/dist ./api/dist
COPY --from=api-builder /build/api/node_modules ./api/node_modules        # includes the prisma CLI
COPY --from=api-builder /build/api/package.json /build/api/prisma.config.ts ./api/
COPY --from=api-builder /build/api/generated ./api/generated              # read by PrismaService
COPY --from=api-builder /build/api/prisma/migrations ./api/prisma/migrations
COPY --from=api-builder /build/api/scripts/migrate.mjs ./api/scripts/
COPY --from=api-builder /build/api/src/slices ./api/src/slices            # the contract source
RUN find ./api/src -type f ! -name '*.prisma' -delete && find ./api/src -type d -empty -delete
```

The start script runs `node scripts/migrate.mjs` before `node dist/main.js`.

::: warning
Keep `**/*.tsbuildinfo` in `.dockerignore`. A local incremental build-info file makes `nest build` inside the image emit nothing.
:::

## Tests

- Run `bun run test`, never `bun test`. The script is `prisma contract emit && NODE_OPTIONS=--experimental-vm-modules jest`: Jest only allows the runtime's `import()` under that flag.
- ts-jest uses the project tsconfig: `"transform": { "^.+\\.(t|j)s$": ["ts-jest", { "tsconfig": "<rootDir>/../tsconfig.json" }] }`.
- Database specs run against **PostgreSQL**, never SQLite. A Jest `globalSetup` drops and recreates a dedicated database whose name must contain `test`, then runs `scripts/migrate.mjs`; a `setupFiles` entry points `DATABASE_URL` at it. Set `maxWorkers: 1` when suites share that database.
- Build gateways on a real client: `const prisma = await PrismaService.open(); new UserGateway(prisma, new UserMapper())`, with `prisma.close()` in `afterAll` and a `TRUNCATE` in `beforeEach`.
- Unit specs that fake a database error use its real shape: `Object.assign(new Error('duplicate key'), { sqlState: '23505', detail: 'Key (id)=(x) already exists.' })`.

The kit's `api/test/globalSetup.cjs`, `api/test/env.cjs` and `src/slices/setup/prisma/tests/prisma.service.e2e-spec.ts` are the reference.

::: tip Upgrading an older project
A project created before 2026-10-26 runs Prisma 6 with prisma-import. [Upgrading from Prisma 6](/backend/prisma-upgrade) walks through the move, including how to adopt the existing database without losing data.
:::

## What's Next?

- [Gateways](/backend/gateways) -- See how gateways use PrismaService for data access
- [Identifiers](/standards/identifiers) -- The one primary ID format and how gateways mint it
- [Mappers](/backend/mappers) -- Convert rows to domain types
- [Upgrading from Prisma 6](/backend/prisma-upgrade) -- The full upgrade procedure
- [Slice Structure](/backend/slice-structure) -- Where model files fit in the slice layout
