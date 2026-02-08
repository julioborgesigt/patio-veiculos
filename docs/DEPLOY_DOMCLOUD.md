# Tutorial: Deploy do Sistema de Pátio de Veículos no DOMcloud.co

Este tutorial ensina como fazer o deploy completo do seu sistema de gerenciamento de pátio de veículos no DOMcloud.co, uma plataforma de hospedagem web acessível com suporte a Node.js e MySQL.

---

## Pré-requisitos

1. **Conta no DOMcloud** - Crie em [domcloud.co](https://domcloud.co)
2. **Conta no GitHub** - Seu código precisa estar em um repositório público
3. **Token da API Placas** (opcional) - Para consulta automática de placas

---

## Planos do DOMcloud

| Plano | Preço | Recursos |
|-------|-------|----------|
| **Lite** | $0.50/mês (~R$ 2,50) | 512MB RAM, 2GB SSD, 1 site |
| **Kit** | $2/mês (~R$ 10) | 1GB RAM, 10GB SSD, 5 sites |
| **Pro** | $10/mês (~R$ 50) | 4GB RAM, 50GB SSD, ilimitado |

**Recomendação**: Plano **Kit** ($2/mês) é suficiente para este projeto.

---

## Passo 1: Criar Conta e Novo Website

1. Acesse [domcloud.co](https://domcloud.co) e faça login
2. No painel, clique em **"Create New Website"**
3. Preencha:
   - **Domain**: Escolha um subdomínio gratuito (ex: `patio-veiculos.domcloud.dev`)
   - **Template**: Selecione **"Node.js"**
   - **Plan**: Escolha o plano (recomendado: Kit - $2/mês)
4. Clique em **"Create"**
5. Aguarde a criação (leva ~1 minuto)

---

## Passo 2: Configurar Repositório GitHub

1. Faça push do seu código para um repositório GitHub público
2. No terminal do DOMcloud, clone o repositório:

```bash
# Limpar diretório padrão
cd ~
rm -rf public_html/*

# Clonar seu repositório
git clone https://github.com/SEU_USUARIO/patio-veiculos.git temp_repo
mv temp_repo/* public_html/
mv temp_repo/.* public_html/ 2>/dev/null || true
rm -rf temp_repo

# Entrar no diretório
cd public_html

# Instalar pnpm globalmente
npm install -g pnpm

# Instalar dependências
pnpm install

# Build do projeto
pnpm build
```

---

## Passo 3: Configurar Banco de Dados MySQL

### Criar banco de dados:

1. No painel do DOMcloud, vá em **"Manage"** → **"Database"**
2. Clique em **"Create Database"**
3. Anote as credenciais:
   - **Database Name**: (ex: `patio_veiculos`)
   - **Username**: (ex: `seu_usuario`)
   - **Password**: (será gerado automaticamente)
   - **Host**: `localhost` ou o host fornecido

### Construir a DATABASE_URL:

Formato:
```
mysql://usuario:senha@host/nome_banco
```

---

## Passo 4: Configurar Variáveis de Ambiente

### Criar arquivo `.env` no servidor:

No terminal do DOMcloud:

```bash
cd ~/public_html

# Criar arquivo .env
cat > .env << 'EOF'
# Banco de Dados
DATABASE_URL=mysql://SEU_USUARIO:SUA_SENHA@localhost/patio_veiculos

# Segurança
JWT_SECRET=GERE_UMA_STRING_ALEATORIA_AQUI_32_CARACTERES

# Node Environment
NODE_ENV=production

# API Placas (opcional)
API_PLACAS_TOKEN=seu-token-da-api-placas

# Porta
PORT=3000
EOF

# Editar o arquivo para adicionar valores reais
nano .env
```

### Gerar JWT_SECRET:

Execute no terminal:
```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

Copie o resultado e cole no arquivo `.env` no campo `JWT_SECRET`.

---

## Passo 5: Executar Migrações do Banco

No terminal do DOMcloud:

```bash
cd ~/public_html

# Executar migrações
pnpm db:push
```

Aguarde a confirmação de que as tabelas foram criadas.

---

## Passo 6: Configurar Inicialização Automática

### Criar arquivo de configuração do PM2:

```bash
cd ~/public_html

# Criar ecosystem.config.js
cat > ecosystem.config.js << 'EOF'
module.exports = {
  apps: [{
    name: 'patio-veiculos',
    script: 'dist/index.js',
    instances: 1,
    exec_mode: 'fork',
    autorestart: true,
    watch: false,
    max_memory_restart: '400M',
    env: {
      NODE_ENV: 'production',
      PORT: 3000
    }
  }]
};
EOF
```

### Instalar PM2 e iniciar aplicação:

```bash
# Instalar PM2 globalmente
npm install -g pm2

# Iniciar aplicação
pm2 start ecosystem.config.js

# Salvar configuração para reiniciar automaticamente
pm2 save

# Configurar PM2 para iniciar no boot
pm2 startup
```

---

## Passo 7: Configurar Nginx (Proxy Reverso)

O DOMcloud usa Nginx. Você precisa configurar o proxy reverso:

1. No painel do DOMcloud, vá em **"Manage"** → **"Nginx Config"**
2. Adicione a seguinte configuração:

```nginx
location / {
    proxy_pass http://localhost:3000;
    proxy_http_version 1.1;
    proxy_set_header Upgrade $http_upgrade;
    proxy_set_header Connection 'upgrade';
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
    proxy_cache_bypass $http_upgrade;
}
```

3. Clique em **"Save"** e **"Reload Nginx"**

---

## Passo 8: Testar o Deploy

1. Acesse seu domínio: `https://patio-veiculos.domcloud.dev`
2. Faça login com o usuário padrão: `admin` / `12312312`
3. Teste as funcionalidades:
   - Dashboard carrega
   - Cadastro de veículo
   - Busca de placa (API Placas)
   - Filtros e exportação

---

## Atualizar o Projeto

Para atualizar após fazer alterações:

```bash
# Conecte via SSH/Terminal do DOMcloud
cd ~/public_html

# Parar aplicação
pm2 stop patio-veiculos

# Atualizar código
git pull origin main

# Reinstalar dependências (se necessário)
pnpm install

# Rebuild
pnpm build

# Reiniciar aplicação
pm2 restart patio-veiculos
```

---

## Domínio Personalizado

### Usar seu próprio domínio:

1. No painel do DOMcloud, vá em **"Manage"** → **"Domain"**
2. Clique em **"Add Domain"**
3. Digite seu domínio (ex: `veiculos.seusite.com.br`)
4. O DOMcloud fornecerá registros DNS (A ou CNAME)
5. Adicione esses registros no painel do seu provedor de domínio
6. Aguarde propagação DNS (1-48h)

---

## Solução de Problemas

### Erro: "502 Bad Gateway"

**Causa**: Aplicação não está rodando

**Solução**:
```bash
cd ~/public_html
pm2 status
pm2 restart patio-veiculos
pm2 logs patio-veiculos
```

---

### Erro: "Database connection failed"

**Causa**: Credenciais incorretas ou banco não criado

**Solução**:
1. Verifique o arquivo `.env`
2. Confirme que o banco existe no painel "Database"
3. Teste conexão: `mysql -u usuario -p nome_banco`

---

### Erro: "Module not found"

**Causa**: Dependências não instaladas ou build não executado

**Solução**:
```bash
cd ~/public_html
pnpm install
pnpm build
pm2 restart patio-veiculos
```

---

## Monitoramento

### Ver logs da aplicação:

```bash
# Logs em tempo real
pm2 logs patio-veiculos

# Ver últimas 100 linhas
pm2 logs patio-veiculos --lines 100

# Status da aplicação
pm2 status
```

---

## Custos Estimados

### Opção Econômica:
| Serviço | Plano | Custo |
|---------|-------|-------|
| **DOMcloud Hosting** | Kit | R$ 10/mês |
| **Banco MySQL** | Incluído | R$ 0 |
| **Total** | | **R$ 10/mês** |

**Inclui**:
- 1GB RAM
- 10GB SSD
- MySQL incluído
- SSL gratuito
- 5 sites

---

## Links Úteis

- [Documentação DOMcloud](https://domcloud.co/docs)
- [Suporte DOMcloud](https://domcloud.co/support)
- [PM2 Documentation](https://pm2.keymetrics.io/docs)

---

## Resumo dos Comandos Principais

```bash
# Setup inicial
cd ~/public_html
git clone https://github.com/SEU_USUARIO/patio-veiculos.git .
npm install -g pnpm pm2
pnpm install
pnpm build
pnpm db:push

# Iniciar aplicação
pm2 start ecosystem.config.js
pm2 save
pm2 startup

# Atualizar projeto
git pull origin main
pnpm install
pnpm build
pm2 restart patio-veiculos

# Monitorar
pm2 status
pm2 logs patio-veiculos
```
