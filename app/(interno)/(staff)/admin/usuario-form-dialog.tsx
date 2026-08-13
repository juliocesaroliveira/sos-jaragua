'use client'

import { zodResolver } from '@hookform/resolvers/zod'
import { useEffect } from 'react'
import { Controller, useForm } from 'react-hook-form'
import { z } from '@/src/shared/validacao/zod-ptbr'
import { camposComErro } from '@/src/shared/kernel'
import { Button, Dialog, Input, Select, avisar } from '@/src/shared/ui'
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

type Formulario = {
    nome: string
    email?: string
    senha?: string
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

    const {
        register,
        handleSubmit,
        control,
        reset,
        setError,
        formState: { errors, isSubmitting }
    } = useForm<Formulario>({
        resolver: zodResolver(modoEdicao ? esquemaEditar : esquemaCriar)
    })

    useEffect(() => {
        if (!open) return
        reset(
            usuario ? { nome: usuario.nome, role: usuario.role } : { nome: '', email: '', senha: '', role: 'usuario' }
        )
    }, [open, usuario, reset])

    async function enviar(dados: Formulario) {
        const resultado = modoEdicao
            ? await editarUsuario({ id: usuario!.id, nome: dados.nome, role: dados.role })
            : await criarUsuario({ nome: dados.nome, email: dados.email, senha: dados.senha, role: dados.role })

        if (!resultado.ok) {
            const campos = camposComErro(resultado.erro)
            for (const [campo, mensagem] of Object.entries(campos)) {
                setError(campo as keyof Formulario, { message: mensagem })
            }
            avisar.erro(modoEdicao ? 'Não foi possível salvar' : 'Não foi possível cadastrar', resultado.erro.mensagem)
            return
        }

        avisar.sucesso(
            modoEdicao ? 'Conta atualizada' : 'Conta cadastrada',
            modoEdicao ? `${dados.nome} foi atualizado.` : `${dados.nome} já pode acessar o sistema.`
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
                    <Button type="button" variant="secondary" onClick={() => onOpenChange(false)}>
                        Cancelar
                    </Button>
                    <Button type="submit" form="usuario-form" loading={isSubmitting}>
                        {modoEdicao ? 'Salvar' : 'Cadastrar'}
                    </Button>
                </>
            }
        >
            <form id="usuario-form" onSubmit={handleSubmit(enviar)} className="flex flex-col gap-4">
                <Input id="nome" label="Nome" obrigatorio erro={errors.nome?.message} {...register('nome')} />

                {/* E-mail e senha só existem no cadastro — a edição não os aceita (FR-010, contracts E-01). */}
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
                        <Input
                            id="senha"
                            label="Senha"
                            type="password"
                            obrigatorio
                            apoio="Mínimo de 8 caracteres."
                            erro={errors.senha?.message}
                            {...register('senha')}
                        />
                    </>
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
