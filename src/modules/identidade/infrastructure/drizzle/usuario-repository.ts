import { and, count, desc, eq, inArray, isNotNull, isNull, sql } from 'drizzle-orm'
import { db, type Transacao } from '@/src/shared/db/postgres'
import { account, session, user } from '@/db/schema/identidade'
import type { Role } from '@/src/shared/auth/roles'
import type { LinhaUsuario, UsuarioRepository } from '../../application/ports/usuario-repository'
import { cifrar, decifrar, ehEnvelope } from '@/src/shared/cripto'
import {
    consentimentoWhatsapp,
    notificacao,
    notificacaoEnvio,
    preferenciaWhatsapp,
    whatsappRespostaAutomatica
} from '@/db/schema/notificacoes'

/**
 * Implementação Drizzle do port de Identidade (DESIGN.md §5).
 *
 * Substitui `criarUserRepository` que vivia em
 * `voluntariado/infrastructure/drizzle/voluntario-repository.ts`
 * (006-user-management-page, research.md D6) — `atualizarRole`/`buscarRole`
 * migraram para aqui como `atualizarNomeERole`/`buscarRole`, e `listar` é
 * novo.
 */
type Executor = typeof db | Transacao

/**
 * Provedor de credencial do better-auth para contas com senha própria — as
 * criadas manualmente em `/admin`. Contas sociais gravam `google`/`facebook`
 * (008-admin-password-reset, D2).
 */
const PROVEDOR_SENHA = 'credential'

/**
 * Subconsulta correlacionada em vez de uma consulta por linha: a listagem de
 * `/admin` já é paginada e um N+1 aqui apareceria justamente na tela de
 * administração durante uma crise. Mesmo padrão de `HABILIDADES_DO_PERFIL`
 * em `voluntariado`.
 */
const POSSUI_SENHA_PROPRIA = sql<boolean>`exists (
    select 1 from "account"
    where "account"."user_id" = "user"."id"
      and "account"."provider_id" = ${PROVEDOR_SENHA}
      and "account"."password" is not null
)`

export function criarUsuarioRepository(executor: Executor = db): UsuarioRepository {
    return {
        async listar({ page, pageSize }) {
            const [linhas, [total]] = await Promise.all([
                executor
                    .select({
                        id: user.id,
                        nome: user.name,
                        email: user.email,
                        role: user.role,
                        criadoEm: user.createdAt,
                        podeTrocarSenha: POSSUI_SENHA_PROPRIA
                    })
                    .from(user)
                    .orderBy(desc(user.createdAt))
                    .limit(pageSize)
                    .offset((page - 1) * pageSize),
                executor.select({ total: count() }).from(user)
            ])

            return {
                rows: linhas.map((l) => ({ ...l, criadoEm: l.criadoEm.toISOString() })) as LinhaUsuario[],
                totalCount: total?.total ?? 0
            }
        },

        async atualizarNomeERole(userId, { nome, role }) {
            await executor.update(user).set({ name: nome, role }).where(eq(user.id, userId))
        },

        async atualizarRole(userId, role) {
            await executor.update(user).set({ role }).where(eq(user.id, userId))
        },

        async possuiSenhaPropria(userId) {
            const [linha] = await executor
                .select({ id: account.id })
                .from(account)
                .where(
                    and(eq(account.userId, userId), eq(account.providerId, PROVEDOR_SENHA), isNotNull(account.password))
                )
                .limit(1)

            return linha !== undefined
        },

        async buscarRole(userId) {
            const [linha] = await executor.select({ role: user.role }).from(user).where(eq(user.id, userId)).limit(1)
            return (linha?.role as Role) ?? null
        },

        async definirDataNascimentoSeAusente(userId, data) {
            // `isNull` no WHERE, e não um `select` antes: é o que torna a
            // escrita idempotente e imune a corrida entre dois envios
            // simultâneos, sem precisar de lock explícito.
            //
            // Cifrado aqui (feature 025, FR-008): esta é a cópia da data que vive
            // em `user`, e protegê-la junto da de `voluntario_perfil` é o que
            // impede que o dia e o mês continuem legíveis em um dos dois lugares.
            await executor
                .update(user)
                .set({ dataNascimento: cifrar(data) })
                .where(and(eq(user.id, userId), isNull(user.dataNascimento)))
        },

        async anonimizarConta(userId) {
            // Valor neutro e irrepetível: a coluna é `notNull unique`, a conta não
            // pode ser reativável, e um futuro cadastro independente da mesma
            // pessoa não pode ficar bloqueado por um e-mail "queimado".
            await executor
                .update(user)
                .set({
                    name: 'Titular anônimo',
                    email: `anonimizado+${userId}@invalido.local`,
                    image: null,
                    dataNascimento: null,
                    ativo: false
                })
                .where(eq(user.id, userId))

            // Encerra a sessão (FR-028) e remove os vínculos de login, para que a
            // conta não possa ser reautenticada por senha nem por provedor social.
            await executor.delete(session).where(eq(session.userId, userId))
            await executor.delete(account).where(eq(account.userId, userId))

            // As notificações entram no alcance da eliminação porque o conteúdo
            // pode carregar dado pessoal.
            //
            // NOTA DE PROPRIEDADE DE MÓDULO: `notificacao` pertence ao módulo de
            // Notificações, e o Princípio I manda que um módulo não toque tabela de
            // outro. Está aqui porque a alternativa — estender
            // `UnidadeDeTrabalho` com um terceiro port só para um `DELETE` por
            // `user_id` — mudaria uma interface usada por vários casos de uso. É um
            // desvio consciente, registrado em tasks.md, e o lugar certo se a
            // eliminação crescer é um port próprio de Notificações.
            //
            // O canal WhatsApp (024-notificacoes-whatsapp) também guarda o
            // telefone do titular, e entra no mesmo alcance — com o mesmo desvio
            // de módulo descrito acima:
            //
            // - `notificacao_envio.destino` sai junto com `notificacao` (cascade);
            //   por isso os números são coletados ANTES do `DELETE` abaixo.
            // - `whatsapp_resposta_automatica` é chaveada só pelo número, sem
            //   `user_id`: os números conhecidos do titular são a única ponte.
            // - `preferencia_whatsapp` é apagada — ausência de linha = desligado.
            // - `consentimento_whatsapp` é append-only como evidência de
            //   consentimento (FR-011). A linha fica (quem, quando, concedeu ou
            //   revogou, por qual origem) e só o telefone é anulado: mesma
            //   exceção única que a constituição abre para a trilha de auditoria —
            //   a evidência sobrevive, o dado pessoal não.
            const consentimentos = await executor
                .select({ telefone: consentimentoWhatsapp.telefone })
                .from(consentimentoWhatsapp)
                .where(and(eq(consentimentoWhatsapp.userId, userId), isNotNull(consentimentoWhatsapp.telefone)))
            const envios = await executor
                .select({ telefone: notificacaoEnvio.destino })
                .from(notificacaoEnvio)
                .innerJoin(notificacao, eq(notificacao.id, notificacaoEnvio.notificacaoId))
                .where(and(eq(notificacao.destinatarioUserId, userId), isNotNull(notificacaoEnvio.destino)))
            const telefones = [
                ...new Set(
                    [...consentimentos, ...envios].map((l) => l.telefone).filter((t): t is string => t !== null)
                )
            ]
            if (telefones.length > 0) {
                await executor
                    .delete(whatsappRespostaAutomatica)
                    .where(inArray(whatsappRespostaAutomatica.telefone, telefones))
            }
            await executor.delete(preferenciaWhatsapp).where(eq(preferenciaWhatsapp.userId, userId))
            await executor
                .update(consentimentoWhatsapp)
                .set({ telefone: null })
                .where(eq(consentimentoWhatsapp.userId, userId))

            await executor.delete(notificacao).where(eq(notificacao.destinatarioUserId, userId))
        },

        async buscarDataNascimento(userId) {
            const [linha] = await executor
                .select({ dataNascimento: user.dataNascimento })
                .from(user)
                .where(eq(user.id, userId))
                .limit(1)

            const armazenado = linha?.dataNascimento ?? null
            if (armazenado === null) return null

            // Linhas gravadas antes da migração de proteção ainda estão em claro;
            // o script `proteger-dados-existentes` as converte. Ler as duas formas
            // mantém a aplicação funcional durante a janela da migração.
            return ehEnvelope(armazenado) ? decifrar(armazenado) : armazenado
        }
    }
}
