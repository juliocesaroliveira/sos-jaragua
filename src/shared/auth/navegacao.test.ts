import { readdirSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { GRUPOS, NAVEGACAO, atalhosDeNavegacao, gruposVisiveis, itemAtivo, itensDeNavegacao } from './navegacao'
import { ROLES, type Role } from './roles'
import { rolesExigidas } from './rotas'

/**
 * Invariantes do registro de navegação
 * (specs/002-role-based-app-shell/contracts/navegacao.md).
 *
 * Estes testes são a trava que impede menu e autorização de divergirem — o
 * modo de falha mais caro da feature, porque é silencioso: um item some do
 * menu de quem tinha direito a ele, ou aparece para quem não tem e leva a uma
 * negativa de acesso.
 */

const RAIZ = join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..')

/** Comparação de conjuntos — a ordem de declaração das roles não importa. */
function mesmoConjunto(a: readonly string[], b: readonly string[]) {
    return [...a].sort().join('|') === [...b].sort().join('|')
}

describe('INV-01 — consistência com a autorização de rota', () => {
    it('roles do item são idênticas às da regra de rota, quando há regra', () => {
        for (const item of NAVEGACAO) {
            const exigidas = rolesExigidas(item.href)
            if (!exigidas) continue

            // Igualdade, não subconjunto: subconjunto esconderia um destino de
            // quem tem direito a ele (FR-013), e passaria despercebido.
            expect(mesmoConjunto(item.roles, exigidas), `${item.href}: [${item.roles}] vs regra [${exigidas}]`).toBe(
                true
            )
        }
    })

    it('todo item é acessível a todas as roles para as quais é exibido', () => {
        for (const item of NAVEGACAO) {
            for (const role of item.roles) {
                const exigidas = rolesExigidas(item.href)
                if (exigidas) expect(exigidas, `${item.href} para ${role}`).toContain(role)
            }
        }
    })
})

describe('INV-02 — declaração explícita e não-vazia', () => {
    it('todo item declara ao menos uma role', () => {
        for (const item of NAVEGACAO) {
            expect(item.roles.length, item.href).toBeGreaterThan(0)
        }
    })

    it('só declara roles conhecidas', () => {
        for (const item of NAVEGACAO) {
            for (const role of item.roles) {
                expect(ROLES, item.href).toContain(role)
            }
        }
    })
})

describe('INV-03 — todo destino existe', () => {
    /** Caminhos públicos de todo `page.tsx` sob `app/`, sem os route groups. */
    function rotasExistentes(): Set<string> {
        const encontradas = new Set<string>()

        function varrer(diretorio: string, rota: string) {
            for (const entrada of readdirSync(diretorio, { withFileTypes: true })) {
                if (entrada.isDirectory()) {
                    // Route groups `(x)` e pastas privadas `_x` não entram na URL.
                    const ehGrupo = entrada.name.startsWith('(') && entrada.name.endsWith(')')
                    const ehPrivada = entrada.name.startsWith('_')
                    if (ehPrivada) continue
                    varrer(join(diretorio, entrada.name), ehGrupo ? rota : `${rota}/${entrada.name}`)
                } else if (entrada.name === 'page.tsx') {
                    encontradas.add(rota === '' ? '/' : rota)
                }
            }
        }

        varrer(join(RAIZ, 'app'), '')
        return encontradas
    }

    it('todo href do registro corresponde a uma página existente', () => {
        const existentes = rotasExistentes()
        for (const item of NAVEGACAO) {
            expect(existentes, `${item.href} não tem page.tsx correspondente`).toContain(item.href)
        }
    })

    it('a varredura enxerga rotas conhecidas (sanidade do próprio teste)', () => {
        const existentes = rotasExistentes()
        expect(existentes).toContain('/dashboard')
        expect(existentes).toContain('/voluntariado/candidatura')
        expect(existentes).toContain('/estoque/kits')
    })
})

describe('INV-04 — matriz de visibilidade por perfil', () => {
    /** Fonte: specs/002-role-based-app-shell/data-model.md. */
    const MATRIZ: Record<Role, string[]> = {
        usuario: ['/', '/voluntariado/candidatura'],
        voluntario: ['/', '/voluntariado/candidatura', '/voluntariado/minhas-atividades'],
        membro_defesa_civil: [
            '/',
            '/dashboard',
            '/cadastros-pendentes',
            '/voluntarios',
            '/atividades',
            '/crise',
            '/estoque',
            '/estoque/entrada',
            '/estoque/saida',
            '/relatorios',
            '/voluntariado/minhas-atividades'
        ],
        coordenador: [
            '/',
            '/dashboard',
            '/cadastros-pendentes',
            '/voluntarios',
            '/atividades',
            '/estoque',
            '/estoque/entrada',
            '/estoque/saida',
            '/estoque/kits',
            '/estoque/descarte',
            '/convocacao',
            '/voluntariado/minhas-atividades'
        ],
        administrador: [
            '/',
            '/dashboard',
            '/cadastros-pendentes',
            '/voluntarios',
            '/atividades',
            '/crise',
            '/estoque',
            '/estoque/entrada',
            '/estoque/saida',
            '/estoque/kits',
            '/estoque/descarte',
            '/convocacao',
            '/relatorios',
            '/voluntariado/minhas-atividades'
        ]
    }

    for (const role of ROLES) {
        it(`${role} vê exatamente os destinos da matriz`, () => {
            const hrefs = itensDeNavegacao(role).map((i) => i.href)
            expect([...hrefs].sort()).toEqual([...MATRIZ[role]].sort())
        })
    }

    it('nenhum perfil vê um destino de gestão sem ser staff', () => {
        for (const role of ['usuario', 'voluntario'] as const) {
            const hrefs = itensDeNavegacao(role).map((i) => i.href)
            for (const proibido of ['/dashboard', '/estoque', '/relatorios', '/convocacao', '/cadastros-pendentes']) {
                expect(hrefs, `${role} não pode ver ${proibido}`).not.toContain(proibido)
            }
        }
    })

    it('coordenação não é exibida a membro_defesa_civil', () => {
        const hrefs = itensDeNavegacao('membro_defesa_civil').map((i) => i.href)
        for (const proibido of ['/estoque/kits', '/estoque/descarte', '/convocacao']) {
            expect(hrefs).not.toContain(proibido)
        }
    })

    it('relatórios e variáveis da crise pertencem à Defesa Civil, não à coordenação', () => {
        for (const destino of ['/relatorios', '/crise']) {
            expect(itensDeNavegacao('membro_defesa_civil').map((i) => i.href), destino).toContain(destino)
            expect(itensDeNavegacao('administrador').map((i) => i.href), destino).toContain(destino)
            expect(itensDeNavegacao('coordenador').map((i) => i.href), destino).not.toContain(destino)
        }
    })
})

describe('atalhos — cards de acesso rápido da home', () => {
    it('todo atalho é um destino visível ao perfil (nunca um card inacessível)', () => {
        for (const role of ROLES) {
            const visiveis = itensDeNavegacao(role).map((i) => i.href)
            for (const atalho of atalhosDeNavegacao(role)) {
                expect(visiveis, `${role} → ${atalho.href}`).toContain(atalho.href)
            }
        }
    })

    it('todo atalho tem descrição preenchida', () => {
        for (const role of ROLES) {
            for (const atalho of atalhosDeNavegacao(role)) {
                expect(atalho.atalho.descricao.trim(), atalho.href).not.toBe('')
            }
        }
    })

    /** Fonte: specs/002-role-based-app-shell/data-model.md. */
    const ATALHOS: Record<Role, string[]> = {
        usuario: ['/voluntariado/candidatura'],
        voluntario: ['/voluntariado/candidatura', '/voluntariado/minhas-atividades'],
        membro_defesa_civil: [
            '/voluntariado/minhas-atividades',
            '/dashboard',
            '/cadastros-pendentes',
            '/crise',
            '/relatorios',
            '/estoque/entrada',
            '/estoque/saida'
        ],
        coordenador: [
            '/voluntariado/minhas-atividades',
            '/dashboard',
            '/cadastros-pendentes',
            '/estoque/entrada',
            '/estoque/saida',
            '/convocacao'
        ],
        administrador: [
            '/voluntariado/minhas-atividades',
            '/dashboard',
            '/cadastros-pendentes',
            '/crise',
            '/relatorios',
            '/estoque/entrada',
            '/estoque/saida',
            '/convocacao'
        ]
    }

    for (const role of ROLES) {
        it(`${role} recebe exatamente os cards esperados`, () => {
            const hrefs = atalhosDeNavegacao(role).map((i) => i.href)
            expect([...hrefs].sort()).toEqual([...ATALHOS[role]].sort())
        })
    }

    it('nenhum perfil recebe card de destino restrito a outro perfil', () => {
        const naoStaff = ['usuario', 'voluntario'] as const
        for (const role of naoStaff) {
            const hrefs = atalhosDeNavegacao(role).map((i) => i.href)
            for (const proibido of ['/dashboard', '/cadastros-pendentes', '/relatorios', '/convocacao']) {
                expect(hrefs, `${role} não pode ter card de ${proibido}`).not.toContain(proibido)
            }
        }
        // `/relatorios` e `/crise` pertencem à Defesa Civil — coordenação não os alcança.
        const doCoordenador = atalhosDeNavegacao('coordenador').map((i) => i.href)
        expect(doCoordenador).not.toContain('/relatorios')
        expect(doCoordenador).not.toContain('/crise')
    })

    it('a home não vira card de si mesma', () => {
        for (const role of ROLES) {
            expect(atalhosDeNavegacao(role).map((i) => i.href), role).not.toContain('/')
        }
    })
})

describe('INV-05 — href único', () => {
    it('nenhum destino aparece duas vezes', () => {
        const hrefs = NAVEGACAO.map((i) => i.href)
        expect(new Set(hrefs).size).toBe(hrefs.length)
    })
})

describe('INV-06 — rótulos preenchidos', () => {
    it('todo item tem rótulo e ícone não vazios', () => {
        for (const item of NAVEGACAO) {
            expect(item.rotulo.trim(), item.href).not.toBe('')
            expect(item.icone.trim(), item.href).not.toBe('')
        }
    })

    it('todo grupo tem rótulo não vazio', () => {
        for (const grupo of Object.values(GRUPOS)) {
            expect(grupo.rotulo.trim(), grupo.id).not.toBe('')
        }
    })

    it('todo grupo referenciado por um item existe', () => {
        for (const item of NAVEGACAO) {
            expect(GRUPOS[item.grupo], `${item.href} → ${item.grupo}`).toBeDefined()
        }
    })
})

describe('itemAtivo — correspondência (G-08, G-09)', () => {
    const itens = itensDeNavegacao('coordenador')

    it('casa por igualdade exata', () => {
        expect(itemAtivo('/dashboard', itens)?.href).toBe('/dashboard')
    })

    it('casa por prefixo de segmento', () => {
        expect(itemAtivo('/atividades/abc-123', itens)?.href).toBe('/atividades')
    })

    it('não casa prefixo parcial de palavra', () => {
        expect(itemAtivo('/estoquex', itens)).toBeUndefined()
    })

    it('desempata pelo href mais longo — o defeito do shell anterior', () => {
        // `/estoque` e `/estoque/kits` casam ambos; só o mais específico vence.
        expect(itemAtivo('/estoque/kits', itens)?.href).toBe('/estoque/kits')
        expect(itemAtivo('/estoque/descarte', itens)?.href).toBe('/estoque/descarte')
        expect(itemAtivo('/estoque', itens)?.href).toBe('/estoque')
    })

    it('retorna undefined quando nada corresponde', () => {
        expect(itemAtivo('/sem-permissao', itens)).toBeUndefined()
    })
})

describe('gruposVisiveis — agrupamento (G-05, G-06, G-07)', () => {
    it('nenhuma seção vem vazia (FR-026)', () => {
        for (const role of ROLES) {
            for (const secao of gruposVisiveis(itensDeNavegacao(role))) {
                expect(secao.itens.length, `${role} → ${secao.grupo.id}`).toBeGreaterThan(0)
            }
        }
    })

    it('seções vêm ordenadas por GrupoNavegacao.ordem', () => {
        for (const role of ROLES) {
            const ordens = gruposVisiveis(itensDeNavegacao(role)).map((s) => s.grupo.ordem)
            expect(ordens, role).toEqual([...ordens].sort((a, b) => a - b))
        }
    })

    it('não perde nem duplica itens', () => {
        for (const role of ROLES) {
            const itens = itensDeNavegacao(role)
            const agrupados = gruposVisiveis(itens).flatMap((s) => s.itens)
            expect(agrupados.length, role).toBe(itens.length)
            expect([...agrupados].sort()).toEqual([...itens].sort())
        }
    })

    it('membro_defesa_civil não recebe as seções Coordenação nem Administração', () => {
        const ids = gruposVisiveis(itensDeNavegacao('membro_defesa_civil')).map((s) => s.grupo.id)
        expect(ids).not.toContain('coordenacao')
        expect(ids).not.toContain('administracao')
    })

    it('coordenador recebe a seção Coordenação, mas não Administração (research.md D4)', () => {
        const ids = gruposVisiveis(itensDeNavegacao('coordenador')).map((s) => s.grupo.id)
        expect(ids).toContain('coordenacao')
        expect(ids).not.toContain('administracao')
    })

    it('nenhum perfil produz a seção Administração enquanto a área não existir', () => {
        for (const role of ROLES) {
            const ids = gruposVisiveis(itensDeNavegacao(role)).map((s) => s.grupo.id)
            expect(ids, role).not.toContain('administracao')
        }
    })

    it('lista vazia produz nenhuma seção', () => {
        expect(gruposVisiveis([])).toEqual([])
    })
})

describe('itensDeNavegacao — garantias gerais', () => {
    it('preserva a ordem de declaração do registro (G-02)', () => {
        const itens = itensDeNavegacao('administrador')
        const posicoes = itens.map((i) => NAVEGACAO.indexOf(i))
        expect(posicoes).toEqual([...posicoes].sort((a, b) => a - b))
    })

    it('é pura — mesma role, mesmo resultado (G-04)', () => {
        expect(itensDeNavegacao('coordenador')).toEqual(itensDeNavegacao('coordenador'))
    })
})
