# Mapa de Migração Futura - localStorage para Supabase

Este documento não autoriza migration. Ele registra como os dados do sandbox deverão ser persistidos depois da Human Validation.

## Princípio

A implementação definitiva deve manter as mesmas transições homologadas no sandbox.

## Entidades atuais e destino sugerido

### Pré-solicitação

Sandbox: `PreRequest`

Destino sugerido: evolução de `public.camisa_solicitacoes`.

Campos a adicionar/revisar:

- protocolo;
- codigo oficial nullable;
- status_pre_solicitacao/status operacional;
- status financeiro;
- expira_em;
- pagamento_informado_em;
- cancelado_em;
- motivo_cancelamento;
- valor_unitario_snapshot;
- valor_total;
- pix_tipo_chave_snapshot;
- pix_chave_snapshot;
- pix_recebedor_snapshot;
- pix_cidade_snapshot;
- pix_payload_snapshot.

Regra: `codigo` oficial deve permanecer NULL antes da confirmação financeira.

### Itens

Sandbox: `PreRequestItem[]`

Destino: `public.camisa_solicitacao_itens`.

Os itens não devem participar de demanda, reserva, reposição ou entrega enquanto o pagamento não estiver confirmado.

### Pagamento

Sandbox: campos financeiros da PreRequest.

Destino sugerido: `public.camisa_pagamentos`.

Campos mínimos:

- id;
- solicitacao_id;
- status;
- valor;
- data_pix_informada;
- comprovante_path;
- comprovante_nome;
- comprovante_tipo;
- comprovante_tamanho;
- confirmado_por;
- confirmado_em;
- estornado_por;
- estornado_em;
- motivo/observacao;
- criado_em;
- atualizado_em.

Não haverá provider bancário, txid obrigatório, webhook ou conciliação automática.

### Histórico

Sandbox: `history[]`

Destino sugerido: `public.camisa_auditoria` ou `public.camisa_solicitacao_historico`.

Registrar:

- entidade;
- entidade_id;
- evento;
- status anterior;
- status novo;
- usuário/ator;
- observação;
- timestamp.

### E-mail

Sandbox: `emailEventsSent[]`.

Destino sugerido: `public.camisa_email_outbox`.

O definitivo precisa controlar:

- evento;
- destinatário;
- status;
- tentativas;
- enviado_em;
- ultimo_erro;
- correlation id.

## Expiração definitiva

No localStorage a expiração ocorre quando o app é aberto.

No Supabase deve existir processamento server-side agendado para:

1. localizar pré-solicitações `AGUARDANDO_PAGAMENTO` vencidas;
2. marcar `EXPIRADA` de forma idempotente;
3. registrar auditoria;
4. enfileirar e-mail de expiração.

## Estoque

Somente registros com:

- pagamento CONFIRMADO;
- solicitação CONFIRMADA;

podem entrar nas views/cálculos de:

- demanda;
- reserva;
- reposição;
- entrega.

## Migração

A migration só deve ser escrita depois da aprovação da Human Validation.

A ordem sugerida:

1. adicionar estados/colunas compatíveis;
2. criar tabela de pagamentos;
3. criar histórico;
4. criar outbox de e-mail;
5. criar novas RPCs;
6. atualizar views de demanda para filtrar apenas confirmados;
7. migrar frontend do adapter local para adapter Supabase;
8. validar homologação;
9. manter rollback.
