# Identifiers

Every primary key in a CleanSlice application has one format, minted by the application, never by the database:

```
<prefix>-<adjective>-<noun>-<suffix>
user-calm-rivers-k8m4p2d7n9x3
```

The `setup/id` slice of the starter kit owns the format. Feature slices call `formatId(prefix)` inside the write, wrap the write in `withIdRetry`, and validate incoming IDs with `@IsEntityId(prefix)` or `EntityIdPipe`. Nothing else in the codebase knows how an ID is built.

## Why This Format

- **Readable and self-describing.** The prefix names the entity, so a log line, a support ticket or a URL tells you what it refers to without a lookup. `team-api-key-…` is never confused with `team-…`.
- **Enough entropy.** The suffix carries 60 bits; the words add roughly 16. Collisions are decided by the primary key, not by hope.
- **One module, many products.** `idFormat.ts` is byte-for-byte the same in every CleanSlice product; a control test vector proves a copy is exact.
- **The application mints.** A gateway knows the ID before the row exists, can reserve it before an irreversible external effect, and a test can inject a deterministic byte source. A database default can do none of that.

## The Format

| Part | Rule |
|---|---|
| `prefix` | The entity, lowercase kebab-case, at most 32 characters, may itself contain `-` (`team-api-key`). |
| `adjective` | One of the 200 adjectives of **human-id 4.1.3**, in the package's own order. |
| `noun` | One of the 300 nouns of **human-id 4.1.3**. No verb, no adverb, no dictionary of our own. |
| `suffix` | Exactly **12** characters of lower-case Crockford base32: `0123456789abcdefghjkmnpqrstvwxyz` (no `i`, `l`, `o`, `u`). 60 bits. |
| randomness | Node `crypto.randomBytes`. Words by masked rejection; the suffix by **nanoid 3.3.11** `customRandom`. |
| uniqueness | The primary key. On a collision the whole write is repeated, at most 5 times. |
| length | At most 62 characters for a canonical ID; any accepted value, legacy included, at most 80 (`ID_MAX_LENGTH`). |

Both dependencies are pinned exactly, without `^`:

```json [package.json]
{
  "dependencies": {
    "human-id": "4.1.3",
    "nanoid": "3.3.11"
  }
}
```

A floating minor would change the dictionaries and with them every ID the product mints. The test suite asserts the installed versions.

## Prefixes

A prefix belongs to an entity and is declared once, next to that entity's domain types. The application owns this registry, not the `setup/id` slice:

```typescript [slices/user/domain/user.types.ts]
/** Primary ID prefix of the User entity: `user-<adjective>-<noun>-<12 Crockford>`. */
export const USER_ID_PREFIX = 'user';
```

Rules:

- Lowercase kebab-case, `^[a-z][a-z0-9]*(-[a-z0-9]+)*$`, at most 32 characters. `formatId` and every validator throw a `TypeError` for anything else, at build time, not on the first request.
- The whole model name in kebab-case: `OrganizationMember` → `organization-member`, `ApiKey` → `api-key`. Shorten only by a decision recorded in the registry (`org`, not `organization`, is such a decision).
- A hyphenated prefix is never ambiguous: the number of segments after the prefix is fixed at three, so `team-api-key-calm-rivers-k8m4p2d7n9x3` is a `team-api-key` ID and `isId(value, 'team')` refuses it.
- Prefixes are never reused for a second entity and never changed in place. Renaming one is a migration.

## Generation

`formatId(prefix, random = crypto.randomBytes)` is the only way a new ID is made. It reads from a source `random(n)` that returns `n` bytes, in this order:

1. **adjective**, `index(200)`
2. **noun**, `index(300)`
3. **suffix**, nanoid 3.3.11 `customRandom(alphabet, 12, random)()` with the same source

`index(n)` takes the fewest whole bytes that hold `n − 1`, reads them big-endian, masks the value to the bit length of `n − 1`, and draws again while the value is not below `n`. That keeps the draw unbiased.

| n | bits | bytes per try | mask | accepted when |
|---|---|---|---|---|
| 200 (adjectives) | 8 | 1 | 255 | value < 200 |
| 300 (nouns) | 9 | 2 | 511 | (b0·256 + b1) & 511 < 300 |

nanoid's `customRandom` for a 32-letter alphabet and size 12 asks for `ceil(1.6 × 31 × 12 / 32)` = **19** bytes in one request, reads them from the last one back, keeps `byte & 31` of each, and stops after 12 letters; the first 7 bytes of the request are unused.

### Control test vector

A source that hands out bytes `0, 1, 2, 3, …` in order gives:

```
formatId('user', counter) === 'user-afraid-swans-nmkjhgfedcba'
```

Byte 0 → `adjectives[0]` = `afraid`; bytes 1, 2 → 258 & 511 = 258 → `nouns[258]` = `swans`; one request of bytes 3…21, read from 21 down to 10 → letters 21…10 of the alphabet = `nmkjhgfedcba`. Exactly **22** bytes are read. Every product's suite asserts this string. A different result means a different dictionary, order, alphabet or draw, which is not a valid copy of the module.

## Prisma Models

The column is a plain string primary key. No `@default(uuid())`, no `@default(cuid())`, no `autoincrement()`:

```prisma [slices/user/user.prisma]
// use prisma-8
model User {
  id        String   @id        // minted by the gateway: formatId(USER_ID_PREFIX)
  email     String   @unique
  name      String
  createdAt TimestamptzJsDate(3) @default(now())
  updatedAt temporal.timestamptzJsDate(3, onCreate: now, onUpdate: now)
}
```

Foreign keys are the same type (`teamId String`) and are validated at the boundary with the owner's prefix.

## Minting in the Gateway

The mapper prepares everything **except** the id. The gateway mints the id inside the write and repeats the whole write on a primary-key collision:

```typescript [slices/user/data/user.gateway.ts]
import { Injectable } from '@nestjs/common';
import { PrismaService } from '#setup/prisma';
import { formatId, withIdRetry } from '#setup/id';
import { IUserGateway } from '../domain/user.gateway';
import { ICreateUserData, IUserData, USER_ID_PREFIX } from '../domain/user.types';
import { UserMapper } from './user.mapper';

@Injectable()
export class UserGateway extends IUserGateway {
  constructor(
    private readonly prisma: PrismaService,
    private readonly mapper: UserMapper,
  ) {
    super();
  }

  async createUser(data: ICreateUserData): Promise<IUserData> {
    const createData = this.mapper.toCreate(data);
    const user = await withIdRetry(
      () => this.prisma.db.public.User.create({ id: formatId(USER_ID_PREFIX), ...createData }),
      this.prisma.inTransaction,
    );
    return this.mapper.toData(user);
  }
}
```

```typescript [slices/user/data/user.mapper.ts]
import type { PrismaCreate } from '#setup/prisma';

/** Everything but the id: the gateway mints that with formatId(USER_ID_PREFIX). */
toCreate(data: ICreateUserData): Omit<PrismaCreate<'User'>, 'id'> {
  return {
    email: data.email.toLowerCase().trim(),
    name: data.name.trim(),
    password: data.password,
    roles: [],
  };
}
```

`formatId` is called **inside** the callback so that every attempt is a new candidate. Minting once outside and retrying the same value would retry the same collision.

## Retry

`withIdRetry(work, insideTransaction = false)` repeats `work` at most **5** times (`ID_MAX_ATTEMPTS`) and only when the failure is a unique violation on exactly the `id` column, read off PostgreSQL's own error (SQLSTATE `23505` on the `id` key) by `isUniqueViolation(error, ['id'])` from `#setup/prisma`. Any other error is rethrown on the first attempt: a conflict on `email`, a foreign-key failure, a timeout.

- **Inside `prisma.transaction(...)`, pass `this.prisma.inTransaction`.** A failed statement leaves a PostgreSQL transaction aborted; the owner of the transaction repeats the whole unit of work, not one statement of it.
- **External effects stay outside `work`.** The callback is a database write, nothing else. Sending an email or calling a provider inside it would run up to five times.
- **Other uniqueness keeps its meaning.** A duplicate email is a domain error for the service to translate, not a reason to mint again.

## Validation

`isId(value, prefix)` accepts the canonical form or a legacy format the product has declared. It is a format check and nothing more: it never looks anything up and never grants access. There is no normalization: upper case, Unicode look-alikes, percent-encoded dashes and surrounding whitespace are refused rather than cleaned.

At the HTTP boundary:

```typescript [slices/team/dtos/moveFile.dto.ts]
import { IsEntityId } from '#setup/id';

export class MoveFileDto {
  @ApiProperty({ example: 'team-calm-rivers-k8m4p2d7n9x3', pattern: idPattern(TEAM_ID_PREFIX) })
  @IsEntityId(TEAM_ID_PREFIX)
  teamId: string;
}
```

```typescript [slices/user/user.controller.ts]
@Get(':id')
@ApiParam({ name: 'id', example: 'user-calm-rivers-k8m4p2d7n9x3' })
getUser(@Param('id', new EntityIdPipe(USER_ID_PREFIX)) id: string) {
  return this.userService.getUser(id);
}
```

Elsewhere (a zod schema, a pipe of your own, a gateway guard) `entityId(prefix)` returns the check itself: `z.string().refine(entityId('artifact'))`. The prefix is validated once when the check is built, so a typo fails at boot.

`idPattern(prefix)` gives the OpenAPI `pattern` for a new ID; the generated frontend SDK types carry it.

Refused as canonical: a third word, a 6- or 20-character suffix, hex of another length, `i`/`l`/`o`/`u` in the suffix, a word outside the dictionaries, a UUID, a cuid. Twelve hex digits are a subset of the Crockford alphabet, so `…-a1b2c3d4e5f6` is canonical; that cannot and need not be told apart.

## Reservation

Some work is irreversible and must carry the ID before the row can exist: an object key in S3, a record on a payment provider, a webhook secret. `IIdGateway.reserve(prefix)` burns an identity in its own committed statement (the `IdReservation` table) so that the external work can use it; the business row is created afterwards with the reserved id. Failed operations do not recycle IDs. Call it before opening the business transaction, never inside one.

```typescript
const fileId = await this.ids.reserve(FILE_ID_PREFIX);
await this.storage.upload(fileId, body);          // external, irreversible
await this.fileGateway.create({ id: fileId, ... }); // the row, with the reserved id
```

## Legacy IDs and the Transition

`LEGACY_ID_FORMATS` in `idFormat.ts` is the only part of the module that differs between products. It lists formats the product has **already issued** and must keep accepting; nothing in it is ever minted. A fresh project has issued nothing, so the list is empty.

A project scaffolded before this standard holds `user-<uuid>` rows. It declares that shape and changes nothing else:

```typescript [slices/setup/id/domain/idFormat.ts]
export const LEGACY_ID_FORMATS: readonly ILegacyIdFormat[] = Object.freeze([
  {
    name: 'prefixed-uuid',
    shape: '<prefix>-<lower-case UUID> (before the ID standard)',
    prefixed: true,
    segments: 5,
    test: (s) =>
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/.test(s.join('-')),
  },
]);
```

From then on `isId` accepts both shapes, `isCanonicalId` only the new one, and `legacyIdFormat(value)` tells which legacy entry matched.

**Rewriting existing rows is a separate procedure**, agreed and scheduled explicitly, never implied by adopting the standard:

1. Inventory every table and every column that references the entity, including JSON payloads, provider references and idempotency keys.
2. Stop writers, back up, restore-check.
3. One transaction per entity type: insert the mapping (`entity`, `oldId`, `newId`), rewrite the primary key and every reference, revoke sessions and signed contexts that embed the old value.
4. Repeat runs change zero identities; the command must be safe to run twice.
5. Old HTTP paths are not aliased. References that arrive from outside (webhooks, provider callbacks) resolve through the recorded mapping.

See [Migrations and Evidence of Readiness](/architecture/migrations-and-evidence) for what counts as proof that such a run is ready.

## Checklist

- [ ] `human-id` and `nanoid` pinned exactly; the suite asserts the control vector `user-afraid-swans-nmkjhgfedcba`
- [ ] Every model: `id String @id`, no `@default(uuid())`, `cuid()` or `autoincrement()`
- [ ] Every entity declares `{ENTITY}_ID_PREFIX` next to its domain types
- [ ] Gateways mint with `formatId(prefix)` inside `withIdRetry`; mappers never produce an id
- [ ] Every incoming ID is checked with `@IsEntityId(prefix)`, `EntityIdPipe` or `entityId(prefix)`
- [ ] Irreversible external work uses a reserved id
- [ ] `LEGACY_ID_FORMATS` lists only what the product has already issued

### Never Do

- `@default(uuid())`, `@default(cuid())`, `randomUUID()`, `uuid()` for a primary key
- `formatId` outside the retried callback
- Normalizing an incoming ID (lower-casing, trimming) before checking it
- Accepting an ID without a prefix check (`isId(value, prefix)`, never a bare "looks like an id")
- Rewriting issued IDs as a side effect of a deploy

## What's Next?

- [Database](/backend/database) -- Prisma models and migrations
- [Gateways](/backend/gateways) -- Where IDs are minted
- [DTOs](/backend/dtos) -- Where IDs are validated
