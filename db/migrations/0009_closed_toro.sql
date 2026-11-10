CREATE TYPE "public"."acao_consentimento" AS ENUM('concedido', 'revogado');--> statement-breakpoint
CREATE TYPE "public"."motivo_nao_entrega" AS ENUM('canal_desativado', 'sem_celular', 'usuario_inativo', 'nao_configurado', 'numero_sem_whatsapp', 'limite_envio', 'modelo_indisponivel', 'falha');--> statement-breakpoint
CREATE TYPE "public"."origem_consentimento" AS ENUM('cadastro', 'perfil', 'resposta_whatsapp');--> statement-breakpoint
ALTER TYPE "public"."canal_envio" ADD VALUE 'whatsapp';--> statement-breakpoint
ALTER TYPE "public"."status_envio" ADD VALUE 'entregue';--> statement-breakpoint
ALTER TYPE "public"."status_envio" ADD VALUE 'lido';--> statement-breakpoint
ALTER TYPE "public"."status_envio" ADD VALUE 'nao_enviado';--> statement-breakpoint
CREATE TABLE "consentimento_whatsapp" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"acao" "acao_consentimento" NOT NULL,
	"origem" "origem_consentimento" NOT NULL,
	"telefone" text,
	"criado_em" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "preferencia_whatsapp" (
	"user_id" text PRIMARY KEY NOT NULL,
	"ativo" boolean NOT NULL,
	"atualizado_em" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "whatsapp_resposta_automatica" (
	"telefone" text PRIMARY KEY NOT NULL,
	"ultima_em" timestamp with time zone NOT NULL
);
--> statement-breakpoint
DROP INDEX "notificacao_envio_notificacao_idx";--> statement-breakpoint
ALTER TABLE "notificacao_envio" ADD COLUMN "motivo" "motivo_nao_entrega";--> statement-breakpoint
ALTER TABLE "notificacao_envio" ADD COLUMN "destino" text;--> statement-breakpoint
ALTER TABLE "notificacao_envio" ADD COLUMN "id_externo" text;--> statement-breakpoint
ALTER TABLE "notificacao_envio" ADD COLUMN "atualizado_em" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "consentimento_whatsapp" ADD CONSTRAINT "consentimento_whatsapp_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "preferencia_whatsapp" ADD CONSTRAINT "preferencia_whatsapp_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "consentimento_whatsapp_user_criado_idx" ON "consentimento_whatsapp" USING btree ("user_id","criado_em");--> statement-breakpoint
CREATE UNIQUE INDEX "notificacao_envio_notificacao_canal_unico" ON "notificacao_envio" USING btree ("notificacao_id","canal");--> statement-breakpoint
CREATE UNIQUE INDEX "notificacao_envio_id_externo_idx" ON "notificacao_envio" USING btree ("id_externo") WHERE "notificacao_envio"."id_externo" is not null;