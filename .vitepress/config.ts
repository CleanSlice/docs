import { defineConfig } from 'vitepress'

export default defineConfig({
  srcDir: 'docs',
  appearance: 'dark',
  title: 'CleanSlice',
  description: 'Build scalable full-stack applications with Clean Architecture and vertical slices',

  head: [
    ['link', { rel: 'icon', type: 'image/svg+xml', href: '/logo.svg' }],
  ],

  themeConfig: {
    logo: '/logo.svg',

    nav: [
      { text: 'Guide', link: '/guide/introduction' },
      { text: 'Architecture', link: '/architecture/overview' },
      { text: 'Backend', link: '/backend/getting-started' },
      { text: 'Frontend', link: '/frontend/getting-started' },
      {
        text: 'More',
        items: [
          { text: 'Standards', link: '/standards/typescript' },
          { text: 'Examples', link: '/examples/user-slice' },
        ],
      },
    ],

    sidebar: {
      '/guide/': [
        {
          text: 'Guide',
          items: [
            { text: 'Introduction', link: '/guide/introduction' },
            { text: 'Getting Started', link: '/guide/getting-started' },
            { text: 'Project Structure', link: '/guide/project-structure' },
            { text: 'Core Concepts', link: '/guide/core-concepts' },
            { text: 'Setup Slices', link: '/guide/setup-slices' },
          ],
        },
      ],
      '/architecture/': [
        {
          text: 'Architecture',
          items: [
            { text: 'Overview', link: '/architecture/overview' },
            { text: 'Layers', link: '/architecture/layers' },
            { text: 'Slices', link: '/architecture/slices' },
            { text: 'Dependency Flow', link: '/architecture/dependency-flow' },
          ],
        },
      ],
      '/backend/': [
        {
          text: 'Getting Started',
          items: [
            { text: 'Project Setup', link: '/backend/getting-started' },
            { text: 'Database', link: '/backend/database' },
            { text: 'API Documentation', link: '/backend/api-docs' },
            { text: 'Slice Structure', link: '/backend/slice-structure' },
          ],
        },
        {
          text: 'Patterns',
          items: [
            { text: 'Controllers', link: '/backend/controllers' },
            { text: 'Gateways', link: '/backend/gateways' },
            { text: 'Mappers', link: '/backend/mappers' },
            { text: 'DTOs', link: '/backend/dtos' },
            { text: 'Services', link: '/backend/services' },
            { text: 'Types', link: '/backend/types' },
            { text: 'Error Handling', link: '/backend/error-handling' },
          ],
        },
      ],
      '/frontend/': [
        {
          text: 'Getting Started',
          items: [
            { text: 'Project Setup', link: '/frontend/getting-started' },
            { text: 'Slice Structure', link: '/frontend/slice-structure' },
          ],
        },
        {
          text: 'Features',
          items: [
            { text: 'State Management', link: '/frontend/state-management' },
            { text: 'API Integration', link: '/frontend/api-integration' },
            { text: 'UI Components', link: '/frontend/ui-components' },
            { text: 'Dependency Injection', link: '/frontend/dependency-injection' },
            { text: 'Internationalization', link: '/frontend/i18n' },
            { text: 'Error Handling', link: '/frontend/error-handling' },
            { text: 'Navigation', link: '/frontend/navigation' },
          ],
        },
      ],
      '/standards/': [
        {
          text: 'Standards',
          items: [
            { text: 'TypeScript', link: '/standards/typescript' },
            { text: 'NestJS', link: '/standards/nestjs' },
            { text: 'Nuxt', link: '/standards/nuxt' },
            { text: 'Git Commits', link: '/standards/git' },
          ],
        },
      ],
      '/examples/': [
        {
          text: 'Examples',
          items: [
            { text: 'User Slice', link: '/examples/user-slice' },
          ],
        },
      ],
    },

    search: {
      provider: 'local',
    },

    socialLinks: [
      { icon: 'github', link: 'https://github.com/cleanslice' },
    ],

    footer: {
      message: 'Built with CleanSlice',
    },

    outline: {
      level: [2, 3],
    },
  },
})
