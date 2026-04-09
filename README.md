# Cadastro de Clientes

Aplicacao web simples para cadastro de clientes com `vanilla.js + Bootstrap`, integrada a API do Asaas por meio de um servidor local em Node.js.

O frontend envia os dados para um proxy local, e o proxy repassa a requisicao para `https://api.asaas.com/v3/customers`. Isso evita problemas de CORS no navegador e protege o token da API no backend local.

## Funcionalidades

- Formulario responsivo com Bootstrap
- Layout customizado com identidade visual do projeto
- Envio de cadastro para o Asaas
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
|-- .env
|-- .env.example
|-- .gitignore
|-- app.js
|-- index.html
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
ASAAS_ACCESS_TOKEN=seu_token_asaas_aqui
ASAAS_USER_AGENT=dbv-tsunami
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

## Como funciona o envio

1. O usuario preenche o formulario em `index.html`.
2. O JavaScript em `app.js` aplica mascaras, normaliza os dados e monta o payload.
3. O frontend envia o payload para `http://localhost:3000/api/customers`.
4. O `server.js` adiciona os headers obrigatorios:

```http
Content-Type: application/json
User-Agent: nome_da_sua_aplicacao
access_token: sua_api_key
```

5. O servidor local repassa a requisicao para a API do Asaas.

## Campos tratados no frontend

- `name`, `address`, `complement`, `province`, `observations`: enviados em maiusculo
- `email`: enviado em minusculo
- `cpfCnpj`: enviado como texto com mascara
- `phone` e `mobilePhone`: enviados apenas com numeros
- `postalCode`: mantem a mascara visual de CEP

## Seguranca

- O token da API fica no `.env`, fora do frontend
- O arquivo `.env` esta ignorado no `.gitignore`
- Nao exponha `ASAAS_ACCESS_TOKEN` em `app.js` ou em HTML

## Observacoes

- O projeto usa apenas recursos nativos do Node.js no backend, sem dependencias externas
- Se alterar o `.env`, reinicie o servidor para recarregar as variaveis
- Se o navegador apontar erro de CORS, verifique se a pagina esta sendo aberta por `http://localhost:3000` e nao por outro servidor estatico
