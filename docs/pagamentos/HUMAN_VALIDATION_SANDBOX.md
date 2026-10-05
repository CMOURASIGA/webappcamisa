# Human Validation - Sandbox de Pré-solicitação + PIX manual

## Objetivo

Validar o novo processo operacional sem alterar o Supabase de produção.

Rota: `/sandbox`

Persistência: `localStorage`

## Pré-requisitos

1. Abrir a branch `feature/pre-solicitacao-pix-manual-local`.
2. Publicar/abrir o preview da branch.
3. Para validar e-mails reais, implantar `camisa-sandbox-email`.
4. Configurar:
   - GMAIL_CLIENT_ID
   - GMAIL_CLIENT_SECRET
   - GMAIL_REFRESH_TOKEN
   - GMAIL_FROM
   - GMAIL_FROM_NAME
   - SANDBOX_EMAIL_ALLOWED_RECIPIENTS
5. Em `SANDBOX_EMAIL_ALLOWED_RECIPIENTS`, informar somente os e-mails autorizados para teste, separados por vírgula.

## HV-01 - Configurações

1. Abrir Configurações.
2. Definir tipo de chave PIX.
3. Definir chave PIX.
4. Definir recebedor e cidade.
5. Definir valor unitário.
6. Definir validade em horas.
7. Salvar.
8. Criar uma nova pré-solicitação.
9. Alterar o preço.
10. Confirmar que a pré-solicitação anterior manteve o valor antigo.

Esperado: configuração nova não altera registros anteriores.

## HV-02 - Pré-solicitação sem pagamento

1. Criar pré-solicitação válida.
2. Não anexar comprovante.

Esperado:

- protocolo REC gerado;
- status Aguardando pagamento;
- nenhum código oficial;
- aviso explícito de que não existe reserva/pedido confirmado;
- prazo visível;
- PIX Copia e Cola gerado;
- e-mail de pré-solicitação enviado quando e-mail está autorizado.

## HV-03 - PIX Copia e Cola

1. Copiar o PIX.
2. Colar em um leitor/validador PIX ou aplicativo bancário apenas até a tela de conferência, sem concluir pagamento se for teste.
3. Conferir chave/recebedor/valor.

Esperado: valor corresponde exatamente à quantidade x preço congelado.

## HV-04 - Informar pagamento

1. Em uma pré-solicitação aguardando pagamento, escolher data do PIX.
2. Anexar PDF/JPG/JPEG/PNG.
3. Informar pagamento.

Esperado:

- status Aguardando validação financeira;
- status financeiro Aguardando validação;
- comprovante aparece pelo nome no Financeiro;
- pedido oficial ainda não existe;
- e-mail informa que o pagamento ainda depende de confirmação humana.

Observação: no sandbox o arquivo não é enviado ao Storage; somente os metadados são guardados.

## HV-05 - Financeiro confirma

1. Abrir Financeiro.
2. Confirmar PIX.

Esperado:

- status Confirmada;
- status financeiro Confirmado;
- código PED gerado;
- e-mail de pedido confirmado;
- evento aparece no histórico.

## HV-06 - PIX não localizado

1. Criar nova pré-solicitação.
2. Informar pagamento.
3. No Financeiro selecionar Não localizado.

Esperado:

- financeiro Não localizado;
- usuário pode informar novamente o pagamento;
- pedido oficial não é gerado;
- e-mail de PIX não localizado é enviado.

## HV-07 - Cancelamento antes do PIX

1. Criar uma nova pré-solicitação.
2. Cancelar sem informar pagamento.

Esperado:

- status Cancelada;
- nenhum estorno;
- nenhum código oficial;
- e-mail informa que nada foi confirmado e nenhuma camisa foi reservada.

## HV-08 - Cancelamento após informar PIX

1. Criar pré-solicitação.
2. Informar pagamento.
3. Solicitar cancelamento.

Esperado:

- status Cancelamento solicitado;
- Financeiro não deve ter opção de confirmar pedido;
- Financeiro decide se o PIX entrou ou não.

## HV-09 - Cancelamento com PIX não recebido

1. Usar o cenário HV-08.
2. Financeiro escolhe PIX não entrou - cancelar sem estorno.

Esperado:

- status Cancelada;
- financeiro Não localizado;
- sem estorno;
- e-mail de cancelamento.

## HV-10 - Cancelamento com PIX recebido

1. Usar o cenário HV-08.
2. Financeiro escolhe PIX entrou - exigir estorno.
3. Confirmar status Estorno pendente.
4. Registrar estorno.

Esperado:

- pagamento Estornado;
- solicitação Cancelada;
- histórico preservado;
- e-mail de estorno concluído.

## HV-11 - Cancelamento depois do pedido confirmado

1. Criar e confirmar um pedido.
2. Solicitar cancelamento.

Esperado:

- o pedido não some;
- vira Cancelamento solicitado;
- Financeiro precisa encaminhar estorno;
- após Registrar estorno fica Cancelada + Estornado.

## HV-12 - Expiração

Para facilitar o teste:

1. Alterar validade para 1 hora.
2. Criar pré-solicitação.
3. Alternativamente, editar temporariamente o dado no localStorage para um `expiresAt` passado.
4. Reabrir/atualizar o sandbox.

Esperado:

- status Expirada;
- não há pedido oficial;
- e-mail de expiração é disparado uma única vez quando o sandbox processar a expiração.

Limitação consciente da fase local-first: com o navegador fechado não existe job em background. A expiração é processada quando o sandbox volta a ser aberto. A implementação definitiva no Supabase deverá executar expiração no servidor.

## HV-13 - Idempotência de e-mails do sandbox

1. Atualizar a página após cada evento.
2. Navegar entre abas várias vezes.

Esperado: o mesmo evento não deve ser reenviado após estar registrado em `emailEventsSent`.

## HV-14 - Segurança de e-mail

1. Criar registro com e-mail fora de `SANDBOX_EMAIL_ALLOWED_RECIPIENTS`.

Esperado:

- o fluxo local é preservado;
- envio retorna erro de destinatário não autorizado;
- nenhum e-mail real é enviado para pessoa fora da homologação.

## HV-15 - Limpeza

1. Configurações > Limpar dados de teste.

Esperado:

- pré-solicitações do sandbox removidas;
- contador local reiniciado;
- produção/Supabase não sofre qualquer alteração.

## Critério de aprovação

A Human Validation é aprovada somente quando:

- pré-solicitação não for confundida com pedido;
- preço e PIX forem congelados por registro;
- nenhuma confirmação financeira for automática;
- cancelamento antes/depois de pagamento estiver claro;
- estorno for rastreável;
- e-mails forem coerentes e sem duplicidade;
- nenhuma tabela de produção for alterada.
