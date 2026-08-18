-- =============================================================================
-- ALTERACAO MANUAL DO STATUS DA SOLICITACAO
-- Permite ao dashboard alterar a solicitacao entre ABERTA, CONCLUIDA e CANCELADA
-- sem permitir conclusao inconsistente com itens ainda pendentes.
-- =============================================================================

begin;

create or replace function public.camisa_alterar_status_solicitacao(
  p_solicitacao_id uuid,
  p_status text
)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_sol public.camisa_solicitacoes%rowtype;
  v_status text := upper(trim(coalesce(p_status,'')));
  r record;
begin
  if not public.usuario_pode_editar() then
    raise exception 'Usuário sem permissão de edição.';
  end if;

  if v_status not in ('ABERTA','CONCLUIDA','CANCELADA') then
    raise exception 'Status inválido. Use ABERTA, CONCLUIDA ou CANCELADA.';
  end if;

  select * into v_sol
  from public.camisa_solicitacoes
  where id = p_solicitacao_id
  for update;

  if not found then
    raise exception 'Solicitação não encontrada.';
  end if;

  if v_status = 'CONCLUIDA' then
    if v_sol.status = 'CANCELADA' then
      raise exception 'Reabra a solicitação antes de concluí-la.';
    end if;

    if exists (
      select 1
      from public.camisa_solicitacao_itens i
      where i.solicitacao_id = p_solicitacao_id
        and i.status <> 'CANCELADO'
        and i.quantidade_entregue < i.quantidade_solicitada
    ) then
      raise exception 'A solicitação ainda possui item pendente. Use a ação Entregar antes de concluir.';
    end if;

    update public.camisa_solicitacoes
       set status = 'CONCLUIDA', atualizado_em = now()
     where id = p_solicitacao_id;

  elsif v_status = 'CANCELADA' then
    update public.camisa_solicitacoes
       set status = 'CANCELADA', atualizado_em = now()
     where id = p_solicitacao_id;

    -- Preserva itens totalmente entregues e cancela somente o saldo ainda pendente.
    update public.camisa_solicitacao_itens
       set status = case
           when quantidade_entregue >= quantidade_solicitada then 'ENTREGUE'
           else 'CANCELADO'
         end,
         quantidade_reservada = 0,
         atualizado_em = now()
     where solicitacao_id = p_solicitacao_id;

  else
    update public.camisa_solicitacoes
       set status = 'ABERTA', atualizado_em = now()
     where id = p_solicitacao_id;

    -- Ao reabrir, restaura os itens cancelados para o fluxo operacional.
    update public.camisa_solicitacao_itens
       set status = case
           when quantidade_entregue >= quantidade_solicitada then 'ENTREGUE'
           when quantidade_entregue > 0 then 'PARCIALMENTE_ENTREGUE'
           else 'SOLICITADO'
         end,
         atualizado_em = now()
     where solicitacao_id = p_solicitacao_id
       and status = 'CANCELADO';
  end if;

  -- Recalcula a cobertura das combinacoes afetadas, pois cancelar/reabrir
  -- altera quanto estoque pode ser direcionado às demais solicitações.
  for r in
    select distinct cor, tamanho
    from public.camisa_solicitacao_itens
    where solicitacao_id = p_solicitacao_id
  loop
    perform private.camisa_recalcular_reservas_combo(r.cor, r.tamanho);
  end loop;

  return jsonb_build_object(
    'success', true,
    'solicitacao_id', p_solicitacao_id,
    'status', v_status
  );
end;
$$;

revoke execute on function public.camisa_alterar_status_solicitacao(uuid,text) from public, anon;
grant execute on function public.camisa_alterar_status_solicitacao(uuid,text) to authenticated;

notify pgrst, 'reload schema';
commit;

-- Validacao opcional da funcao:
select routine_schema, routine_name, security_type
from information_schema.routines
where routine_schema='public'
  and routine_name='camisa_alterar_status_solicitacao';
