import { getViteConfig } from 'astro/config'

import type { ViteUserConfig } from 'vitest/config'

const config: ViteUserConfig = {
  test: {
    environment: 'happy-dom',
    include: ['src/**/*.spec.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'lcov'],
      include: ['src/**/*.{ts,tsx}'],
      exclude: [
        'src/**/*.spec.ts',
        'src/**/*.d.ts',
        'src/test-dom.ts',
        'src/test-render.ts',
        'src/pages/**',
      ],
      thresholds: {
        lines: 80,
        statements: 80,
        functions: 80,
        branches: 80,
      },
    },
  },
}

export default getViteConfig(config)
