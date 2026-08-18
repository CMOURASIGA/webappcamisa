# Gmail do EAC - configuração para envio pela Edge Function

A aplicação usa a Gmail API. O Gmail continua sendo o remetente oficial do EAC; nenhuma senha do Gmail é colocada no frontend.

## 1. Google Cloud

1. Acesse o Google Cloud Console com a conta responsável pelo Gmail do EAC.
2. Crie ou selecione um projeto, por exemplo `EAC Camisas`.
3. Em APIs e serviços, habilite **Gmail API**.
4. Configure a tela de consentimento OAuth.
5. Adicione a conta do Gmail do EAC como usuário de teste enquanto estiver validando.
6. Crie um OAuth Client ID. Para obter o refresh token de forma simples, um cliente Web ou Desktop pode ser usado conforme o fluxo escolhido.
7. O único escopo necessário para envio é:

   `https://www.googleapis.com/auth/gmail.send`

## 2. Obter o refresh token

O envio é servidor-servidor e precisa de acesso offline. Na autorização OAuth use `access_type=offline`. Guarde o `refresh_token` retornado em local seguro.

Para teste, você pode usar o OAuth 2.0 Playground do Google com as credenciais do seu projeto, autorizar somente `gmail.send`, trocar o authorization code por tokens e copiar o refresh token.

Importante: se a tela de consentimento permanecer em modo de teste, políticas do Google podem limitar a validade do refresh token. Para uso contínuo, revise o status de publicação e as exigências do seu projeto Google Cloud.

## 3. Secrets da Edge Function no Supabase

Configure na Edge Function `camisa-email`:

- `GMAIL_CLIENT_ID`
- `GMAIL_CLIENT_SECRET`
- `GMAIL_REFRESH_TOKEN`
- `GMAIL_FROM` - o endereço Gmail do EAC autorizado no OAuth
- `GMAIL_FROM_NAME` - exemplo: `EAC Porciúncula de Santana`
- `EAC_LOGO_URL` - opcional
- `EAC_INSTAGRAM_URL` - opcional

`SUPABASE_URL` e `SUPABASE_SERVICE_ROLE_KEY` são disponibilizados no ambiente das Edge Functions do projeto Supabase.

Nunca coloque `GMAIL_CLIENT_SECRET`, `GMAIL_REFRESH_TOKEN` ou `SUPABASE_SERVICE_ROLE_KEY` no `.env.local` do React.

## 4. Deploy da Edge Function

No Supabase, Edge Functions, crie/deploy `camisa-email` usando:

- `supabase/functions/camisa-email/index.ts`
- `supabase/functions/camisa-email/deno.json`

A função foi projetada para ser chamada pelo formulário após o registro. Ela exige `request_id` + `dispatch_token` descartável retornado pela RPC. Após um envio bem-sucedido, o token é invalidado no banco para impedir reenvios indevidos.

## 5. SQL antes do teste

Na base que já tem as tabelas de camisas, rode:

`supabase/camisas_email_gmail.sql`

Esse patch adiciona:

- código curto da solicitação
- token descartável de envio
- timestamp de confirmação por e-mail
- atualização da RPC de solicitação
- atualização da view administrativa

## 6. Teste

Depois do deploy e dos secrets:

1. Execute uma solicitação local informando um e-mail seu.
2. O modal deve mostrar um código no formato `EAC37-XXXXXX`.
3. O modal deve informar que a confirmação foi enviada.
4. Confira no Gmail do EAC em "Enviados".
5. Confira no banco:

```sql
select codigo, email_solicitante, email_confirmacao_enviada_em
from public.camisa_solicitacoes
order by criado_em desc
limit 10;
```

### JWT da Edge Function

Como o formulário é público, `camisa-email` deve ser implantada com verificação JWT desabilitada. A autorização do disparo não fica aberta: a função exige o par `request_id` + `email_dispatch_token`, e o token é um UUID de uso único gerado pelo banco e apagado após o envio. O arquivo `supabase/config.toml` já contém `verify_jwt = false` para essa função.
