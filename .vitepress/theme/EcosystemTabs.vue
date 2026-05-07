<script setup lang="ts">
import { ref } from 'vue'

type Pkg = {
  id: string
  name: string
  tagline: string
  blurb: string
  highlights: string[]
  install?: string
  docsLink: string
  repoLink: string
  liveLink?: { label: string; href: string }
}

const packages: Pkg[] = [
  {
    id: 'ranch',
    name: 'Ranch',
    tagline: 'Agent deployment platform on Kubernetes',
    blurb:
      'Multi-tenant control plane for AI agents. GitOps with ArgoCD, agent runs on Argo Workflows, managed Postgres per tenant.',
    highlights: [
      'GitOps-native deployment via ArgoCD',
      'Argo Workflows for parallel agent runs',
      'Per-tenant ranches with isolated workspaces',
      'Built-in admin panel + dashboard',
    ],
    install: 'bun add -g @cleanslice/ranch && ranch dev',
    docsLink: '/ecosystem/ranch',
    repoLink: 'https://github.com/CleanSlice/ranch',
    liveLink: { label: 'ranch.cleanslice.org', href: 'https://ranch.cleanslice.org/' },
  },
  {
    id: 'runtime',
    name: 'Runtime',
    tagline: 'Files-as-agent runtime with channels & tools',
    blurb:
      'Define an agent as Markdown files (SOUL, USER, MEMORY, HEARTBEAT). The runtime handles channels, LLM calls, tool execution, sessions, and cron.',
    highlights: [
      'Files as truth — version-control your agent like code',
      'Telegram & Slack channels out of the box',
      'Pluggable skills, secret providers, model rotation',
      'Heartbeat & cron for proactive behavior',
    ],
    install: 'bun run cli init && bun run dev',
    docsLink: '/ecosystem/runtime',
    repoLink: 'https://github.com/CleanSlice/runtime',
  },
  {
    id: 'bridle',
    name: 'Bridle',
    tagline: 'Webchat relay for browser ↔ agent',
    blurb:
      'Stateless NestJS hub that routes messages between browsers and agents over Socket.IO. Ships with a Nuxt chat UI and a drop-in embed SDK for any site.',
    highlights: [
      'Stateless hub — horizontal scaling, no sticky sessions',
      'Rich parts[]: text, images, files end-to-end',
      'Streaming partial tokens',
      'One-tag <script> embed for any website',
    ],
    install:
      '<scr' + 'ipt src="https://bridle.cleanslice.org/sdk/latest.js" data-agent-id="..."></scr' + 'ipt>',
    docsLink: '/ecosystem/bridle',
    repoLink: 'https://github.com/CleanSlice/bridle',
    liveLink: { label: 'bridle.cleanslice.org', href: 'https://bridle.cleanslice.org' },
  },
  {
    id: 'paddock',
    name: 'Paddock',
    tagline: 'Automated eval & improvement loop',
    blurb:
      'Generates test scenarios, runs the agent through them, scores with multi-model consensus (Claude + GPT + Gemini), and iteratively patches code until the pass rate clears your threshold.',
    highlights: [
      '3-judge LLM consensus scoring',
      'Auto-patches agent code until threshold met',
      'Sandbox validation: type-check + build before commit',
      'All work on eval/* branches, push only on success',
    ],
    install: 'bun run eval --repo /path/to/agent-repo',
    docsLink: '/ecosystem/paddock',
    repoLink: 'https://github.com/CleanSlice/paddock',
  },
]

const active = ref<string>(packages[0].id)
function selected() {
  return packages.find((p) => p.id === active.value)!
}
</script>

<template>
  <section class="eco-section">
    <div class="eco-inner">
      <div class="eco-head">
        <span class="eco-badge">Ecosystem</span>
        <h2 class="eco-title">One architecture, four packages</h2>
        <p class="eco-desc">
          CleanSlice ships as a small constellation of focused tools — each one solves a single
          problem in the AI-agent stack, all built on the same NestJS + Nuxt + slices foundation.
        </p>
      </div>

      <div class="eco-tabs" role="tablist">
        <button
          v-for="pkg in packages"
          :key="pkg.id"
          :class="['eco-tab', { active: active === pkg.id }]"
          role="tab"
          :aria-selected="active === pkg.id"
          @click="active = pkg.id"
        >
          <span class="eco-tab-name">{{ pkg.name }}</span>
          <span class="eco-tab-tag">{{ pkg.tagline }}</span>
        </button>
      </div>

      <div class="eco-panel">
        <div class="eco-panel-main">
          <h3 class="eco-panel-title">{{ selected().name }}</h3>
          <p class="eco-panel-tag">{{ selected().tagline }}</p>
          <p class="eco-panel-blurb">{{ selected().blurb }}</p>

          <ul class="eco-features">
            <li v-for="h in selected().highlights" :key="h">
              <span class="eco-feat-dot">›</span>
              {{ h }}
            </li>
          </ul>

          <div class="eco-actions">
            <a :href="selected().docsLink" class="eco-btn primary">Read docs →</a>
            <a :href="selected().repoLink" target="_blank" rel="noopener" class="eco-btn ghost">
              GitHub
            </a>
            <a
              v-if="selected().liveLink"
              :href="selected().liveLink!.href"
              target="_blank"
              rel="noopener"
              class="eco-btn ghost"
            >
              {{ selected().liveLink!.label }} ↗
            </a>
          </div>
        </div>

        <div v-if="selected().install" class="eco-panel-side">
          <div class="eco-side-label">Quick start</div>
          <code class="eco-install">{{ selected().install }}</code>
        </div>
      </div>
    </div>
  </section>
</template>

<style scoped>
.eco-section {
  width: 100%;
  padding: 32px 24px;
}

.eco-inner {
  max-width: 1152px;
  margin: 0 auto;
}

.eco-head {
  text-align: center;
  margin: 0 auto 32px;
  max-width: 720px;
}

.eco-badge {
  display: inline-block;
  font-size: 13px;
  font-weight: 600;
  letter-spacing: 0.04em;
  text-transform: uppercase;
  color: var(--vp-c-brand-1);
  background: var(--vp-c-brand-soft);
  border: 1px solid var(--vp-c-brand-1);
  border-radius: 20px;
  padding: 4px 14px;
  margin-bottom: 16px;
}

.eco-title {
  font-size: 28px;
  font-weight: 700;
  line-height: 1.3;
  color: var(--vp-c-text-1);
  margin: 0 0 12px;
}

.eco-desc {
  font-size: 16px;
  line-height: 1.7;
  color: var(--vp-c-text-2);
  margin: 0;
}

.eco-tabs {
  display: grid;
  grid-template-columns: 1fr;
  gap: 8px;
  margin-bottom: 16px;
}

.eco-tab {
  text-align: left;
  padding: 14px 18px;
  border-radius: 10px;
  border: 1px solid var(--vp-c-border);
  background: var(--vp-c-bg-soft);
  color: var(--vp-c-text-1);
  cursor: pointer;
  transition: border-color 0.2s, background 0.2s;
  display: flex;
  flex-direction: column;
  gap: 4px;
  font: inherit;
}

.eco-tab:hover {
  border-color: var(--vp-c-brand-1);
}

.eco-tab.active {
  border-color: var(--vp-c-brand-1);
  background: var(--vp-c-brand-soft);
}

.eco-tab-name {
  font-weight: 700;
  font-size: 16px;
}

.eco-tab-tag {
  font-size: 13px;
  color: var(--vp-c-text-2);
}

.eco-panel {
  display: grid;
  grid-template-columns: 1fr;
  gap: 24px;
  border: 1px solid var(--vp-c-border);
  border-radius: 16px;
  background: var(--vp-c-bg-soft);
  padding: 28px;
}

.eco-panel-title {
  font-size: 22px;
  font-weight: 700;
  margin: 0 0 4px;
  color: var(--vp-c-text-1);
}

.eco-panel-tag {
  font-size: 14px;
  font-weight: 500;
  color: var(--vp-c-brand-1);
  margin: 0 0 12px;
}

.eco-panel-blurb {
  font-size: 15px;
  line-height: 1.7;
  color: var(--vp-c-text-2);
  margin: 0 0 18px;
}

.eco-features {
  list-style: none;
  padding: 0;
  margin: 0 0 22px;
  display: grid;
  gap: 8px;
}

.eco-features li {
  display: flex;
  gap: 10px;
  font-size: 14px;
  color: var(--vp-c-text-1);
}

.eco-feat-dot {
  color: var(--vp-c-brand-1);
  font-weight: 700;
  flex-shrink: 0;
}

.eco-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
}

.eco-btn {
  display: inline-flex;
  align-items: center;
  padding: 9px 18px;
  font-size: 14px;
  font-weight: 600;
  border-radius: 8px;
  text-decoration: none;
  transition: background 0.2s, border-color 0.2s;
}

.eco-btn.primary {
  color: var(--vp-button-brand-text);
  background: var(--vp-button-brand-bg);
}

.eco-btn.primary:hover {
  background: var(--vp-button-brand-hover-bg);
}

.eco-btn.ghost {
  color: var(--vp-c-text-1);
  background: transparent;
  border: 1px solid var(--vp-c-border);
}

.eco-btn.ghost:hover {
  border-color: var(--vp-c-brand-1);
  color: var(--vp-c-brand-1);
}

.eco-side-label {
  font-size: 12px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  color: var(--vp-c-text-2);
  margin-bottom: 8px;
}

.eco-install {
  display: block;
  font-size: 13px;
  color: var(--vp-c-text-1);
  background: var(--vp-c-bg);
  border: 1px solid var(--vp-c-border);
  border-radius: 8px;
  padding: 14px 16px;
  user-select: all;
  word-break: break-all;
  white-space: pre-wrap;
  line-height: 1.5;
}

@media (min-width: 640px) {
  .eco-tabs {
    grid-template-columns: repeat(2, 1fr);
  }
}

@media (min-width: 960px) {
  .eco-section {
    padding: 56px 24px;
  }
  .eco-tabs {
    grid-template-columns: repeat(4, 1fr);
  }
  .eco-panel {
    grid-template-columns: 1.6fr 1fr;
    padding: 36px;
  }
  .eco-title {
    font-size: 32px;
  }
}
</style>
