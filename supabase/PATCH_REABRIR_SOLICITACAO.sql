-- =============================================================================
-- REABERTURA COMPLETA DE SOLICITACAO
-- Ao mudar uma solicitacao para ABERTA, desfaz qualquer entrega registrada,
-- devolve as unidades ao estoque fisico e recalcula a cobertura/reservas.
-- =============================================================================

begin;

grant usage on schema private to authenticated;
grant execute on function private.camisa_recalcular_reservas_combo(text,text) to authenticated;

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
  v_operador uuid;
  v_est public.camisa_estoque%rowtype;
  v_qtd_estorno integer;
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

  select id into v_operador
  from public.usuarios
  where auth_user_id = auth.uid()
    and status = 'ATIVO'
  limit 1;

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

    -- Entregas já realizadas permanecem entregues. Somente o saldo pendente é cancelado.
    update public.camisa_solicitacao_itens
       set status = case
           when quantidade_entregue >= quantidade_solicitada then 'ENTREGUE'
           else 'CANCELADO'
         end,
         quantidade_reservada = 0,
         atualizado_em = now()
     where solicitacao_id = p_solicitacao_id;

  else
    -- ABERTA significa que a solicitacao volta a estar pendente.
    -- Se havia entrega registrada, ela e estornada e devolvida ao estoque.
    for r in
      select *
      from public.camisa_solicitacao_itens
      where solicitacao_id = p_solicitacao_id
      for update
    loop
      v_qtd_estorno := coalesce(r.quantidade_entregue, 0);

      if v_qtd_estorno > 0 then
        select * into v_est
        from public.camisa_estoque
        where cor = r.cor
          and tamanho = r.tamanho
        order by ativo desc, atualizado_em desc
        limit 1
        for update;

        if not found then
          insert into public.camisa_estoque(
            cor, tamanho, quantidade_fisica, ativo
          ) values (
            r.cor, r.tamanho, v_qtd_estorno, true
          )
          returning * into v_est;

          insert into public.camisa_movimentacoes(
            estoque_id, solicitacao_item_id, encontro_id, tipo, quantidade,
            saldo_anterior, saldo_posterior, observacoes, operador_id
          ) values (
            v_est.id, r.id, v_sol.encontro_id, 'AJUSTE_ENTRADA', v_qtd_estorno,
            0, v_qtd_estorno,
            'Estorno de entrega por reabertura da solicitação ' || coalesce(v_sol.codigo, v_sol.id::text),
            v_operador
          );
        else
          update public.camisa_estoque
             set quantidade_fisica = v_est.quantidade_fisica + v_qtd_estorno,
                 ativo = true,
                 atualizado_em = now()
           where id = v_est.id;

          insert into public.camisa_movimentacoes(
            estoque_id, solicitacao_item_id, encontro_id, tipo, quantidade,
            saldo_anterior, saldo_posterior, observacoes, operador_id
          ) values (
            v_est.id, r.id, v_sol.encontro_id, 'AJUSTE_ENTRADA', v_qtd_estorno,
            v_est.quantidade_fisica, v_est.quantidade_fisica + v_qtd_estorno,
            'Estorno de entrega por reabertura da solicitação ' || coalesce(v_sol.codigo, v_sol.id::text),
            v_operador
          );
        end if;
      end if;

      update public.camisa_solicitacao_itens
         set quantidade_entregue = 0,
             quantidade_reservada = 0,
             status = 'SOLICITADO',
             entregue_em = null,
             atualizado_em = now()
       where id = r.id;
    end loop;

    update public.camisa_solicitacoes
       set status = 'ABERTA', atualizado_em = now()
     where id = p_solicitacao_id;
  end if;

  -- Recalcula as combinacoes afetadas depois de qualquer mudanca.
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

-- Validacao opcional:
select
  routine_schema,
  routine_name,
  security_type
from information_schema.routines
where routine_schema = 'public'
  and routine_name = 'camisa_alterar_status_solicitacao';
