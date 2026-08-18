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
            '@tanstack/query/exhaustive-deps': 'error',
            /**
             * `<form>` cru é proibido (016-formularios-rhf-zod, FR-003).
             *
             * A regra existe porque "não esquecer o `noValidate`" falhou na
             * prática: antes desta feature, dois formulários o tinham e um não,
             * e a mesma aplicação exibia balão do navegador em uma tela e
             * mensagem própria nas outras. O componente `Formulario` aplica o
             * atributo sempre; esta regra é o que garante que ninguém contorne
             * o componente sem perceber.
             */
            'no-restricted-syntax': [
                'error',
                {
                    selector: "JSXOpeningElement[name.name='form']",
                    message:
                        'Use o componente `Formulario` de `@/src/shared/ui` em vez de `<form>`. Ele aplica `noValidate`, exigido pelo padrão de formulários (016-formularios-rhf-zod, FR-003).'
                }
            ]
        }
    },
    {
        // O próprio componente é quem pode — é onde o `<form>` mora.
        files: ['src/shared/ui/formulario/**/*.tsx'],
        rules: {
            'no-restricted-syntax': 'off'
        }
    },
    {
        ignores: ['.next/', 'node_modules/', 'out/', 'build/']
    }
]
