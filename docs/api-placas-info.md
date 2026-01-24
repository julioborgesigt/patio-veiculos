# Informações sobre API de Consulta de Placas

## API Placas (apiplacas.com.br)

### Descrição
A API Placas fornece dados e informações sobre veículos emplacados no Brasil através da placa do veículo. Base de dados com mais de 300 milhões de registros.

### Endpoint
```
GET https://wdapi2.com.br/consulta/{placa}/{token}
```

### Formato da Placa
- Formato Mercosul: AAA0X00 (ex: INT8C36)
- Formato Antigo: AAA9999 (ex: ABC1234)

### Dados Retornados
- **Marca**: Fabricante do veículo
- **Modelo**: Modelo do veículo
- **Ano**: Ano de fabricação
- **Ano Modelo**: Ano do modelo
- **Cor**: Cor do veículo
- **Chassi**: Número do chassi (parcialmente mascarado)
- **UF**: Estado de registro
- **Município**: Cidade de registro
- **Situação**: Status do veículo (restrições)
- **Origem**: Nacional/Importado

### Dados Extras (quando disponíveis)
- Cilindradas
- Combustível
- Tipo de veículo
- Quantidade de passageiros
- Peso bruto total
- Espécie
- Carroceria
- Nacionalidade

### Dados FIPE (quando disponíveis)
- Código FIPE
- Valor de mercado
- Referência

### Preços
- R$ 0,03 por consulta
- Mínimo: 10.000 consultas = R$ 300,00

### Códigos de Retorno
| Código | Descrição |
|--------|-----------|
| 200 | Sucesso |
| 400 | URL incorreta |
| 401 | Placa inválida |
| 402 | Token inválido |
| 406 | Sem resultados |
| 429 | Limite de consultas atingido |

### Exemplo de Resposta JSON
```json
{
  "MARCA": "VW",
  "MODELO": "CROSSFOX",
  "ano": "2007",
  "anoModelo": "2007",
  "chassi": "*****10137",
  "cor": "Prata",
  "municipio": "São Leopoldo",
  "origem": "NACIONAL",
  "placa": "INT8C36",
  "situacao": "Sem restrição",
  "uf": "RS",
  "extra": {
    "cilindradas": "1599",
    "combustivel": "Alcool / Gasolina",
    "tipo_veiculo": "Automovel",
    "quantidade_passageiro": "5"
  },
  "fipe": {
    "dados": [{
      "texto_valor": "R$ 28.799,00",
      "codigo_fipe": "005225-6"
    }]
  }
}
```

## Implementação Sugerida

1. Usuário digita a placa no formulário
2. Ao sair do campo ou clicar em "Buscar", sistema consulta a API
3. Campos são preenchidos automaticamente com os dados retornados
4. Usuário pode editar os dados antes de salvar

## Requisitos
- Token de API (obtido após cadastro e pagamento)
- Configuração de variável de ambiente para o token
