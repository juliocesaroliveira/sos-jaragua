ALTER TABLE "habilidade" DROP CONSTRAINT "habilidade_nome_unique";--> statement-breakpoint
ALTER TABLE "voluntario_habilidade" DROP CONSTRAINT "voluntario_habilidade_habilidade_id_habilidade_id_fk";
--> statement-breakpoint
ALTER TABLE "voluntario_habilidade" ADD CONSTRAINT "voluntario_habilidade_habilidade_id_habilidade_id_fk" FOREIGN KEY ("habilidade_id") REFERENCES "public"."habilidade"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "habilidade_nome_lower_idx" ON "habilidade" USING btree (lower("nome"));