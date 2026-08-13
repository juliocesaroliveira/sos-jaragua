/**
 * Stub de `server-only` para os testes.
 *
 * O pacote real é resolvido pelo bundler do Next e lança se importado fora de
 * um contexto de servidor. Nos testes rodamos os módulos de `application` e
 * `infrastructure` diretamente no Node, então o alias em `vitest.config.ts`
 * aponta para este arquivo vazio.
 *
 * A garantia que `server-only` dá — não vazar código de servidor para o
 * cliente — continua valendo em produção, onde o pacote real é usado.
 */
export {}
