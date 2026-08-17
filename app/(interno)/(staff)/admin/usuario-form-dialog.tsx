'use client'

import { zodResolver } from '@hookform/resolvers/zod'
import { useEffect, useState } from 'react'
import { Controller, useForm } from 'react-hook-form'
import { Check, Key, X } from 'lucide-react'
import { z } from '@/src/shared/validacao/zod-ptbr'
import { camposComErro } from '@/src/shared/kernel'
import { Button, Dialog, Input, Password, Select, avisar } from '@/src/shared/ui'
import { ROLES, ROTULO_ROLE, type Role } from '@/src/shared/auth/roles'
import { criarUsuario, editarUsuario } from '@/src/modules/identidade/presentation/actions/usuarios'
import type { LinhaUsuario } from '@/src/modules/identidade/presentation/queries/usuarios'

/**
 * Formulário de cadastro/edição de conta (006-user-management-page, US2/US3).
 *
 * Um único `Dialog` para os dois modos (research.md D3 — já responsivo,
 * folha em mobile/modal em desktop, sem precisar de um `Drawer` separado) e
 * um único componente para os dois modos, não dois formulários separados —
 * a diferença entre cadastrar e editar é só quais campos aparecem e qual
 * Server Action é chamada.
 *
 * 008-admin-password-reset: na edição o e-mail aparece desabilitado (confirma
 * de qual conta se trata sem permitir alterá-la) e o rodapé ganha "Trocar
 * Senha" — exibida apenas para contas com senha própria, nunca para quem entra
 * por Google ou Facebook.
 */
const esquemaCriar = z.object({
    nome: z.string().min(1, 'Informe o nome.'),
    email: z.email('Informe um e-mail válido.'),
    senha: z.string().min(8, 'A senha deve ter ao menos 8 caracteres.'),
    role: z.enum(ROLES, { error: 'Selecione o papel.' })
})

const esquemaEditar = z.object({
    nome: z.string().min(1, 'Informe o nome.'),
    role: z.enum(ROLES, { error: 'Selecione o papel.' })
})

/**
 * Com a troca de senha ativa, o campo passa a ser obrigatório — revelar e
 * deixar em branco é engano, não desistência; desistir é recolher a ação
 * (008-admin-password-reset, FR-011/FR-012).
 */
const esquemaEditarComSenha = esquemaEditar.extend({
    novaSenha: z.string().min(8, 'A senha deve ter ao menos 8 caracteres.')
})

type Formulario = {
    nome: string
    email?: string
    senha?: string
    novaSenha?: string
    role: Role
}

const OPCOES_ROLE = ROLES.map((role) => ({ value: role, label: ROTULO_ROLE[role] }))

export interface UsuarioFormDialogProps {
    open: boolean
    onOpenChange: (aberto: boolean) => void
    /** Fechado o diálogo após sucesso, a listagem já reflete a mudança (cache invalidado pela Server Action). */
    onSucesso?: () => void
    /** Presente = modo edição, pré-preenchido (US3, E-04); ausente = modo cadastro (US2). */
    usuario?: LinhaUsuario
}

export function UsuarioFormDialog({ open, onOpenChange, onSucesso, usuario }: UsuarioFormDialogProps) {
    const modoEdicao = Boolean(usuario)
    const [trocandoSenha, setTrocandoSenha] = useState(false)

    const {
        register,
        handleSubmit,
        control,
        reset,
        setError,
        formState: { errors, isSubmitting }
    } = useForm<Formulario>({
        resolver: zodResolver(modoEdicao ? (trocandoSenha ? esquemaEditarComSenha : esquemaEditar) : esquemaCriar)
    })

    // Reinicialização única: cobre abrir o diálogo e também alternar de uma
    // conta para outra sem fechá-lo — a senha digitada para uma conta jamais
    // pode alcançar a seguinte (FR-020).
    useEffect(() => {
        if (!open) return
        setTrocandoSenha(false)
        reset(
            usuario ? { nome: usuario.nome, role: usuario.role } : { nome: '', email: '', senha: '', role: 'usuario' }
        )
    }, [open, usuario, reset])

    function cancelarTrocaDeSenha() {
        setTrocandoSenha(false)
        reset((valores) => ({ ...valores, novaSenha: undefined }))
    }

    async function enviar(dados: Formulario) {
        const resultado = modoEdicao
            ? await editarUsuario({
                  id: usuario!.id,
                  nome: dados.nome,
                  role: dados.role,
                  // Campo recolhido não envia senha alguma — o servidor então
                  // nem consulta o meio de acesso da conta (FR-008).
                  novaSenha: trocandoSenha ? dados.novaSenha : undefined
              })
            : await criarUsuario({ nome: dados.nome, email: dados.email, senha: dados.senha, role: dados.role })

        if (!resultado.ok) {
            const campos = camposComErro(resultado.erro)
            for (const [campo, mensagem] of Object.entries(campos)) {
                setError(campo as keyof Formulario, { message: mensagem })
            }
            avisar.erro(modoEdicao ? 'Não foi possível salvar' : 'Não foi possível cadastrar', resultado.erro.mensagem)
            // A senha nunca é reapresentada depois de uma falha (U-05.3).
            if (trocandoSenha) reset((valores) => ({ ...valores, novaSenha: undefined }))
            return
        }

        const senhaTrocada = modoEdicao && trocandoSenha
        avisar.sucesso(
            modoEdicao ? 'Conta atualizada' : 'Conta cadastrada',
            senhaTrocada
                ? `${dados.nome} foi atualizado e a senha foi redefinida.`
                : modoEdicao
                  ? `${dados.nome} foi atualizado.`
                  : `${dados.nome} já pode acessar o sistema.`
        )
        onOpenChange(false)
        onSucesso?.()
    }

    return (
        <Dialog
            open={open}
            onOpenChange={onOpenChange}
            titulo={modoEdicao ? 'Editar conta' : 'Nova conta'}
            descricao={modoEdicao ? 'Altere o nome e/ou o papel da conta.' : 'Informe os dados para criar uma conta.'}
            acoes={
                <>
                    {/* Só contas com senha própria: quem entra por Google ou
                        Facebook não tem senha aqui para trocar (FR-005). */}
                    {modoEdicao && usuario?.podeTrocarSenha && (
                        <Button
                            type="button"
                            variant="ghost"
                            iconeInicio={trocandoSenha ? <X className="size-4" /> : <Key className="size-4" />}
                            onClick={trocandoSenha ? cancelarTrocaDeSenha : () => setTrocandoSenha(true)}
                        >
                            {trocandoSenha ? 'Cancelar troca de senha' : 'Trocar Senha'}
                        </Button>
                    )}
                    <Button
                        type="button"
                        variant="secondary"
                        iconeInicio={<X className="size-4" />}
                        onClick={() => onOpenChange(false)}
                    >
                        Cancelar
                    </Button>
                    <Button
                        type="submit"
                        form="usuario-form"
                        iconeInicio={<Check className="size-4" />}
                        loading={isSubmitting}
                    >
                        {modoEdicao ? 'Salvar' : 'Cadastrar'}
                    </Button>
                </>
            }
        >
            <form id="usuario-form" onSubmit={handleSubmit(enviar)} className="flex flex-col gap-4">
                <Input id="nome" label="Nome" obrigatorio erro={errors.nome?.message} {...register('nome')} />

                {/* Na edição o e-mail é exibido, mas desabilitado e **fora** do
                    `register`: assim não entra no payload da action, e o schema
                    do servidor — que não aceita `email` — é a segunda barreira
                    (008-admin-password-reset, FR-002). */}
                {modoEdicao && (
                    <Input
                        id="email-conta"
                        label="E-mail"
                        type="email"
                        value={usuario?.email ?? ''}
                        disabled
                        readOnly
                    />
                )}

                {/* No cadastro, e-mail e senha são campos normais do formulário. */}
                {!modoEdicao && (
                    <>
                        <Input
                            id="email"
                            label="E-mail"
                            type="email"
                            obrigatorio
                            erro={errors.email?.message}
                            {...register('email')}
                        />
                        <Password
                            autoComplete="new-password"
                            id="senha"
                            label="Senha"
                            obrigatorio
                            apoio="Mínimo de 8 caracteres."
                            erro={errors.senha?.message}
                            {...register('senha')}
                        />
                    </>
                )}

                {trocandoSenha && (
                    <Password
                        autoComplete="new-password"
                        id="novaSenha"
                        label="Nova senha"
                        obrigatorio
                        apoio="Mínimo de 8 caracteres."
                        erro={errors.novaSenha?.message}
                        {...register('novaSenha')}
                    />
                )}

                <Controller
                    name="role"
                    control={control}
                    render={({ field }) => (
                        <Select
                            id="role"
                            label="Papel"
                            obrigatorio
                            opcoes={OPCOES_ROLE}
                            erro={errors.role?.message}
                            value={field.value ? [field.value] : []}
                            onValueChange={(v) => field.onChange(v[0] as Role)}
                        />
                    )}
                />
            </form>
        </Dialog>
    )
}
