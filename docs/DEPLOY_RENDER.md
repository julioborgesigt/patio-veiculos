# Tutorial: Deploy do Sistema de Pátio de Veículos no Render.com

Este tutorial ensina como fazer o deploy completo do seu sistema de gerenciamento de pátio de veículos no Render.com, incluindo banco de dados MySQL e todas as configurações necessárias.

---

## ⚠️ Aviso Importante sobre Hospedagem Externa

**O Manus já oferece hospedagem integrada com domínio personalizado!**

Antes de prosseguir com o Render, considere que:
- ✅ O Manus tem hospedagem built-in com SSL automático
- ✅ Suporta domínios personalizados (você pode comprar ou conectar seu próprio domínio)
- ✅ Não requer configuração manual de variáveis de ambiente
- ✅ Deploy automático via botão "Publish" na interface
- ⚠️ Deploy externo pode causar problemas de compatibilidade com recursos do Manus (especialmente autenticação OAuth)

**Para usar a hospedagem do Manus:**
1. Abra o Management UI (painel lateral direito)
2. Vá em Settings → Domains
3. Configure seu domínio ou use o domínio gratuito .manus.space
4. Clique em "Publish" no header

Se mesmo assim preferir o Render, continue com este tutorial.

---

## 📋 Pré-requisitos

Antes de começar, você precisará:

1. **Conta no Render** - Crie gratuitamente em [render.com](https://render.com)
2. **Conta no GitHub** - Seu código precisa estar em um repositório GitHub público ou privado
3. **Banco de dados MySQL** - Você precisará de um banco MySQL externo (veja opções abaixo)

---

## 🗄️ Passo 1: Configurar Banco de Dados MySQL

O Render não oferece MySQL gratuito, então você precisará usar um serviço externo:

### Opção A: PlanetScale (Recomendado - Plano Hobby Gratuito)

1. Acesse [planetscale.com](https://planetscale.com) e crie uma conta
2. Clique em "Create database"
3. Dê um nome (ex: `patio-veiculos-db`)
4. Escolha a região mais próxima (ex: AWS São Paulo - sa-east-1)
5. Clique em "Create database"
6. Após criar, clique em "Connect"
7. Selecione "Prisma" ou "General" como framework
8. Copie a **DATABASE_URL** completa (formato: `mysql://usuario:senha@host/database?sslaccept=strict`)

**Características do PlanetScale:**
- ✅ Gratuito até 5GB de armazenamento
- ✅ 1 bilhão de leituras/mês
- ✅ 10 milhões de escritas/mês
- ✅ Backups automáticos
- ✅ Escalável

### Opção B: Railway (Plano Trial com $5 de crédito)

1. Acesse [railway.app](https://railway.app) e faça login com GitHub
2. Clique em "New Project" → "Provision MySQL"
3. Após criar, clique no serviço MySQL
4. Vá na aba "Connect"
5. Copie a **MySQL Connection URL**

**Características do Railway:**
- ✅ $5 de crédito gratuito mensalmente
- ✅ Fácil configuração
- ⚠️ Após acabar o crédito, cobra por uso

### Opção C: Aiven (Plano Gratuito Limitado)

1. Acesse [aiven.io](https://aiven.io) e crie uma conta
2. Crie um serviço MySQL
3. Escolha o plano gratuito (limitado)
4. Copie a string de conexão

---

## 📦 Passo 2: Preparar o Repositório GitHub

### Se você ainda não tem o código no GitHub:

1. **Exporte via Management UI do Manus**:
   - Abra o painel lateral direito
   - Vá em Settings → GitHub
   - Conecte sua conta GitHub
   - Clique em "Export" para criar um novo repositório

2. **Ou crie manualmente**:
   ```bash
   # No seu computador local, clone o projeto
   git clone [URL_DO_SEU_REPO_MANUS]
   cd patio-veiculos
   
   # Crie um novo repositório no GitHub (via web)
   # Depois adicione o remote e faça push
   git remote add github https://github.com/SEU_USUARIO/patio-veiculos.git
   git push github main
   ```

---

## 🚀 Passo 3: Criar Web Service no Render

1. Acesse [dashboard.render.com](https://dashboard.render.com)
2. Clique em **"New +"** → **"Web Service"**

3. **Conecte seu repositório GitHub**:
   - Se for a primeira vez, clique em "Connect account"
   - Autorize o Render a acessar seus repositórios
   - Selecione o repositório `patio-veiculos`

4. **Configure o serviço**:

   | Campo | Valor |
   |-------|-------|
   | **Name** | `patio-veiculos` (ou nome de sua preferência) |
   | **Region** | Oregon (US West) ou Ohio (US East) - mais próximos do Brasil |
   | **Branch** | `main` (ou `master`) |
   | **Root Directory** | (deixe em branco) |
   | **Runtime** | **Node** |
   | **Build Command** | `pnpm install && pnpm build` |
   | **Start Command** | `pnpm start` |

5. Clique em **"Advanced"** para expandir as opções avançadas

---

## 🔐 Passo 4: Configurar Variáveis de Ambiente

Na seção **Environment Variables**, clique em "Add Environment Variable" e adicione as seguintes variáveis:

### Variáveis Obrigatórias:

```bash
# ===== BANCO DE DADOS =====
DATABASE_URL
# Valor: Cole a URL do seu banco MySQL (PlanetScale, Railway, etc.)
# Exemplo: mysql://usuario:senha@host.planetscale.com/patio_veiculos?sslaccept=strict

# ===== SEGURANÇA =====
JWT_SECRET
# Valor: String aleatória de 32+ caracteres
# Como gerar: node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
# Exemplo: a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6q7r8s9t0u1v2w3x4y5z6

# ===== NODE ENVIRONMENT =====
NODE_ENV
# Valor: production

# ===== API PLACAS =====
API_PLACAS_TOKEN
# Valor: 88c5130c5f73f6c829ed04a1e991eee4
# (seu token da API Placas)
```

### ⚠️ Importante sobre Autenticação:

O sistema usa **Manus OAuth** para autenticação, que **não funcionará fora da plataforma Manus**. Você tem duas opções:

**Opção 1: Remover autenticação (mais simples)**
- O sistema funcionará sem login
- Todos terão acesso total
- Adicione esta variável:
  ```bash
  DISABLE_AUTH
  # Valor: true
  ```

**Opção 2: Implementar autenticação alternativa**
- Você precisará modificar o código para usar Auth0, NextAuth, ou sistema próprio
- Requer conhecimento de desenvolvimento

---

## 🔧 Passo 5: Configurar Plano e Criar Serviço

1. **Instance Type**: 
   - **Free** (gratuito) - Suficiente para testes
     - ⚠️ Dorme após 15 minutos de inatividade
     - ⚠️ Reinicia automaticamente no primeiro acesso (demora ~30 segundos)
   - **Starter** ($7/mês) - Recomendado para produção
     - ✅ Sempre ativo
     - ✅ 512MB RAM

2. Clique em **"Create Web Service"**

3. **Aguarde o deploy** (primeira vez leva 5-10 minutos):
   - Você verá os logs em tempo real
   - Aguarde até aparecer "Build successful" e "Deploy live"

---

## 🗃️ Passo 6: Executar Migrações do Banco de Dados

Após o primeiro deploy bem-sucedido, você precisa criar as tabelas no banco:

1. No painel do Render, clique no seu serviço `patio-veiculos`
2. No menu lateral, clique em **"Shell"**
3. Aguarde o terminal abrir
4. Execute o comando:
   ```bash
   pnpm db:push
   ```
5. Aguarde a confirmação de que as tabelas foram criadas

Isso criará todas as tabelas necessárias (users, vehicles, etc.) no seu banco de dados.

---

## ✅ Passo 7: Testar o Deploy

1. Após o deploy completar, o Render fornecerá uma URL pública:
   - Exemplo: `https://patio-veiculos.onrender.com`
   - Você encontra a URL no topo da página do serviço

2. **Acesse a URL no navegador**

3. **Teste as funcionalidades principais**:
   - ✅ Dashboard carrega corretamente
   - ✅ Cadastro de novo veículo
   - ✅ Busca automática de placa (API Placas)
   - ✅ Filtros (No Pátio, Devolvidos, Perícia Pendente)
   - ✅ Botão "Marcar como Devolvido"
   - ✅ Exportação CSV e Excel

---

## 🔄 Atualizações Automáticas

O Render fará deploy automático sempre que você fizer push para o branch `main` no GitHub:

```bash
# Faça suas alterações localmente
git add .
git commit -m "Descrição das alterações"
git push origin main

# O Render detectará automaticamente e fará novo deploy
```

Você pode acompanhar o progresso do deploy no painel do Render.

---

## 🌐 Domínio Personalizado (Opcional)

### Usar domínio próprio:

1. No painel do serviço, vá em **"Settings"** → **"Custom Domain"**
2. Clique em **"Add Custom Domain"**
3. Digite seu domínio (ex: `veiculos.seusite.com.br`)
4. O Render fornecerá um registro CNAME
5. Adicione esse CNAME no painel do seu provedor de domínio
6. Aguarde propagação DNS (pode levar até 48h, geralmente 1-2h)

---

## 🐛 Solução de Problemas Comuns

### ❌ Erro: "Build failed"

**Causa**: Comando de build incorreto ou dependências faltando

**Solução**:
1. Verifique os logs de build no Render
2. Confirme que o Build Command está: `pnpm install && pnpm build`
3. Verifique se o `package.json` tem o script `build` configurado

---

### ❌ Erro: "Application failed to respond"

**Causa**: Servidor não está iniciando ou porta incorreta

**Solução**:
1. Verifique os logs de runtime
2. Confirme que o Start Command está: `pnpm start`
3. Certifique-se de que o servidor usa `process.env.PORT` (Render injeta automaticamente)

---

### ❌ Erro: "Database connection failed"

**Causa**: DATABASE_URL incorreta ou banco inacessível

**Solução**:
1. Verifique se a `DATABASE_URL` está correta nas variáveis de ambiente
2. Teste a conexão com o banco usando um cliente MySQL (ex: MySQL Workbench)
3. Certifique-se de que o banco permite conexões externas
4. Verifique se incluiu `?sslaccept=strict` no final da URL (PlanetScale exige)

---

### ❌ Erro: "Module not found" ou tabelas não existem

**Causa**: Migrações do banco não foram executadas

**Solução**:
1. Acesse o Shell no painel do Render
2. Execute: `pnpm db:push`
3. Aguarde confirmação

---

### ⚠️ Site muito lento ou offline

**Causa**: Plano gratuito dormindo após inatividade

**Solução**:
- **Temporária**: Aguarde 30 segundos no primeiro acesso (ele "acorda")
- **Permanente**: Upgrade para plano Starter ($7/mês)
- **Alternativa**: Use serviço de "ping" como [UptimeRobot](https://uptimerobot.com) para manter ativo

---

### ❌ Autenticação não funciona

**Causa**: Manus OAuth não funciona fora da plataforma

**Solução**:
- Adicione variável `DISABLE_AUTH=true` para desabilitar autenticação
- Ou implemente sistema de autenticação alternativo (Auth0, NextAuth)

---

## 💰 Custos Estimados

### Opção 100% Gratuita:
| Serviço | Plano | Custo |
|---------|-------|-------|
| **Render Web Service** | Free | R$ 0 |
| **PlanetScale Database** | Hobby | R$ 0 |
| **Total** | | **R$ 0/mês** |

**Limitações**:
- Site dorme após 15min de inatividade
- 750 horas/mês de uptime (suficiente para 1 serviço)
- Banco limitado a 5GB

---

### Opção Produção (Recomendada):
| Serviço | Plano | Custo |
|---------|-------|-------|
| **Render Web Service** | Starter | ~R$ 35/mês |
| **PlanetScale Database** | Scaler Pro | ~R$ 145/mês |
| **Total** | | **~R$ 180/mês** |

**Ou use Railway para banco**:
| Serviço | Plano | Custo |
|---------|-------|-------|
| **Render Web Service** | Starter | ~R$ 35/mês |
| **Railway MySQL** | Pay as you go | ~R$ 25-50/mês |
| **Total** | | **~R$ 60-85/mês** |

---

## 📊 Monitoramento

O Render oferece:
- ✅ Logs em tempo real
- ✅ Métricas de CPU e memória
- ✅ Histórico de deploys
- ✅ Alertas por email (planos pagos)

Acesse tudo no painel do serviço.

---

## 🔗 Links Úteis

- [Documentação do Render](https://render.com/docs)
- [PlanetScale Docs](https://planetscale.com/docs)
- [Railway Docs](https://docs.railway.app)
- [Render Community](https://community.render.com)
- [Status do Render](https://status.render.com)

---

## 📞 Suporte

**Problemas com o Render:**
- [Render Community Forum](https://community.render.com)
- [Render Support](https://render.com/support)

**Problemas com o código:**
- Verifique os logs no painel do Render
- Teste localmente primeiro: `pnpm dev`

---

## ⚡ Alternativa Mais Simples: Hospedagem Manus

Lembre-se que a forma mais simples e integrada é usar a hospedagem do Manus:

**Vantagens:**
- ✅ Deploy com 1 clique
- ✅ Sem configuração manual
- ✅ Autenticação funcionando
- ✅ Domínio personalizado incluído
- ✅ Banco de dados integrado
- ✅ SSL automático
- ✅ Suporte completo

**Como usar:**
1. Abra o Management UI
2. Clique em "Publish" no header
3. Pronto! Seu site está no ar

---

## 🎯 Resumo dos Comandos

```bash
# Gerar JWT_SECRET
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"

# No Shell do Render (após primeiro deploy)
pnpm db:push

# Para atualizar (no seu computador)
git add .
git commit -m "Atualização"
git push origin main
```

---

**Boa sorte com seu deploy! 🚀**
