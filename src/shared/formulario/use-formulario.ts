'use client'

import { zodResolver } from '@hookform/resolvers/zod'
import { useForm, type DefaultValues, type FieldValues, type Resolver, type UseFormReturn } from 'react-hook-form'
import type { ZodType, input, output } from 'zod'

/**
 * Ponto único de configuração de formulário da aplicação
 * (016-formularios-rhf-zod, contracts §1).
 *
 * Devolve o retorno do react-hook-form **sem alterá-lo** — `register`,
 * `control`, `handleSubmit`, `formState`, `setError`, `clearErrors` e `reset`
 * continuam sendo os da biblioteca. O que este envelope faz é fixar as três
 * opções que definem o comportamento percebido pelo usuário, para que nenhum
 * formulário escolha outro em silêncio:
 *
 * - `mode: 'onSubmit'` — não há mensagem de erro antes da primeira tentativa de
 *   envio. Validar a cada tecla marcaria "e-mail inválido" na primeira letra
 *   digitada, punindo quem ainda está preenchendo (FR-001).
 * - `reValidateMode: 'onChange'` — depois do primeiro envio, o campo reavalia
 *   enquanto a pessoa corrige, e a mensagem some sozinha (FR-007).
 * - `shouldFocusError: true` — o foco vai ao primeiro campo com erro, para que
 *   um formulário longo não pareça "não fazer nada" ao ser enviado (FR-011).
 *   Só funciona onde o controle expõe `ref`; por isso todo componente de campo
 *   do design system encaminha o seu (research.md D4).
 *
 * Essas opções **não** são parametrizáveis — é justamente o que torna o
 * comportamento igual entre formulários. Precisando divergir, a divergência
 * vira decisão documentada (Princípio VI), não mais um parâmetro aqui.
 */
export function useFormulario<TEsquema extends ZodType<FieldValues, FieldValues>>(
    esquema: TEsquema,
    opcoes: { defaultValues?: DefaultValues<input<TEsquema>> } = {}
): UseFormReturn<input<TEsquema>, unknown, output<TEsquema>> {
    return useForm<input<TEsquema>, unknown, output<TEsquema>>({
        /**
         * A asserção existe porque `zodResolver` resolve seus genéricos contra
         * a **restrição** de `TEsquema` (`FieldValues`), não contra o esquema
         * concreto que o chamador passou — devolvendo `Resolver<FieldValues>`
         * onde o `useForm` espera `Resolver<input<TEsquema>>`. Os dois tipos
         * descrevem o mesmo valor em tempo de execução; o que se perde é só a
         * ligação entre eles, aqui dentro. Do lado de fora nada é afrouxado: o
         * chamador continua recebendo `UseFormReturn` com os campos do seu
         * próprio esquema, e um nome de campo errado segue quebrando o `tsc`.
         */
        resolver: zodResolver(esquema) as unknown as Resolver<input<TEsquema>, unknown, output<TEsquema>>,
        mode: 'onSubmit',
        reValidateMode: 'onChange',
        shouldFocusError: true,
        defaultValues: opcoes.defaultValues
    })
}
