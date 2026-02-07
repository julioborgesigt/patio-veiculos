# Deploy Automático no DOMcloud usando .domcloud.yml

Este guia explica como usar o arquivo `.domcloud.yml` para fazer deploy automatizado do sistema de pátio de veículos no DOMcloud.

---

## 🚀 O que é o arquivo .domcloud.yml?

O `.domcloud.yml` é um arquivo de configuração que automatiza todo o processo de deploy no DOMcloud. Com ele, você não precisa executar comandos manualmente via SSH - o DOMcloud faz tudo automaticamente.

---

## 📋 Pré-requisitos

1. **Conta no DOMcloud** - [domcloud.co](https://domcloud.co)
2. **Repositório GitHub público** com o código do projeto
3. **Banco de dados MySQL** criado no painel do DOMcloud

---

## 🔧 Passo 1: Configurar o Arquivo .domcloud.yml

O arquivo `.domcloud.yml` já está criado na raiz do projeto. Você precisa editá-lo com seus dados:

### 1.1. Editar URL do Repositório

Abra o arquivo `.domcloud.yml` e substitua:

```yaml
source: https://github.com/SEU_USUARIO/patio-veiculos
```

Por:

```yaml
source: https://github.com/julioborgesigt/patio-veiculos
```

(Substitua `julioborgesigt` pelo seu usuário do GitHub)

---

### 1.2. Configurar DATABASE_URL

Primeiro, crie o banco de dados no DOMcloud:

1. Acesse o painel do DOMcloud
2. Vá em **Manage** → **Database**
3. Clique em **Create Database**
4. Anote:
   - **Nome do banco**: Ex: `patio_veiculos`
   - **Usuário**: Ex: `seu_usuario`
   - **Senha**: Será gerada automaticamente
   - **Host**: Geralmente `localhost` ou `sao.domcloud.co`

Depois, edite o `.domcloud.yml`:

```yaml
- DATABASE_URL=mysql://seu_usuario:sua_senha@localhost/patio_veiculos
```

**Exemplo real:**
```yaml
- DATABASE_URL=mysql://patio_user:Abc123XyZ@localhost/patio_veiculos
```

---

### 1.3. Gerar JWT_SECRET

Execute no seu computador local ou no terminal do DOMcloud:

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

Copie o resultado e cole no `.domcloud.yml`:

```yaml
- JWT_SECRET=a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6q7r8s9t0u1v2w3x4y5z6a7b8c9d0e1f2
```

---

### 1.4. Desabilitar Autenticação (Opcional)

Como o Manus OAuth não funciona fora da plataforma, adicione esta linha:

```yaml
- DISABLE_AUTH=true
```

---

## 📤 Passo 2: Fazer Push para o GitHub

Após editar o `.domcloud.yml`, faça push para o GitHub:

```bash
git add .domcloud.yml
git commit -m "Adicionar configuração de deploy do DOMcloud"
git push origin main
```

---

## 🌐 Passo 3: Criar Website no DOMcloud

1. Acesse [domcloud.co](https://domcloud.co) e faça login
2. Clique em **"Create New Website"**
3. Preencha:
   - **Domain**: Escolha um subdomínio (ex: `patio-veiculos.domcloud.dev`)
   - **Template**: Selecione **"From GitHub"** ou **"Custom"**
   - **Repository**: Cole a URL do seu repositório GitHub
   - **Plan**: Escolha o plano (recomendado: Kit - $2/mês)
4. Clique em **"Create"**

---

## ⚙️ Passo 4: Deploy Automático

O DOMcloud detectará o arquivo `.domcloud.yml` e executará automaticamente:

1. ✅ Instalará Node.js LTS
2. ✅ Instalará pnpm
3. ✅ Instalará dependências (`pnpm install`)
4. ✅ Fará build do projeto (`pnpm build`)
5. ✅ Executará migrações do banco (`pnpm db:push`)
6. ✅ Iniciará a aplicação (`node dist/index.js`)

**Aguarde 5-10 minutos** para o primeiro deploy completar.

---

## ✅ Passo 5: Verificar Deploy

1. Acesse o domínio configurado: `https://patio-veiculos.domcloud.dev`
2. Verifique se o dashboard carrega corretamente
3. Teste as funcionalidades principais

---

## 🔄 Atualizar o Projeto

Para atualizar após fazer alterações:

### Método 1: Automático (Recomendado)

1. Faça suas alterações localmente
2. Commit e push para o GitHub:
   ```bash
   git add .
   git commit -m "Descrição das alterações"
   git push origin main
   ```
3. No painel do DOMcloud, vá em **Manage** → **Deployment**
4. Clique em **"Redeploy"** ou **"Pull from GitHub"**
5. O DOMcloud executará novamente os comandos do `.domcloud.yml`

### Método 2: Manual via SSH

Se precisar forçar atualização:

```bash
# Conectar via SSH
ssh usuario@seu-dominio.domcloud.dev

# Ir para o diretório
cd ~/public_html

# Atualizar código
git pull origin main

# Reinstalar dependências (se necessário)
pnpm install

# Rebuild
pnpm build

# Reiniciar aplicação
touch tmp/restart.txt
```

---

## 🐛 Solução de Problemas

### ❌ Erro: "Deploy failed"

**Verifique os logs:**
1. Painel DOMcloud → **Manage** → **Logs**
2. Procure por erros específicos

**Causas comuns:**
- DATABASE_URL incorreta
- JWT_SECRET não configurado
- Repositório privado (DOMcloud gratuito só aceita públicos)

---

### ❌ Erro: "Database connection failed"

**Solução:**
1. Verifique se o banco foi criado no painel
2. Confirme que a DATABASE_URL está correta
3. Teste conexão via SSH:
   ```bash
   mysql -u seu_usuario -p nome_banco
   ```

---

### ❌ Erro: "502 Bad Gateway"

**Causa:** Aplicação não iniciou corretamente

**Solução:**
1. Verifique logs: Painel → **Logs**
2. Reinicie manualmente:
   ```bash
   cd ~/public_html
   touch tmp/restart.txt
   ```

---

## 📊 Estrutura do .domcloud.yml Explicada

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

## 💡 Dicas

1. **Sempre teste localmente antes de fazer push:**
   ```bash
   pnpm install
   pnpm build
   pnpm db:push
   pnpm start
   ```

2. **Use variáveis de ambiente sensíveis:**
   - Nunca commite senhas no código
   - Use sempre o `.domcloud.yml` para configurar

3. **Monitore os logs:**
   - Painel DOMcloud → Logs
   - Ajuda a identificar problemas rapidamente

4. **Backup do banco:**
   - Faça backups regulares via painel do DOMcloud
   - Exporte dados importantes periodicamente

---

## 🔗 Recursos Adicionais

- [Documentação DOMcloud](https://domcloud.co/docs)
- [Exemplos de .domcloud.yml](https://domcloud.co/docs/deployment/recipes)
- [Suporte DOMcloud](https://domcloud.co/support)

---

## ⚡ Comparação: Deploy Manual vs Automático

| Aspecto | Manual (SSH) | Automático (.domcloud.yml) |
|---------|--------------|----------------------------|
| **Configuração inicial** | Complexa | Simples |
| **Atualizações** | Comandos manuais | 1 clique |
| **Reprodutibilidade** | Difícil | Fácil |
| **Documentação** | Você mantém | Auto-documentado |
| **Erros** | Mais propenso | Menos propenso |

**Recomendação:** Use sempre o `.domcloud.yml` para deploy automatizado!

---

## 📞 Suporte

Se tiver problemas:
1. Verifique os logs no painel do DOMcloud
2. Consulte a documentação oficial
3. Entre em contato com suporte: support@domcloud.co

---

**Deploy automatizado configurado! 🎉**

Agora você pode atualizar seu projeto com apenas um `git push`!
