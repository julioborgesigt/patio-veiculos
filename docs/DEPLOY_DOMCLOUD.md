# Tutorial: Deploy do Sistema de Pátio de Veículos no DOMcloud.co

Este tutorial ensina como fazer o deploy completo do seu sistema de gerenciamento de pátio de veículos no DOMcloud.co, uma plataforma de hospedagem web acessível com suporte a Node.js e MySQL.

---

## ⚠️ Aviso Importante sobre Hospedagem Externa

**O Manus já oferece hospedagem integrada com domínio personalizado!**

Antes de prosseguir com o DOMcloud, considere que:
- ✅ O Manus tem hospedagem built-in com SSL automático
- ✅ Suporta domínios personalizados
- ✅ Não requer configuração manual
- ✅ Deploy automático via botão "Publish"
- ⚠️ Deploy externo pode causar problemas de compatibilidade (especialmente autenticação)

**Para usar a hospedagem do Manus:**
1. Abra o Management UI → Settings → Domains
2. Configure seu domínio
3. Clique em "Publish"

Se mesmo assim preferir o DOMcloud, continue com este tutorial.

---

## 📋 Pré-requisitos

1. **Conta no DOMcloud** - Crie em [domcloud.co](https://domcloud.co)
2. **Conta no GitHub** - Seu código precisa estar em um repositório público
3. **Token da API Placas** - Já configurado: `88c5130c5f73f6c829ed04a1e991eee4`

---

## 💰 Planos do DOMcloud

| Plano | Preço | Recursos |
|-------|-------|----------|
| **Lite** | $0.50/mês (~R$ 2,50) | 512MB RAM, 2GB SSD, 1 site |
| **Kit** | $2/mês (~R$ 10) | 1GB RAM, 10GB SSD, 5 sites |
| **Pro** | $10/mês (~R$ 50) | 4GB RAM, 50GB SSD, ilimitado |

**Recomendação**: Plano **Kit** ($2/mês) é suficiente para este projeto.

---

## 🚀 Passo 1: Criar Conta e Novo Website

1. Acesse [domcloud.co](https://domcloud.co) e faça login
2. No painel, clique em **"Create New Website"**
3. Preencha:
   - **Domain**: Escolha um subdomínio gratuito (ex: `patio-veiculos.domcloud.dev`)
   - **Template**: Selecione **"Node.js"**
   - **Plan**: Escolha o plano (recomendado: Kit - $2/mês)
4. Clique em **"Create"**
5. Aguarde a criação (leva ~1 minuto)

---

## 📦 Passo 2: Configurar Repositório GitHub

### Preparar o código no GitHub:

1. **Exporte via Manus**:
   - Management UI → Settings → GitHub → Export

2. **Ou crie manualmente**:
   ```bash
   git clone [URL_DO_SEU_REPO_MANUS]
   cd patio-veiculos
   git remote add github https://github.com/SEU_USUARIO/patio-veiculos.git
   git push github main
   ```

3. **Certifique-se de que o repositório é público** (DOMcloud gratuito só suporta repos públicos)

---

## 🔧 Passo 3: Configurar Deploy via SSH/Terminal

1. No painel do DOMcloud, clique no seu website
2. Vá na aba **"Manage"** → **"Terminal"** ou **"File Manager"**
3. Clique em **"Open Terminal"**

### Comandos para executar no terminal:

```bash
# 1. Limpar diretório padrão
cd ~
rm -rf public_html/*

# 2. Clonar seu repositório
git clone https://github.com/SEU_USUARIO/patio-veiculos.git temp_repo
mv temp_repo/* public_html/
mv temp_repo/.* public_html/ 2>/dev/null || true
rm -rf temp_repo

# 3. Entrar no diretório
cd public_html

# 4. Instalar pnpm globalmente
npm install -g pnpm

# 5. Instalar dependências
pnpm install

# 6. Build do projeto
pnpm build
```

---

## 🗄️ Passo 4: Configurar Banco de Dados MySQL

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

Exemplo:
```
mysql://seu_usuario:senha_gerada@localhost/patio_veiculos
```

---

## 🔐 Passo 5: Configurar Variáveis de Ambiente

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

# API Placas
API_PLACAS_TOKEN=88c5130c5f73f6c829ed04a1e991eee4

# Porta (DOMcloud usa porta específica)
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

## 🗃️ Passo 6: Executar Migrações do Banco

No terminal do DOMcloud:

```bash
cd ~/public_html

# Executar migrações
pnpm db:push
```

Aguarde a confirmação de que as tabelas foram criadas.

---

## 🚀 Passo 7: Configurar Inicialização Automática

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

## 🌐 Passo 8: Configurar Nginx (Proxy Reverso)

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

## ✅ Passo 9: Testar o Deploy

1. Acesse seu domínio: `https://patio-veiculos.domcloud.dev`
2. Teste as funcionalidades:
   - ✅ Dashboard carrega
   - ✅ Cadastro de veículo
   - ✅ Busca de placa (API Placas)
   - ✅ Filtros e exportação

---

## 🔄 Atualizar o Projeto

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

## 🌐 Domínio Personalizado

### Usar seu próprio domínio:

1. No painel do DOMcloud, vá em **"Manage"** → **"Domain"**
2. Clique em **"Add Domain"**
3. Digite seu domínio (ex: `veiculos.seusite.com.br`)
4. O DOMcloud fornecerá registros DNS (A ou CNAME)
5. Adicione esses registros no painel do seu provedor de domínio
6. Aguarde propagação DNS (1-48h)

---

## 🐛 Solução de Problemas

### ❌ Erro: "502 Bad Gateway"

**Causa**: Aplicação não está rodando

**Solução**:
```bash
cd ~/public_html
pm2 status
pm2 restart patio-veiculos
pm2 logs patio-veiculos
```

---

### ❌ Erro: "Database connection failed"

**Causa**: Credenciais incorretas ou banco não criado

**Solução**:
1. Verifique o arquivo `.env`
2. Confirme que o banco existe no painel "Database"
3. Teste conexão: `mysql -u usuario -p nome_banco`

---

### ❌ Erro: "Module not found"

**Causa**: Dependências não instaladas ou build não executado

**Solução**:
```bash
cd ~/public_html
pnpm install
pnpm build
pm2 restart patio-veiculos
```

---

### ⚠️ Site lento

**Causa**: Plano Lite com poucos recursos

**Solução**:
- Upgrade para plano Kit ($2/mês) ou Pro ($10/mês)
- Otimize queries do banco de dados

---

## 📊 Monitoramento

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

## 💰 Custos Estimados

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

## 🔗 Links Úteis

- [Documentação DOMcloud](https://domcloud.co/docs)
- [Suporte DOMcloud](https://domcloud.co/support)
- [PM2 Documentation](https://pm2.keymetrics.io/docs)

---

## 📞 Suporte

**Problemas com DOMcloud:**
- [DOMcloud Support](https://domcloud.co/support)
- Email: support@domcloud.co

**Problemas com o código:**
- Verifique logs: `pm2 logs patio-veiculos`
- Teste localmente: `pnpm dev`

---

## ⚡ Alternativa Mais Simples: Hospedagem Manus

Lembre-se que a forma mais simples é usar a hospedagem integrada do Manus:

**Vantagens:**
- ✅ Deploy com 1 clique
- ✅ Sem SSH ou terminal
- ✅ Autenticação funcionando
- ✅ Banco de dados integrado
- ✅ SSL automático

**Como usar:**
1. Management UI → Clique em "Publish"
2. Pronto!

---

## 🎯 Resumo dos Comandos Principais

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

---

## ⚠️ Limitações do DOMcloud

- ❌ Autenticação Manus OAuth não funcionará
- ❌ Requer conhecimento de terminal/SSH
- ❌ Configuração manual mais complexa
- ✅ Mais controle sobre o servidor
- ✅ Preço acessível

---

**Boa sorte com seu deploy! 🚀**

Se tiver dúvidas, consulte a documentação do DOMcloud ou entre em contato com o suporte deles.
