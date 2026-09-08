# SPEC 06 a 08 - Conciliação, Dashboard Financeiro e Migração

## SPEC 06 - Conciliação automática

### Objetivo

Automatizar a confirmação financeira quando houver provider oficial escolhido.

### Requisitos

- Endpoint server-side para webhook.
- Validação de autenticidade do evento.
- Idempotência.
- Registro de evento recebido.
- Associação por `provider_payment_id` e/ou `txid`.
- Validação de valor.
- Mudança de status controlada.
- Retry seguro.
- Rotina de reconciliação para pagamentos pendentes.
- Auditoria completa de alterações.

### Regras

- Evento duplicado não pode duplicar pagamento.
- Valor divergente não pode confirmar automaticamente.
- Pagamento sem pedido correspondente deve ir para fila de divergência.
- Pedido cancelado com pagamento recebido deve ser sinalizado para tratamento administrativo.

## SPEC 07 - Dashboard financeiro

### Objetivo

Dar visibilidade operacional e financeira sobre os pedidos.

### Indicadores mínimos

- Total recebido.
- Total pendente.
- Total em análise.
- Total com divergência.
- Pedidos pagos.
- Pedidos aguardando pagamento.
- Pagamentos confirmados automaticamente.
- Pagamentos aprovados manualmente.

### Lista de pagamentos

Exibir:

- Código do pedido.
- Solicitante.
- Beneficiário.
- Valor.
- Status do pagamento.
- Provider.
- Identificador/txid.
- Data de criação.
- Data de pagamento.
- Origem da confirmação.
- Ação para visualizar comprovante quando existir.

### Filtros

- Status.
- Período.
- Solicitante.
- Beneficiário.
- Provider.
- Origem da confirmação.

### Operação administrativa

Quando o fluxo manual estiver habilitado:

- Aprovar comprovante.
- Rejeitar comprovante.
- Informar motivo.
- Registrar usuário e data da ação.
- Nunca apagar o histórico anterior.

## SPEC 08 - Migração, auditoria e fechamento

### Objetivo

Migrar o sistema existente sem perder pedidos, comprovantes ou histórico.

### Migração

- Criar `camisa_pagamentos` sem remover campos antigos imediatamente.
- Para pedidos históricos com comprovante, criar pagamento histórico correspondente quando aplicável.
- Para pedidos sem comprovante, classificar como inconsistência histórica e não inventar status PAGO.
- Manter compatibilidade com dashboard durante transição.
- Após validação, definir se campos antigos de comprovante serão descontinuados.

### Auditoria

Registrar no mínimo:

- mudança de status;
- usuário responsável;
- origem automática/manual;
- data/hora;
- motivo de rejeição/divergência;
- identificador externo quando existir.

### Testes obrigatórios

1. Pedido sem comprovante no modo manual deve falhar ou permanecer sem confirmação financeira, conforme desenho final.
2. Pedido com comprovante válido deve entrar em análise.
3. Comprovante rejeitado deve preservar histórico.
4. Pagamento automático válido deve marcar PAGO uma única vez.
5. Webhook duplicado deve ser idempotente.
6. Valor divergente deve gerar DIVERGENCIA.
7. Pedido pago deve liberar fluxo de entrega apenas conforme regra definida.
8. Manipulação do frontend não pode burlar validação server-side.
9. Arquivo acima do limite deve ser rejeitado.
10. Credenciais privadas não podem aparecer no bundle Vite.

### Encerramento

Antes de merge em `main`, produzir:

- `RESULTADO_SPEC_01.md`.
- `DECISAO_PROVIDER_PAGAMENTO.md`.
- evidência de migrations aplicadas em homologação;
- checklist de testes;
- plano de rollback;
- validação funcional do fluxo manual;
- validação funcional do fluxo automático, caso já implementado.
