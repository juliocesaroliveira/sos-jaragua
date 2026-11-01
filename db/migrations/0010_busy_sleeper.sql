-- Feature 024 — ETAPA 2: nulabilidade para a anonimização a pedido do titular.
--
-- Os campos pessoais passam a aceitar nulo porque a eliminação (FR-022) os
-- esvazia e marca `anonimizado_em`, mantendo a linha. Nulo aqui significa
-- "titular anonimizado", não "cadastro incompleto": a obrigatoriedade dos campos
-- continua valendo na validação da candidatura, no `domain`.
--
-- A linha NÃO pode ser apagada: `alocacao.participante_user_id` é cascade e
-- destruiria o histórico de turnos, e `alocacao.alocado_por`,
-- `atividade.criado_por` e as tabelas de estoque não declaram onDelete, então o
-- DELETE falharia para quem tem histórico operacional (research.md D7).

ALTER TABLE "voluntario_perfil" ALTER COLUMN "nome_completo" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "voluntario_perfil" ALTER COLUMN "data_nascimento" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "voluntario_perfil" ALTER COLUMN "cpf" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "voluntario_perfil" ALTER COLUMN "telefone" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "voluntario_perfil" ALTER COLUMN "cep" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "voluntario_perfil" ALTER COLUMN "bairro" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "voluntario_perfil" ALTER COLUMN "profissao" DROP NOT NULL;