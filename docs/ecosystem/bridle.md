# Bridle

> Webchat relay for AI agents. Bridle connects browser users to an agent runtime through a stateless NestJS hub, with a ready-made Nuxt chat UI, an embeddable JS SDK for any site, and an agent-side Socket.IO client.

- **Repository:** [github.com/CleanSlice/bridle](https://github.com/CleanSlice/bridle)
- **Documentation:** [bridle.cleanslice.org](https://bridle.cleanslice.org)

## What it does

Bridle is the **browser channel** for an agent. Think Intercom, but the bot on the other side is your CleanSlice runtime.

```
Browser (Nuxt)               Bridle Hub (NestJS)           Agent Runtime
     |                             |                             |
     |--- /ws/client --------------->|                             |
     |   auth: { token, agentId }    |--- /ws/agent -------------->|
     |                             |   auth: { apiKey, agentId }   |
     |<--- stream/message ---------|<--- stream/message ---------|
     |   { text, parts[] }         |   { text, parts[] }         |
```

The hub is **stateless** — it holds no message history. It routes messages between browsers and agents in real time using Socket.IO. Multiple bots can connect simultaneously, each scoped by `agentId`.

## Highlights

- **Stateless hub** — horizontal scaling without sticky sessions.
- **Rich `parts[]`** — text, images, files flow end-to-end.
- **Streaming** — partial tokens delivered as they arrive.
- **Drop-in embed SDK** — one `<script>` tag adds chat to any site.
- **Nuxt layer** — for internal apps, get the full chat UI as a layer.
- **Agent client** — Socket.IO repository plugs into the runtime as a channel.

## Packages

| Directory | What it is | Stack |
|-----------|------------|-------|
| `nestjs/` | Hub server — WebSocket relay + HTTP fallback | NestJS, Socket.IO, JWT |
| `nuxt/` | Nuxt layer — chat UI for internal Nuxt apps | Nuxt 3, Vue 3, shadcn-vue |
| `sdk/` | Embed SDK — Web Component for any website | Vue 3 (compiled), socket.io-client |
| `runtime/` | Agent client — connects to the hub as a channel | socket.io-client |

## Embed in any site

```html
<script
  src="https://bridle.cleanslice.org/sdk/latest.js"
  data-api-url="https://your-hub.example.com"
  data-agent-id="bot-abc-123"
  data-token="<jwt>"
></script>
```

Full embed guide: [bridle.cleanslice.org/embed/script-tag](https://bridle.cleanslice.org/embed/script-tag).

## Message parts

Every message carries `parts: BridlePart[]`. A `text` field is always present as a plain-text shorthand.

```ts
{ type: "text",  text: "Hello" }
{ type: "image", base64: "...", mediaType: "image/jpeg" }
{ type: "file",  url: "https://...", name: "doc.pdf", mimeType: "application/pdf" }
```

Parts flow end-to-end (browser → hub → agent → hub → browser), including over `stream` and `stream_end` events.

## Add to a CleanSlice project

The repo's README ships a Claude Code prompt that wires Bridle into an existing CleanSlice app — copies the slices into `api/`, `app/`, and the runtime, sets the env vars, and verifies the round-trip. See the [README](https://github.com/CleanSlice/bridle) for the full snippet.
