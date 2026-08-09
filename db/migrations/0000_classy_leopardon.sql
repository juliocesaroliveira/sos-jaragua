-- Extensao exigida pelo indice trigram de item.nome (BR-EST-01, DB_SCHEMA.md 12)
CREATE EXTENSION IF NOT EXISTS pg_trgm;--> statement-breakpoint
CREATE TYPE "public"."role" AS ENUM('usuario', 'voluntario', 'membro_defesa_civil', 'coordenador', 'administrador');--> statement-breakpoint
CREATE TYPE "public"."disponibilidade" AS ENUM('integral', 'manha', 'tarde', 'noite', 'fim_de_semana');--> statement-breakpoint
CREATE TYPE "public"."status_alocacao" AS ENUM('confirmado', 'cancelado');--> statement-breakpoint
CREATE TYPE "public"."status_atividade" AS ENUM('aberta', 'encerrada', 'cancelada');--> statement-breakpoint
CREATE TYPE "public"."status_voluntario" AS ENUM('pendente', 'aprovado', 'rejeitado');--> statement-breakpoint
CREATE TYPE "public"."tipo_veiculo" AS ENUM('carro', 'caminhonete', 'moto', 'barco');--> statement-breakpoint
CREATE TYPE "public"."categoria_item" AS ENUM('agua', 'alimentacao', 'higiene', 'limpeza', 'acomodacao', 'materiais_construcao', 'vestuario', 'outros');--> statement-breakpoint
CREATE TYPE "public"."condicao_item" AS ENUM('novo', 'usado_bom_estado', 'necessita_higienizacao');--> statement-breakpoint
CREATE TYPE "public"."tipo_saida" AS ENUM('avulso', 'kit');--> statement-breakpoint
CREATE TYPE "public"."unidade_medida" AS ENUM('unidade', 'kg', 'litro', 'fardo', 'caixa');--> statement-breakpoint
CREATE TYPE "public"."base_demanda" AS ENUM('por_familia', 'por_pessoa_desabrigada');--> statement-breakpoint
CREATE TYPE "public"."canal_envio" AS ENUM('email', 'plataforma');--> statement-breakpoint
CREATE TYPE "public"."status_envio" AS ENUM('pendente', 'enviado', 'falhou');--> statement-breakpoint
CREATE TYPE "public"."tipo_notificacao" AS ENUM('triagem_concluida', 'atividade_atribuida', 'alteracao_atividade', 'lembrete_turno', 'broadcast_urgencia', 'cadastros_acumulados', 'estoque_critico', 'deficit_atendimento');--> statement-breakpoint
CREATE TABLE "account" (
	"id" text PRIMARY KEY NOT NULL,
	"account_id" text NOT NULL,
	"provider_id" text NOT NULL,
	"user_id" text NOT NULL,
	"access_token" text,
	"refresh_token" text,
	"id_token" text,
	"access_token_expires_at" timestamp with time zone,
	"refresh_token_expires_at" timestamp with time zone,
	"scope" text,
	"password" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "session" (
	"id" text PRIMARY KEY NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"token" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"ip_address" text,
	"user_agent" text,
	"user_id" text NOT NULL,
	"last_activity_at" timestamp with time zone,
	CONSTRAINT "session_token_unique" UNIQUE("token")
);
--> statement-breakpoint
CREATE TABLE "user" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"email" text NOT NULL,
	"email_verified" boolean DEFAULT false NOT NULL,
	"image" text,
	"role" "role" DEFAULT 'usuario' NOT NULL,
	"ativo" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "user_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE "verification" (
	"id" text PRIMARY KEY NOT NULL,
	"identifier" text NOT NULL,
	"value" text NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "alocacao" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"turno_id" uuid NOT NULL,
	"voluntario_perfil_id" uuid NOT NULL,
	"status" "status_alocacao" DEFAULT 'confirmado' NOT NULL,
	"alocado_por" text NOT NULL,
	"lembrete_enviado_em" timestamp with time zone,
	"criado_em" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "atividade" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"titulo" text NOT NULL,
	"categoria_id" uuid NOT NULL,
	"local" text NOT NULL,
	"status" "status_atividade" DEFAULT 'aberta' NOT NULL,
	"criado_por" text NOT NULL,
	"criado_em" timestamp with time zone DEFAULT now() NOT NULL,
	"atualizado_em" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "atividade_categoria" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"nome" text NOT NULL,
	"criado_em" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "atividade_categoria_nome_unique" UNIQUE("nome")
);
--> statement-breakpoint
CREATE TABLE "habilidade" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"nome" text NOT NULL,
	"criado_em" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "habilidade_nome_unique" UNIQUE("nome")
);
--> statement-breakpoint
CREATE TABLE "turno" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"atividade_id" uuid NOT NULL,
	"inicio" timestamp with time zone NOT NULL,
	"fim" timestamp with time zone NOT NULL,
	"vagas" integer NOT NULL,
	"criado_em" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "voluntario_habilidade" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"voluntario_perfil_id" uuid NOT NULL,
	"habilidade_id" uuid NOT NULL
);
--> statement-breakpoint
CREATE TABLE "voluntario_perfil" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"nome_completo" text NOT NULL,
	"data_nascimento" date NOT NULL,
	"cpf" text NOT NULL,
	"telefone" text NOT NULL,
	"cep" text NOT NULL,
	"bairro" text NOT NULL,
	"profissao" text NOT NULL,
	"restricoes_saude" text,
	"veiculo_proprio" boolean NOT NULL,
	"tipo_veiculo" "tipo_veiculo",
	"disponibilidade" "disponibilidade"[] NOT NULL,
	"status" "status_voluntario" DEFAULT 'pendente' NOT NULL,
	"aprovado_por" text,
	"aprovado_em" timestamp with time zone,
	"motivo_rejeicao" text,
	"criado_em" timestamp with time zone DEFAULT now() NOT NULL,
	"atualizado_em" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "voluntario_perfil_userId_unique" UNIQUE("user_id")
);
--> statement-breakpoint
CREATE TABLE "descarte" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"item_id" uuid NOT NULL,
	"quantidade" numeric(14, 3) NOT NULL,
	"motivo" text,
	"registrado_por" text NOT NULL,
	"criado_em" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "entrada" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"item_id" uuid NOT NULL,
	"quantidade" numeric(14, 3) NOT NULL,
	"condicao" "condicao_item" NOT NULL,
	"perecivel" boolean NOT NULL,
	"data_validade" date,
	"kit_destino_id" uuid,
	"registrado_por" text NOT NULL,
	"criado_em" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "item" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"nome" text NOT NULL,
	"categoria" "categoria_item" NOT NULL,
	"unidade_medida" "unidade_medida" NOT NULL,
	"criado_em" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "kit" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"nome" text NOT NULL,
	"descricao" text,
	"ativo" boolean DEFAULT true NOT NULL,
	"criado_em" timestamp with time zone DEFAULT now() NOT NULL,
	"atualizado_em" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "kit_receita_item" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"kit_id" uuid NOT NULL,
	"item_id" uuid NOT NULL,
	"quantidade" numeric(14, 3) NOT NULL
);
--> statement-breakpoint
CREATE TABLE "saida" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tipo" "tipo_saida" NOT NULL,
	"destino" text NOT NULL,
	"responsavel_transporte" text NOT NULL,
	"registrado_por" text NOT NULL,
	"criado_em" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "saida_item" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"saida_id" uuid NOT NULL,
	"item_id" uuid NOT NULL,
	"quantidade" numeric(14, 3) NOT NULL
);
--> statement-breakpoint
CREATE TABLE "saldo_estoque" (
	"item_id" uuid PRIMARY KEY NOT NULL,
	"quantidade_atual" numeric(14, 3) DEFAULT '0' NOT NULL,
	"atualizado_em" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "crise_variaveis" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"total_familias_afetadas" integer NOT NULL,
	"total_pessoas_afetadas" integer NOT NULL,
	"atualizado_por" text NOT NULL,
	"atualizado_em" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "metrica_kit" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"kit_id" uuid NOT NULL,
	"base_demanda" "base_demanda" NOT NULL,
	"proporcao" numeric(10, 3) NOT NULL,
	CONSTRAINT "metrica_kit_kitId_unique" UNIQUE("kit_id")
);
--> statement-breakpoint
CREATE TABLE "notificacao" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"destinatario_user_id" text NOT NULL,
	"tipo" "tipo_notificacao" NOT NULL,
	"titulo" text NOT NULL,
	"mensagem" text NOT NULL,
	"lida" boolean DEFAULT false NOT NULL,
	"contexto" jsonb,
	"criado_em" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "notificacao_envio" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"notificacao_id" uuid NOT NULL,
	"canal" "canal_envio" NOT NULL,
	"status" "status_envio" DEFAULT 'pendente' NOT NULL,
	"enviado_em" timestamp with time zone,
	"erro" text
);
--> statement-breakpoint
ALTER TABLE "account" ADD CONSTRAINT "account_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "session" ADD CONSTRAINT "session_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "alocacao" ADD CONSTRAINT "alocacao_turno_id_turno_id_fk" FOREIGN KEY ("turno_id") REFERENCES "public"."turno"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "alocacao" ADD CONSTRAINT "alocacao_voluntario_perfil_id_voluntario_perfil_id_fk" FOREIGN KEY ("voluntario_perfil_id") REFERENCES "public"."voluntario_perfil"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "alocacao" ADD CONSTRAINT "alocacao_alocado_por_user_id_fk" FOREIGN KEY ("alocado_por") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "atividade" ADD CONSTRAINT "atividade_categoria_id_atividade_categoria_id_fk" FOREIGN KEY ("categoria_id") REFERENCES "public"."atividade_categoria"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "atividade" ADD CONSTRAINT "atividade_criado_por_user_id_fk" FOREIGN KEY ("criado_por") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "turno" ADD CONSTRAINT "turno_atividade_id_atividade_id_fk" FOREIGN KEY ("atividade_id") REFERENCES "public"."atividade"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "voluntario_habilidade" ADD CONSTRAINT "voluntario_habilidade_voluntario_perfil_id_voluntario_perfil_id_fk" FOREIGN KEY ("voluntario_perfil_id") REFERENCES "public"."voluntario_perfil"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "voluntario_habilidade" ADD CONSTRAINT "voluntario_habilidade_habilidade_id_habilidade_id_fk" FOREIGN KEY ("habilidade_id") REFERENCES "public"."habilidade"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "voluntario_perfil" ADD CONSTRAINT "voluntario_perfil_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "voluntario_perfil" ADD CONSTRAINT "voluntario_perfil_aprovado_por_user_id_fk" FOREIGN KEY ("aprovado_por") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "descarte" ADD CONSTRAINT "descarte_item_id_item_id_fk" FOREIGN KEY ("item_id") REFERENCES "public"."item"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "descarte" ADD CONSTRAINT "descarte_registrado_por_user_id_fk" FOREIGN KEY ("registrado_por") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "entrada" ADD CONSTRAINT "entrada_item_id_item_id_fk" FOREIGN KEY ("item_id") REFERENCES "public"."item"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "entrada" ADD CONSTRAINT "entrada_kit_destino_id_kit_id_fk" FOREIGN KEY ("kit_destino_id") REFERENCES "public"."kit"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "entrada" ADD CONSTRAINT "entrada_registrado_por_user_id_fk" FOREIGN KEY ("registrado_por") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "kit_receita_item" ADD CONSTRAINT "kit_receita_item_kit_id_kit_id_fk" FOREIGN KEY ("kit_id") REFERENCES "public"."kit"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "kit_receita_item" ADD CONSTRAINT "kit_receita_item_item_id_item_id_fk" FOREIGN KEY ("item_id") REFERENCES "public"."item"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "saida" ADD CONSTRAINT "saida_registrado_por_user_id_fk" FOREIGN KEY ("registrado_por") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "saida_item" ADD CONSTRAINT "saida_item_saida_id_saida_id_fk" FOREIGN KEY ("saida_id") REFERENCES "public"."saida"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "saida_item" ADD CONSTRAINT "saida_item_item_id_item_id_fk" FOREIGN KEY ("item_id") REFERENCES "public"."item"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "saldo_estoque" ADD CONSTRAINT "saldo_estoque_item_id_item_id_fk" FOREIGN KEY ("item_id") REFERENCES "public"."item"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "crise_variaveis" ADD CONSTRAINT "crise_variaveis_atualizado_por_user_id_fk" FOREIGN KEY ("atualizado_por") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "metrica_kit" ADD CONSTRAINT "metrica_kit_kit_id_kit_id_fk" FOREIGN KEY ("kit_id") REFERENCES "public"."kit"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notificacao" ADD CONSTRAINT "notificacao_destinatario_user_id_user_id_fk" FOREIGN KEY ("destinatario_user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notificacao_envio" ADD CONSTRAINT "notificacao_envio_notificacao_id_notificacao_id_fk" FOREIGN KEY ("notificacao_id") REFERENCES "public"."notificacao"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "account_provider_account_idx" ON "account" USING btree ("provider_id","account_id");--> statement-breakpoint
CREATE INDEX "session_user_id_idx" ON "session" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "user_role_idx" ON "user" USING btree ("role");--> statement-breakpoint
CREATE INDEX "verification_identifier_idx" ON "verification" USING btree ("identifier");--> statement-breakpoint
CREATE UNIQUE INDEX "alocacao_turno_voluntario_idx" ON "alocacao" USING btree ("turno_id","voluntario_perfil_id");--> statement-breakpoint
CREATE INDEX "alocacao_voluntario_idx" ON "alocacao" USING btree ("voluntario_perfil_id");--> statement-breakpoint
CREATE INDEX "atividade_status_idx" ON "atividade" USING btree ("status");--> statement-breakpoint
CREATE INDEX "turno_atividade_idx" ON "turno" USING btree ("atividade_id");--> statement-breakpoint
CREATE INDEX "turno_inicio_idx" ON "turno" USING btree ("inicio");--> statement-breakpoint
CREATE UNIQUE INDEX "voluntario_habilidade_unico_idx" ON "voluntario_habilidade" USING btree ("voluntario_perfil_id","habilidade_id");--> statement-breakpoint
CREATE INDEX "voluntario_habilidade_habilidade_idx" ON "voluntario_habilidade" USING btree ("habilidade_id");--> statement-breakpoint
CREATE UNIQUE INDEX "voluntario_perfil_cpf_idx" ON "voluntario_perfil" USING btree ("cpf");--> statement-breakpoint
CREATE INDEX "voluntario_perfil_status_idx" ON "voluntario_perfil" USING btree ("status");--> statement-breakpoint
CREATE INDEX "descarte_item_criado_idx" ON "descarte" USING btree ("item_id","criado_em");--> statement-breakpoint
CREATE INDEX "entrada_item_criado_idx" ON "entrada" USING btree ("item_id","criado_em");--> statement-breakpoint
CREATE INDEX "item_nome_trgm_idx" ON "item" USING gin ("nome" gin_trgm_ops);--> statement-breakpoint
CREATE INDEX "item_categoria_idx" ON "item" USING btree ("categoria");--> statement-breakpoint
CREATE UNIQUE INDEX "kit_receita_item_unico_idx" ON "kit_receita_item" USING btree ("kit_id","item_id");--> statement-breakpoint
CREATE INDEX "saida_criado_idx" ON "saida" USING btree ("criado_em");--> statement-breakpoint
CREATE INDEX "saida_item_item_idx" ON "saida_item" USING btree ("item_id");--> statement-breakpoint
CREATE INDEX "crise_variaveis_atualizado_idx" ON "crise_variaveis" USING btree ("atualizado_em");--> statement-breakpoint
CREATE INDEX "notificacao_destinatario_lida_idx" ON "notificacao" USING btree ("destinatario_user_id","lida");--> statement-breakpoint
CREATE INDEX "notificacao_tipo_criado_idx" ON "notificacao" USING btree ("tipo","criado_em");--> statement-breakpoint
CREATE INDEX "notificacao_envio_notificacao_idx" ON "notificacao_envio" USING btree ("notificacao_id");