# Frente de Pagamentos e Integração Bancária

## Objetivo

Evoluir o módulo de camisas para separar corretamente pedido, pagamento e entrega, garantir que nenhum pedido seja tratado como pago sem evidência válida e preparar o sistema para uma futura integração bancária, inicialmente estudando Nubank sem acoplamento definitivo ao banco.

## Princípio central

O sistema não deve considerar comprovante e pagamento como a mesma coisa.

- Comprovante = evidência enviada pelo usuário.
- Pagamento = evento financeiro confirmado por regra do sistema ou por instituição/provedor.
- Pedido = solicitação comercial/operacional.
- Entrega = evento logístico independente.

## Situação atual identificada

Na branch `main`, o comprovante já é exigido em duas camadas:

1. Frontend em `src/components/Form.tsx`.
2. Backend na função SQL de registro de solicitação em `supabase/camisas_module.sql`.

Mesmo assim foi observado ao menos um caso de pedido registrado sem comprovante aparente. Isso precisa ser auditado antes de qualquer mudança estrutural.

Hipóteses a validar:

- Deploy em produção diferente da `main` atual.
- Função/RPC antiga ainda ativa no Supabase.
- Fluxo legado de Google Apps Script.
- Inserção direta ou operação administrativa.
- Registro criado antes da regra atual.
- Comprovante existente no storage, mas não exibido corretamente no dashboard.

## Arquitetura alvo

```text
Pedido
  |
  +--> Pagamento
  |      |
  |      +--> Provider PIX/Bancário
  |      |      +--> Nubank, se tecnicamente viável
  |      |      +--> outro PSP, se necessário
  |      |
  |      +--> Comprovante manual como contingência
  |
  +--> Estoque
  |
  +--> Entrega
```

## Regra de negócio obrigatória

Um pedido só pode avançar para condição financeira válida quando ocorrer uma das duas situações:

1. Pagamento confirmado automaticamente pelo provedor/banco.
2. Comprovante enviado e posteriormente validado conforme regra definida.

Se não houver pagamento confirmado e não houver comprovante válido, o pedido não pode ser tratado como pago nem liberado para entrega.

## Status separados

### Pedido

- AGUARDANDO_PAGAMENTO
- CONFIRMADO
- CANCELADO
- CONCLUIDO

### Pagamento

- PENDENTE
- COMPROVANTE_ENVIADO
- EM_ANALISE
- PAGO
- EXPIRADO
- CANCELADO
- ESTORNADO
- DIVERGENCIA

### Entrega

- NAO_LIBERADA
- PENDENTE
- PARCIAL
- ENTREGUE
- CANCELADA

## Modelo sugerido

Criar uma entidade específica para pagamentos, sem remover inicialmente os campos existentes de comprovante para preservar compatibilidade.

Tabela sugerida: `camisa_pagamentos`

Campos mínimos:

- id
- solicitacao_id
- provider
- provider_payment_id
- txid
- valor
- status
- pix_copia_cola
- qr_code_payload
- qr_code_url, se aplicável
- criado_em
- atualizado_em
- expira_em
- pago_em
- comprovante_path
- comprovante_nome
- comprovante_tipo
- comprovante_tamanho
- origem_confirmacao
- confirmado_por
- confirmado_em
- observacoes

## Provider de pagamento

A aplicação não deve implementar regras de negócio diretamente acopladas ao Nubank.

Criar conceito de provider/adaptador de pagamento com operações equivalentes a:

- criarCobranca()
- consultarCobranca()
- cancelarCobranca()
- processarWebhook()
- reconciliarPagamento()

Implementações possíveis:

- NubankProvider
- PixManualProvider
- FuturoPSPProvider

A escolha do provider definitivo depende do estudo técnico e comercial descrito em `SPEC_05_ESTUDO_INTEGRACAO_BANCARIA.md`.

## Configuração

Dados bancários não devem permanecer exclusivamente em variáveis públicas do frontend.

Criar configuração administrativa para:

- Instituição/provedor.
- Chave PIX.
- Nome do recebedor.
- CPF/CNPJ, quando necessário.
- Modo de cobrança.
- Integração automática ativa/inativa.
- Permissão de uso de comprovante manual.

Credenciais privadas de API nunca podem ser expostas em `VITE_*`.

## Dashboard

Criar uma área de pagamentos com no mínimo:

- Total recebido.
- Total pendente.
- Total em análise.
- Quantidade de pedidos pagos.
- Quantidade de pedidos pendentes.
- Divergências.
- Lista de pagamentos por pedido.
- Link para comprovante.
- Origem da confirmação.
- Data de pagamento.

## Sequência de execução

1. SPEC 01 - Auditoria do fluxo atual.
2. SPEC 02 - Modelo de pagamentos e status.
3. SPEC 03 - Segurança e obrigatoriedade do comprovante.
4. SPEC 04 - Novo checkout PIX e experiência do usuário.
5. SPEC 05 - Estudo de integração bancária e decisão do provider.
6. SPEC 06 - Conciliação automática e webhooks.
7. SPEC 07 - Dashboard financeiro.
8. SPEC 08 - Migração, auditoria e fechamento.

## Regra para desenvolvimento

Nenhuma integração bancária real deve ser implementada antes da conclusão e aprovação da SPEC 05.

As SPECs 01 a 04 podem ser desenvolvidas independentemente do banco escolhido, pois tratam de consistência de dados, segurança, estados e experiência de pagamento.
