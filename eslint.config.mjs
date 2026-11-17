import love from 'eslint-config-love'
import prettierRecommended from 'eslint-plugin-prettier/recommended'
import tseslint from 'typescript-eslint'

import commonRules from './eslint.common.mjs'
import projectRules from './eslint.landing.mjs'

export default [
  {
    ignores: [
      'eslint.config.mjs',
      'eslint.common.mjs',
      'eslint.mobile.mjs',
      'eslint.landing.mjs',
      'eslint.web.mjs',
      'eslint.backend.mjs',
      '.astro/**',
      '.atl/**',
      'dist/**',
      'build/**',
      'node_modules/**',
      '.expo/**',
      'coverage/**',
      '.next/**',
      'out/**',
      'build/**',
      'next-env.d.ts',
      'postcss.config.mjs',
      'e2e/**',
      'playwright-report/**',
      'playwright.config.ts',
    ],
  },
  love,

  {
    files: ['**/*.ts', '**/*.tsx'],
    languageOptions: {
      parserOptions: {
        projectService: false,
        project: true,
      },
    },
  },

  ...commonRules,
  ...projectRules,
  prettierRecommended,

  {
    files: ['**/*.astro', '**/*.astro/*.ts', '**/*.astro/*.js'],
    ...tseslint.configs.disableTypeChecked,
    rules: {
      ...tseslint.configs.disableTypeChecked.rules,
      'no-var': 'off',
      '@typescript-eslint/explicit-function-return-type': 'off',
      '@typescript-eslint/no-unused-vars': 'off',
      'prefer-template': 'off',
      'prettier/prettier': 'off',
      'import-x/order': 'off',
      'import-x/no-cycle': 'off',
      'import-x/no-duplicates': 'off',
      'import-x/no-self-import': 'off',
    },
  },
]
