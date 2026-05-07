# Runtime

> Agent runtime for the CleanSlice ecosystem. Define an agent as files, connect it to channels (Telegram, Slack), and let it use tools — all powered by a pluggable LLM backend.

- **Repository:** [github.com/CleanSlice/runtime](https://github.com/CleanSlice/runtime)

## What it does

An **agent** in CleanSlice is just files:

```
.agent/
├── SOUL.md              ← who the agent is
├── USER.md              ← who it works with
├── MEMORY.md            ← what it remembers
├── HEARTBEAT.md         ← periodic tasks to run
├── agent.config.json    ← runtime configuration
├── skills/              ← pluggable skills
├── data/                ← cron jobs, secrets
├── sessions/            ← conversation history (JSONL)
└── memory/              ← long-term memory storage
```

The **runtime** brings those files to life. It handles channels, LLM calls, tool execution, sessions, cron, and heartbeat — all configured through `agent.config.json`.

If you've ever wanted "just give me a working agent loop and let me describe behavior in Markdown," this is that.

## Highlights

- **Files as truth** — version-control your agent like code, edit in any editor.
- **Channels** — Telegram and Slack out of the box; pluggable for more.
- **Skills** — drop a folder into `skills/` to extend the agent's capabilities.
- **Heartbeat & cron** — proactive behavior, not just request/response.
- **Secret providers** — `file` for dev, `aws` for prod.
- **Model rotation** — comma-separated `CLAUDE_CODE_OAUTH_TOKEN` rotates on rate limit.
- **Sensible defaults** — `agent.config.json` only needs the values you want to override.

## Quick start

Prerequisites: [Bun](https://bun.sh) installed.

```bash
git clone https://github.com/CleanSlice/runtime.git
cd runtime
bun install

bun run cli init     # scaffolds .agent/ from .agent.example/
cp .env.example .env # then fill in tokens
bun run dev          # auto-reload on file changes
```

## Required environment

| Variable | Description |
|----------|-------------|
| `TELEGRAM_BOT_TOKEN` | Bot token from @BotFather |
| `TELEGRAM_BOT_NAME` | Bot username (without `@`) |
| `TELEGRAM_BOT_ADMIN_IDS` | Comma-separated Telegram user IDs |
| `CLAUDE_CODE_OAUTH_TOKEN` | Anthropic OAuth token (comma-separated for rotation) |

Optional: `LLM_MODEL`, `LLM_FALLBACK_MODEL`, `SLACK_BOT_TOKEN`, `SLACK_APP_TOKEN`, `SECRET_PROVIDER`, `CLEANSLICE_AGENT_DIR`.

## Where it fits

The runtime is the **single agent process**. Pair it with:

- [Bridle](/ecosystem/bridle) to add a browser channel.
- [Ranch](/ecosystem/ranch) to deploy many runtimes on Kubernetes.
- [Paddock](/ecosystem/paddock) to evaluate and auto-improve the agent's behavior.
