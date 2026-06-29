# CLAUDE.md

Mapa do projeto para análise eficiente. Mantenha **enxuto** — o objetivo deste
arquivo é evitar exploração repetida (e gasto de tokens) em cada sessão.

## O que é

Sistema de gestão de **pátio de veículos apreendidos**: cadastro de veículos
(suporta placa original + ostentada para casos de clonagem), controle de
**perícia** e **devolução**, e **logs de auditoria** com reversão de ações.

## Stack

- **Front:** React 19, Vite 7, Wouter (rotas), TanStack Query 5, tRPC 11 (client),
  Tailwind 4 + shadcn/ui (Radix), lucide-react, sonner (toasts), date-fns.
- **Back:** Express 4, tRPC 11 (server), Drizzle ORM + MySQL (mysql2), Zod
  (validação), jose (JWT em cookie), helmet, express-rate-limit, cors.
- **Infra:** AWS S3 para fotos de veículos; ExcelJS para exportação; Vitest (testes); pnpm.

## Comandos

```bash
pnpm dev      # dev (tsx watch server/_core/index.ts)
pnpm build    # vite build (client) + esbuild (server -> dist/)
pnpm start    # produção (node dist/index.js)
pnpm check    # typecheck (tsc --noEmit)
pnpm lint     # eslint
pnpm format   # prettier --write
pnpm test     # vitest run
pnpm db:push  # aplica o schema Drizzle no banco
```

## Estrutura

```
client/src/
  main.tsx, App.tsx     # entry + rotas Wouter: / (Home), /dashboard, /logs, * (NotFound)
  pages/                # Dashboard.tsx (orquestrador ~440L), Logs.tsx, Home.tsx, NotFound.tsx
  components/           # componentes da app + ui/ (primitivos shadcn)
  components/dashboard/ # peças do Dashboard: types.ts, DashboardHeader, StatsCards,
                        #   VehicleFilters, VehicleFormDialog, VehicleTable, PhotoViewerDialog,
                        #   ReturnVehicleDialog (marca/desfaz devolução + registra destino)
                        #   (Dashboard.tsx só mantém estado/queries/mutations e compõe estas)
  contexts/             # ThemeContext.tsx
  hooks/                # useComposition, usePersistFn
  lib/                  # trpc.ts (client tRPC), export.ts (Excel), imageUtils.ts, utils.ts
  _core/hooks/useAuth.ts
server/
  routers.ts            # combinador tRPC (fino): auth/vehicles/auditLogs + tipo AppRouter
  routers/              # routers por domínio: auth.ts, vehicles.ts (+schemas Zod), auditLogs.ts (+revert)
  db.ts                 # queries Drizzle + seedDefaultAdmin + withTransaction (~540L)
  plateService.ts       # consulta de placa em API externa
  *.test.ts             # testes Vitest (colocados ao lado do código)
  _core/                # scaffolding do framework — entry e infra:
                        #   index.ts (servidor Express), trpc, context, sdk (auth JWT),
                        #   storage (S3), cookies, env, logger, vite, loginRateLimit
shared/
  const.ts              # constantes compartilhadas (COOKIE_NAME, MAX_BODY_SIZE, ...)
  _core/errors.ts       # erros tipados (ForbiddenError, ...)
drizzle/schema.ts       # tabelas: users, vehicles, audit_logs
scripts/                # migrate-production.mjs, seed-admin.mjs
docs/                   # tutoriais de deploy + notas de APIs de placa
```

**Aliases de import:** `@/*` → `client/src/*` · `@shared/*` → `shared/*`

## Modelo de dados (drizzle/schema.ts)

- **users** — auth (username único, password, role user|admin).
- **vehicles** — núcleo do domínio. Placas `placaOriginal` (UNIQUE) e
  `placaOstentada`; dados do veículo; `tipoProcedimento` (IP|TCO|BOC|BO);
  `statusPericia` (pendente|sem_pericia|feita); `devolvido` (sim|nao) + `dataDevolucao`
  + `destinoDevolucao` (restituido|detran|dra|outros) + `destinoDevolucaoDescricao` (50 chars, p/ "outros");
  `fotos` (JSON, até 2 URLs S3); `createdBy`.
- **audit_logs** — registra ações (criar/editar/excluir veículo, marcar/reverter
  perícia, devolução, login) com `previousData`/`newData` para reversão.

## API tRPC (server/routers.ts)

- **auth:** me, login, logout
- **vehicles:** create, update, delete, getById, list, stats, export,
  markAsReturned, undoReturn, updatePericiaStatus, searchPlate, getUploadUrl, deletePhoto
- **auditLogs:** list, revert

`publicProcedure` vs `protectedProcedure` (sessão via cookie JWT). Inputs validados com Zod.

## Dicas para gastar menos token aqui

- **NÃO leia** `pnpm-lock.yaml` (~200KB), `dist/`, `build/`, `node_modules/` — sem valor de análise.
- O Dashboard foi quebrado em `components/dashboard/` — edite o componente específico
  (filtros, formulário, tabela...) em vez de abrir o `Dashboard.tsx` inteiro.
- Os routers tRPC foram separados por domínio em `server/routers/` — edite
  `auth.ts`, `vehicles.ts` ou `auditLogs.ts` em vez do `routers.ts` (que só combina).
- Escope o pedido ("ajustar o filtro de status no Dashboard") em vez de "analisar tudo".
