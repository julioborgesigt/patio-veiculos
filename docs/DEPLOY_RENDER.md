# Tutorial: Deploy do Sistema de Pátio de Veículos no Render.com

Este tutorial ensina como fazer o deploy completo do seu sistema de gerenciamento de pátio de veículos no Render.com, incluindo banco de dados MySQL e todas as configurações necessárias.

---

## Pré-requisitos

Antes de começar, você precisará:

1. **Conta no Render** - Crie gratuitamente em [render.com](https://render.com)
2. **Conta no GitHub** - Seu código precisa estar em um repositório GitHub público ou privado
3. **Banco de dados MySQL** - Você precisará de um banco MySQL externo (veja opções abaixo)

---

## Passo 1: Configurar Banco de Dados MySQL

O Render não oferece MySQL gratuito, então você precisará usar um serviço externo:

### Opção A: PlanetScale (Recomendado - Plano Hobby Gratuito)

1. Acesse [planetscale.com](https://planetscale.com) e crie uma conta
2. Clique em "Create database"
3. Dê um nome (ex: `patio-veiculos-db`)
4. Escolha a região mais próxima (ex: AWS São Paulo - sa-east-1)
5. Clique em "Create database"
6. Após criar, clique em "Connect"
7. Copie a **DATABASE_URL** completa

### Opção B: Railway (Plano Trial com $5 de crédito)

1. Acesse [railway.app](https://railway.app) e faça login com GitHub
2. Clique em "New Project" → "Provision MySQL"
3. Após criar, clique no serviço MySQL
4. Vá na aba "Connect"
5. Copie a **MySQL Connection URL**

---

## Passo 2: Preparar o Repositório GitHub

Faça push do seu código para um repositório GitHub:

```bash
cd patio-veiculos
git remote add origin https://github.com/SEU_USUARIO/patio-veiculos.git
git push origin main
```

---

## Passo 3: Criar Web Service no Render

1. Acesse [dashboard.render.com](https://dashboard.render.com)
2. Clique em **"New +"** → **"Web Service"**

3. **Conecte seu repositório GitHub**:
   - Se for a primeira vez, clique em "Connect account"
   - Autorize o Render a acessar seus repositórios
   - Selecione o repositório `patio-veiculos`

4. **Configure o serviço**:

   | Campo | Valor |
   |-------|-------|
   | **Name** | `patio-veiculos` |
   | **Region** | Oregon (US West) ou Ohio (US East) |
   | **Branch** | `main` |
   | **Runtime** | **Node** |
   | **Build Command** | `pnpm install && pnpm build` |
   | **Start Command** | `pnpm start` |

5. Clique em **"Advanced"** para expandir as opções avançadas

---

## Passo 4: Configurar Variáveis de Ambiente

Na seção **Environment Variables**, adicione:

```bash
# Banco de Dados
DATABASE_URL=mysql://usuario:senha@host/patio_veiculos

# Segurança - gere com: node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
JWT_SECRET=sua-chave-secreta-de-32-caracteres

# Node Environment
NODE_ENV=production

# API Placas (opcional)
API_PLACAS_TOKEN=seu-token-da-api-placas
```

---

## Passo 5: Configurar Plano e Criar Serviço

1. **Instance Type**:
   - **Free** (gratuito) - Suficiente para testes
     - Dorme após 15 minutos de inatividade
     - Reinicia automaticamente no primeiro acesso (~30 segundos)
   - **Starter** ($7/mês) - Recomendado para produção

2. Clique em **"Create Web Service"**

3. **Aguarde o deploy** (primeira vez leva 5-10 minutos)

---

## Passo 6: Executar Migrações do Banco de Dados

Após o primeiro deploy bem-sucedido:

1. No painel do Render, clique no seu serviço
2. No menu lateral, clique em **"Shell"**
3. Execute:
   ```bash
   pnpm db:push
   ```
4. Aguarde a confirmação de que as tabelas foram criadas

O sistema criará automaticamente o usuário admin na primeira execução, usando as variáveis `ADMIN_USER` e `ADMIN_PASSWORD`.

---

## Passo 7: Testar o Deploy

1. Acesse a URL fornecida pelo Render (ex: `https://patio-veiculos.onrender.com`)
2. Faça login com o usuário e senha configurados nas variáveis `ADMIN_USER` / `ADMIN_PASSWORD`
3. Teste as funcionalidades principais

---

## Atualizações Automáticas

O Render fará deploy automático sempre que você fizer push para o branch `main`:

```bash
git add .
git commit -m "Descrição das alterações"
git push origin main
```

---

## Domínio Personalizado (Opcional)

1. No painel do serviço, vá em **"Settings"** → **"Custom Domain"**
2. Clique em **"Add Custom Domain"**
3. Digite seu domínio (ex: `veiculos.seusite.com.br`)
4. Adicione o CNAME fornecido no seu provedor de domínio

---

## Solução de Problemas Comuns

### Erro: "Build failed"
- Verifique os logs de build no Render
- Confirme que o Build Command está: `pnpm install && pnpm build`

### Erro: "Application failed to respond"
- Verifique os logs de runtime
- Certifique-se de que o servidor usa `process.env.PORT`

### Erro: "Database connection failed"
- Verifique se a `DATABASE_URL` está correta
- Certifique-se de que o banco permite conexões externas

### Site muito lento ou offline
- **Temporária**: Aguarde 30 segundos no primeiro acesso (ele "acorda")
- **Permanente**: Upgrade para plano Starter ($7/mês)

---

## Custos Estimados

### Opção 100% Gratuita:
| Serviço | Plano | Custo |
|---------|-------|-------|
| **Render Web Service** | Free | R$ 0 |
| **PlanetScale Database** | Hobby | R$ 0 |
| **Total** | | **R$ 0/mês** |

### Opção Produção:
| Serviço | Plano | Custo |
|---------|-------|-------|
| **Render Web Service** | Starter | ~R$ 35/mês |
| **Railway MySQL** | Pay as you go | ~R$ 25-50/mês |
| **Total** | | **~R$ 60-85/mês** |

---

## Links Úteis

- [Documentação do Render](https://render.com/docs)
- [PlanetScale Docs](https://planetscale.com/docs)
- [Railway Docs](https://docs.railway.app)

---

## Resumo dos Comandos

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
