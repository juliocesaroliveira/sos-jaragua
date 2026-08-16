'use client'

import { zodResolver } from '@hookform/resolvers/zod'
import { useRouter, useSearchParams } from 'next/navigation'
import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { ArrowLeft, LogIn, LockOpen } from 'lucide-react'
import { z } from '@/src/shared/validacao/zod-ptbr'
import { signIn } from '@/src/shared/auth/client'
import { AREA_PADRAO } from '@/src/shared/auth/rotas'
import { Alert, Button, Input } from '@/src/shared/ui'

const esquema = z.object({
    email: z.email('Informe um e-mail válido.'),
    senha: z.string().min(8, 'A senha precisa ter ao menos 8 caracteres.')
})

type Formulario = z.infer<typeof esquema>

/**
 * Dois estados de exibição, sem navegação entre eles (FR-011): `'opcoes'` é o
 * estado inicial (Google/Facebook/usuário e senha); `'credenciais'` é o
 * formulário de e-mail/senha com Voltar/Acessar.
 */
type ModoLogin = 'opcoes' | 'credenciais'

/**
 * Recusas do login social traduzidas (011-auto-cadastro-provedor, FR-005a e
 * FR-007). O better-auth aborta o callback OAuth redirecionando para
 * `errorCallbackURL` com `?error=<código>`; sem este mapa o candidato via um
 * erro cru em inglês, ou nada, e não tinha como saber o que fazer.
 *
 * `account_not_linked` é o caso mais provável na prática: o e-mail já tem conta
 * criada com senha, e a vinculação automática exige e-mail verificado
 * localmente — verificação que o projeto ainda não faz. Manter esse gate é
 * decisão de segurança deliberada (research.md D4), então o caminho de saída
 * precisa ser explicado, não escondido.
 */
const MENSAGEM_POR_ERRO_SOCIAL: Record<string, string> = {
    account_not_linked:
        'Este e-mail já tem conta no sistema, criada com senha. Entre com e-mail e senha para continuar.',
    email_not_found:
        'O provedor não informou seu e-mail, que é necessário para criar sua conta. Use outra forma de acesso ou libere o e-mail nas permissões do provedor.',
    unable_to_link_account:
        'Não foi possível vincular esta conta ao seu acesso. Entre com e-mail e senha para continuar.'
}

const ERRO_SOCIAL_GENERICO = 'Não foi possível concluir o acesso pelo provedor. Tente novamente ou use e-mail e senha.'

export function LoginForm() {
    const router = useRouter()
    const params = useSearchParams()
    // A home serve a todos os papéis (ela é montada a partir da sessão). Este
    // formulário roda no cliente antes de a sessão existir, então não teria como
    // escolher um destino por papel — fixar `/dashboard` aqui mandava `usuario`
    // e `voluntario` direto para `/sem-permissao`.
    const destino = params.get('redirecionar') ?? AREA_PADRAO
    const expirouPorInatividade = params.get('motivo') === 'expirado'

    // Recusa do callback OAuth: chega como `?error=<código>` porque passamos
    // `errorCallbackURL` abaixo. Sem isso o better-auth redirecionaria para a
    // própria página de erro da biblioteca, em inglês e fora do nosso layout.
    const codigoErroSocial = params.get('error')
    const erroSocial = codigoErroSocial ? (MENSAGEM_POR_ERRO_SOCIAL[codigoErroSocial] ?? ERRO_SOCIAL_GENERICO) : null

    const [modo, setModo] = useState<ModoLogin>('opcoes')
    const [erroServidor, setErroServidor] = useState<string | null>(null)
    const [carregandoSocial, setCarregandoSocial] = useState<'google' | 'facebook' | null>(null)

    const {
        register,
        handleSubmit,
        reset,
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
        const { error } = await signIn.social({
            provider,
            callbackURL: destino,
            // Traz a recusa de volta para esta tela, em pt-BR, em vez de largar
            // o usuário na página de erro padrão do better-auth (FR-005a).
            errorCallbackURL: '/login'
        })
        if (error) {
            setErroServidor('Não foi possível iniciar o login. Tente novamente.')
            setCarregandoSocial(null)
        }
    }

    function usarUsuarioESenha() {
        setErroServidor(null)
        setModo('credenciais')
    }

    /** Retorna ao estado inicial e descarta os campos preenchidos (FR-007). */
    function voltar() {
        setErroServidor(null)
        reset()
        setModo('opcoes')
    }

    return (
        <div className="flex flex-col gap-6">
            {expirouPorInatividade && (
                <Alert tom="warning" titulo="Sessão encerrada por inatividade">
                    Por segurança, sessões da Defesa Civil expiram após um período sem uso. Entre novamente para
                    continuar.
                </Alert>
            )}

            {erroSocial && !erroServidor && <Alert tom="danger" titulo={erroSocial} />}

            {erroServidor && <Alert tom="danger" titulo={erroServidor} />}

            {modo === 'opcoes' ? (
                <div className="flex flex-col gap-3">
                    <Button
                        variant="secondary"
                        size="lg"
                        fullWidth
                        loading={carregandoSocial === 'google'}
                        onClick={() => entrarComRedeSocial('google')}
                    >
                        Acessar com Google
                    </Button>
                    <Button
                        variant="secondary"
                        size="lg"
                        fullWidth
                        loading={carregandoSocial === 'facebook'}
                        onClick={() => entrarComRedeSocial('facebook')}
                    >
                        Acessar com Facebook
                    </Button>
                    <Button
                        variant="ghost"
                        iconeInicio={<LockOpen className="size-4" />}
                        size="lg"
                        fullWidth
                        onClick={usarUsuarioESenha}
                    >
                        Usar usuário e senha
                    </Button>

                    {/*
                      FR-010 — transparência antes do redirecionamento: a pessoa
                      precisa saber o que sai da conta dela antes de autorizar,
                      não depois, na tela de consentimento do provedor.
                    */}
                    <p className="text-sm text-neutral-600 dark:text-neutral-300">
                        Ao entrar com Google ou Facebook, recebemos apenas seu nome e e-mail para criar sua conta.
                    </p>
                </div>
            ) : (
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
                    <div className="flex flex-col gap-2 sm:flex-row">
                        <Button
                            type="button"
                            variant="secondary"
                            iconeInicio={<ArrowLeft className="size-4" />}
                            size="lg"
                            fullWidth
                            onClick={voltar}
                        >
                            Voltar
                        </Button>
                        <Button
                            type="submit"
                            iconeInicio={<LogIn className="size-4" />}
                            size="lg"
                            fullWidth
                            loading={isSubmitting}
                        >
                            Acessar
                        </Button>
                    </div>
                </form>
            )}
        </div>
    )
}
