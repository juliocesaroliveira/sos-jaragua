CREATE EXTENSION IF NOT EXISTS unaccent;--> statement-breakpoint
CREATE OR REPLACE FUNCTION public.f_unaccent(text) RETURNS text LANGUAGE sql IMMUTABLE PARALLEL SAFE STRICT AS $$ select public.unaccent('public.unaccent', $1) $$;--> statement-breakpoint
CREATE INDEX "item_nome_unaccent_trgm_idx" ON "item" USING gin (f_unaccent("nome") gin_trgm_ops);
