# Linha de base — tela de login antes do redesign

**Feature**: `014-redesign-tela-login` | **Tarefa**: T001 | **Data**: 2026-08-16

Referência de comparação para a **SC-006a**: em conexão móvel de 3G, o total transferido para
exibir a tela operável precisa permanecer **abaixo** do que a versão anterior transferia. Este
número deixa de ser obtível assim que o redesign entra — daí ser a primeira tarefa da feature.

**Commit de referência**: estado da árvore em `feat/design-improvements` antes do T003.

## Medição por artefato de build

Obtida com `npx next build` seguido da soma dos artefatos em `.next/static`.

| Métrica | Valor |
| --- | --- |
| JS + CSS estático total (33 arquivos) | **1690,0 KB** brutos |
| Só CSS | 62,1 KB |
| `public/sos-logo.png` (fonte da marca) | 64,6 KB |

**Reproduzir**:

```bash
npx next build
node -e "
const fs=require('fs'),path=require('path');
function walk(d){let o=[];for(const e of fs.readdirSync(d,{withFileTypes:true})){const p=path.join(d,e.name);if(e.isDirectory())o=o.concat(walk(p));else o.push(p);}return o;}
const f=walk('.next/static').filter(x=>x.endsWith('.js')||x.endsWith('.css'));
console.log((f.reduce((a,x)=>a+fs.statSync(x).size,0)/1024).toFixed(1),'KB em',f.length,'arquivos');
"
```

## Limitação desta medição — leia antes de comparar

**Next.js 16 deixou de imprimir tamanhos por rota** no relatório de build, e o
`app-build-manifest.json` que permitiria atribuir chunks a `/login` não é mais gerado pelo
Turbopack. O número acima é o **total estático da aplicação**, não o payload da rota de login.

Serve como sinal de regressão grosseiro: se o total subir muito, algo pesado entrou. **Não
serve** para afirmar que a SC-006a passou.

## O que ainda precisa ser medido no navegador

A SC-006a é sobre bytes transferidos e tempo até operável em 3G — grandezas de rede, não de
disco. Precisam de DevTools e não podem ser derivadas do build:

| Medir | Como | Onde fecha |
| --- | --- | --- |
| Bytes transferidos até a tela ficar operável, em 360px | DevTools → Network, "Slow 3G", recarga sem cache; somar até o primeiro paint utilizável | quickstart 2.6 |
| Idem, em 1280px | Mesmo procedimento | quickstart 2.6 |
| Tempo até operável em "Slow 3G" | DevTools → Performance | quickstart 2.2 |

**Procedimento para a comparação depois do redesign**: `git stash` das mudanças, medir a versão
anterior no navegador, `git stash pop`, medir a nova. É o único caminho honesto, porque as duas
medições precisam sair do mesmo aparelho, mesma rede emulada e mesmo estado de cache.

Registro aqui em vez de fingir que o número de disco resolve: a SC-006a existe porque o
redesign não pode tornar o login mais lento em campo, e conferir isso exige medir rede.
