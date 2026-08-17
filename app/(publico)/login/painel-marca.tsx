import { Logo } from '@/src/shared/ui'

/**
 * Bloco institucional da tela de login (014-redesign-tela-login, FR-001, FR-002,
 * FR-016): marca, nome do sistema e a frase que diz a que ele serve.
 *
 * É o que responde à US1 — alguém que nunca usou o sistema precisa reconhecer,
 * em segundos, de que organização é a ferramenta.
 *
 * **Texto claro nos dois temas, de propósito.** O fundo desta tela é escuro em
 * claro e em escuro (ver `fundo-login.tsx`): uma composição imersiva sobre
 * fotografia não inverte para branco no tema claro, ou o scrim deixaria de
 * funcionar e a foto perderia a força. Como o fundo não muda de luminosidade
 * entre os temas, o texto sobre ele também não muda — usar
 * `text-foreground` aqui produziria texto quase preto sobre fundo quase preto no
 * tema claro. Os tons são fixos e vêm da escala `neutral`, não de valores
 * avulsos (FR-005).
 *
 * Server Component: só texto e imagem.
 */
export function PainelMarca() {
    return (
        <div className="flex flex-col items-center gap-4 text-center lg:items-start lg:text-left">
            {/*
              `alt` vazio: o nome do sistema vem escrito no `<h1>` logo abaixo, e
              um texto alternativo aqui faria o leitor de tela anunciar
              "SOS Jaraguá" duas vezes seguidas.

              Compacto no celular (`sm`), grande a partir de `lg` — no mobile a
              marca divide a altura útil com o cartão de acesso, que tem
              prioridade (FR-008).
            */}
            <Logo tamanho="md" className="lg:hidden" />
            <Logo tamanho="lg" className="hidden lg:block" />

            {/*
              Único `<h1>` da página (FR-016). O `<span>` interno separa o nome
              da marca do complemento, para que o complemento possa ter peso
              visual menor sem virar um segundo cabeçalho na árvore de
              acessibilidade.
            */}
            <h1 className="text-3xl font-bold tracking-tight text-white lg:text-5xl">
                SOS Jaraguá
                <span className="mt-1 block text-lg font-medium text-neutral-300 lg:text-2xl">Defesa Civil</span>
            </h1>

            <p className="max-w-sm text-balance text-base text-neutral-300 lg:max-w-md lg:text-lg">
                Gestão e mobilização em situações de emergência no município de Jaraguá do Sul.
            </p>
        </div>
    )
}
