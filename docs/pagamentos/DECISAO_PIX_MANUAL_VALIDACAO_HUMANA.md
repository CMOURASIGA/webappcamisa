# Decisão de Arquitetura - PIX manual com validação humana

## Status

APROVADO para a branch `feature/pre-solicitacao-pix-manual-local`.

## Decisão

O webappcamisa não terá integração bancária automática.

Não haverá:

- consulta automática a banco;
- API bancária;
- webhook de instituição financeira;
- conciliação automática;
- confirmação automática de PIX.

A autoridade para confirmar um pagamento será sempre uma pessoa autorizada na tela do Financeiro.

## Geração do PIX

O sistema pode gerar PIX Copia e Cola e, posteriormente, QR Code a partir de configuração própria.

Isso não representa integração bancária.

A configuração contém:

- tipo da chave;
- chave PIX;
- nome do recebedor;
- cidade;
- valor unitário da camisa;
- prazo da pré-solicitação.

O sistema gera o payload BR Code localmente.

## Fluxo aprovado

1. Usuário cria pré-solicitação sem necessidade de pagamento.
2. Sistema gera protocolo `REC-AAAA-NNNNNN`.
3. Sistema informa de forma explícita que ainda não existe pedido confirmado.
4. Sistema informa prazo para pagamento.
5. Sistema apresenta PIX Copia e Cola calculado pelo valor da pré-solicitação.
6. Usuário pode pagar ou cancelar.
7. Se pagar, informa o pagamento e envia comprovante.
8. Financeiro verifica manualmente o recebimento.
9. Somente após confirmação humana o sistema gera o pedido oficial.
10. Somente o pedido confirmado participa de estoque, reposição e entrega.

## Cancelamento

### Antes de informar pagamento

A pré-solicitação pode ser cancelada diretamente.

Não existe obrigação financeira.

### Após informar pagamento e antes da confirmação

O cancelamento vira `CANCELAMENTO_SOLICITADO`.

O Financeiro deve verificar se o PIX entrou.

Se não entrou, encerra o processo.

Se entrou, deve existir estorno.

### Após pagamento confirmado

O cliente ainda pode solicitar cancelamento.

O sistema deve sinalizar `ESTORNO_PENDENTE`.

Após devolução do valor, o Financeiro registra `ESTORNADO` e a solicitação é encerrada.

## Expiração

Pré-solicitações em `AGUARDANDO_PAGAMENTO` expiram após o prazo configurado.

O usuário deve ser avisado:

- na criação;
- antes da expiração, quando a comunicação estiver implementada;
- após a expiração/cancelamento automático.

## Comunicação

Os e-mails fazem parte do fluxo operacional.

Eventos mínimos:

- pré-solicitação criada;
- lembrete de prazo;
- pré-solicitação expirada;
- pagamento informado;
- pagamento confirmado;
- pagamento não localizado;
- cancelamento recebido;
- estorno registrado.

Durante a fase local-first, os dados de negócio permanecem no navegador. O envio real será feito por função server-side específica de homologação, sem expor credenciais no frontend.

## Documentos anteriores

As SPECs que tratam de integração bancária automática, provider, webhook e conciliação automática ficam superadas por esta decisão.

Elas permanecem no histórico do Git, mas não representam mais a arquitetura alvo.
