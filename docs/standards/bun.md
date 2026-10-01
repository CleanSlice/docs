# Bun

CleanSlice projects use **Bun**. Not npm, not yarn, not pnpm — one package manager, one lockfile (`bun.lock`), one set of commands in every README, every Dockerfile and every setup guide.

Two package managers in a repo means two lockfiles that disagree and a CI that installs something different from what the developer ran. The choice matters less than there being exactly one — and that one is Bun.

## The command map

| Instead of | Use | Notes |
|---|---|---|
| `npm install` | `bun install` | Restores from `bun.lock` |
| `npm ci` | `bun install --frozen-lockfile` | CI and Docker: fail rather than move the lock |
| `npm install <pkg>` | `bun add <pkg>` | |
| `npm install -D <pkg>` | `bun add -d <pkg>` | |
| `npm uninstall <pkg>` | `bun remove <pkg>` | |
| `npm run <script>` | `bun run <script>` | |
| `npx <cli>` | `bunx <cli>` | `bunx prisma`, `bunx shadcn-vue@latest add` |
| `package-lock.json` | `bun.lock` | Commit it. Never both |

## What does not change

**Pre-scripts still run.** `bun run dev` runs `predev` first, `bun run migrate` runs `premigrate`. The CleanSlice flow leans on this — `predev` is where docker, prisma-import, migrations and the [boundary check](/standards/boundary-check) live.

**The scripts themselves.** `nest build`, `nuxt dev`, `jest`, `eslint` — same binaries, same flags.

**Node still serves production.** Bun installs and builds; the api's runtime image runs the compiled output on Node. That is why a runtime image without Bun calls a local binary directly — `node_modules/.bin/prisma migrate deploy` — instead of `bunx`.


## Docker: Bun installs, Node builds

Use a **Node** base image with the Bun binary copied in, not `oven/bun`:

```dockerfile
FROM node:20-alpine AS builder
COPY --from=oven/bun:1-alpine /usr/local/bin/bun /usr/local/bin/bun
# `bunx` is a symlink to the same binary in the oven image — copying the binary
# alone leaves the build with `bunx: not found`
RUN ln -s /usr/local/bin/bun /usr/local/bin/bunx

WORKDIR /app
COPY package.json bun.lock ./
RUN bun install --frozen-lockfile
COPY src ./src
RUN bun run build
```

`oven/bun` ships a **shim named `node`**, so `nest build` runs under Bun there — and Nest's tsconfig-paths hook then leaves `#slice` aliases in the emitted JavaScript instead of rewriting them to relative paths. The image builds without a warning and dies on boot with `Cannot find module '#mcp'`. Same source, same lockfile, same command: `require("#mcp")` inside `oven/bun`, `require("../mcp")` with a real Node under the build.

A Nuxt build has no such hook and is unaffected — but one rule for every image beats remembering which is which.

## Migrating a project that still has `package-lock.json`

Run `bun install` **while `package-lock.json` is still there**. Bun reads it and carries the exact resolved versions into `bun.lock`; delete the npm lockfile afterwards.

```bash
bun install          # migrates package-lock.json → bun.lock, same versions
rm package-lock.json
bun run build        # prove the build still passes before committing
```

Deleting the npm lockfile first re-resolves every range from scratch, and a minor version you never asked for can break the build.

## Rules

1. `bun.lock` is committed; `package-lock.json`, `yarn.lock` and `pnpm-lock.yaml` are not.
2. Scripts call `bun run` and `bunx` — inside `package.json`, Dockerfiles, `start.sh`, husky hooks and CI alike.
3. Docker installs with `--frozen-lockfile`. A build that quietly updates the lockfile ships something nobody tested.
4. Scaffolds that hard-code a package manager get `--skip-install`, then `bun install`. The NestJS CLI's `--package-manager` flag has no Bun value; don't pass it `npm`.
5. Docs count. A page that still says `npm install` teaches the next reader — human or agent — to break rule 1.

## Checklist

- [ ] `bun.lock` committed, no other lockfile in the repo
- [ ] Every `package.json` script uses `bun run` / `bunx`
- [ ] Dockerfile builds on `oven/bun` with `bun install --frozen-lockfile`
- [ ] README and setup docs say `bun`
