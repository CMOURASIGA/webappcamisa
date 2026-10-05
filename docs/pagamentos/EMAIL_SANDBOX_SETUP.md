# E-mail do Sandbox

A função `camisa-sandbox-email` existe apenas para a homologação do novo fluxo.

## Segurança

A função recusa qualquer destinatário que não esteja na variável:

`SANDBOX_EMAIL_ALLOWED_RECIPIENTS`

Exemplo:

`teste1@exemplo.com,teste2@exemplo.com`

Não use uma lista aberta ou domínio curinga.

## Secrets

A função reutiliza as mesmas credenciais Gmail já usadas pelo projeto:

- GMAIL_CLIENT_ID
- GMAIL_CLIENT_SECRET
- GMAIL_REFRESH_TOKEN
- GMAIL_FROM
- GMAIL_FROM_NAME

E exige adicionalmente:

- SANDBOX_EMAIL_ALLOWED_RECIPIENTS

## Deploy

Implantar:

`supabase/functions/camisa-sandbox-email/index.ts`

A configuração `supabase/config.toml` deixa `verify_jwt = false` porque o sandbox é público. A restrição de homologação é feita pela allowlist de destinatários.

## Eventos

- PRE_REQUEST_CREATED
- PAYMENT_INFORMED
- PAYMENT_CONFIRMED
- PAYMENT_NOT_FOUND
- CANCELLATION_REQUESTED
- PRE_REQUEST_CANCELLED
- PRE_REQUEST_EXPIRED
- REFUND_COMPLETED

Todos os assuntos saem prefixados com `[HOMOLOGAÇÃO]`.
