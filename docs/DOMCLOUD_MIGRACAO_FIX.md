# Fix: Migração do Banco de Dados no DOMcloud

## Problema Identificado

O comando `pnpm db:push` estava falhando no DOMcloud porque a variável `DATABASE_URL` não estava disponível durante a execução dos comandos de deploy, mesmo estando configurada no `.domcloud.yml`.

**Erro:**
```
DATABASE_URL is required to run drizzle commands
ELIFECYCLE Command failed with exit code 1.
```

---

## Solução Implementada

Criamos um script customizado de migração (`scripts/migrate-production.mjs`) que:

1. Tenta usar `DATABASE_URL` se disponível
2. Se não disponível, constrói a URL a partir de variáveis separadas:
   - `DB_HOST`
   - `DB_USER`
   - `DB_PASSWORD`
   - `DB_NAME`
3. Executa as migrações do Drizzle com a URL construída

---

## Arquivos Modificados

### 1. `/scripts/migrate-production.mjs` (NOVO)

Script Node.js que gerencia as migrações de forma mais flexível.

### 2. `/.domcloud.yml` (ATUALIZADO)

**Antes:**
```yaml
env_var_list:
  - DATABASE_URL=mysql://usuario:senha@host/banco

commands:
  - pnpm db:push
```

**Depois:**
```yaml
env_var_list:
  - DB_HOST=localhost
  - DB_USER=seu_usuario
  - DB_PASSWORD=sua_senha
  - DB_NAME=seu_banco
  - DATABASE_URL=mysql://seu_usuario:sua_senha@localhost/seu_banco

commands:
  - node scripts/migrate-production.mjs
```

---

## Como Usar

### Passo 1: Atualizar Credenciais no `.domcloud.yml`

Edite o arquivo `.domcloud.yml` e substitua os valores pelas credenciais reais do seu banco MySQL.

### Passo 2: Fazer Push para o GitHub

```bash
git add .
git commit -m "Fix: Adicionar script de migração customizado para DOMcloud"
git push origin main
```

### Passo 3: Redeploy no DOMcloud

No painel do DOMcloud:
1. Vá em **Manage** → **Deployment**
2. Clique em **"Redeploy"** ou **"Pull from GitHub"**

---

## Vantagens da Nova Abordagem

| Aspecto | Antes | Depois |
|---------|-------|--------|
| **Flexibilidade** | Apenas DATABASE_URL | DATABASE_URL ou variáveis separadas |
| **Encoding** | Problemas com caracteres especiais | Suporta qualquer senha |
| **Debug** | Erro genérico | Mensagens claras de erro |
| **Compatibilidade** | Específico para ambientes com env vars | Funciona em qualquer ambiente |

---

## Testando Localmente

Você pode testar o script localmente:

```bash
# Definir variáveis
export DB_HOST=localhost
export DB_USER=seu_usuario
export DB_PASSWORD=sua_senha
export DB_NAME=seu_banco

# Executar script
node scripts/migrate-production.mjs
```

---

## Solução de Problemas

### Erro: "Credenciais do banco de dados não configuradas"

**Causa:** Nem DATABASE_URL nem as variáveis separadas estão disponíveis

**Solução:**
1. Verifique se as variáveis estão no `.domcloud.yml`
2. Confirme que fez push das alterações para o GitHub
3. Faça redeploy no DOMcloud

### Erro: "Access denied for user"

**Causa:** Senha incorreta ou usuário sem permissões

**Solução:**
1. Verifique as credenciais no painel DOMcloud (Manage → Database)
2. Teste a conexão manualmente via SSH:
   ```bash
   mysql -u seu_usuario -p seu_banco
   ```

### Erro: "Unknown database"

**Causa:** Banco de dados não existe

**Solução:**
1. Crie o banco no painel DOMcloud (Manage → Database)
2. Verifique se o nome do banco está correto no `.domcloud.yml`
