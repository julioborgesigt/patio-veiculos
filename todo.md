# Sistema de Gerenciamento de Pátio de Veículos - TODO

## Funcionalidades Principais

- [x] Esquema do banco de dados para veículos
- [x] API tRPC para CRUD de veículos
- [x] Validação de formato de procedimento (xxx-xxxxx/ano)
- [x] Validação de formato de processo (xxxxxxx-xx.xxxx.x.xx.xxxx)
- [x] Suporte a duas placas por veículo (original e ostentada)
- [x] Campo de observações com limite de 200 caracteres
- [x] Status de devolução (devolvido/não devolvido)
- [x] Status de perícia (pendente/sem perícia/feita)
- [x] Dashboard com estatísticas (total no pátio, devolvidos, perícias pendentes)
- [x] Listagem de veículos em tabela com paginação
- [x] Ordenação por colunas na tabela
- [x] Busca avançada por placa, processo, procedimento, data cadastro, data devolução
- [x] Filtros: veículos no pátio, devolvidos, aguardando perícia
- [x] Formulário de cadastro de veículo
- [x] Funcionalidade de edição de veículo
- [x] Funcionalidade de exclusão de veículo
- [x] Exportação para CSV
- [x] Exportação para Excel
- [x] Interface responsiva para dispositivos móveis
- [x] Design cinematográfico com gradiente azul petróleo e laranja queimado
- [x] Tipografia sans-serif branca em negrito
- [x] Acentos geométricos em ciano e laranja
- [x] Testes unitários para as rotas principais

## Novas Funcionalidades

- [ ] Integração com API de consulta de placas (API Placas)
- [ ] Auto-preenchimento de dados do veículo pela placa
- [ ] Botão de busca no formulário de cadastro
- [ ] Tratamento de erros da API
- [x] Testes da nova funcionalidade

## Integração API Consulta de Placas (Experimental)

- [x] Adicionar campos de características do veículo no banco (marca, modelo, ano, cor, combustível)
- [x] Instalar pacote sinesp-api
- [x] Criar serviço de consulta de placas no backend
- [x] Adicionar rota tRPC para consulta de placa
- [x] Atualizar formulário com novos campos
- [x] Implementar botão de busca automática
- [x] Tratamento de erros e fallback manual
- [x] Testes da nova funcionalidade
