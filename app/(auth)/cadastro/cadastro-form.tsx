'use client'

import { zodResolver } from '@hookform/resolvers/zod'
import { useRouter, useSearchParams } from 'next/navigation'
import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { z } from '@/src/shared/validacao/zod-ptbr'
import { signUp } from '@/src/shared/auth/client'
import { Alert, Button, Input } from '@/src/shared/ui'

/**
 * Criação de conta de **Usuário Comum** (BRD §2) — o pré-requisito da
 * candidatura a voluntário, já que `voluntario_perfil` é extensão 1:1 de `user`.
 *
 * A conta nasce com `role = 'usuario'`: a promoção para `voluntario` só
 * acontece dentro de `AprovarCandidaturaUseCase` (BR-VOL-03), nunca a partir de
 * um dado enviado pelo cliente (por isso `role` é `input: false` no better-auth).
 */
const esquema = z
    .object({
        nome: z.string().min(1, 'Informe seu nome.'),
        email: z.email('Informe um e-mail válido.'),
        senha: z.string().min(8, 'A senha precisa ter ao menos 8 caracteres.'),
        confirmacao: z.string()
    })
    .refine((d) => d.senha === d.confirmacao, {
        path: ['confirmacao'],
        message: 'As senhas não conferem.'
    })

type Formulario = z.infer<typeof esquema>

export function CadastroForm() {
    const router = useRouter()
    const params = useSearchParams()
    const destino = params.get('redirecionar') ?? '/voluntariado/candidatura'
    const [erroServidor, setErroServidor] = useState<string | null>(null)

    const {
        register,
        handleSubmit,
        formState: { errors, isSubmitting }
    } = useForm<Formulario>({ resolver: zodResolver(esquema) })

    async function criar(dados: Formulario) {
        setErroServidor(null)
        const { error } = await signUp.email({ name: dados.nome, email: dados.email, password: dados.senha })

        if (error) {
            setErroServidor(
                error.status === 422
                    ? 'Já existe uma conta com este e-mail.'
                    : 'Não foi possível criar a conta. Tente novamente.'
            )
            return
        }

        router.push(destino)
        router.refresh()
    }

    return (
        <div className="flex flex-col gap-6">
            {erroServidor && <Alert tom="danger" titulo={erroServidor} />}

            <form onSubmit={handleSubmit(criar)} className="flex flex-col gap-4" noValidate>
                <Input
                    id="nome"
                    label="Nome"
                    autoComplete="name"
                    obrigatorio
                    erro={errors.nome?.message}
                    {...register('nome')}
                />
                <Input
                    id="email"
                    label="E-mail"
                    type="email"
                    inputMode="email"
                    autoComplete="email"
                    obrigatorio
                    erro={errors.email?.message}
                    {...register('email')}
                />
                <Input
                    id="senha"
                    label="Senha"
                    type="password"
                    autoComplete="new-password"
                    apoio="Mínimo de 8 caracteres."
                    obrigatorio
                    erro={errors.senha?.message}
                    {...register('senha')}
                />
                <Input
                    id="confirmacao"
                    label="Confirmar senha"
                    type="password"
                    autoComplete="new-password"
                    obrigatorio
                    erro={errors.confirmacao?.message}
                    {...register('confirmacao')}
                />
                <Button type="submit" size="lg" fullWidth loading={isSubmitting}>
                    Criar conta
                </Button>
            </form>
        </div>
    )
}
