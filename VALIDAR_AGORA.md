# Validar agora - Gestão de Camisas EAC

Esta versão consolida o fluxo já validado na base EAC e os ajustes finais do frontend.

## O que já está contemplado

- Supabase como fonte oficial, sem dependência do `Code.gs`.
- Solicitação livre, sem bloqueio por estoque.
- Pergunta `Você é encontreiro?` com autocomplete em `pessoas`.
- Não encontreiro com nome livre.
- Beneficiário obrigatório e pré-preenchido para encontreiro.
- Comprovante com área claramente clicável.
- Código amigável `EAC37-XXXXXX` no modal.
- Envio automático do e-mail pelo Gmail do EAC após a gravação.
- Falha no e-mail não cancela a solicitação.
- Dashboard com Visão geral, Solicitações, Reposição e Estoque.
- Reposição recebida aumenta estoque.
- Somente entrega reduz estoque.
- Token de e-mail é descartável e fica `null` após envio bem-sucedido.

## 1. Banco

Como a sua base já recebeu as migrações anteriores, rode somente:

`supabase/AJUSTES_FINAIS_VALIDACAO_LOCAL.sql`

Esse script não apaga tabelas nem solicitações. Ele garante constraint de entrega parcial, views finais e privilégios necessários para a Edge Function.

## 2. Edge Function

A função existente `camisa-email` precisa receber a versão atualizada do arquivo:

`supabase/functions/camisa-email/index.ts`

Essa versão corrige a codificação UTF-8 do nome do remetente no cabeçalho `From`, mantém assunto e corpo em UTF-8 e registra a mensagem real de erro em `email_confirmacao_erro` se o Gmail falhar.

Mantenha `Verify JWT with legacy secret` desligado.

Os secrets já configurados devem permanecer:

- `GMAIL_CLIENT_ID`
- `GMAIL_CLIENT_SECRET`
- `GMAIL_REFRESH_TOKEN`
- `GMAIL_FROM`
- `GMAIL_FROM_NAME`

## 3. Frontend local

Copie `.env.example` para `.env.local` e preencha sua Publishable Key:

```env
VITE_SUPABASE_URL="https://niagdoowqmngxjcrmstd.supabase.co"
VITE_SUPABASE_ANON_KEY="SUA_PUBLISHABLE_KEY"
VITE_EAC_ENCONTRO_ID="57a08fa1-29e9-4c35-ab34-eb187f79b13a"
VITE_EAC_ENCONTRO_NOME="EAC 37"
```

Depois:

```bash
npm install
npm run lint
npm run build
npm run dev
```

Formulário: `http://localhost:3000/`

Dashboard: `http://localhost:3000/dashboard`

Se o `.env.local` estiver incompleto, esta versão exibe uma tela de configuração em vez de ficar em branco.

## 4. Teste do formulário

### Encontreiro

1. Marque `Sim`.
2. Digite pelo menos 3 letras do nome.
3. Selecione o nome retornado.
4. Confirme que Beneficiário veio preenchido com o mesmo nome.
5. Informe contato, equipe, camisa e comprovante.
6. Envie.
7. Confirme o código `EAC37-XXXXXX` no modal.
8. Se houver e-mail, confirme a mensagem `Confirmação enviada para o e-mail informado`.
9. Verifique no Gmail se o remetente aparece corretamente como `EAC Porciúncula de Santana`.

### Não encontreiro

1. Marque `Não`.
2. Digite o nome livremente.
3. Informe obrigatoriamente o beneficiário.
4. Finalize a solicitação normalmente.

## 5. Teste principal do dashboard

1. Na aba Estoque, deixe `Azul / G = 1`.
2. Faça uma solicitação de `Azul / G = 1`.
3. Faça outra solicitação de `Azul / G = 2`.
4. A Visão geral deve mostrar:
   - Estoque físico: 1
   - Demanda aberta: 3
   - Pronto para entrega: 1
   - Solicitar reposição: 2
5. Clique `Criar reposição sugerida`.
6. Deve ficar:
   - Em reposição: 2
   - Solicitar reposição: 0
7. Na aba Reposição, receba as 2 unidades.
8. Estoque físico deve ir para 3.
9. Na aba Solicitações, entregue 1 e depois 2.
10. Estoque físico final: 0.
11. Demanda aberta final: 0.

## 6. Conferências SQL

```sql
select *
from public.vw_camisa_dashboard
where encontro_id='57a08fa1-29e9-4c35-ab34-eb187f79b13a'
order by cor,tamanho;
```

```sql
select codigo,nome_solicitante,nome_beneficiario,email_solicitante,
       email_confirmacao_enviada_em,email_confirmacao_erro
from public.vw_camisa_solicitacoes_detalhes
where encontro_id='57a08fa1-29e9-4c35-ab34-eb187f79b13a'
order by criado_em desc;
```

Para um e-mail enviado com sucesso:

```text
email_dispatch_token = null
email_confirmacao_enviada_em = preenchido
email_confirmacao_erro = null
```
