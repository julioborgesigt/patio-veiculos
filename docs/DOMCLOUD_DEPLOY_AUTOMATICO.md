# Deploy Automático no DOMcloud usando .domcloud.yml

Este guia explica como usar o arquivo `.domcloud.yml` para fazer deploy automatizado do sistema de pátio de veículos no DOMcloud.

---

## O que é o arquivo .domcloud.yml?

O `.domcloud.yml` é um arquivo de configuração que automatiza todo o processo de deploy no DOMcloud. Com ele, você não precisa executar comandos manualmente via SSH - o DOMcloud faz tudo automaticamente.

---

## Pré-requisitos

1. **Conta no DOMcloud** - [domcloud.co](https://domcloud.co)
2. **Repositório GitHub público** com o código do projeto
3. **Banco de dados MySQL** criado no painel do DOMcloud

---

## Passo 1: Configurar o Arquivo .domcloud.yml

O arquivo `.domcloud.yml` já está criado na raiz do projeto. Você precisa editá-lo com seus dados:

### 1.1. Editar URL do Repositório

```yaml
source: https://github.com/SEU_USUARIO/patio-veiculos
```

### 1.2. Configurar DATABASE_URL

Primeiro, crie o banco de dados no DOMcloud:

1. Acesse o painel do DOMcloud
2. Vá em **Manage** → **Database**
3. Clique em **Create Database**
4. Anote as credenciais

Depois, edite o `.domcloud.yml`:

```yaml
- DATABASE_URL=mysql://seu_usuario:sua_senha@localhost/patio_veiculos
```

### 1.3. Gerar JWT_SECRET

Execute no seu computador:

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

Copie o resultado e cole no `.domcloud.yml`:

```yaml
- JWT_SECRET=sua-chave-gerada-aqui
```

---

## Passo 2: Fazer Push para o GitHub

```bash
git add .domcloud.yml
git commit -m "Adicionar configuração de deploy do DOMcloud"
git push origin main
```

---

## Passo 3: Criar Website no DOMcloud

1. Acesse [domcloud.co](https://domcloud.co) e faça login
2. Clique em **"Create New Website"**
3. Preencha:
   - **Domain**: Escolha um subdomínio (ex: `patio-veiculos.domcloud.dev`)
   - **Template**: Selecione **"From GitHub"** ou **"Custom"**
   - **Repository**: Cole a URL do seu repositório GitHub
   - **Plan**: Escolha o plano (recomendado: Kit - $2/mês)
4. Clique em **"Create"**

---

## Passo 4: Deploy Automático

O DOMcloud detectará o arquivo `.domcloud.yml` e executará automaticamente:

1. Instalará Node.js LTS
2. Instalará pnpm
3. Instalará dependências (`pnpm install`)
4. Fará build do projeto (`pnpm build`)
5. Executará migrações do banco (`pnpm db:push`)
6. Iniciará a aplicação (`node dist/index.js`)

**Aguarde 5-10 minutos** para o primeiro deploy completar.

---

## Passo 5: Verificar Deploy

1. Acesse o domínio configurado
2. Faça login com o usuário padrão: `admin` / `12312312`
3. Teste as funcionalidades principais

---

## Atualizar o Projeto

### Método 1: Automático (Recomendado)

1. Faça suas alterações localmente
2. Commit e push para o GitHub:
   ```bash
   git add .
   git commit -m "Descrição das alterações"
   git push origin main
   ```
3. No painel do DOMcloud, vá em **Manage** → **Deployment**
4. Clique em **"Redeploy"**

### Método 2: Manual via SSH

```bash
ssh usuario@seu-dominio.domcloud.dev
cd ~/public_html
git pull origin main
pnpm install
pnpm build
touch tmp/restart.txt
```

---

## Solução de Problemas

### Erro: "Deploy failed"

1. Verifique os logs: Painel DOMcloud → **Manage** → **Logs**
2. Causas comuns:
   - DATABASE_URL incorreta
   - JWT_SECRET não configurado
   - Repositório privado (DOMcloud gratuito só aceita públicos)

### Erro: "Database connection failed"

1. Verifique se o banco foi criado no painel
2. Confirme que a DATABASE_URL está correta
3. Teste conexão via SSH: `mysql -u seu_usuario -p nome_banco`

### Erro: "502 Bad Gateway"

1. Verifique logs: Painel → **Logs**
2. Reinicie: `cd ~/public_html && touch tmp/restart.txt`

---

## Estrutura do .domcloud.yml Explicada

```yaml
# URL do repositório GitHub
source: https://github.com/usuario/repo

# Recursos necessários
features:
  - node lts  # Node.js versão LTS

# Configuração do servidor
passenger:
  enabled: "on"
  app_start_command: node dist/index.js  # Comando para iniciar
  env_var_list:  # Variáveis de ambiente
    - DATABASE_URL=...
    - JWT_SECRET=...

# Comandos executados no deploy
commands:
  - npm install -g pnpm  # Instalar pnpm
  - pnpm install         # Instalar dependências
  - pnpm build           # Build do projeto
  - pnpm db:push         # Migrações
  - mkdir -p tmp && touch tmp/restart.txt  # Reiniciar
```

---

## Comparação: Deploy Manual vs Automático

| Aspecto | Manual (SSH) | Automático (.domcloud.yml) |
|---------|--------------|----------------------------|
| **Configuração inicial** | Complexa | Simples |
| **Atualizações** | Comandos manuais | 1 clique |
| **Reprodutibilidade** | Difícil | Fácil |
| **Documentação** | Você mantém | Auto-documentado |

**Recomendação:** Use sempre o `.domcloud.yml` para deploy automatizado!

---

## Recursos Adicionais

- [Documentação DOMcloud](https://domcloud.co/docs)
- [Exemplos de .domcloud.yml](https://domcloud.co/docs/deployment/recipes)
- [Suporte DOMcloud](https://domcloud.co/support)
