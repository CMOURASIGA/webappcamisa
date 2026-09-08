# SPEC 02 a 04 - Base de Pagamentos, Segurança e Checkout PIX

## SPEC 02 - Modelo de pagamentos

### Objetivo

Separar pagamento de pedido e entrega.

### Entregas

- Criar tabela `camisa_pagamentos`.
- Relacionamento 1:N entre solicitação e pagamentos para suportar reprocessamento, nova cobrança ou estorno sem apagar histórico.
- Criar status de pagamento independentes.
- Criar campos de auditoria.
- Criar view administrativa consolidando pedido, pagamento e entrega.
- Preservar os campos antigos de comprovante durante a migração.

### Regras

- Um pedido pode existir antes de estar pago.
- Um pagamento nunca pode ser inferido apenas pela existência do pedido.
- Alterações financeiras devem deixar trilha de auditoria.
- Não excluir pagamentos históricos.

## SPEC 03 - Segurança e comprovante obrigatório

### Objetivo

Garantir no backend que nenhum fluxo não autorizado consiga marcar ou tratar pedido como pago sem condição financeira válida.

### Regra central

```text
pagamento confirmado automaticamente
OU
comprovante enviado e aceito
```

Sem uma das condições acima:

- pagamento permanece PENDENTE;
- pedido permanece AGUARDANDO_PAGAMENTO;
- entrega fica NAO_LIBERADA.

### Validações de comprovante

- Obrigatório quando não houver confirmação automática.
- Extensões aceitas: PDF, JPG, JPEG e PNG.
- Limite inicial: 10 MB.
- Validar MIME e extensão no backend quando tecnicamente possível.
- Nome do arquivo não deve ser usado como identificador de storage.
- Arquivo deve ser relacionado ao pagamento.
- Upload concluído sem criação do pedido deve ser tratado como arquivo órfão para limpeza posterior.

### Backend

A trava não pode depender do React.

Toda operação que altere pagamento para PAGO ou libere entrega deve validar o estado financeiro no banco.

## SPEC 04 - Novo checkout PIX

### Objetivo

Transformar a etapa atual de PIX + upload em um fluxo de pagamento claro e preparado para automação.

### Modo A - PIX manual

Enquanto não houver integração bancária:

1. Usuário informa camisas.
2. Sistema calcula valor.
3. Exibe chave PIX e instruções.
4. Usuário paga.
5. Usuário anexa comprovante obrigatoriamente.
6. Sistema cria/atualiza pagamento como COMPROVANTE_ENVIADO ou EM_ANALISE.
7. Pedido não deve aparecer como PAGO até validação definida.

### Modo B - PIX integrado

Quando houver provider aprovado:

1. Sistema cria cobrança com valor exato e identificador único.
2. Exibe QR Code e Pix Copia e Cola.
3. Registra `provider_payment_id`/`txid`.
4. Aguarda confirmação automática.
5. Ao receber confirmação válida, muda pagamento para PAGO.
6. Comprovante manual deixa de ser obrigatório e passa a ser contingência.

### Experiência de tela

Exibir:

- Quantidade de camisas.
- Valor unitário.
- Valor total.
- Forma de pagamento.
- QR Code quando disponível.
- Pix Copia e Cola quando disponível.
- Chave PIX no modo manual.
- Status em linguagem clara.
- Botão de comprovante quando necessário.

### Estados de interface

- Aguardando pagamento.
- Comprovante enviado.
- Em análise.
- Pagamento confirmado.
- Pagamento expirado.
- Divergência.

### Importante

O frontend não deve conhecer segredo, token privado, certificado bancário ou credencial de provider. Toda integração privada deve passar por backend seguro, preferencialmente Edge Function/serviço server-side apropriado.

## Critérios de aceite conjuntos

- Pedido, pagamento e entrega possuem estados independentes.
- Nenhuma entrega pode ser liberada por simples manipulação do frontend.
- Fluxo manual continua funcionando mesmo sem integração bancária.
- Arquitetura permite trocar Nubank por outro provider sem reescrever as regras centrais do pedido.
