<script setup>
import { ref, onMounted, onUnmounted } from 'vue'

const container = ref(null)
const onion = ref(null)
let timer = null
let resizeObserver = null
let visibilityHandler = null

const DESIGN_WIDTH = 580

function updateScale() {
  if (!container.value || !onion.value) return
  const available = container.value.clientWidth
  const scale = Math.min(1, available / DESIGN_WIDTH)
  onion.value.style.transform = `scale(${scale})`
  container.value.style.height = `${500 * scale}px`

}

onMounted(() => {
  if (!container.value) return

  updateScale()
  resizeObserver = new ResizeObserver(updateScale)
  resizeObserver.observe(container.value)

  const sequence = [
    container.value.querySelector('.arch-layer-3'),
    container.value.querySelector('.arch-layer-2'),
    container.value.querySelector('.arch-layer-1'),
    container.value.querySelector('.arch-stack-1'),
    container.value.querySelector('.arch-stack-2'),
    container.value.querySelector('.arch-stack-3'),
    container.value.querySelector('.arch-stack-4'),
  ]

  const upDuration = 550
  const downDuration = 150
  let index = 0
  let adding = true
  let isPaused = false
  let isHovering = false

  function step() {
    if (adding) {
      const element = sequence[index]
      if (element) {
        element.classList.add('glow')
        // Trigger halo on stacks and layer-1 (outermost layer)
        if (element.classList.contains('arch-stack') || element.classList.contains('arch-layer-1')) {
          const halo = document.createElement('div')
          halo.className = 'arch-halo'
          element.appendChild(halo)
          halo.addEventListener('animationend', () => halo.remove())
        }
      }
      index++
      if (index >= sequence.length) {
        adding = false
        index = 0
      }
    } else {
      sequence[index]?.classList.remove('glow')
      index++
      if (index >= sequence.length) {
        adding = true
        index = 0
      }
    }
    if (!isPaused) {
      timer = setTimeout(step, adding ? upDuration : downDuration)
    }
  }

  step()

  // Pause animation on hover
  container.value.addEventListener('mouseenter', () => {
    isHovering = true
    isPaused = true
    if (timer) clearTimeout(timer)
  })

  container.value.addEventListener('mouseleave', () => {
    isHovering = false
    // Only resume if the page is visible
    if (!document.hidden) {
      isPaused = false
      timer = setTimeout(step, adding ? upDuration : downDuration)
    }
  })

  // Pause animation when window/tab becomes inactive
  visibilityHandler = () => {
    if (document.hidden) {
      isPaused = true
      if (timer) clearTimeout(timer)
    } else {
      // Only resume if not hovering
      if (!isHovering) {
        isPaused = false
        timer = setTimeout(step, adding ? upDuration : downDuration)
      }
    }
  }
  document.addEventListener('visibilitychange', visibilityHandler)

  container.value.querySelectorAll('.arch-stack, .arch-layer').forEach(el => {
    el.style.cursor = 'pointer'
    el.addEventListener('click', (e) => {
      e.stopPropagation()
      const halo = document.createElement('div')
      halo.className = 'arch-halo'
      el.appendChild(halo)
      halo.addEventListener('animationend', () => halo.remove())
    })
  })
})

onUnmounted(() => {
  if (timer) clearTimeout(timer)
  if (resizeObserver) resizeObserver.disconnect()
  if (visibilityHandler) {
    document.removeEventListener('visibilitychange', visibilityHandler)
  }
})
</script>

<template>
  <div ref="container" class="arch-wrapper">


    <div class="arch-stack-bg">
      <div ref="onion" class="arch-onion">
        <div class="arch-layer arch-layer-1">
          <span class="arch-label arch-view-title"><strong>View</strong></span>
          <span class="arch-label arch-view-controllers">Controllers</span>
          <span class="arch-label arch-view-components">UI Components</span>
          <span class="arch-label arch-view-html">Html / React / Vue</span>

          <span class="arch-divider"></span>
          <span class="arch-label arch-data-title"><strong>Data</strong></span>
          <span class="arch-label arch-data-repositories">Repositories</span>
          <span class="arch-label arch-data-mappers">Mappers</span>

          <div class="arch-layer arch-layer-2">
            <span class="arch-label arch-view-dtos">Dtos</span>
            <span class="arch-divider"></span>
            <span class="arch-label arch-data-gateways">Gateways</span>

            <div class="arch-layer arch-layer-3">
              <div class="arch-domain-content">
                <div class="arch-domain-title">Domain</div>
                <div class="arch-domain-items">
                  <span>Types</span>
                  <span>Interfaces</span>
                  <span>Services</span>
                </div>
              </div>
            </div>
          </div>
        </div>
        <div class="arch-stack arch-stack-4"><span>Setup</span></div>
        <div class="arch-stack arch-stack-3"><span>API</span></div>
        <div class="arch-stack arch-stack-2"><span>Auth</span></div>
        <div class="arch-stack arch-stack-1"><span>User</span></div>
      </div>
    </div>
  </div>
</template>

<style scoped>
/* ---- Light theme (VitePress default) ---- */
.arch-wrapper {
  --arch-layer-border: rgba(40, 100, 120, 0.35);
  --arch-core-bg: #c5d6e0;
  --arch-core-border: rgba(0, 130, 150, 0.5);
  --arch-core-shadow: 0 0 16px rgba(0, 130, 150, 0.15), inset 0 0 10px rgba(0, 130, 150, 0.08);
  --arch-layer-shadow: 0 0 16px rgba(0, 150, 170, 0.1), inset 0 0 10px rgba(0, 150, 170, 0.05);
  --arch-layer1-bg: radial-gradient(circle, rgba(40, 140, 160, 0.1) 0%, rgba(40, 140, 160, 0.28) 100%);
  --arch-layer2-bg: radial-gradient(circle, rgba(0, 130, 150, 0.15) 0%, rgba(0, 130, 150, 0.38) 100%);
  --arch-label-color: #141e26;
  --arch-label-shadow: 0 0 4px rgba(0, 120, 140, 0.1);
  --arch-title-color: #22303b;
  --arch-title-shadow: 0 0 8px rgba(0, 120, 150, 0.2);
  --arch-domain-items-color: #3c4a57;
  --arch-domain-items-shadow: 0 0 4px rgba(0, 120, 140, 0.08);
  --arch-stack-border: rgba(40, 100, 120, 0.2);
  --arch-stack-bg-1: rgba(180, 210, 225, 0.85);
  --arch-stack-bg-2: rgba(190, 215, 228, 0.88);
  --arch-stack-bg-3: rgba(200, 220, 232, 0.9);
  --arch-stack-bg-4: rgba(210, 225, 236, 0.93);
  --arch-stack-bg-5: rgba(218, 230, 240, 0.95);
  --arch-stack-text: rgba(40, 80, 100, 0.6);
  --arch-stack-text-shadow: 0 0 4px rgba(0, 120, 140, 0.08);
  --arch-hover-border-1: rgba(0, 160, 180, 0.6);
  --arch-hover-shadow-1: 0 0 30px rgba(0, 160, 180, 0.2), 0 0 60px rgba(0, 160, 180, 0.1), inset 0 0 20px rgba(0, 160, 180, 0.08);
  --arch-hover-border-2: rgba(0, 150, 170, 0.7);
  --arch-hover-shadow-2: 0 0 25px rgba(0, 150, 170, 0.25), 0 0 50px rgba(0, 150, 170, 0.12), inset 0 0 18px rgba(0, 150, 170, 0.1);
  --arch-hover-border-3: rgba(0, 140, 160, 0.8);
  --arch-hover-shadow-3: 0 0 20px rgba(0, 140, 160, 0.3), 0 0 40px rgba(0, 140, 160, 0.15), inset 0 0 15px rgba(0, 140, 160, 0.12);
  --arch-hover-stack-border: rgba(0, 150, 170, 0.5);
  --arch-hover-stack-shadow: 0 0 20px rgba(0, 150, 170, 0.18), 0 0 40px rgba(0, 150, 170, 0.08);
  --arch-hover-stack-text: #0d6070;
  --arch-hover-stack-text-shadow: 0 0 8px rgba(0, 120, 150, 0.25);
  --arch-halo-border: rgba(0, 150, 170, 0.7);
  --arch-halo-gradient: radial-gradient(circle, transparent 30%, rgba(0, 150, 170, 0.15) 100%);

  display: flex;
  justify-content: center;
  align-items: center;
  width: 100%;
  font-family: 'Segoe UI', Roboto, sans-serif;
  color: #2a3a48;
}

/* ---- Dark theme (VitePress .dark) ---- */
.dark .arch-wrapper {
  --arch-layer-border: rgba(255, 255, 255, 0.4);
  --arch-core-bg: #031627;
  --arch-core-border: rgba(0, 200, 220, 0.5);
  --arch-core-shadow: 0 0 20px rgba(0, 200, 220, 0.15), inset 0 0 15px rgba(0, 200, 220, 0.08);
  --arch-layer-shadow: 0 0 20px rgba(0, 255, 255, 0.1), inset 0 0 15px rgba(0, 255, 255, 0.05);
  --arch-layer1-bg: radial-gradient(circle, rgba(122, 230, 230, 0.1) 0%, rgba(122, 230, 230, 0.3) 100%);
  --arch-layer2-bg: radial-gradient(circle, rgba(0, 230, 230, 0.2) 0%, rgba(0, 230, 230, 0.5) 100%);
  --arch-label-color: inherit;
  --arch-label-shadow: 0 0 8px rgba(0, 255, 255, 0.15);
  --arch-title-color: rgba(180, 255, 255, 1);
  --arch-title-shadow: 0 0 12px rgba(0, 255, 255, 0.4), 0 0 30px rgba(0, 255, 255, 0.15);
  --arch-domain-items-color: rgba(160, 220, 220, 0.8);
  --arch-domain-items-shadow: 0 0 6px rgba(0, 255, 255, 0.1);
  --arch-stack-border: rgba(255, 255, 255, 0.1);
  --arch-stack-bg-1: rgba(10, 30, 40, 0.8);
  --arch-stack-bg-2: rgba(8, 25, 35, 0.85);
  --arch-stack-bg-3: rgba(5, 20, 30, 0.9);
  --arch-stack-bg-4: rgba(2, 10, 20, 0.95);
  --arch-stack-bg-5: rgba(1, 5, 12, 0.97);
  --arch-stack-text: rgba(255, 255, 255, 0.5);
  --arch-stack-text-shadow: 0 0 6px rgba(0, 255, 255, 0.1);
  --arch-hover-border-1: rgba(100, 255, 255, 0.7);
  --arch-hover-shadow-1: 0 0 40px rgba(0, 255, 255, 0.3), 0 0 80px rgba(0, 255, 255, 0.15), inset 0 0 30px rgba(0, 255, 255, 0.1);
  --arch-hover-border-2: rgba(100, 255, 255, 0.8);
  --arch-hover-shadow-2: 0 0 35px rgba(0, 255, 255, 0.4), 0 0 70px rgba(0, 255, 255, 0.2), inset 0 0 25px rgba(0, 255, 255, 0.15);
  --arch-hover-border-3: rgba(0, 255, 255, 0.9);
  --arch-hover-shadow-3: 0 0 30px rgba(0, 255, 255, 0.5), 0 0 60px rgba(0, 255, 255, 0.3), inset 0 0 20px rgba(0, 255, 255, 0.2);
  --arch-hover-stack-border: rgba(100, 255, 255, 0.5);
  --arch-hover-stack-shadow: 0 0 30px rgba(0, 255, 255, 0.25), 0 0 60px rgba(0, 255, 255, 0.1);
  --arch-hover-stack-text: rgba(180, 255, 255, 1);
  --arch-hover-stack-text-shadow: 0 0 12px rgba(0, 255, 255, 0.4), 0 0 30px rgba(0, 255, 255, 0.15);
  --arch-halo-border: rgba(0, 255, 255, 0.8);
  --arch-halo-gradient: radial-gradient(circle, transparent 30%, rgba(0, 255, 255, 0.2) 100%);

  color: white;
}

.arch-onion {
  position: relative;
  width: 500px;
  height: 500px;
  display: flex;
  justify-content: center;
  align-items: center;
  transform-origin: center;
}

/* Base circle */
.arch-layer {
  border-radius: 50%;
  border: 1.5px solid var(--arch-layer-border);
  display: flex;
  justify-content: center;
  align-items: center;
  position: relative;
  box-shadow: var(--arch-layer-shadow);
  transition: box-shadow 0.4s ease, border-color 0.4s ease, background 0.5s ease;
}

.arch-layer-1 {
  width: 420px;
  height: 420px;
  background: var(--arch-layer1-bg);
  z-index: 5;
}

.arch-layer-2 {
  width: 280px;
  height: 280px;
  background: var(--arch-layer2-bg);
}

.arch-layer-3 {
  width: 180px;
  height: 180px;
  background-color: var(--arch-core-bg);
  border: 1.5px solid var(--arch-core-border);
  box-shadow: var(--arch-core-shadow);
  text-align: center;
  transition: box-shadow 0.4s ease, border-color 0.4s ease, background-color 0.5s ease;
}

/* Hover + Glow */
.arch-layer-1:hover,
.arch-layer-1.glow {
  border-color: var(--arch-hover-border-1);
  box-shadow: var(--arch-hover-shadow-1);
}

.arch-layer-2:hover,
.arch-layer-2.glow {
  border-color: var(--arch-hover-border-2);
  box-shadow: var(--arch-hover-shadow-2);
}

.arch-layer-3:hover,
.arch-layer-3.glow {
  border-color: var(--arch-hover-border-3);
  box-shadow: var(--arch-hover-shadow-3);
}

.arch-stack:hover,
.arch-stack.glow {
  border-color: var(--arch-hover-stack-border);
  box-shadow: var(--arch-hover-stack-shadow);
}

.arch-stack:hover span,
.arch-stack.glow span {
  color: var(--arch-hover-stack-text);
  text-shadow: var(--arch-hover-stack-text-shadow);
}

/* Labels */
.arch-label {
  position: absolute;
  font-size: 13px;
  font-weight: 300;
  opacity: 0.75;
  pointer-events: none;
  letter-spacing: 0.5px;
  color: var(--arch-label-color);
  text-shadow: var(--arch-label-shadow);
  transition: color 0.5s ease, text-shadow 0.5s ease;
}

.arch-label strong {
  font-weight: 600;
  font-size: 14px;
  text-transform: uppercase;
  letter-spacing: 3px;
  color: var(--arch-title-color);
  text-shadow: var(--arch-title-shadow);
  transition: color 0.5s ease, text-shadow 0.5s ease;
}

.arch-view-title { top: 32px; left: 125px; }
.arch-view-controllers { top: 90px; left: 40px; transform: rotate(-50deg); }
.arch-view-components { top: 200px; left: -10px; transform: rotate(-90deg); }
.arch-view-html { bottom: 75px; left: 35px; transform: rotate(45deg); }
.arch-view-dtos { top: 130px; left: 16px; transform: rotate(-90deg); }

.arch-data-title { top: 32px; right: 125px; }
.arch-data-repositories { top: 115px; right: 25px; transform: rotate(60deg); }
.arch-data-mappers { bottom: 100px; right: 40px; transform: rotate(-50deg); }
.arch-data-gateways { top: 135px; right: 0; transform: rotate(90deg); }

/* Domain core */
.arch-domain-content {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 5px;
  padding: 16px;
}

.arch-domain-title {
  font-size: 14px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 3px;
  color: var(--arch-title-color);
  text-shadow: var(--arch-title-shadow);
  margin-bottom: 4px;
  transition: color 0.5s ease, text-shadow 0.5s ease;
}

.arch-domain-items {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 2px;
  font-size: 13px;
  font-weight: 300;
  letter-spacing: 0.5px;
  color: var(--arch-domain-items-color);
  text-shadow: var(--arch-domain-items-shadow);
  transition: color 0.5s ease, text-shadow 0.5s ease;
}

/* Stacks */
.arch-stack-bg {
  position: absolute;
  z-index: 1;
}

.arch-stack {
  position: absolute;
  width: 400px;
  height: 400px;
  border-radius: 50%;
  border: 1px solid var(--arch-stack-border);
  background: var(--arch-stack-bg-1);
  display: flex;
  align-items: center;
  justify-content: flex-end;
  padding-right: 12px;
  transition: box-shadow 0.4s ease, border-color 0.4s ease, background 0.5s ease;
}

.arch-stack span {
  transform: rotate(-90deg);
  font-size: 12px;
  font-weight: 400;
  text-transform: uppercase;
  letter-spacing: 3px;
  color: var(--arch-stack-text);
  text-shadow: var(--arch-stack-text-shadow);
  transition: color 0.4s ease, text-shadow 0.4s ease;
}

.arch-stack-1 { right: -20px; scale: 1; }
.arch-stack-2 { right: -90px; background: var(--arch-stack-bg-2); scale: 0.9; }
.arch-stack-3 { right: -150px; background: var(--arch-stack-bg-3); scale: 0.8; }
.arch-stack-4 { right: -210px; background: var(--arch-stack-bg-4); scale: 0.7; }

/* Divider */
.arch-divider {
  position: absolute;
  left: 50%;
  top: 0;
  bottom: 0;
  width: 1.5px;
  background: var(--arch-layer-border);
  transform: translateX(-50%);
  pointer-events: none;
  transition: background 0.5s ease;
}

/* Click halo (dynamically created, needs :deep to bypass scoped) */
:deep(.arch-halo) {
  position: absolute;
  border-radius: 50%;
  border: 2px solid var(--arch-halo-border);
  background: var(--arch-halo-gradient);
  pointer-events: none;
  animation: arch-halo-expand 0.8s ease-out forwards;
}

@keyframes arch-halo-expand {
  0% {
    width: 100%;
    height: 100%;
    top: 0;
    left: 0;
    opacity: 1;
    border-width: 2px;
  }
  100% {
    width: 200%;
    height: 200%;
    top: -50%;
    left: -50%;
    opacity: 0;
    border-width: 0.5px;
  }
}

</style>
