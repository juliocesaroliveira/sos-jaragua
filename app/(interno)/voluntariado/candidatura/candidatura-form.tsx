'use client'

import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { Controller } from 'react-hook-form'
import { UserPlus } from 'lucide-react'
import { z } from '@/src/shared/validacao/zod-ptbr'
import {
    aplicarErrosDoServidor,
    listaNaoVazia,
    selecaoObrigatoria,
    textoObrigatorio,
    useFormulario
} from '@/src/shared/formulario'
import {
    Alert,
    Button,
    CheckboxGroup,
    DatePicker,
    Formulario,
    Input,
    RadioGroup,
    Switch,
    Textarea,
    avisar
} from '@/src/shared/ui'
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
const MENSAGEM_TIPO_VEICULO = 'Selecione o tipo de veículo.'

const esquemaBase = z.object({
    nomeCompleto: textoObrigatorio('Informe o nome completo.'),
    /**
     * Continua obrigatório na validação de forma: quando a conta já tem a data,
     * o campo entra pré-preenchido com ela e a regra passa de graça; quando não
     * tem, o candidato precisa informá-la (011-auto-cadastro-provedor, FR-014).
     */
    dataNascimento: textoObrigatorio('Informe a data de nascimento.'),
    cpf: textoObrigatorio('Informe o CPF.'),
    telefone: textoObrigatorio('Informe o telefone.'),
    cep: textoObrigatorio('Informe o CEP.'),
    bairro: textoObrigatorio('Informe o bairro.'),
    profissao: textoObrigatorio('Informe a profissão ou formação.'),
    restricoesSaude: z.string().optional(),
    veiculoProprio: z.boolean(),
    tipoVeiculo: selecaoObrigatoria(TIPOS_VEICULO, MENSAGEM_TIPO_VEICULO).optional(),
    disponibilidade: listaNaoVazia(z.enum(DISPONIBILIDADES), 'Selecione ao menos uma disponibilidade.'),
    habilidadeIds: z.array(z.string())
})

/**
 * Obrigatoriedade condicional no **esquema**, não só na renderização
 * (016-formularios-rhf-zod, FR-014).
 *
 * Antes, o campo apenas aparecia quando o switch era ligado, mas continuava
 * `optional()` na validação — então a mensagem só existia depois de o servidor
 * recusar o envio. Quem esquecia de escolher o tipo dava a volta inteira pela
 * rede para descobrir isso.
 */
const esquema = esquemaBase.superRefine((dados, ctx) => {
    if (dados.veiculoProprio && !dados.tipoVeiculo) {
        ctx.addIssue({ code: 'custom', path: ['tipoVeiculo'], message: MENSAGEM_TIPO_VEICULO })
    }
})

/** Campos que este formulário conhece — usado ao distribuir a recusa do servidor (FR-012). */
const CAMPOS = Object.keys(esquemaBase.shape)

type DadosFormulario = z.infer<typeof esquema>

export type CandidaturaFormProps = {
    habilidades: { id: string; nome: string }[]
    /** Status da candidatura existente, quando houver (permite reenvio). */
    statusAtual?: 'pendente' | 'aprovado' | 'rejeitado'
    motivoRejeicao?: string | null
    /** E-mail da conta — exibição e conferência apenas, nunca enviado (FR-019). */
    email: string
    /** Nome já confirmado na candidatura anterior, ou o nome da conta. */
    nomeInicial: string
    /** `YYYY-MM-DD` quando a conta já tem o dado; `null` no primeiro envio. */
    dataNascimentoDaConta: string | null
}

/** Exibe `YYYY-MM-DD` como `dd/mm/aaaa`, sem passar por fuso horário. */
function formatarDataBR(iso: string): string {
    const [ano, mes, dia] = iso.split('-')
    return dia && mes && ano ? `${dia}/${mes}/${ano}` : iso
}

export function CandidaturaForm({
    habilidades,
    statusAtual,
    motivoRejeicao,
    email,
    nomeInicial,
    dataNascimentoDaConta
}: CandidaturaFormProps) {
    const router = useRouter()
    const [erroGeral, setErroGeral] = useState<string | null>(null)
    const [enviada, setEnviada] = useState(false)

    // A conta é a autoridade sobre a data (FR-017): quando ela já tem o valor,
    // o campo entra travado. O servidor reconfere de qualquer forma — isto aqui
    // é conveniência, não segurança.
    const dataVemDaConta = dataNascimentoDaConta !== null

    const {
        register,
        handleSubmit,
        control,
        watch,
        setError,
        clearErrors,
        formState: { errors, isSubmitting }
    } = useFormulario(esquema, {
        defaultValues: {
            nomeCompleto: nomeInicial,
            dataNascimento: dataNascimentoDaConta ?? '',
            veiculoProprio: false,
            disponibilidade: [],
            habilidadeIds: []
        }
    })

    const veiculoProprio = watch('veiculoProprio')

    async function enviar(dados: DadosFormulario) {
        setErroGeral(null)

        const resultado = await submeterCandidatura({
            ...dados,
            restricoesSaude: dados.restricoesSaude ?? null,
            // Sem veículo próprio o tipo não é enviado — o domínio também
            // descarta, mas não faz sentido mandar lixo pela rede.
            tipoVeiculo: dados.veiculoProprio ? (dados.tipoVeiculo ?? null) : null
        })

        if (!resultado.ok) {
            const { mensagemGeral } = aplicarErrosDoServidor({
                erro: resultado.erro,
                camposConhecidos: CAMPOS,
                definirErro: (campo, mensagem) => setError(campo as keyof DadosFormulario, { message: mensagem })
            })
            setErroGeral(mensagemGeral)
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
        <Formulario onSubmit={handleSubmit(enviar)} className="flex flex-col gap-6">
            {statusAtual === 'rejeitado' && (
                <Alert tom="warning" titulo="Candidatura anterior não aprovada">
                    {motivoRejeicao ?? 'Revise seus dados e envie novamente.'}
                </Alert>
            )}

            {erroGeral && <Alert tom="danger" titulo={erroGeral} />}

            <div className="grid gap-4 md:grid-cols-2">
                {/*
                  E-mail sempre somente leitura (FR-012): não é campo da
                  candidatura, é a identificação de sob qual conta ela está
                  sendo enviada. Fora do `register` de propósito — o formulário
                  não o envia, e a Server Action não o aceita (FR-019).
                */}
                <Input
                    id="emailDaConta"
                    label="E-mail"
                    apoio="Vem da sua conta. É por ele que avisamos o resultado da triagem."
                    value={email}
                    vemDaConta
                    readOnly
                    autoComplete="email"
                />

                {/*
                  Nome pré-preenchido mas editável (FR-013): Google e Facebook
                  costumam trazer apelido ou nome parcial, e a triagem confere o
                  nome contra o CPF. Travar aqui empurraria a correção para a
                  fila da Defesa Civil.
                */}
                <Input
                    id="nomeCompleto"
                    label="Nome completo"
                    obrigatorio
                    apoio="Como está no seu documento. Corrija se necessário."
                    autoComplete="name"
                    erro={errors.nomeCompleto?.message}
                    {...register('nomeCompleto')}
                />

                {dataVemDaConta ? (
                    /*
                      Texto formatado em vez do DatePicker (FR-014): o primitivo
                      Ark só expõe `disabled`, e um calendário que não abre é
                      pior que um valor legível. Como `Input` somente leitura, o
                      leitor de tela anuncia o campo com a data.
                    */
                    <Input
                        id="dataNascimento"
                        label="Data de nascimento"
                        apoio="Vem da sua conta."
                        value={formatarDataBR(dataNascimentoDaConta)}
                        vemDaConta
                        readOnly
                    />
                ) : (
                    <Controller
                        control={control}
                        name="dataNascimento"
                        render={({ field }) => (
                            <DatePicker
                                ref={field.ref}
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
                )}

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
                        ref={field.ref}
                        id="disponibilidade"
                        obrigatorio
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
                        ref={field.ref}
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
                            ref={field.ref}
                            id="veiculoProprio"
                            label="Possui veículo próprio"
                            checked={field.value}
                            onCheckedChange={(marcado) => {
                                field.onChange(marcado)
                                /*
                                  Desligar o switch retira o campo da tela — e
                                  um erro dele que continuasse no formulário
                                  bloquearia o envio sem nada visível para
                                  corrigir. Limpar aqui é o que evita esse beco
                                  sem saída (016-formularios-rhf-zod, FR-014).
                                */
                                if (!marcado) clearErrors('tipoVeiculo')
                            }}
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
                                ref={field.ref}
                                id="tipoVeiculo"
                                label="Tipo de veículo"
                                obrigatorio
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

            <Button
                type="submit"
                iconeInicio={<UserPlus className="size-4" />}
                size="lg"
                fullWidth
                loading={isSubmitting}
            >
                Enviar candidatura
            </Button>
        </Formulario>
    )
}
