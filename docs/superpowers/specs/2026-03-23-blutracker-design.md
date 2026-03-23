# Blutracker — Design Spec

## Visao Geral

Blutracker e uma plataforma que recebe webhooks de pedidos da Bluvesales e envia eventos de conversao (Purchase) para a Meta Conversions API for Business Messaging (CAPI), atribuindo vendas a campanhas CTWA (Click-to-WhatsApp). Inclui um dashboard para acompanhamento de metricas.

## Problema

Campanhas CTWA geram vendas via WhatsApp, mas sem um sistema que envie eventos de conversao ao Meta, nao ha como medir ROI, otimizar campanhas ou atribuir vendas aos anuncios que as geraram.

## Solucao

Sistema que:
1. Gerencia multiplos numeros WhatsApp API Oficial (WABA ID, Phone Number ID, Token, Dataset ID)
2. Recebe webhooks da Bluvesales a cada pedido criado
3. Envia eventos Purchase para o Meta via CAPI Business Messaging
4. Exibe metricas em um dashboard proprio

## Arquitetura

Monolito Next.js fullstack deployado na Vercel com Vercel Postgres (Neon).

```
Bluvesales                    Blutracker (Vercel)                   Meta
    |                              |                                  |
    | POST /api/webhooks/          |                                  |
    |   bluvesales?numberId=xxx    |                                  |
    |----------------------------->|                                  |
    |                              | 1. Valida secret + payload       |
    |                              | 2. Busca config do numero        |
    |                              |    (datasetId, accessToken)      |
    |                              | 3. Salva Event (status: PENDING) |
    |                              |                                  |
    |<---- 200 OK ----------------|                                  |
    |                              |                                  |
    |                              | 4. Normaliza + hash SHA256      |
    |                              |    (phone, email, name, cpf...)  |
    |                              | 5. Monta payload CAPI            |
    |                              | 6. POST graph.facebook.com      |
    |                              |    /{version}/{datasetId}/events |
    |                              |    (timeout: 8s)                 |
    |                              |--------------------------------->|
    |                              |                                  |
    |                              |<--------- response --------------|
    |                              |                                  |
    |                              | 7. Atualiza Event                |
    |                              |    (SENT ou FAILED)              |
```

## Stack Tecnologica

| Componente | Tecnologia |
|---|---|
| Framework | Next.js 14 (App Router, TypeScript) |
| Banco de dados | PostgreSQL (Vercel Postgres / Neon) |
| ORM | Prisma |
| Autenticacao | NextAuth.js |
| UI | Tailwind CSS + shadcn/ui |
| Deploy | Vercel |

## Modelo de Dados

### WhatsAppNumber

| Campo | Tipo | Descricao |
|---|---|---|
| id | String (cuid) | PK |
| name | String | Apelido do numero (ex: "Reduza Principal") |
| wabaId | String | WhatsApp Business Account ID |
| phoneNumberId | String | Phone Number ID da API Oficial |
| accessToken | String (encrypted) | Token de acesso (AES-256) |
| datasetId | String | Dataset ID no Events Manager (mensagens) |
| webhookSecret | String | Secret UUID v4 para autenticacao do webhook |
| isActive | Boolean | Se o numero esta ativo |
| createdAt | DateTime | Data de criacao |
| updatedAt | DateTime | Data de atualizacao |

### Event

| Campo | Tipo | Descricao |
|---|---|---|
| id | String (cuid) | PK |
| whatsappNumberId | String (FK) | Numero que processou o evento |
| type | Enum (PURCHASE) | Tipo do evento (extensivel para LEAD no futuro) |
| status | Enum (PENDING, SENT, FAILED) | Status do envio ao Meta |
| retryCount | Int (default: 0) | Numero de tentativas de envio |
| orderId | String | ID do pedido na Bluvesales (BLV-XXXX) |
| customerPhone | String | Telefone do cliente |
| customerEmail | String? | Email do cliente |
| customerName | String | Nome do cliente |
| productName | String | Nome do produto |
| value | Decimal | Valor da venda (R$) |
| currency | String | Moeda (default: BRL) |
| metaResponse | Json? | Resposta do Meta (para debug) |
| errorMessage | String? | Mensagem de erro se FAILED |
| sentAt | DateTime? | Quando foi enviado ao Meta |
| createdAt | DateTime | Data de criacao |

## Webhook — Endpoint e Fluxo

### Endpoint

```
POST /api/webhooks/bluvesales?numberId={whatsappNumberId}
Header: X-Webhook-Secret: {webhookSecret}
```

Cada numero cadastrado gera uma URL unica de webhook com um `secret` aleatorio (UUID v4). O usuario configura essa URL e o header `X-Webhook-Secret` na Bluvesales como destino do postback. O `secret` e validado server-side a cada request — requests com secret invalido sao rejeitados com 401.

### Resposta do webhook

| Status | Body | Quando |
|---|---|---|
| 200 OK | `{ "status": "received", "eventId": "..." }` | Evento aceito e salvo |
| 200 OK | `{ "status": "duplicate" }` | Pedido ja processado (idempotente) |
| 401 Unauthorized | `{ "error": "Invalid secret" }` | Secret invalido |
| 400 Bad Request | `{ "error": "..." }` | Payload invalido ou campos obrigatorios faltando |

### Payload esperado (Bluvesales)

```json
{
  "event": "ORDER_CREATE",
  "order": {
    "id": "BLV-XXXX",
    "internal_id": 123,
    "status": "cadastrados",
    "created_at": "2026-03-22T10:30:00-03:00"
  },
  "customer": {
    "name": "Joao Silva",
    "document": "123.456.789-00",
    "email": "joao@email.com",
    "phone": "11999999999",
    "address": {
      "street": "Rua X",
      "number": "100",
      "complement": null,
      "neighborhood": "Centro",
      "city": "Sao Paulo",
      "state": "SP",
      "zipcode": "01000-000",
      "country": "BR"
    }
  },
  "product": {
    "name": "Reduza",
    "plan": "6 Meses",
    "price": 697.00
  },
  "seller": {
    "name": "Caio"
  }
}
```

### Validacao

1. Verifica se header `X-Webhook-Secret` e valido para o `numberId` (autenticacao do webhook)
2. Verifica se `numberId` existe e esta ativo
3. Verifica se `event` === `"ORDER_CREATE"`
4. Verifica campos obrigatorios: `customer.phone`, `product.price`, `order.id`
5. Rejeita duplicatas pelo `order.id` (constraint unica `(whatsappNumberId, orderId)` no banco)

## Meta CAPI — Estrutura do Evento

### Endpoint Meta

```
POST https://graph.facebook.com/{META_API_VERSION}/{DATASET_ID}/events
Authorization: Bearer {ACCESS_TOKEN}
```

### Payload enviado ao Meta

```json
{
  "data": [
    {
      "event_name": "Purchase",
      "event_time": 1711104600,
      "event_id": "BLV-XXXX",
      "action_source": "business_messaging",
      "messaging_channel": "whatsapp",
      "user_data": {
        "ph": ["SHA256(5511999999999)"],
        "em": ["SHA256(joao@email.com)"],
        "fn": ["SHA256(joao)"],
        "ln": ["SHA256(silva)"],
        "ct": ["SHA256(saopaulo)"],
        "st": ["SHA256(sp)"],
        "zp": ["SHA256(01000000)"],
        "country": ["SHA256(br)"],
        "external_id": ["SHA256(12345678900)"]
      },
      "custom_data": {
        "value": 697.00,
        "currency": "BRL",
        "content_name": "Reduza - 6 Meses",
        "content_type": "product",
        "order_id": "BLV-XXXX"
      }
    }
  ],
}
```

### Normalizacao antes do hash (exigencia Meta)

| Campo | Normalizacao |
|---|---|
| phone | Remover tudo exceto digitos; se nao comecar com "55", adicionar; validar 12-13 digitos (55 + DDD + numero) |
| email | Lowercase, trim |
| name (fn/ln) | Lowercase, trim, split por primeiro espaco |
| document (cpf) | Remover pontos e tracos |
| city | Lowercase, remover acentos, remover espacos |
| state | Lowercase |
| zipcode | Remover traco |
| country | Lowercase (br) |

Apos normalizar, aplicar SHA256 em cada valor.

### Deduplicacao

O `event_id` usa o `order.id` da Bluvesales. Se o webhook disparar duplicado, o Meta ignora eventos com mesmo `event_id` na mesma janela de tempo.

No banco, constraint unica em `(whatsappNumberId, orderId)` garante deduplicacao mesmo em requests concorrentes. Violacao da constraint retorna 200 OK (idempotente).

### Retry de eventos FAILED

- Vercel Cron Job roda a cada 15 minutos, busca eventos FAILED/PENDING com `retryCount < 3`
- Elegibilidade por `retryCount`: retry 1 apos 15min, retry 2 apos 30min, retry 3 apos 45min (baseado em `updatedAt`)
- Apos 3 falhas, marca como permanentemente falho (reenvio apenas manual via dashboard)
- Botao de reenvio manual no dashboard reseta o `retryCount` e tenta novamente

### Versao da Graph API

A versao da Graph API (`v21.0`) e definida como variavel de ambiente (`META_API_VERSION`), permitindo atualizar sem redeploy de codigo. Verificar compatibilidade a cada release do Meta (a cada ~3 meses).

## Dashboard — Telas

### 1. Visao Geral (/)

- Cards: total eventos (hoje/7d/30d), valor total vendas, taxa de sucesso
- Grafico de linha: eventos por dia (ultimos 30 dias)
- Grafico de pizza: eventos por numero

### 2. Numeros WhatsApp (/numbers)

- Tabela com numeros cadastrados
- Colunas: nome, WABA ID, Phone Number ID, Dataset ID, status, acoes
- Cada numero mostra sua URL de webhook (copiar com 1 clique)
- Modal para adicionar/editar numero
- Botao para ativar/desativar

### 3. Eventos (/events)

- Tabela paginada com todos os eventos
- Colunas: data, numero, cliente, telefone, produto, valor, status
- Filtros: por numero, por status (SENT/FAILED), por periodo
- Botao de reenvio para eventos FAILED
- Detalhe do evento ao clicar (payload enviado + resposta Meta)

### 4. Configuracoes (/settings)

- Dados da conta (email, senha)

## Seguranca

- **Access Tokens** armazenados com criptografia AES-256-GCM (IV aleatorio por registro, chave em env var `ENCRYPTION_KEY`)
- **Webhook endpoint** autenticado via header `X-Webhook-Secret` (UUID v4 por numero)
- **Autenticacao** via NextAuth.js (login com email/senha)
- **HTTPS** garantido pela Vercel
- **Environment variables** para chaves de criptografia e secrets
- **Meta API Token** enviado via header `Authorization: Bearer` (nao no body)

## Banco de Dados — Indices

- `Event(whatsappNumberId, createdAt)` — queries do dashboard por periodo
- `Event(status)` — busca de eventos FAILED para retry
- `Event(whatsappNumberId, orderId)` — constraint unica para deduplicacao

## Timezone

Todas as datas no dashboard usam `America/Sao_Paulo` (UTC-3). O `event_time` enviado ao Meta usa o timestamp Unix derivado de `order.created_at` do payload.

## Decisoes de Design

1. **Monolito Next.js** — simplicidade sobre microservicos; volume inicial nao justifica fila ou separacao
2. **Sem `ctwa_clid`** — atribuicao por match de dados do usuario (phone, email, name, cpf, address); match rate alto pela riqueza de dados no payload
3. **Um usuario** — sem multi-tenancy por agora; dados ja vinculados a uma "conta" logica para facilitar evolucao futura
4. **`action_source: "business_messaging"`** — otimiza para conversoes por mensagem (CTWA), nao para compras em site
5. **Dataset por numero configuravel** — flexibilidade para agrupar ou separar metricas por numero/pixel
6. **URL de webhook por numero** — roteamento explicito via query param `numberId`, sem ambiguidade

## Fora de Escopo (v1)

- Multi-tenancy / SaaS
- Eventos alem de Purchase (Lead, AddToCart, etc.)
- Integracao direta com WhatsApp Cloud API (envio de mensagens)
- Captura de `ctwa_clid`
- Relatorios avancados / exportacao
- App mobile
