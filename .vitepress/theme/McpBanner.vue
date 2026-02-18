<script setup lang="ts">
const tools = [
  { icon: '📚', label: 'Architecture patterns & best practices' },
  { icon: '🧩', label: 'Slice scaffolding & structure guides' },
  { icon: '⚙️', label: 'NestJS + Nuxt code generation rules' },
  { icon: '✅', label: 'Naming conventions & type-safety checks' },
]
</script>

<template>
  <div class="mcp-banner">
    <div class="mcp-inner">
      <div class="mcp-content">
        <span class="mcp-badge">MCP Server</span>
        <h2 class="mcp-title">AI-Powered Architecture Guidance</h2>
        <p class="mcp-desc">
          Connect your coding agent to CleanSlice via the
          <strong>Model Context Protocol</strong>. Get real-time architecture
          patterns, slice structure rules, and code generation guidance — directly
          inside your editor.
        </p>
        <ul class="mcp-tools">
          <li v-for="tool in tools" :key="tool.label">
            <span class="mcp-tool-icon">{{ tool.icon }}</span>
            {{ tool.label }}
          </li>
        </ul>
        <div class="mcp-actions">
          <a href="https://mcp.cleanslice.org/" target="_blank" class="mcp-btn primary">
            Learn More
          </a>
          <code class="mcp-install">claude mcp add cleanslice https://mcp.cleanslice.org/mcp</code>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.mcp-banner {
  width: 100%;
  padding: 32px 24px;
}

.mcp-inner {
  max-width: 1152px;
  margin: 0 auto;
  border-radius: 16px;
  background: var(--vp-c-brand-soft);
  border: 1px solid var(--vp-c-border);
  padding: 40px 32px;
}

.mcp-content {
  max-width: 720px;
}

.mcp-badge {
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

.mcp-title {
  font-size: 28px;
  font-weight: 700;
  line-height: 1.3;
  color: var(--vp-c-text-1);
  margin: 0 0 12px;
}

.mcp-desc {
  font-size: 16px;
  line-height: 1.7;
  color: var(--vp-c-text-2);
  margin: 0 0 24px;
}

.mcp-desc strong {
  color: var(--vp-c-text-1);
}

.mcp-tools {
  list-style: none;
  padding: 0;
  margin: 0 0 28px;
  display: grid;
  grid-template-columns: 1fr;
  gap: 10px;
}

.mcp-tools li {
  display: flex;
  align-items: center;
  gap: 10px;
  font-size: 15px;
  color: var(--vp-c-text-1);
}

.mcp-tool-icon {
  flex-shrink: 0;
  font-size: 18px;
}

.mcp-actions {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 16px;
}

.mcp-btn.primary {
  display: inline-flex;
  align-items: center;
  padding: 10px 24px;
  font-size: 14px;
  font-weight: 600;
  color: var(--vp-button-brand-text);
  background: var(--vp-button-brand-bg);
  border-radius: 8px;
  text-decoration: none;
  transition: background 0.2s;
}

.mcp-btn.primary:hover {
  background: var(--vp-button-brand-hover-bg);
}

.mcp-install {
  font-size: 13px;
  color: var(--vp-c-text-2);
  background: var(--vp-c-bg);
  border: 1px solid var(--vp-c-border);
  border-radius: 8px;
  padding: 10px 16px;
  user-select: all;
}

@media (min-width: 640px) {
  .mcp-tools {
    grid-template-columns: 1fr 1fr;
  }
}

@media (min-width: 960px) {
  .mcp-banner {
    padding: 48px 24px;
  }

  .mcp-inner {
    padding: 48px 40px;
  }

  .mcp-title {
    font-size: 32px;
  }
}
</style>
