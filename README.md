# Sistema de Gerenciamento de Pátio de Veículos Apreendidos

Sistema completo para controle de veículos apreendidos em pátio policial, com suporte a:
- CRUD de veículos com duas placas (original e ostentada)
- Controle de perícia e devolução
- Consulta automática de dados pela placa (API Placas)
- Dashboard com estatísticas
- Exportação para CSV e Excel
- Autenticação com usuário e senha

## Stack Tecnológica

- **Frontend**: React 19, Vite, TailwindCSS, shadcn/ui
- **Backend**: Node.js, Express, tRPC
- **Banco de Dados**: MySQL com Drizzle ORM
- **Autenticação**: JWT com usuário e senha

---

## Configuração Local

### Pré-requisitos

- Node.js 20+
- npm ou pnpm
- MySQL 8+

### Instalação

```bash
# Clone o repositório
git clone https://github.com/seu-usuario/patio-veiculos.git
cd patio-veiculos

# Instale as dependências
npm install

# Copie o arquivo de exemplo de variáveis de ambiente
cp .env.example .env

# Configure as variáveis no arquivo .env
```

### Variáveis de Ambiente

Edite o arquivo `.env` com suas configurações:

```env
# Obrigatórias
DATABASE_URL=mysql://root:senha@localhost:3306/patio_veiculos
JWT_SECRET=sua-chave-secreta-de-32-caracteres

# Opcional - Consulta de placas
API_PLACAS_TOKEN=seu-token-da-api-placas
```

### Usuário Padrão

Na primeira execução, o sistema cria automaticamente um usuário administrador se as variáveis de ambiente estiverem configuradas:
- **ADMIN_USER**: Nome do usuário admin (padrão: `admin`)
- **ADMIN_PASSWORD**: Senha do admin (obrigatório)

### Executando

```bash
# Criar tabelas no banco
npm run db:push

# Modo desenvolvimento
npm run dev

# Rodar testes
npm test

# Build de produção
npm run build

# Iniciar produção
npm start
```

---

## Deploy no Render

O Render é uma plataforma cloud fácil de usar com tier gratuito.

### Passo 1: Criar Banco de Dados MySQL

1. Acesse [Render Dashboard](https://dashboard.render.com/)
2. Para MySQL, use [PlanetScale](https://planetscale.com/) (gratuito) ou [Railway MySQL](https://railway.app/)
3. Copie a connection string do banco

### Passo 2: Deploy via Blueprint (Recomendado)

1. Fork este repositório para sua conta GitHub
2. No Render Dashboard, clique em **New +** → **Blueprint**
3. Conecte seu repositório
4. O Render detectará automaticamente o `render.yaml`
5. Configure as variáveis de ambiente:

| Variável | Valor |
|----------|-------|
| `DATABASE_URL` | URL de conexão do MySQL |
| `JWT_SECRET` | Chave secreta para JWT (gerada automaticamente) |
| `API_PLACAS_TOKEN` | Token da API Placas (opcional) |

6. Clique em **Create Blueprint**

### Passo 2 (Alternativo): Deploy Manual

1. No Render Dashboard, clique em **New +** → **Web Service**
2. Conecte seu repositório GitHub
3. Configure:
   - **Name**: patio-veiculos
   - **Runtime**: Node
   - **Build Command**: `pnpm install && pnpm run build`
   - **Start Command**: `pnpm run start`
   - **Plan**: Free
4. Adicione as variáveis de ambiente (mesmas do Blueprint)
5. Clique em **Create Web Service**

### Passo 3: Executar Migrations

Após o deploy, você precisa rodar as migrations do banco:

```bash
# Via Render Shell ou localmente com DATABASE_URL de produção
pnpm run db:push
```

### Health Check

O sistema expõe um endpoint `/health` para monitoramento. O Render usa automaticamente.

---

## Deploy no Railway

Railway é uma plataforma moderna com experiência de desenvolvedor excelente.

### Passo 1: Criar Projeto

1. Acesse [Railway](https://railway.app/)
2. Clique em **Start a New Project**
3. Selecione **Deploy from GitHub repo**
4. Conecte seu repositório

### Passo 2: Adicionar MySQL

1. No projeto, clique em **+ New**
2. Selecione **Database** → **Add MySQL**
3. Railway criará automaticamente as variáveis `MYSQL_*`
4. Copie a variável `DATABASE_URL` (ou `MYSQL_URL`)

### Passo 3: Configurar Variáveis

1. Clique no serviço do seu app
2. Vá para **Variables**
3. Adicione:

```
NODE_ENV=production
DATABASE_URL=${{MySQL.DATABASE_URL}}
JWT_SECRET=sua-chave-secreta
API_PLACAS_TOKEN=seu-token (opcional)
```

> **Dica**: Use `${{MySQL.DATABASE_URL}}` para referenciar automaticamente a URL do MySQL do Railway.

### Passo 4: Configurar Build

Railway detecta automaticamente o `railway.json`. Se necessário, configure manualmente:

1. Vá para **Settings** → **Build**
2. **Build Command**: `pnpm install && pnpm run build`
3. **Start Command**: `pnpm run start`

### Passo 5: Domínio

1. Em **Settings** → **Networking**
2. Clique em **Generate Domain** para um domínio `.railway.app`
3. Ou adicione seu domínio customizado

### Passo 6: Executar Migrations

Use o Railway CLI ou o Shell integrado:

```bash
# Instalar CLI
npm install -g @railway/cli

# Login
railway login

# Vincular projeto
railway link

# Rodar migrations
railway run pnpm run db:push
```

---

## Deploy com Docker

### Build da Imagem

```bash
# Build
docker build -t patio-veiculos .

# Run
docker run -p 3000:3000 \
  -e DATABASE_URL="mysql://..." \
  -e JWT_SECRET="..." \
  patio-veiculos
```

### Docker Compose

Crie um `docker-compose.yml`:

```yaml
version: '3.8'

services:
  app:
    build: .
    ports:
      - "3000:3000"
    environment:
      - NODE_ENV=production
      - DATABASE_URL=mysql://root:senha@db:3306/patio
      - JWT_SECRET=sua-chave-secreta
    depends_on:
      - db

  db:
    image: mysql:8
    environment:
      - MYSQL_ROOT_PASSWORD=senha
      - MYSQL_DATABASE=patio
    volumes:
      - mysql_data:/var/lib/mysql
    ports:
      - "3306:3306"

volumes:
  mysql_data:
```

```bash
docker-compose up -d
```

---

## Estrutura do Projeto

```
patio-veiculos/
├── client/                 # Frontend React
│   ├── src/
│   │   ├── components/     # Componentes UI
│   │   ├── pages/          # Páginas
│   │   ├── hooks/          # Hooks customizados
│   │   ├── lib/            # Utilitários
│   │   └── contexts/       # Contextos React
│   └── public/             # Assets estáticos
├── server/                 # Backend Node.js
│   ├── _core/              # Core do servidor
│   ├── routers.ts          # Rotas tRPC
│   ├── db.ts               # Operações BD
│   └── plateService.ts     # API de placas
├── shared/                 # Código compartilhado
├── drizzle/                # Schema do banco
├── Dockerfile              # Container Docker
├── render.yaml             # Config Render
├── railway.json            # Config Railway
└── .env.example            # Variáveis de exemplo
```

---

## API Endpoints

### tRPC (via `/api/trpc`)

| Endpoint | Tipo | Descrição |
|----------|------|-----------|
| `auth.me` | Query | Retorna usuário autenticado |
| `auth.login` | Mutation | Faz login com usuário e senha |
| `auth.logout` | Mutation | Faz logout |
| `vehicles.list` | Query | Lista veículos com filtros |
| `vehicles.create` | Mutation | Cria veículo |
| `vehicles.update` | Mutation | Atualiza veículo |
| `vehicles.delete` | Mutation | Remove veículo |
| `vehicles.stats` | Query | Estatísticas |
| `vehicles.export` | Query | Exportar dados |
| `vehicles.searchPlate` | Query | Consulta placa |
| `vehicles.markAsReturned` | Mutation | Marca como devolvido |

### REST

| Endpoint | Método | Descrição |
|----------|--------|-----------|
| `/health` | GET | Health check |
| `/api/auth/login` | POST | Login com usuário e senha |

---

## Troubleshooting

### Erro de conexão com banco

- Verifique se `DATABASE_URL` está correta
- Confirme que o IP do servidor está liberado no firewall do banco
- Para PlanetScale, use `?ssl={"rejectUnauthorized":true}` na URL

### Build falha no Render/Railway

- Verifique se `pnpm-lock.yaml` está no repositório
- Confirme que Node.js 20+ está sendo usado

### Consulta de placas não funciona

- Verifique se `API_PLACAS_TOKEN` está configurado
- Confirme que o token tem créditos disponíveis

---

## Licença

MIT

---

## Suporte

Para reportar bugs ou sugerir melhorias, abra uma issue no GitHub.
