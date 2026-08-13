/**
 * Gera os ícones PNG do PWA em `public/`.
 *
 * Executar com: `node scripts/gerar-icones-pwa.mjs`
 *
 * Existe para que os ícones sejam **reproduzíveis**: mudar a cor da marca ou a
 * forma é editar este arquivo e rodar de novo, em vez de recriar binários à mão
 * em um editor externo e commitá-los sem origem conhecida.
 *
 * Sem dependências: escreve o PNG na unha (IHDR/IDAT/IEND + CRC32) sobre o
 * `zlib` do Node. Um encoder completo seria exagero — as formas aqui são um
 * retângulo arredondado e um triângulo de alerta, ambos resolvidos por teste de
 * pertencimento por pixel.
 */
import { deflateSync } from 'node:zlib'
import { writeFileSync, mkdirSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const RAIZ = join(dirname(fileURLToPath(import.meta.url)), '..')
const DESTINO = join(RAIZ, 'public')

/** Laranja da marca (`--color-primary-600`, Tailwind orange-600). */
const MARCA = [234, 88, 12]
const BRANCO = [255, 255, 255]

/** Supersampling: 3x em cada eixo, média — suficiente para bordas suaves. */
const AMOSTRAS = 3

// -- Geometria ---------------------------------------------------------------

function dentroDoRetanguloArredondado(x, y, lado, raio) {
    const dx = Math.min(x, lado - x)
    const dy = Math.min(y, lado - y)
    if (dx >= raio || dy >= raio) return x >= 0 && x <= lado && y >= 0 && y <= lado
    return (raio - dx) ** 2 + (raio - dy) ** 2 <= raio ** 2
}

/** Triângulo isósceles apontando para cima, com cantos levemente recuados. */
function dentroDoTriangulo(x, y, cx, cy, tamanho) {
    const meia = tamanho / 2
    const topo = cy - tamanho * 0.46
    const base = cy + tamanho * 0.4
    if (y < topo || y > base) return false
    const progresso = (y - topo) / (base - topo)
    const meiaLargura = meia * progresso
    return Math.abs(x - cx) <= meiaLargura
}

/** Barra + ponto da exclamação, recortados do triângulo. */
function dentroDaExclamacao(x, y, cx, cy, tamanho) {
    const largura = tamanho * 0.075
    const barraTopo = cy - tamanho * 0.12
    const barraBase = cy + tamanho * 0.12
    naBarra: {
        if (y < barraTopo || y > barraBase) break naBarra
        if (Math.abs(x - cx) <= largura) return true
    }
    const pontoY = cy + tamanho * 0.245
    return (x - cx) ** 2 + (y - pontoY) ** 2 <= (largura * 1.15) ** 2
}

/**
 * `maskable` preenche a tela inteira: a máscara do sistema recorta as bordas,
 * então o conteúdo fica na zona segura central (80%) e não pode ter cantos
 * arredondados próprios — seriam cortados duas vezes.
 */
function pintar(lado, { maskable }) {
    const pixels = Buffer.alloc(lado * lado * 4)
    const raio = lado * 0.22
    const cx = lado / 2
    const cy = lado / 2
    const tamanhoTriangulo = maskable ? lado * 0.5 : lado * 0.62

    for (let y = 0; y < lado; y++) {
        for (let x = 0; x < lado; x++) {
            let r = 0
            let g = 0
            let b = 0
            let a = 0

            for (let sy = 0; sy < AMOSTRAS; sy++) {
                for (let sx = 0; sx < AMOSTRAS; sx++) {
                    const px = x + (sx + 0.5) / AMOSTRAS
                    const py = y + (sy + 0.5) / AMOSTRAS

                    const noFundo = maskable ? true : dentroDoRetanguloArredondado(px, py, lado, raio)
                    if (!noFundo) continue

                    const noSimbolo =
                        dentroDoTriangulo(px, py, cx, cy, tamanhoTriangulo) &&
                        !dentroDaExclamacao(px, py, cx, cy, tamanhoTriangulo)

                    const cor = noSimbolo ? BRANCO : MARCA
                    r += cor[0]
                    g += cor[1]
                    b += cor[2]
                    a += 255
                }
            }

            const total = AMOSTRAS * AMOSTRAS
            const i = (y * lado + x) * 4
            // Pré-divisão pelo total de amostras opacas mantém a cor correta na
            // borda; a transparência vem da razão entre amostras dentro e fora.
            const opacas = a / 255
            pixels[i] = opacas ? Math.round(r / opacas) : 0
            pixels[i + 1] = opacas ? Math.round(g / opacas) : 0
            pixels[i + 2] = opacas ? Math.round(b / opacas) : 0
            pixels[i + 3] = Math.round(a / total)
        }
    }

    return pixels
}

// -- Codificação PNG ---------------------------------------------------------

const TABELA_CRC = (() => {
    const t = new Int32Array(256)
    for (let n = 0; n < 256; n++) {
        let c = n
        for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
        t[n] = c
    }
    return t
})()

function crc32(buf) {
    let c = -1
    for (const byte of buf) c = TABELA_CRC[(c ^ byte) & 0xff] ^ (c >>> 8)
    return (c ^ -1) >>> 0
}

function chunk(tipo, dados) {
    const tamanho = Buffer.alloc(4)
    tamanho.writeUInt32BE(dados.length)
    const corpo = Buffer.concat([Buffer.from(tipo, 'ascii'), dados])
    const crc = Buffer.alloc(4)
    crc.writeUInt32BE(crc32(corpo))
    return Buffer.concat([tamanho, corpo, crc])
}

function codificarPng(lado, pixels) {
    const assinatura = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])

    const ihdr = Buffer.alloc(13)
    ihdr.writeUInt32BE(lado, 0)
    ihdr.writeUInt32BE(lado, 4)
    ihdr[8] = 8 // profundidade
    ihdr[9] = 6 // RGBA
    ihdr[10] = 0
    ihdr[11] = 0
    ihdr[12] = 0

    // Cada scanline é prefixada pelo byte de filtro (0 = nenhum).
    const bruto = Buffer.alloc(lado * (lado * 4 + 1))
    for (let y = 0; y < lado; y++) {
        const destino = y * (lado * 4 + 1)
        bruto[destino] = 0
        pixels.copy(bruto, destino + 1, y * lado * 4, (y + 1) * lado * 4)
    }

    return Buffer.concat([
        assinatura,
        chunk('IHDR', ihdr),
        chunk('IDAT', deflateSync(bruto, { level: 9 })),
        chunk('IEND', Buffer.alloc(0))
    ])
}

// -- Geração -----------------------------------------------------------------

const ICONES = [
    { arquivo: 'icone-192.png', lado: 192, maskable: false },
    { arquivo: 'icone-512.png', lado: 512, maskable: false },
    { arquivo: 'icone-maskable-512.png', lado: 512, maskable: true },
    { arquivo: 'apple-touch-icon.png', lado: 180, maskable: true }
]

mkdirSync(DESTINO, { recursive: true })

for (const { arquivo, lado, maskable } of ICONES) {
    const png = codificarPng(lado, pintar(lado, { maskable }))
    writeFileSync(join(DESTINO, arquivo), png)
    console.log(`✓ ${arquivo} (${lado}x${lado}${maskable ? ', maskable' : ''}) — ${png.length} bytes`)
}
