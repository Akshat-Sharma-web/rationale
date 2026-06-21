import type { Config } from 'tailwindcss'

/**
 * tailwind.config.ts
 *
 * NOTE: Tailwind v4 is CSS-first — the primary color tokens live in
 * src/index.css under @theme {}. This file documents the palette for
 * tooling/IDE integration and can be used for any v3-compatible plugins.
 */
const config: Config = {
  content: [
    './index.html',
    './src/**/*.{ts,tsx,js,jsx}',
  ],
  theme: {
    extend: {
      colors: {
        primary:  '#1a1a2e',   // deep navy
        accent:   '#4f46e5',   // indigo-600
        surface:  '#0f0f1a',   // near-black bg
        muted:    '#6b7280',   // gray-500
        success:  '#10b981',   // emerald-500
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', '-apple-system', 'sans-serif'],
        mono: ['JetBrains Mono', 'Fira Code', 'monospace'],
      },
    },
  },
  plugins: [],
}

export default config
