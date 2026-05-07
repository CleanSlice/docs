# Ecosystem

CleanSlice ships as a small constellation of focused packages. Each one is built on the same architecture (NestJS + Nuxt + slices), and each one solves a single problem in the AI-agent stack.

## Packages

| Package | What it does | Repository |
|---------|--------------|------------|
| [Ranch](/ecosystem/ranch) | Agent deployment platform on Kubernetes | [CleanSlice/ranch](https://github.com/CleanSlice/ranch) |
| [Runtime](/ecosystem/runtime) | Files-as-agent runtime with channels & tools | [CleanSlice/runtime](https://github.com/CleanSlice/runtime) |
| [Bridle](/ecosystem/bridle) | Webchat relay for browser ↔ agent | [CleanSlice/bridle](https://github.com/CleanSlice/bridle) |
| [Paddock](/ecosystem/paddock) | Automated eval & improvement loop | [CleanSlice/paddock](https://github.com/CleanSlice/paddock) |

## How they fit together

```
                       ┌─────────────────────┐
                       │      Paddock        │  evals + auto-patches
                       │  (eval & improve)   │──────────┐
                       └──────────┬──────────┘          │
                                  │ scores              │
                                  ▼                     ▼
┌──────────────┐         ┌─────────────────┐   ┌─────────────────┐
│   Bridle     │◀───────▶│     Runtime     │──▶│      Ranch      │
│ (web chat)   │         │  (agent files)  │   │ (k8s platform)  │
└──────────────┘         └─────────────────┘   └─────────────────┘
       ▲                          ▲                     ▲
       │                          │                     │
       └─── browser users ────────┴── Telegram/Slack ───┘
```

- **Runtime** is the single agent process — files in, channels out.
- **Bridle** plugs browsers into the runtime as another channel.
- **Ranch** runs many runtimes on Kubernetes with GitOps + Argo Workflows.
- **Paddock** evaluates a runtime against scenarios and patches code until it passes.

## Built with

Real products running on CleanSlice:

- **[miy.bot](https://miy.bot)** — Telegram bot builder powered by the CleanSlice runtime.
