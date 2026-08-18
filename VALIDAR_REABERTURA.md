# Validar reabertura de solicitação

1. Rode `supabase/PATCH_REABRIR_SOLICITACAO.sql` no SQL Editor.
2. Abra uma solicitação com item já entregue.
3. Anote o saldo do estoque da mesma cor/tamanho.
4. Altere o status da solicitação para `Aberta`.
5. Confirme que:
   - `quantidade_entregue` volta para 0;
   - `entregue_em` fica nulo;
   - situação do item deixa de ser `Entregue`;
   - a quantidade entregue retorna ao estoque físico;
   - a cobertura/reserva é recalculada;
   - a solicitação aparece como `Aberta`.

SQL de conferência por código:

```sql
select
  s.codigo,
  s.status as status_solicitacao,
  i.cor,
  i.tamanho,
  i.quantidade_solicitada,
  i.quantidade_entregue,
  i.quantidade_reservada,
  i.status as status_item,
  i.entregue_em
from public.camisa_solicitacoes s
join public.camisa_solicitacao_itens i on i.solicitacao_id = s.id
where s.codigo = 'SEU_CODIGO';
```
