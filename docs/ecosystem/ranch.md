# Ranch

> Agent deployment platform on Kubernetes. Deploy, manage, and monitor AI agents at scale.

- **Repository:** [github.com/CleanSlice/ranch](https://github.com/CleanSlice/ranch)
- **Live demo:** [ranch.cleanslice.org](https://ranch.cleanslice.org/)

## What it does

Ranch is a multi-tenant control plane for AI agents. You bring an agent (a Runtime checkout, a Docker image, or a template), Ranch handles the rest — secrets, MCP servers, skills, deployment, logs, usage metering.

It's the production answer to "how do I run a fleet of agents without writing my own platform team."

## Highlights

- **GitOps-native** — ArgoCD syncs every agent from Git. No imperative deploys.
- **Argo Workflows** — agent runs are workflows. Scale to thousands of pods, retry, fan-out.
- **CloudNativePG** — managed PostgreSQL per tenant on Hetzner Cloud.
- **MCP runtime hosted at `/mcp/*`** — agents expose their tools through the Model Context Protocol.
- **Per-tenant ranches** — each workspace gets its own slice of the platform.
- **Built-in admin panel** — Nuxt + shadcn-vue dashboards for ops, users, secrets.

## Stack

| Layer | Technology |
|---|---|
| Backend | NestJS, Prisma, PostgreSQL |
| Frontend | Nuxt 3, Vue 3, Pinia, Tailwind, shadcn-vue |
| Infrastructure | Terraform, Hetzner Cloud, k3s |
| Deployment | ArgoCD (GitOps), Argo Workflows |
| Runtime | Bun |
| Monorepo | Turborepo |

## Quick start

```bash
bun add -g @cleanslice/ranch
# or: npm install -g @cleanslice/ranch

ranch dev    # offers to clone, then starts api + app + admin + local k3d
```

The `ranch dev` command boots the full platform locally: API on `:3000`, dashboard on `:3001`, admin on `:3002`, and a local k3d cluster for workflows.

For manual setup, deployment to Hetzner, and full CLI reference, see the [README](https://github.com/CleanSlice/ranch).

## Slices

Ranch follows the CleanSlice convention strictly. Major slices:

- `agent`, `file`, `pod`, `secret`, `template`, `templateFile` — the agent lifecycle
- `workflow` — Argo Workflows integration
- `bridle` — chat sessions, messages, streaming (browser channel)
- `mcp`, `mcpServer` — MCP runtime + registry
- `llm` — provider configuration
- `skill` — reusable agent skills
- `rancher` — per-tenant workspace management
- `reins` — access control / API keys
- `setting`, `usage`, `log` — system-wide concerns

Reading any one of these is the fastest way to learn how a real production CleanSlice app is structured.
