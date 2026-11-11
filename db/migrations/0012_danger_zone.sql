DROP INDEX "alocacao_turno_participante_idx";--> statement-breakpoint
CREATE UNIQUE INDEX "alocacao_turno_participante_idx" ON "alocacao" USING btree ("turno_id","participante_user_id") WHERE "alocacao"."participante_user_id" <> 'sistema-usuario-removido';--> statement-breakpoint
-- Registros padrão da Danger Zone (026-danger-zone-admin, research D4).
-- Ids iguais a `REGISTROS_SISTEMA` em `src/shared/kernel/registros-sistema.ts`.
-- "Usuário removido" nasce inativo e sem linha em `account`: não autentica e o
-- serviço de notificação o recusa como `usuario_inativo` (FR-012a).
INSERT INTO "user" ("id", "name", "email", "email_verified", "role", "ativo")
VALUES ('sistema-usuario-removido', 'Usuário removido', 'usuario-removido@sistema.invalid', false, 'usuario', false)
ON CONFLICT ("id") DO NOTHING;--> statement-breakpoint
INSERT INTO "item" ("id", "nome", "categoria", "unidade_medida")
VALUES ('00000000-0000-4000-8000-000000000001', 'Item removido', 'outros', 'unidade')
ON CONFLICT ("id") DO NOTHING;--> statement-breakpoint
INSERT INTO "atividade_categoria" ("id", "nome")
VALUES ('00000000-0000-4000-8000-000000000002', 'Categoria removida')
ON CONFLICT ("id") DO NOTHING;
