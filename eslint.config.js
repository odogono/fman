import { resolve } from 'node:path';

import nkzw from '@nkzw/eslint-config';

export default [
  {
    ignores: ['**/dist/*', '**/coverage/*', 'roms/*', 'build/*']
  },
  ...nkzw,
  {
    rules: {
      'arrow-body-style': ['error', 'as-needed'],
      'arrow-parens': ['error', 'as-needed'],
      'arrow-spacing': ['error', { after: true, before: true }],
      'func-style': ['error', 'expression'],
      'import-x/no-namespace': 'off',
      'import-x/no-unresolved': ['error', { ignore: ['^bun:'] }],
      'no-var': 'error',
      'prefer-arrow-callback': 'error',
      'prefer-const': 'error'
    },
    settings: {
      'import-x/resolver': {
        typescript: {
          noWarnOnMultipleProjects: true,
          project: [
            resolve(process.cwd(), './tsconfig.json'),
            resolve(process.cwd(), './web/src/sim/tsconfig.json'),
            resolve(process.cwd(), './web/src/view/tsconfig.json'),
            resolve(process.cwd(), './web/tsconfig.test.json')
          ]
        }
      }
    }
  },
  {
    files: ['tools/**/*.ts'],
    rules: {
      'no-console': 'off'
    }
  },
  {
    // The sim is deterministic (CODING_STANDARDS.md): no wall clock and no
    // unseeded randomness. Use the tick and the seeded RNG instead.
    files: ['web/src/sim/**/*.ts'],
    ignores: ['**/*.test.ts'],
    rules: {
      'no-restricted-properties': [
        'error',
        {
          message:
            'The sim is deterministic: use the seeded RNG in web/src/sim/rng.ts.',
          object: 'Math',
          property: 'random'
        },
        {
          message:
            'The sim is deterministic: game time comes from the tick, not the wall clock.',
          object: 'Date',
          property: 'now'
        },
        {
          message:
            'The sim is deterministic: game time comes from the tick, not the wall clock.',
          object: 'performance',
          property: 'now'
        }
      ],
      'no-restricted-syntax': [
        'error',
        {
          message:
            'The sim is deterministic: game time comes from the tick, not the wall clock.',
          selector: "NewExpression[callee.name='Date']"
        },
        {
          message:
            'The sim is deterministic: game time comes from the tick, not the wall clock.',
          selector: "CallExpression[callee.name='Date']"
        }
      ]
    }
  }
];
