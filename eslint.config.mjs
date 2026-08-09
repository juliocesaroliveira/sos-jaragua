import nextPlugin from '@next/eslint-plugin-next'
import tsPlugin from '@typescript-eslint/eslint-plugin'
import tsParser from '@typescript-eslint/parser'
import pluginQuery from '@tanstack/eslint-plugin-query'

export default [
    {
        files: ['**/*.{js,mjs,cjs,ts,jsx,tsx}'],
        plugins: {
            '@next/next': nextPlugin,
            '@typescript-eslint': tsPlugin,
            '@tanstack/query': pluginQuery
        },
        languageOptions: {
            parser: tsParser,
            parserOptions: {
                ecmaVersion: 'latest',
                sourceType: 'module',
                ecmaFeatures: {
                    jsx: true
                }
            }
        },
        rules: {
            ...nextPlugin.configs.recommended.rules,
            ...nextPlugin.configs['core-web-vitals'].rules,
            ...tsPlugin.configs.recommended.rules,
            '@tanstack/query/exhaustive-deps': 'error'
        }
    },
    {
        ignores: ['.next/', 'node_modules/', 'out/', 'build/']
    }
]
