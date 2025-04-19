import tseslint from '@electron-toolkit/eslint-config-ts'
import reactPlugin from 'eslint-plugin-react'
import electronToolkitPrettier from '@electron-toolkit/eslint-config-prettier'

export default tseslint.config([
  {
    ignores: ['node_modules', 'dist/**/*', 'out/**/*', 'resources/**/*', 'bun.lockb']
  },
  ...tseslint.configs.recommended,
  {
    files: ['**/*.{js,jsx,ts,tsx}'],
    plugins: {
      react: reactPlugin
    },
    languageOptions: {
      parserOptions: {
        ecmaVersion: 'latest',
        sourceType: 'module',
        ecmaFeatures: {
          jsx: true
        }
      }
    },
    settings: {
      react: {
        version: 'detect'
      }
    },
    rules: {
      'react/prop-types': 'off',
      '@typescript-eslint/explicit-function-return-type': 'warn'
    }
  },
  electronToolkitPrettier
])
