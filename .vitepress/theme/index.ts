import DefaultTheme from 'vitepress/theme'
import { h } from 'vue'
import McpBanner from './McpBanner.vue'
import './custom.css'

const GtmNoscript = {
  render() {
    return h('noscript', h('iframe', {
      src: 'https://www.googletagmanager.com/ns.html?id=GTM-W7ZMZ49G',
      height: '0',
      width: '0',
      style: 'display:none;visibility:hidden',
    }))
  },
}

export default {
  extends: DefaultTheme,
  Layout() {
    return h(DefaultTheme.Layout, null, {
      'layout-top': () => h(GtmNoscript),
      'home-features-before': () => h(McpBanner),
    })
  },
}
