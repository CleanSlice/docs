import DefaultTheme from 'vitepress/theme'
import { h } from 'vue'
import McpBanner from './McpBanner.vue'
import './custom.css'

export default {
  extends: DefaultTheme,
  Layout() {
    return h(DefaultTheme.Layout, null, {
      'home-features-before': () => h(McpBanner),
    })
  },
}
