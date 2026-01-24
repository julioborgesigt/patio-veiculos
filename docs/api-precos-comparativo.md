# Comparativo de APIs de Consulta de Placas Veiculares

## Opções Pesquisadas

### 1. API Placas (apiplacas.com.br)
- **Preço**: R$ 0,03 por consulta
- **Mínimo**: 10.000 consultas = R$ 300,00
- **Dados**: Marca, modelo, ano, cor, chassi, UF, município, situação, valor FIPE
- **Avaliação**: Muito caro para baixa demanda

### 2. Consultar Placa (consultarplaca.com.br)
- **Preço Consultas Básicas**:
  - 1 a 1.000 consultas: R$ 0,25/consulta (com desconto: R$ 0,25)
  - 1.001 a 5.000: R$ 0,20/consulta
  - 5.001 a 10.000: R$ 0,15/consulta
  - 10.001 a 20.000: R$ 0,12/consulta
- **Mínimo estimado**: ~R$ 250 para 1.000 consultas
- **Dados**: Dados básicos + histórico completo, RENAINF, roubo/furto, leilão, FIPE
- **Avaliação**: Muito completo mas caro para baixa demanda

### 3. SINESP-API (npm package)
- **Preço**: Gratuito (open source)
- **Status**: INSTÁVEL - Issues reportam erros 404 e limite de consulta
- **Última atualização**: 2020 (6 anos atrás)
- **Usa**: API-Carros como backend
- **Dados**: Marca, modelo, ano, cor, chassi, UF, município, situação
- **Avaliação**: Gratuito mas instável/não confiável

### 4. Brasil API (brasilapi.com.br)
- **Status**: Não foi possível verificar (site com proteção)
- **Histórico**: Tinha limite gratuito

## Conclusão

Para uso com baixa demanda (até R$ 10/mês), as opções são limitadas:

1. **Opção Gratuita (Instável)**: sinesp-api - pode funcionar mas não é confiável
2. **Opção Manual**: Usuário preenche os dados manualmente
3. **Opção Híbrida**: Implementar busca com sinesp-api como tentativa, com fallback para preenchimento manual

## Recomendação

Implementar uma solução híbrida:
1. Tentar consulta gratuita via sinesp-api
2. Se falhar, mostrar mensagem e permitir preenchimento manual
3. Futuramente, se o usuário quiser, pode contratar uma API paga
