# Build no GitHub Actions (corrige o "heap out of memory" no DOM Cloud)

## O problema

Depois que o DOM Cloud passou a limitar a memória dos comandos de deploy, o
passo `pnpm build` começou a falhar com:

```
FATAL ERROR: NewSpace::EnsureCurrentCapacity Allocation failed -
JavaScript heap out of memory
ELIFECYCLE  Command failed with exit code 134.
```

### Causa (medida neste projeto)

| Onde | Memória disponível p/ o build | Resultado |
|------|-------------------------------|-----------|
| DOM Cloud (runner) | ~160 MB (heap do Node) | ❌ estoura |
| `vite build` precisa de | ~300–400 MB | — |

- Reproduzimos: `--max-old-space-size=160` → **OOM** (igual ao DOM Cloud);
  `--max-old-space-size=384` → **build OK**.
- **Não é só o `exceljs`.** A troca recente do `xlsx` pelo `exceljs` adicionou um
  chunk de ~940 KB ao frontend e piorou o quadro, mas mesmo **removendo o
  `exceljs`** o build ainda estoura em 160 MB. Ou seja: o problema é o teto de
  memória do DOM Cloud, não um pacote específico.

Conclusão: o build **não cabe** mais no DOM Cloud. A solução é compilar fora
dele — no GitHub Actions, que tem memória de sobra — e mandar para o DOM Cloud
apenas o resultado já compilado.

---

## Como funciona a solução

```
push na main ─► GitHub Actions (.github/workflows/deploy.yml)
                  │  pnpm install + pnpm build   (vite + esbuild)
                  └─► força o dist/ compilado na branch "build"
                                                   │
                            (você aguarda ficar verde)
                                                   ▼
DOM Cloud (Redeploy) ─► git pull main + pnpm install (só runtime)
                        └─► baixa o dist/ da branch "build"  (sem pnpm build)
                            └─► migrate + seed + restart
```

- `dist/index.js` → bundle do servidor (Express/tRPC), rodado pelo Passenger.
- `dist/public/` → frontend (React/Vite) servido como estático pelo próprio
  servidor em produção.
- O DOM Cloud continua rodando `pnpm install` porque o bundle do servidor usa
  `--packages=external` (as dependências de runtime ficam em `node_modules`).

---

## O que já está no repositório

1. **`.github/workflows/deploy.yml`** — builda a cada push na `main` (ou via
   *Run workflow*) e publica o `dist/` na branch `build`.
2. **`.domcloud.yml.example`** — já **sem** `pnpm build`; em vez disso baixa o
   `dist/` da branch `build` e valida que ele existe.

---

## Passo a passo (uma vez)

1. **Faça o merge desta branch na `main`.** No primeiro push para a `main`, o
   GitHub Actions vai rodar e criar a branch `build` com o `dist/` compilado.
   - Acompanhe em **GitHub → aba Actions → "Build and Deploy"**.

2. **Atualize a configuração de deploy no painel do DOM Cloud**
   (**Manage → Deployment**) com o conteúdo do novo `.domcloud.yml.example`,
   substituindo os valores reais do banco, `JWT_SECRET`, `ADMIN_PASSWORD`, etc.
   (as chaves de S3/R2 e `API_PLACAS_TOKEN`, se usar).

3. **Deploy**: depois que o workflow do GitHub ficar **verde**, clique em
   **Redeploy** no DOM Cloud.

## No dia a dia

1. `git push` na `main`.
2. Espere o **"Build and Deploy"** ficar verde no GitHub Actions (~1–2 min).
3. **Redeploy** no DOM Cloud.

> Se você clicar em Redeploy **antes** do build terminar, o deploy mostra um
> `AVISO: dist/ foi gerado em <sha>, mas a main está em <sha>` e publica a
> versão anterior. É só refazer o Redeploy quando o Actions terminar.

---

## Alternativa: deploy 100% automático (sem esperar)

Se preferir que o deploy dispare sozinho **após** o build, aponte o DOM Cloud
para a branch **`build`** em vez da `main` (em **Manage → Deployment → Branch**)
e troque, no `.domcloud.yml`, o `git pull origin main --ff-only` por
`git fetch origin build && git reset --hard origin/build`. Assim o DOM Cloud só
dispara quando o GitHub Actions empurra a branch `build` (já compilada),
eliminando a janela de corrida.

---

## (Opcional) Deixar o frontend mais leve

O `exceljs` é importado no cliente (`client/src/lib/export.ts`) e vira um chunk
de ~940 KB (271 KB gzip). Funciona (é carregado sob demanda via `import()` só
quando o usuário exporta), mas, se quiser reduzir o bundle e acelerar o build,
dá para gerar o `.xlsx` no **servidor** (o `exceljs` já é dependência do back e
não entra no bundle por causa do `--packages=external`) e expor um endpoint de
download. Não é necessário para resolver o deploy — é só otimização.
