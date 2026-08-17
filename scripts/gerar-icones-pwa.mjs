/**
 * Gera os ícones do PWA (e o favicon) a partir da marca em `public/sos-logo.png`.
 *
 * Executar com: `node scripts/gerar-icones-pwa.mjs`
 *
 * Existe para que os ícones sejam **reproduzíveis**: trocar a arte da marca é
 * substituir `sos-logo.png` e rodar de novo, em vez de recriar binários à mão
 * em um editor externo e commitá-los sem origem conhecida.
 *
 * A arte original é um brasão circular (anel laranja, disco azul) sobre fundo
 * transparente — por isso cada destino recebe um tratamento diferente de fundo
 * e de zona segura, descrito em `ICONES`.
 */
import { readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import sharp from 'sharp'

const RAIZ = join(dirname(fileURLToPath(import.meta.url)), '..')
const DESTINO = join(RAIZ, 'public')
const ORIGEM = join(DESTINO, 'sos-logo.png')

/**
 * Fundo dos ícones que não podem ser transparentes. Branco, e não o azul da
 * marca: o disco central do brasão é azul e sumiria contra ele — o anel laranja
 * é o que dá a silhueta reconhecível, e ele só se destaca sobre claro.
 */
const FUNDO_OPACO = { r: 255, g: 255, b: 255, alpha: 1 }
const TRANSPARENTE = { r: 0, g: 0, b: 0, alpha: 0 }

const ICONES = [
    // `purpose: any` é desenhado como veio, sem máscara do sistema: o brasão
    // ocupa a área inteira e a transparência das quinas é preservada.
    { arquivo: 'icone-192.png', lado: 192, ocupacao: 1, fundo: TRANSPARENTE },
    { arquivo: 'icone-512.png', lado: 512, ocupacao: 1, fundo: TRANSPARENTE },
    // `maskable` é full-bleed: o sistema recorta na forma dele (círculo no
    // Android, squircle no iOS). O conteúdo fica na zona segura central de 80%
    // e o fundo precisa ser opaco, senão o recorte expõe o vazio.
    { arquivo: 'icone-maskable-512.png', lado: 512, ocupacao: 0.8, fundo: FUNDO_OPACO },
    // O iOS compõe o apple-touch-icon sobre preto quando há alfa, e arredonda
    // os cantos por conta própria — daí fundo opaco e margem menor.
    { arquivo: 'apple-touch-icon.png', lado: 180, ocupacao: 0.88, fundo: FUNDO_OPACO }
]

/** Tamanhos embutidos no `favicon.ico` — 16px para a aba, 32px para atalhos. */
const LADOS_FAVICON = [16, 32, 48]

const origem = readFileSync(ORIGEM)

/** Redimensiona a marca e a centraliza num quadrado de `lado`. */
async function renderizar({ lado, ocupacao, fundo }) {
    const interno = Math.round(lado * ocupacao)
    const margem = Math.round((lado - interno) / 2)

    const marca = await sharp(origem)
        .resize(interno, interno, { fit: 'contain', background: TRANSPARENTE })
        .png()
        .toBuffer()

    return sharp({
        create: { width: lado, height: lado, channels: 4, background: fundo }
    })
        .composite([{ input: marca, top: margem, left: margem }])
        .png({ compressionLevel: 9 })
        .toBuffer()
}

/**
 * Monta um `.ico` com PNGs embutidos (formato aceito por todos os navegadores
 * atuais). Escrito à mão porque um `.ico` é só um cabeçalho de 6 bytes, uma
 * entrada de diretório de 16 bytes por imagem e os PNGs concatenados — trazer
 * uma dependência só para isso não se paga.
 */
function montarIco(imagens) {
    const cabecalho = Buffer.alloc(6)
    cabecalho.writeUInt16LE(0, 0) // reservado
    cabecalho.writeUInt16LE(1, 2) // tipo: ícone
    cabecalho.writeUInt16LE(imagens.length, 4)

    let deslocamento = 6 + imagens.length * 16
    const entradas = imagens.map(({ lado, png }) => {
        const entrada = Buffer.alloc(16)
        // 0 no campo de dimensão significa 256 — nenhum lado aqui chega lá, mas
        // o `% 256` deixa a regra explícita em vez de implícita no truncamento.
        entrada[0] = lado % 256
        entrada[1] = lado % 256
        entrada[2] = 0 // cores da paleta (0 = sem paleta)
        entrada[3] = 0 // reservado
        entrada.writeUInt16LE(1, 4) // planos de cor
        entrada.writeUInt16LE(32, 6) // bits por pixel
        entrada.writeUInt32LE(png.length, 8)
        entrada.writeUInt32LE(deslocamento, 12)
        deslocamento += png.length
        return entrada
    })

    return Buffer.concat([cabecalho, ...entradas, ...imagens.map(({ png }) => png)])
}

for (const { arquivo, ...opcoes } of ICONES) {
    const png = await renderizar(opcoes)
    writeFileSync(join(DESTINO, arquivo), png)
    console.log(`✓ ${arquivo} (${opcoes.lado}x${opcoes.lado}) — ${png.length} bytes`)
}

const imagensFavicon = await Promise.all(
    LADOS_FAVICON.map(async (lado) => ({
        lado,
        png: await renderizar({ lado, ocupacao: 1, fundo: TRANSPARENTE })
    }))
)
const ico = montarIco(imagensFavicon)
writeFileSync(join(RAIZ, 'app', 'favicon.ico'), ico)
console.log(`✓ app/favicon.ico (${LADOS_FAVICON.join(', ')}) — ${ico.length} bytes`)
