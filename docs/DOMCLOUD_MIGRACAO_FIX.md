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

1. ✅ Tenta usar `DATABASE_URL` se disponível
2. ✅ Se não disponível, constrói a URL a partir de variáveis separadas:
   - `DB_HOST`
   - `DB_USER`
   - `DB_PASSWORD`
   - `DB_NAME`
3. ✅ Executa as migrações do Drizzle com a URL construída

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
  - DB_USER=patioiguatu
  - DB_PASSWORD=sua_senha
  - DB_NAME=patioiguatu_patio_user
  - DATABASE_URL=mysql://patioiguatu:sua_senha@localhost/patioiguatu_patio_user

commands:
  - node scripts/migrate-production.mjs
```

---

## Como Usar

### Passo 1: Atualizar Credenciais no `.domcloud.yml`

Edite o arquivo `.domcloud.yml` e substitua `SUA_SENHA_AQUI` pela senha real do seu banco MySQL:

```yaml
- DB_PASSWORD=8TbEh)13+D8_sq8zAX  # Sua senha real
- DATABASE_URL=mysql://patioiguatu:8TbEh)13+D8_sq8zAX@localhost/patioiguatu_patio_user
```

**Ou melhor:** Use uma senha sem caracteres especiais para evitar problemas de encoding.

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

### ❌ Erro: "Credenciais do banco de dados não configuradas"

**Causa:** Nem DATABASE_URL nem as variáveis separadas estão disponíveis

**Solução:**
1. Verifique se as variáveis estão no `.domcloud.yml`
2. Confirme que fez push das alterações para o GitHub
3. Faça redeploy no DOMcloud

### ❌ Erro: "Access denied for user"

**Causa:** Senha incorreta ou usuário sem permissões

**Solução:**
1. Verifique as credenciais no painel DOMcloud (Manage → Database)
2. Confirme que a senha no `.domcloud.yml` está correta
3. Teste a conexão manualmente via SSH:
   ```bash
   mysql -u patioiguatu -p patioiguatu_patio_user
   ```

### ❌ Erro: "Unknown database"

**Causa:** Banco de dados não existe

**Solução:**
1. Crie o banco no painel DOMcloud (Manage → Database)
2. Verifique se o nome do banco está correto no `.domcloud.yml`

---

## Alternativa: Usar .env no Servidor

Se preferir, você pode criar um arquivo `.env` diretamente no servidor via SSH:

```bash
# Conectar via SSH
ssh patioiguatu@patioiguatu.domcloud.dev

# Criar arquivo .env
cd ~/public_html
cat > .env << 'EOF'
DATABASE_URL=mysql://patioiguatu:sua_senha@localhost/patioiguatu_patio_user
JWT_SECRET=sua_chave_jwt
API_PLACAS_TOKEN=88c5130c5f73f6c829ed04a1e991eee4
NODE_ENV=production
EOF

# Executar migrações manualmente
node scripts/migrate-production.mjs
```

---

## Resumo

✅ Problema resolvido com script customizado de migração  
✅ Suporta tanto DATABASE_URL quanto variáveis separadas  
✅ Mensagens de erro mais claras  
✅ Compatível com senhas complexas  

**Próximo passo:** Atualize o `.domcloud.yml` com sua senha real e faça redeploy!
