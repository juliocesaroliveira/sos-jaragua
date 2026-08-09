'use client'

import { zodResolver } from '@hookform/resolvers/zod'
import { useRouter, useSearchParams } from 'next/navigation'
import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { z } from 'zod'
import { signIn } from '@/src/shared/auth/client'
import { Alert, Button, Input } from '@/src/shared/ui'

const esquema = z.object({
    email: z.email('Informe um e-mail válido.'),
    senha: z.string().min(8, 'A senha precisa ter ao menos 8 caracteres.')
})

type Formulario = z.infer<typeof esquema>

export function LoginForm() {
    const router = useRouter()
    const params = useSearchParams()
    const destino = params.get('redirecionar') ?? '/dashboard'
    const expirouPorInatividade = params.get('motivo') === 'expirado'

    const [erroServidor, setErroServidor] = useState<string | null>(null)
    const [carregandoSocial, setCarregandoSocial] = useState<'google' | 'facebook' | null>(null)

    const {
        register,
        handleSubmit,
        formState: { errors, isSubmitting }
    } = useForm<Formulario>({ resolver: zodResolver(esquema) })

    async function entrar(dados: Formulario) {
        setErroServidor(null)
        const { error } = await signIn.email({ email: dados.email, password: dados.senha })
        if (error) {
            // Mensagem genérica de propósito: não revela se o e-mail existe.
            setErroServidor('E-mail ou senha incorretos.')
            return
        }
        router.push(destino)
        router.refresh()
    }

    async function entrarComRedeSocial(provider: 'google' | 'facebook') {
        setErroServidor(null)
        setCarregandoSocial(provider)
        const { error } = await signIn.social({ provider, callbackURL: destino })
        if (error) {
            setErroServidor('Não foi possível iniciar o login. Tente novamente.')
            setCarregandoSocial(null)
        }
    }

    return (
        <div className="flex flex-col gap-6">
            {expirouPorInatividade && (
                <Alert tom="warning" titulo="Sessão encerrada por inatividade">
                    Por segurança, sessões da Defesa Civil expiram após um período sem uso. Entre novamente para
                    continuar.
                </Alert>
            )}

            {erroServidor && <Alert tom="danger" titulo={erroServidor} />}

            <form onSubmit={handleSubmit(entrar)} className="flex flex-col gap-4" noValidate>
                <Input
                    id="email"
                    label="E-mail"
                    type="email"
                    autoComplete="email"
                    inputMode="email"
                    obrigatorio
                    erro={errors.email?.message}
                    {...register('email')}
                />
                <Input
                    id="senha"
                    label="Senha"
                    type="password"
                    autoComplete="current-password"
                    obrigatorio
                    erro={errors.senha?.message}
                    {...register('senha')}
                />
                <Button type="submit" size="lg" fullWidth loading={isSubmitting}>
                    Entrar
                </Button>
            </form>

            <div className="flex items-center gap-3">
                <span className="h-px flex-1 bg-border" />
                <span className="text-sm text-neutral-500">ou continue com</span>
                <span className="h-px flex-1 bg-border" />
            </div>

            <div className="flex flex-col gap-2 sm:flex-row">
                <Button
                    variant="secondary"
                    size="lg"
                    fullWidth
                    loading={carregandoSocial === 'google'}
                    onClick={() => entrarComRedeSocial('google')}
                >
                    Google
                </Button>
                <Button
                    variant="secondary"
                    size="lg"
                    fullWidth
                    loading={carregandoSocial === 'facebook'}
                    onClick={() => entrarComRedeSocial('facebook')}
                >
                    Facebook
                </Button>
            </div>
        </div>
    )
}
