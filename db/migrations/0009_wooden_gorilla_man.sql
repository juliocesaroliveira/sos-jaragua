-- Feature 024 — proteção dos dados sensíveis (ETAPA 1 de 2: estrutura).
--
-- Depois desta migration, rode o script de dados ANTES de considerar a feature
-- aplicada:   npx tsx --env-file=.env.local scripts/proteger-dados-existentes.ts
-- Ele cifra os valores que esta migration deixou em claro e preenche `cpf_indice`.
--
-- O índice único de `cpf` é trocado por um de `cpf_indice`: com a cifra
-- aleatorizada, um índice sobre `cpf` não detectaria duplicata alguma. Ele é
-- criado aqui, com a coluna ainda toda nula (nulos não colidem no Postgres), de
-- modo que uma eventual duplicata real de CPF estoure no próprio script de
-- dados, na linha exata — em vez de aparecer só no fim.
DROP INDEX "voluntario_perfil_cpf_idx";--> statement-breakpoint

-- `date` -> `text` com cast EXPLÍCITO.
--
-- `SET DATA TYPE text` sozinho usaria o `DateStyle` da sessão, que pode render
-- `03/15/1990` em vez de `1990-03-15`. O domínio (`ehMaiorDeIdade`) e a máscara
-- da data dependem do formato ISO, então o cast é fixado em `to_char` para não
-- depender de configuração de sessão.
ALTER TABLE "user" ALTER COLUMN "data_nascimento" SET DATA TYPE text
    USING to_char("data_nascimento", 'YYYY-MM-DD');--> statement-breakpoint
ALTER TABLE "voluntario_perfil" ALTER COLUMN "data_nascimento" SET DATA TYPE text
    USING to_char("data_nascimento", 'YYYY-MM-DD');--> statement-breakpoint

ALTER TABLE "voluntario_perfil" ADD COLUMN "cpf_indice" text;--> statement-breakpoint
ALTER TABLE "voluntario_perfil" ADD COLUMN "anonimizado_em" timestamp with time zone;--> statement-breakpoint
CREATE UNIQUE INDEX "voluntario_perfil_cpf_indice_idx" ON "voluntario_perfil" USING btree ("cpf_indice");
