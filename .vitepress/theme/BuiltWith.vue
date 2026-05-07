<script setup lang="ts">
const products = [
  {
    name: 'miy.bot',
    tagline: 'Telegram bot builder powered by the CleanSlice runtime',
    href: 'https://miy.bot/',
    accent: '🤖',
  },
]
</script>

<template>
  <section class="bw-section">
    <div class="bw-inner">
      <div class="bw-head">
        <span class="bw-badge">Built with CleanSlice</span>
        <h2 class="bw-title">In production</h2>
        <p class="bw-desc">
          Real products running on the CleanSlice stack today.
        </p>
      </div>

      <div class="bw-grid">
        <a
          v-for="p in products"
          :key="p.name"
          :href="p.href"
          target="_blank"
          rel="noopener"
          class="bw-card"
        >
          <div class="bw-card-icon">{{ p.accent }}</div>
          <div class="bw-card-body">
            <div class="bw-card-name">{{ p.name }}</div>
            <div class="bw-card-tag">{{ p.tagline }}</div>
          </div>
          <div class="bw-card-arrow">↗</div>
        </a>
      </div>
    </div>
  </section>
</template>

<style scoped>
.bw-section {
  width: 100%;
  padding: 16px 24px 56px;
}

.bw-inner {
  max-width: 1152px;
  margin: 0 auto;
}

.bw-head {
  text-align: center;
  margin: 0 auto 28px;
  max-width: 640px;
}

.bw-badge {
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

.bw-title {
  font-size: 26px;
  font-weight: 700;
  line-height: 1.3;
  color: var(--vp-c-text-1);
  margin: 0 0 8px;
}

.bw-desc {
  font-size: 15px;
  color: var(--vp-c-text-2);
  margin: 0;
}

.bw-grid {
  display: grid;
  grid-template-columns: 1fr;
  gap: 16px;
}

.bw-card {
  display: flex;
  align-items: center;
  gap: 18px;
  padding: 22px 24px;
  border: 1px solid var(--vp-c-border);
  border-radius: 14px;
  background: var(--vp-c-bg-soft);
  text-decoration: none;
  color: var(--vp-c-text-1);
  transition: border-color 0.2s, background 0.2s, transform 0.2s;
}

.bw-card:hover {
  border-color: var(--vp-c-brand-1);
  background: var(--vp-c-brand-soft);
  transform: translateY(-2px);
}

.bw-card-icon {
  font-size: 32px;
  flex-shrink: 0;
}

.bw-card-body {
  flex: 1;
}

.bw-card-name {
  font-size: 18px;
  font-weight: 700;
  margin-bottom: 2px;
}

.bw-card-tag {
  font-size: 14px;
  color: var(--vp-c-text-2);
}

.bw-card-arrow {
  font-size: 20px;
  color: var(--vp-c-text-2);
  flex-shrink: 0;
}

.bw-card:hover .bw-card-arrow {
  color: var(--vp-c-brand-1);
}

@media (min-width: 720px) {
  .bw-grid {
    grid-template-columns: repeat(auto-fit, minmax(320px, 1fr));
  }
}
</style>
