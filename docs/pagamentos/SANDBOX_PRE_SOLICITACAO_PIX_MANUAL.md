# Sandbox - Pré-solicitação + PIX manual

## Branch

`feature/pre-solicitacao-pix-manual-local`

## Objetivo

Validar o novo fluxo operacional antes de alterar as tabelas reais do Supabase.

A persistência de negócio desta fase usa exclusivamente `localStorage`.

## Decisões fechadas

1. Não haverá integração bancária.
2. A confirmação do PIX será sempre humana pelo Financeiro.
3. A pré-solicitação pode ser criada sem PIX e sem comprovante.
4. Pré-solicitação não reserva estoque, não entra em reposição, não libera entrega e não gera receita confirmada.
5. A pré-solicitação recebe protocolo `REC-AAAA-NNNNNN`.
6. O número oficial só nasce depois da confirmação financeira.
7. O usuário recebe prazo explícito para informar o pagamento.
8. Pré-solicitação não paga expira após o prazo configurado.
9. Cancelamento antes de pagamento encerra sem ação financeira.
10. Cancelamento após pagamento informado exige tratamento do Financeiro.
11. Pagamento confirmado + cancelamento exige estorno.
12. PIX Copia e Cola é gerado localmente a partir da configuração administrativa.
13. Valor unitário e dados PIX são congelados como snapshot na pré-solicitação.
14. Alterar configurações não muda pré-solicitações já criadas.

## Configurações do sandbox

- tipo de chave PIX;
- chave PIX;
- nome do recebedor;
- cidade;
- valor unitário;
- prazo de validade da pré-solicitação.

## Estados de pré-solicitação

- `AGUARDANDO_PAGAMENTO`
- `PAGAMENTO_INFORMADO`
- `AGUARDANDO_VALIDACAO_FINANCEIRA`
- `CONFIRMADA`
- `CANCELAMENTO_SOLICITADO`
- `CANCELADA`
- `EXPIRADA`

## Estados financeiros

- `NAO_INFORMADO`
- `AGUARDANDO_VALIDACAO`
- `CONFIRMADO`
- `NAO_LOCALIZADO`
- `ESTORNO_PENDENTE`
- `ESTORNADO`

## Persistência local

Chaves:

- `webappcamisa_sandbox_settings_v1`
- `webappcamisa_sandbox_requests_v1`
- `webappcamisa_sandbox_counter_v1`

A estrutura foi desenhada para ser migrada depois para as entidades reais sem alterar o fluxo funcional.

## E-mail

O sandbox registra inicialmente os eventos e estados localmente. O envio real de e-mail será ligado por uma Edge Function separada de homologação, sem colocar credenciais no frontend e sem alterar a função de produção antes da validação do fluxo.

## Próxima etapa

Implementar a tela `/sandbox` com:

- criação de pré-solicitação;
- acompanhamento por protocolo;
- PIX Copia e Cola;
- informação do pagamento;
- cancelamento;
- fila do Financeiro;
- Configurações.
