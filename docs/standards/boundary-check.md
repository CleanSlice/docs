# Boundary Check

CleanSlice makes two promises that a compiler cannot keep for you: slices do not reach sideways, and layers inside a slice only point inward. `cleanslice-check.cjs` keeps them, and it runs on every `dev` start.

TypeScript is perfectly happy with a controller that injects a gateway from a neighbouring slice — the import resolves, the types line up, the app boots. Nothing goes wrong until someone changes that gateway. Left to review, that drift is found by eye, one file at a time, usually long after it spread.

## Setup

```
api/
├── cleanslice.config.cjs        # this project's group order
├── scripts/
│   └── cleanslice-check.cjs     # the check — identical in every project
└── package.json
```

```bash
npm install --save-dev dependency-cruiser
```

```json
{
  "scripts": {
    "check": "node scripts/cleanslice-check.cjs",
    "predev": "npm run check && npm run docker && npm run generate && npm run migrate"
  }
}
```

`predev` runs before `dev` automatically. Keep `npm run check` first — a violation then stops the start before docker, prisma or nest do any work.

## Configuration

Slice groups differ per project, so they are configuration, never code:

```js
// api/cleanslice.config.cjs
module.exports = {
  groups: ['setup', 'user'],
};
```

| Key | Default | Meaning |
|-----|---------|---------|
| `groups` | *required* | Slice groups, **lowest first**. The order is the rule. |
| `slicesDir` | `src/slices` | Where the group folders live. |
| `sourceDir` | `src` | What gets cruised. |

The same unmodified script checks a project with eight groups:

```js
module.exports = {
  groups: ['infra', 'setup', 'system', 'user', 'admin', 'runtime', 'agent', 'billing'],
};
```

::: warning
Never hard-code group names in the script. A check you have to edit per project is a template, not a standard.
:::

A group declared in the configuration but missing from `slicesDir` stops the run with exit code `2` — a rule generated for a folder that does not exist checks nothing, and a check that silently checks nothing is worse than no check at all.

## The Three Rules

### 1. Groups point downward

A group may depend on everything below it and nothing above it.

```
error no-upward-import-from-setup: src/slices/setup/health/health.controller.ts -> src/slices/user/user/domain/user.service.ts
  'setup' (L0) may not import higher groups: user
```

One such import fuses two groups: from then on the lower one cannot be extracted, tested, or reasoned about without the higher one.

### 2. No cycles

```
error no-circular: user.gateway.ts -> user.types.ts -> user.service.ts -> user.gateway.ts
  No dependency cycles anywhere
```

A cycle is the point where "which module depends on which" stops having an answer.

### 3. Layers inside a slice

A controller calls a **service**; a service depends on the gateway **interface** it declares. Neither reaches into `data/`. Three sub-checks:

| Sub-check | Sees | Catches |
|-----------|------|---------|
| `no-data-layer-in-controller` | paths | `import { UserGateway } from './data/user.gateway'` |
| `no-data-layer-in-domain` | paths | a service importing a mapper or a concrete gateway |
| `no-gateway-name-in-controller` | names | `import { IUserGateway } from './domain'` — through the barrel |

The third sub-check reads import statements rather than the module graph, because the barrel form is invisible to a path-based rule: `controller -> ./domain` is the same edge whether it pulls in the service or the gateway. Only the imported name tells them apart.

```
error no-gateway-name-in-controller: src/slices/user/user/user.controller.ts -> ./domain (IUserGateway)
  A controller may not import a gateway — call the owning slice's service instead
```

See [Layers](/architecture/layers), [Dependency Flow](/architecture/dependency-flow) and [Controllers](/backend/controllers) for the rules themselves.

## What It Costs

| Project | Groups | Modules | Check |
|---------|--------|---------|-------|
| starter kit | 2 | 64 | ~0.30 s |
| agentfy2 | 8 | 348 | ~0.55 s |

End to end, `npm run dev` in the starter kit — docker, prisma-import, migrate, a full nest compile, up to "Nest application successfully started":

| | run 1 | run 2 |
|---|---|---|
| without the check | 5.66 s | 5.43 s |
| with the check | 6.08 s | 6.08 s |

Half a second on a start that already waits for docker, prisma-import and a nest compile. There is deliberately no light mode: a check you can skip is a check that gets skipped.

## What It Does Not Catch

A green run means "none of these three rules is broken". It does not mean "this code is CleanSlice".

- **Runtime wiring.** The check reads imports, not the DI container. A module providing the wrong class under `'IUserGateway'` passes.
- **Imports that do not resolve.** No resolved file means no edge, and no edge means no violation.
- **Gateways not named `*Gateway`.** The name sub-check keys on the suffix.
- **Namespace and dynamic imports.** `import * as domain from './domain'` hides names; `await import(path)` hides paths.
- **Test files.** `*.spec.ts` is excluded on purpose — tests legitimately wire across layers.
- **Layers by content.** The rules are directory-shaped: a Prisma query written inside `domain/user.service.ts` is a data concern in a domain file, and nothing here notices.
- **Anything inside a group.** Slice-to-slice imports within one group are allowed by design.
- **The frontend.** The script targets the api.
- **The rest of the conventions** — singular slice names, `operationId`, DTO validation, mappers free of business logic. Those are still on review; see [Standards](/standards/typescript).

Adding a rule is welcome on one condition: prove it red. Break the code on purpose, watch the check fail, then revert. A rule that stays green on broken code is worse than no rule — it manufactures confidence.

## Exit Codes

| Code | Meaning |
|------|---------|
| `0` | No violations. |
| `1` | Violations found; each printed with the rule that caught it. |
| `2` | The check could not run — missing or invalid `cleanslice.config.cjs`, or no `tsconfig.json`. |
