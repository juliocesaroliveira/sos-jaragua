'use client'

import { zodResolver } from '@hookform/resolvers/zod'
import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { Controller, useForm } from 'react-hook-form'
import { z } from '@/src/shared/validacao/zod-ptbr'
import { camposComErro } from '@/src/shared/kernel'
import { Alert, Button, CheckboxGroup, DatePicker, Input, RadioGroup, Switch, Textarea, avisar } from '@/src/shared/ui'
import {
    DISPONIBILIDADES,
    ROTULO_DISPONIBILIDADE,
    ROTULO_TIPO_VEICULO,
    TIPOS_VEICULO
} from '@/src/modules/voluntariado/domain/candidatura'
import { submeterCandidatura } from '@/src/modules/voluntariado/presentation/actions/candidatura'

/**
 * Formulário público de candidatura (BRD §3.1, VOL-02).
 *
 * A validação aqui é de **forma** (campo obrigatório, formato) e serve para dar
 * retorno imediato ao candidato. As regras de negócio — maioridade, dígito
 * verificador do CPF, obrigatoriedade condicional do tipo de veículo — são
 * reavaliadas no `domain` do servidor, que é a autoridade; os erros que ele
 * devolver por campo são reinjetados no formulário.
 */
/**
 * `error` é declarado no **tipo**, não só no `.min()`: quando o campo chega
 * `undefined` (controle ainda não tocado), o `.min` nem roda e o Zod usaria a
 * mensagem padrão em inglês — o que quebraria o requisito de interface toda em
 * pt-BR (NFR §2.2).
 */
const obrigatorio = (mensagem: string) => z.string({ error: mensagem }).min(1, mensagem)

const esquema = z.object({
    nomeCompleto: obrigatorio('Informe o nome completo.'),
    dataNascimento: obrigatorio('Informe a data de nascimento.'),
    cpf: obrigatorio('Informe o CPF.'),
    telefone: obrigatorio('Informe o telefone.'),
    cep: obrigatorio('Informe o CEP.'),
    bairro: obrigatorio('Informe o bairro.'),
    profissao: obrigatorio('Informe a profissão ou formação.'),
    restricoesSaude: z.string().optional(),
    veiculoProprio: z.boolean(),
    tipoVeiculo: z.enum(TIPOS_VEICULO, { error: 'Selecione o tipo de veículo.' }).optional(),
    disponibilidade: z.array(z.enum(DISPONIBILIDADES)).min(1, 'Selecione ao menos uma disponibilidade.'),
    habilidadeIds: z.array(z.string())
})

type Formulario = z.infer<typeof esquema>

export type CandidaturaFormProps = {
    habilidades: { id: string; nome: string }[]
    /** Status da candidatura existente, quando houver (permite reenvio). */
    statusAtual?: 'pendente' | 'aprovado' | 'rejeitado'
    motivoRejeicao?: string | null
}

export function CandidaturaForm({ habilidades, statusAtual, motivoRejeicao }: CandidaturaFormProps) {
    const router = useRouter()
    const [erroGeral, setErroGeral] = useState<string | null>(null)
    const [enviada, setEnviada] = useState(false)

    const {
        register,
        handleSubmit,
        control,
        watch,
        setError,
        formState: { errors, isSubmitting }
    } = useForm<Formulario>({
        resolver: zodResolver(esquema),
        defaultValues: { veiculoProprio: false, disponibilidade: [], habilidadeIds: [] }
    })

    const veiculoProprio = watch('veiculoProprio')

    async function enviar(dados: Formulario) {
        setErroGeral(null)

        const resultado = await submeterCandidatura({
            ...dados,
            restricoesSaude: dados.restricoesSaude ?? null,
            // Sem veículo próprio o tipo não é enviado — o domínio também
            // descarta, mas não faz sentido mandar lixo pela rede.
            tipoVeiculo: dados.veiculoProprio ? (dados.tipoVeiculo ?? null) : null
        })

        if (!resultado.ok) {
            const campos = camposComErro(resultado.erro)
            for (const [campo, mensagem] of Object.entries(campos)) {
                setError(campo as keyof Formulario, { message: mensagem })
            }
            setErroGeral(Object.keys(campos).length > 0 ? resultado.erro.mensagem : resultado.erro.mensagem)
            avisar.erro('Não foi possível enviar', resultado.erro.mensagem)
            return
        }

        setEnviada(true)
        avisar.sucesso('Candidatura enviada', 'A Defesa Civil fará a triagem e avisará você.')
        router.refresh()
    }

    if (enviada || statusAtual === 'pendente') {
        return (
            <Alert tom="info" titulo="Candidatura em análise">
                Recebemos seus dados. A Defesa Civil fará a triagem e você será avisado pelo e-mail cadastrado e pelo
                sino de notificações.
            </Alert>
        )
    }

    if (statusAtual === 'aprovado') {
        return (
            <Alert tom="success" titulo="Você já é voluntário">
                Sua candidatura foi aprovada. Acesse &quot;Minhas atividades&quot; para ver seus turnos.
            </Alert>
        )
    }

    return (
        <form onSubmit={handleSubmit(enviar)} className="flex flex-col gap-6" noValidate>
            {statusAtual === 'rejeitado' && (
                <Alert tom="warning" titulo="Candidatura anterior não aprovada">
                    {motivoRejeicao ?? 'Revise seus dados e envie novamente.'}
                </Alert>
            )}

            {erroGeral && <Alert tom="danger" titulo={erroGeral} />}

            <div className="grid gap-4 md:grid-cols-2">
                <Input
                    id="nomeCompleto"
                    label="Nome completo"
                    obrigatorio
                    autoComplete="name"
                    erro={errors.nomeCompleto?.message}
                    {...register('nomeCompleto')}
                />

                <Controller
                    control={control}
                    name="dataNascimento"
                    render={({ field }) => (
                        <DatePicker
                            id="dataNascimento"
                            label="Data de nascimento"
                            obrigatorio
                            apoio="É necessário ter 18 anos ou mais."
                            value={field.value}
                            onValueChange={(v) => field.onChange(v ?? '')}
                            erro={errors.dataNascimento?.message}
                        />
                    )}
                />

                <Input
                    id="cpf"
                    label="CPF"
                    obrigatorio
                    inputMode="numeric"
                    placeholder="000.000.000-00"
                    erro={errors.cpf?.message}
                    {...register('cpf')}
                />

                <Input
                    id="telefone"
                    label="Telefone (WhatsApp)"
                    obrigatorio
                    inputMode="tel"
                    placeholder="(47) 99999-9999"
                    erro={errors.telefone?.message}
                    {...register('telefone')}
                />

                <Input
                    id="cep"
                    label="CEP"
                    obrigatorio
                    inputMode="numeric"
                    placeholder="89250-000"
                    erro={errors.cep?.message}
                    {...register('cep')}
                />

                <Input
                    id="bairro"
                    label="Bairro"
                    obrigatorio
                    autoComplete="address-level3"
                    erro={errors.bairro?.message}
                    {...register('bairro')}
                />

                <Input
                    id="profissao"
                    label="Profissão / formação"
                    obrigatorio
                    erro={errors.profissao?.message}
                    {...register('profissao')}
                />
            </div>

            <Controller
                control={control}
                name="disponibilidade"
                render={({ field }) => (
                    <CheckboxGroup
                        id="disponibilidade"
                        label="Disponibilidade"
                        opcoes={DISPONIBILIDADES.map((d) => ({ value: d, label: ROTULO_DISPONIBILIDADE[d] }))}
                        value={field.value}
                        onValueChange={field.onChange}
                        erro={errors.disponibilidade?.message}
                    />
                )}
            />

            <Controller
                control={control}
                name="habilidadeIds"
                render={({ field }) => (
                    <CheckboxGroup
                        id="habilidadeIds"
                        label="Habilidades específicas"
                        opcoes={habilidades.map((h) => ({ value: h.id, label: h.nome }))}
                        value={field.value}
                        onValueChange={field.onChange}
                    />
                )}
            />

            <div className="flex flex-col gap-4">
                <Controller
                    control={control}
                    name="veiculoProprio"
                    render={({ field }) => (
                        <Switch
                            id="veiculoProprio"
                            label="Possui veículo próprio"
                            checked={field.value}
                            onCheckedChange={field.onChange}
                        />
                    )}
                />

                {/* Campo condicional exigido pelo BRD §3.1. */}
                {veiculoProprio && (
                    <Controller
                        control={control}
                        name="tipoVeiculo"
                        render={({ field }) => (
                            <RadioGroup
                                id="tipoVeiculo"
                                label="Tipo de veículo"
                                orientacao="horizontal"
                                opcoes={TIPOS_VEICULO.map((t) => ({ value: t, label: ROTULO_TIPO_VEICULO[t] }))}
                                value={field.value}
                                onValueChange={field.onChange}
                                erro={errors.tipoVeiculo?.message}
                            />
                        )}
                    />
                )}
            </div>

            <Textarea
                id="restricoesSaude"
                label="Restrições de saúde"
                apoio="Alergias, limitações físicas. Opcional."
                erro={errors.restricoesSaude?.message}
                {...register('restricoesSaude')}
            />

            <Button type="submit" size="lg" fullWidth loading={isSubmitting}>
                Enviar candidatura
            </Button>
        </form>
    )
}
