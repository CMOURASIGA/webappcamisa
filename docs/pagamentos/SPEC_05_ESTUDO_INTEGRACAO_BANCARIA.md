# SPEC 05 - Estudo e Decisão da Integração Bancária

## Objetivo

Definir com segurança como o `webappcamisa` receberá confirmação automática de pagamentos PIX, sem assumir antecipadamente que Nubank será a integração definitiva.

## Questão principal

Precisamos responder:

> Qual solução permite gerar ou identificar uma cobrança PIX por pedido e confirmar automaticamente o recebimento, com custo, segurança e manutenção compatíveis com o projeto?

## Alternativas a avaliar

### Alternativa 1 - Nubank diretamente

Validar se a conta utilizada pelo projeto possui acesso oficial e suportado a recursos/API suficientes para:

- Criar cobrança PIX com identificador único.
- Consultar cobrança.
- Receber confirmação automática/webhook ou mecanismo oficial equivalente.
- Consultar transações para conciliação.
- Trabalhar com autenticação segura e credenciais próprias de aplicação.
- Operar dentro das regras da conta utilizada.

Não utilizar APIs não oficiais, automação de aplicativo, scraping, engenharia reversa ou login bancário automatizado.

### Alternativa 2 - PSP/Gateway PIX

Avaliar provedores com API oficial de cobrança PIX e webhook.

Critérios:

- Custo fixo.
- Custo por transação.
- Existência de plano gratuito ou baixo custo.
- API oficial e documentada.
- Webhook.
- PIX dinâmico.
- Geração de QR Code/Pix Copia e Cola.
- Idempotência.
- Ambiente sandbox.
- Facilidade de uso com Supabase Edge Functions/Vercel.
- LGPD e segurança.
- Qualidade da documentação.
- Suporte a pessoa física/jurídica conforme conta disponível.

### Alternativa 3 - PIX manual com conciliação administrativa

Caso nenhuma integração automática seja adequada no momento:

- Manter chave PIX.
- Exigir comprovante.
- Criar fila de validação administrativa.
- Registrar quem aprovou o pagamento e quando.
- Preservar arquitetura de provider para futura automação.

## Matriz de decisão

O estudo deve produzir uma tabela comparativa com pelo menos:

| Critério | Nubank direto | PSP A | PSP B | Manual |
|---|---:|---:|---:|---:|
| API oficial | | | | N/A |
| PIX dinâmico | | | | Não |
| Webhook | | | | Não |
| Sandbox | | | | N/A |
| Custo mensal | | | | 0 |
| Custo por cobrança | | | | 0 |
| Complexidade técnica | | | | Baixa |
| Segurança | | | | |
| Conciliação automática | | | | Não |
| Adequação ao projeto | | | | |

## Requisitos técnicos obrigatórios para solução automática

- API oficial.
- HTTPS.
- Credenciais exclusivamente server-side.
- Webhook autenticado/validável quando disponível.
- Idempotência no processamento de eventos.
- Registro de payload mínimo necessário para auditoria.
- Nenhum dado sensível bancário no frontend.
- Nenhuma senha de internet banking armazenada no projeto.
- Retry controlado.
- Proteção contra evento duplicado.
- Associação inequívoca entre pagamento e solicitação.

## Estratégia de identificação

Preferência:

```text
1 pedido = 1 cobrança = 1 identificador/txid único
```

Não usar apenas valor como forma de identificar pagamento, pois dois usuários podem pagar o mesmo valor.

## Webhook

Quando suportado, o fluxo esperado é:

```text
Provider
   |
   +--> webhook server-side
            |
            +--> valida autenticidade
            +--> valida idempotência
            +--> localiza pagamento por provider_payment_id/txid
            +--> valida valor
            +--> atualiza camisa_pagamentos
            +--> atualiza estado do pedido conforme regra
            +--> registra auditoria
```

## Plano B de conciliação

Mesmo com webhook, estudar uma rotina de reconciliação periódica para pagamentos pendentes caso um evento seja perdido.

A reconciliação não pode marcar pagamento como pago apenas por coincidência de valor. Deve utilizar identificador oficial da cobrança/transação sempre que disponível.

## Decisão requerida antes da implementação

Ao finalizar esta SPEC, registrar em `DECISAO_PROVIDER_PAGAMENTO.md`:

- Provider escolhido.
- Motivo.
- Custos.
- Pré-requisitos de conta.
- Credenciais necessárias.
- Fluxo de homologação.
- Limitações.
- Plano de contingência.

## Bloqueio

Não implementar integração real com Nubank ou outro banco/provider antes dessa decisão.

O objetivo é evitar acoplamento prematuro, uso de API não suportada ou necessidade de reescrever o checkout depois.
