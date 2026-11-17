import tseslint from '@typescript-eslint/eslint-plugin'
import tsParser from '@typescript-eslint/parser'
import astro from 'eslint-plugin-astro'
import { createTypeScriptImportResolver } from 'eslint-import-resolver-typescript'
import importX from 'eslint-plugin-import-x'

export default [
  ...astro.configs.recommended,

  {
    files: ['src/**/*.{ts,tsx}'],
    languageOptions: {
      parser: tsParser,
    },
    plugins: {
      '@typescript-eslint': tseslint,
      'import-x': importX,
    },
    settings: {
      'import-x/parsers': { '@typescript-eslint/parser': ['.ts', '.tsx'] },
      'import-x/resolver-next': [createTypeScriptImportResolver({ alwaysTryTypes: true })],
    },
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: ['*/content/*.md', '*/content/*.mdx'],
              message:
                'Use Astro Content Collections API (getCollection/getEntry) — never import content files directly',
            },
            {
              group: ['*/styles/*'],
              message: 'Never import from styles/ in components — use Tailwind tokens instead',
            },
          ],
          paths: [
            {
              name: 'react-redux',
              importNames: ['useSelector', 'useDispatch'],
              message:
                'Redux hooks allowed only in islands with shared cross-component state — prefer useState for island-scoped interactions',
            },
          ],
        },
      ],

      'no-restricted-syntax': [
        'error',

        {
          selector: 'MemberExpression[property.name=/^(?:innerHTML|outerHTML)$/]',
          message: 'Render data as text: never read or write innerHTML or outerHTML',
        },

        {
          selector: "CallExpression[callee.property.name='insertAdjacentHTML']",
          message: 'Render data as text: never call insertAdjacentHTML',
        },

        {
          selector: "JSXAttribute[name.name='dangerouslySetInnerHTML']",
          message: 'Render data as text: never use dangerouslySetInnerHTML',
        },

        {
          selector: "MemberExpression[object.name='process'][property.name='env']",
          message: 'Use import.meta.env instead of process.env — this is the Astro/Vite convention',
        },

        {
          selector: "JSXOpeningElement[name.name='img']",
          message:
            'Use <Image> from astro:assets for automatic optimization — avoid raw <img> in islands',
        },
      ],

      'import-x/no-cycle': ['error', { maxDepth: 3, ignoreExternal: true }],
    },
  },

  {
    files: ['src/**/*.astro'],
    rules: {
      '@typescript-eslint/no-unsafe-return': 'off',
      '@typescript-eslint/prefer-destructuring': 'off',
      'no-restricted-globals': [
        'error',
        {
          name: 'process',
          message: 'Use import.meta.env instead of process.env in Astro files',
        },
      ],
    },
  },

  {
    files: ['**/*.spec.ts', '**/*.spec.tsx', '**/*.test.ts', 'src/test-*.ts'],
    rules: {
      'no-restricted-imports': 'off',
      'no-restricted-syntax': 'off',
    },
  },
]
