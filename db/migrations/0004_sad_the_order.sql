-- 018-inscricao-atividades (data-model.md § Ordem da migração).
-- Gerado por `db:generate` e reordenado à mão: o Drizzle Kit cria
-- `participante_user_id` já como NOT NULL, o que falha com linhas existentes.
-- O backfill (passo 3) é 1:1 a partir de voluntario_perfil.user_id.

-- 1. Tipos
CREATE TYPE "public"."origem_alocacao" AS ENUM('gestao', 'inscricao_propria');--> statement-breakpoint
ALTER TYPE "public"."tipo_notificacao" ADD VALUE 'inscricao_turno';--> statement-breakpoint

-- 2. Colunas novas (participante ainda anulável)
ALTER TABLE "alocacao" ADD COLUMN "participante_user_id" text;--> statement-breakpoint
ALTER TABLE "alocacao" ADD COLUMN "origem" "origem_alocacao" DEFAULT 'gestao' NOT NULL;--> statement-breakpoint

-- 3. Backfill: toda alocação existente veio da gestão e tem perfil
UPDATE "alocacao" a SET "participante_user_id" = vp."user_id" FROM "voluntario_perfil" vp WHERE vp."id" = a."voluntario_perfil_id";--> statement-breakpoint

-- 4. Obrigatoriedade + FK
ALTER TABLE "alocacao" ALTER COLUMN "participante_user_id" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "alocacao" ADD CONSTRAINT "alocacao_participante_user_id_user_id_fk" FOREIGN KEY ("participante_user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint

-- 5. Unicidade passa a ser por pessoa, não por perfil
DROP INDEX "alocacao_turno_voluntario_idx";--> statement-breakpoint
CREATE UNIQUE INDEX "alocacao_turno_participante_idx" ON "alocacao" USING btree ("turno_id","participante_user_id");--> statement-breakpoint
CREATE INDEX "alocacao_participante_idx" ON "alocacao" USING btree ("participante_user_id");--> statement-breakpoint

-- 6. Perfil opcional (equipe interna sem cadastro de voluntário)
ALTER TABLE "alocacao" ALTER COLUMN "voluntario_perfil_id" DROP NOT NULL;
