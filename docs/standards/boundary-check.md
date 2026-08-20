# Boundary Check

`cleanslice-check.cjs` is the part of CleanSlice a machine can enforce. It is the
**same file in every project** — the group order comes from `cleanslice.json`, so
a project with three slice groups is checked against three and one with eight
against eight. Nothing project-specific is ever written into the script; a check
you have to edit per project is a template, and templates drift.

It runs in about half a second, which is why it belongs in front of `dev` and not
only in CI.

## Files

```
api/
├── cleanslice.json              # this project's groups, low → high
└── scripts/
    └── cleanslice-check.cjs     # identical in every CleanSlice project
```

```bash
node scripts/cleanslice-check.cjs
```

| Exit code | Meaning |
|---|---|
| `0` | clean |
| `1` | violations found |
| `2` | the check itself could not run (bad config, missing dependency) |

## Configuration

```json
{
  "srcRoot": "src",
  "slicesRoot": "src/slices",
  "groups": ["infra", "setup", "system", "user", "admin", "runtime", "agent", "billing"]
}
```

**The order of `groups` is the layering.** `groups[0]` is the lowest; a group may
import only groups below it. Reorder the array and what is legal changes — with no
edit to the script.

A group that lives outside `slicesRoot` gives its own path:

```json
{
  "groups": [
    "setup",
    { "name": "user", "path": "src/user" }
  ]
}
```

A group pointing at a directory that does not exist stops the check with exit code
`2`. It is not a warning: a group with no folder produces rules that can never
fire, and a check that silently stops guarding something is worse than no check.

## The three rules

### 1. Group dependencies point downward

```typescript
// src/slices/infra/redis/redis.service.ts
import { AgentService } from '#agent/agent/domain/agent.service'; // ✘ infra (L0) → agent (L6)
```

```
error no-upward-import-from-infra: src/slices/infra/redis/redis.service.ts → src/slices/agent/agent/domain/agent.service.ts
  'infra' (L0) may not import higher groups: setup, system, user, admin, runtime, agent, billing
```

### 2. No dependency cycles

```
error no-circular: src/user/user/domain/user.service.ts →
    src/user/user/user.controller.ts →
    src/user/user/domain/user.service.ts
```

### 3. The layers inside a slice

Presentation → domain → data, and never backwards or across.

- A **controller** depends on a service. Never on `data/`, never on a gateway.
- **Domain** depends on the gateway *interface* beside it in `domain/`. Never on
  the implementation in `data/`.

Rule 3 is checked in two ways, because one is not enough:

| Form | Looks like | Caught by |
|---|---|---|
| direct | `import { UserGateway } from './data/user.gateway'` | the module graph |
| barrel | `import { IUserGateway } from './domain'` | the **import names** |

The barrel form is the one that matters. At module level, pulling the gateway
interface out of `domain/index.ts` looks exactly like importing the service next
to it — which is how six controllers in one codebase ended up holding gateways,
four of them another slice's, with a fully green gate. The script parses every
`*.controller.ts` and rejects any imported identifier ending in `Gateway`:

```
error no-gateway-name-in-controller: a controller may not import a gateway.

  src/user/user/user.controller.ts:58  imports `IUserGateway` from `./domain` — call the owning slice's service instead
```

## Running it on `dev`

```json
{
  "scripts": {
    "cleanslice": "node scripts/cleanslice-check.cjs",
    "predev": "npm run cleanslice && npm run docker && npm run generate && npm run migrate"
  }
}
```

A broken tree never reaches the database step:

```
> starter-api@1.0.0 cleanslice
> node scripts/cleanslice-check.cjs

  error no-gateway-name-in-controller: a controller may not import a gateway.
    src/user/user/user.controller.ts:58  imports `IUserGateway` from `./domain` — call the owning slice's service instead

✘ cleanslice-check failed (2 groups, 0.5s)
```

Projects that boot the API another way hook the same script into their own dev
entry point — a `prestart:dev` script, a Makefile target, a run script. Only the
call site changes.

## What it does not catch

A green run means these three rules hold. It does not mean the code is CleanSlice-clean.

- **Runtime wiring.** The rules read imports. A gateway handed to a controller
  through NestJS DI, with no import in the controller, is invisible.
- **Dynamic imports**, string-built module paths, anything resolved at runtime.
- **Naming** — singular slice names, `{entity}.service.ts`, `dtos/`, `operationId`.
- **DTO and validation rules** — whether a controller returns a DTO, whether a
  service leaks one.
- **Business logic in the wrong place.** A controller full of rules imports
  nothing forbidden.
- **Frontend slices.** The script checks the API's TypeScript project only.
- **Tests.** `*.spec.ts` / `*.e2e-spec.ts` are excluded on purpose — a test wires
  across layers legitimately. Including them would force the real rules to be
  weakened to keep tests compiling.
- **Peers.** Two slices in the same group may import each other freely.

## Changing it

Prove every rule with a **red run**: break the code on purpose, watch the rule
fire, put it back. A rule that stays green on broken code is worse than a missing
one — it manufactures confidence. Two ways to get exactly that, both silent:

- Omitting `validate: true` — dependency-cruiser then parses the rule set, echoes
  it back, and never applies it. Everything passes.
- Putting the tsconfig filename anywhere other than
  `ruleSet.options.tsConfig.fileName` — the tsconfig `paths` are then never
  loaded, every aliased import (`#user/auth`) fails to resolve, and an edge that
  does not resolve is one no rule can forbid.

## See also

- [NestJS Standards](/standards/nestjs)
- [Layers](/architecture/layers)
- [Dependency Flow](/architecture/dependency-flow)
- [Controllers](/backend/controllers)
- [Services](/backend/services)
