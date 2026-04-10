# Cadastro de Clientes

Aplicacao web simples para cadastro de responsaveis e desbravadores com `vanilla.js + Bootstrap`, integrada a API do Asaas por meio de um servidor local em Node.js.

Na v1.0, o frontend envia um registro completo para o backend local. O servidor salva uma copia em `data/registrations.json`, cria o cliente no Asaas e tenta gerar a assinatura recorrente com base na configuracao do ambiente.

## Funcionalidades

- Formulario responsivo com Bootstrap
- Layout customizado com identidade visual do projeto
- Cadastro dinamico de multiplos desbravadores
- Toggle para escolha do ambiente `desenvolvimento` ou `producao`
- Calculo automatico da mensalidade com regra compartilhada em `pricing-rules.js`
- Persistencia local do registro completo em JSON
- Criacao de cliente no Asaas
- Tentativa de criacao de assinatura recorrente no Asaas
- Feedback visual com SweetAlert2
- Bloqueio do botao de envio durante a requisicao
- Mascaras para CPF, CEP, telefone e celular
- Conversao automatica:
  - campos textuais em maiusculo
  - email em minusculo
  - telefone e celular enviados apenas com numeros
  - CPF enviado como texto com mascara

## Tecnologias

- HTML5
- CSS3
- Bootstrap 5
- JavaScript puro
- Node.js

## Estrutura

```text
.
|-- assets/
|   `-- logo-tsunami.png
|-- data/
|   `-- .gitkeep
|-- .env
|-- .env.example
|-- .gitignore
|-- app.js
|-- index.html
|-- pricing-rules.js
|-- server.js
|-- styles.css
`-- README.md
```

## Requisitos

- Node.js 18 ou superior

## Configuracao

1. Ajuste o arquivo `.env` com suas credenciais:

```env
PORT=3000
ASAAS_DEFAULT_ENVIRONMENT=development
ASAAS_DEVELOPMENT_API_BASE_URL=https://api-sandbox.asaas.com/v3
ASAAS_DEVELOPMENT_ACCESS_TOKEN=seu_token_de_desenvolvimento_aqui
ASAAS_DEVELOPMENT_USER_AGENT=dbv-tsunami-dev
ASAAS_PRODUCTION_API_BASE_URL=https://api.asaas.com/v3
ASAAS_PRODUCTION_ACCESS_TOKEN=seu_token_de_producao_aqui
ASAAS_PRODUCTION_USER_AGENT=dbv-tsunami-prod
ASAAS_SUBSCRIPTION_ENABLED=true
ASAAS_SUBSCRIPTION_BILLING_TYPE=BOLETO
ASAAS_SUBSCRIPTION_CYCLE=MONTHLY
ASAAS_SUBSCRIPTION_DUE_DAY=10
ASAAS_SUBSCRIPTION_DESCRIPTION_PREFIX=Clube Tsunami
ASAAS_SUBSCRIPTION_FIRST_DUE_DATE=
```

2. Se precisar recriar o arquivo de ambiente, use `.env.example` como base.

## Como executar

1. Inicie o servidor local:

```bash
node server.js
```

2. Abra no navegador:

```text
http://localhost:3000
```

## Como funciona o envio na v1.0

1. O usuario preenche o formulario em `index.html`.
2. O JavaScript em `app.js` aplica mascaras, normaliza os dados, monta o registro e calcula a mensalidade usando `pricing-rules.js`.
3. O usuario escolhe no formulario se o envio vai para `desenvolvimento` ou `producao`.
4. O frontend envia o payload para `http://localhost:3000/api/registrations`.
5. O `server.js` salva uma copia local do registro em `data/registrations.json`.
6. O backend seleciona a configuracao da API correspondente ao ambiente escolhido.
7. O servidor tenta criar o cliente no Asaas.
8. Se habilitado, o servidor tenta criar a assinatura recorrente no Asaas.
9. A interface informa se o fluxo foi concluido com sucesso ou com ressalvas.

## Endpoints locais

- `POST /api/registrations`: recebe o registro completo, salva localmente e integra com o Asaas
- `GET /api/registrations`: lista os registros salvos localmente
- `POST /api/customers`: mantido por compatibilidade com o proxy antigo

## Configuracao da assinatura

- `ASAAS_SUBSCRIPTION_ENABLED`: ativa ou desativa a tentativa de criar assinatura
- `ASAAS_SUBSCRIPTION_BILLING_TYPE`: tipo de cobranca da assinatura, como `BOLETO` ou `PIX`
- `ASAAS_SUBSCRIPTION_CYCLE`: ciclo da assinatura, por padrao `MONTHLY`
- `ASAAS_SUBSCRIPTION_DUE_DAY`: dia preferencial de vencimento para o calculo automatico da primeira cobranca
- `ASAAS_SUBSCRIPTION_DESCRIPTION_PREFIX`: prefixo usado na descricao enviada ao Asaas
- `ASAAS_SUBSCRIPTION_FIRST_DUE_DATE`: opcional, sobrescreve a data da primeira cobranca com `YYYY-MM-DD`

## Configuracao de ambientes

- `ASAAS_DEFAULT_ENVIRONMENT`: ambiente padrao usado quando a requisicao nao informa um ambiente
- `ASAAS_DEVELOPMENT_API_BASE_URL`: URL base da API de desenvolvimento
- `ASAAS_DEVELOPMENT_ACCESS_TOKEN`: token da API de desenvolvimento
- `ASAAS_DEVELOPMENT_USER_AGENT`: `User-Agent` do ambiente de desenvolvimento
- `ASAAS_PRODUCTION_API_BASE_URL`: URL base da API de producao
- `ASAAS_PRODUCTION_ACCESS_TOKEN`: token da API de producao
- `ASAAS_PRODUCTION_USER_AGENT`: `User-Agent` do ambiente de producao

## Regra de cobranca

- A regra usada pelo frontend e pelo backend fica centralizada em `pricing-rules.js`
- Na v1.0 atual, a configuracao vigente esta em uma faixa unica de `R$ 185,00`
- Quando voces definirem faixas por quantidade, basta atualizar esse arquivo para refletir a nova tabela

## Campos tratados no frontend

- `name`, `address`, `complement`, `province`, `observations`: enviados em maiusculo
- `email`: enviado em minusculo
- `cpfCnpj`: enviado como texto com mascara
- `phone` e `mobilePhone`: enviados apenas com numeros
- `postalCode`: mantem a mascara visual de CEP
- `adventurers`: enviados como lista estruturada

## Seguranca

- O token da API fica no `.env`, fora do frontend
- O arquivo `.env` esta ignorado no `.gitignore`
- Nao exponha `ASAAS_ACCESS_TOKEN` em `app.js` ou em HTML
- O arquivo `data/registrations.json` fica fora do versionamento

## Observacoes

- O projeto usa apenas recursos nativos do Node.js no backend, sem dependencias externas
- Se alterar o `.env`, reinicie o servidor para recarregar as variaveis
- Se o navegador apontar erro de CORS, verifique se a pagina esta sendo aberta por `http://localhost:3000` e nao por outro servidor estatico
- Se o Asaas falhar, o registro ainda fica salvo localmente para reprocessamento manual
