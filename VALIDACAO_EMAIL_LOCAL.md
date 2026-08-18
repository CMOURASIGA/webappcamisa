# Validação local - código, anexo e Gmail

## Banco

Rode primeiro `supabase/camisas_email_gmail.sql`.

Valide:

```sql
select column_name
from information_schema.columns
where table_schema='public'
  and table_name='camisa_solicitacoes'
  and column_name in ('codigo','email_dispatch_token','email_confirmacao_enviada_em','email_confirmacao_erro')
order by column_name;
```

Esperado: 4 linhas.

## Frontend

1. `npm install`
2. `npm run lint`
3. `npm run dev`
4. Abra `http://localhost:3000/`

Verifique:

- Área de comprovante é um botão/caixa clicável.
- Após selecionar arquivo, o nome fica visível e aparece opção `Trocar comprovante`.
- Encontreiro continua sendo localizado por autocomplete.
- Não encontreiro continua com nome livre.
- Beneficiário continua obrigatório.
- Após salvar, aparece código curto `EAC37-XXXXXX`, não UUID.

## Gmail

Com a Edge Function e os secrets configurados, faça uma solicitação com e-mail válido.

Se o envio funcionar, o modal informa `Confirmação enviada para o e-mail informado.`

Se o Gmail ainda não estiver configurado, a solicitação continua sendo gravada e o modal avisa que somente o e-mail falhou. O registro não é perdido.

---

## Correção final de acentuação

A versão atual de `supabase/functions/camisa-email/index.ts` codifica o nome do remetente no padrão UTF-8 do cabeçalho MIME. Reimplante a função antes de validar novamente o remetente no Gmail.
