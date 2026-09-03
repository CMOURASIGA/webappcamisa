-- Exclusão controlada de solicitação pelo dashboard, com auditoria.

begin;

create table if not exists public.camisa_solicitacao_exclusoes (
  id uuid primary key default gen_random_uuid(),
  solicitacao_id_original uuid not null,
  codigo text,
  motivo text not null,
  solicitacao jsonb not null,
  itens jsonb not null,
  operador_id uuid references public.usuarios(id),
  excluido_em timestamptz not null default now()
);

alter table public.camisa_solicitacao_exclusoes enable row level security;

drop policy if exists "camisa exclusoes leitura auth" on public.camisa_solicitacao_exclusoes;
create policy "camisa exclusoes leitura auth"
on public.camisa_solicitacao_exclusoes
for select to authenticated
using (public.usuario_autenticado_ativo());

grant select on public.camisa_solicitacao_exclusoes to authenticated;

create or replace function private.camisa_excluir_solicitacao_internal(
  p_solicitacao_id uuid,
  p_motivo text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_sol public.camisa_solicitacoes%rowtype;
  v_itens jsonb;
  v_operador uuid;
  v_motivo text := trim(coalesce(p_motivo, ''));
begin
  if auth.uid() is null or not public.usuario_pode_editar() then
    raise exception 'Usuário sem permissão de edição.';
  end if;
  if length(v_motivo) < 5 then
    raise exception 'Informe o motivo da exclusão.';
  end if;

  select * into v_sol
  from public.camisa_solicitacoes
  where id = p_solicitacao_id
  for update;

  if not found then raise exception 'Solicitação não encontrada.'; end if;

  if exists (
    select 1 from public.camisa_solicitacao_itens
    where solicitacao_id = p_solicitacao_id
      and quantidade_entregue > 0
  ) then
    raise exception 'A solicitação possui entrega. Reabra antes de excluir.';
  end if;

  if exists (
    select 1
    from public.camisa_movimentacoes m
    join public.camisa_solicitacao_itens i on i.id = m.solicitacao_item_id
    where i.solicitacao_id = p_solicitacao_id
  ) then
    raise exception 'A solicitação possui histórico de movimentação de estoque e não pode ser excluída.';
  end if;

  select coalesce(jsonb_agg(to_jsonb(i) order by i.criado_em, i.id), '[]'::jsonb)
    into v_itens
  from public.camisa_solicitacao_itens i
  where i.solicitacao_id = p_solicitacao_id;

  select id into v_operador
  from public.usuarios
  where auth_user_id = auth.uid() and status = 'ATIVO'
  limit 1;

  insert into public.camisa_solicitacao_exclusoes (
    solicitacao_id_original, codigo, motivo, solicitacao, itens, operador_id
  ) values (
    v_sol.id, v_sol.codigo, v_motivo, to_jsonb(v_sol), v_itens, v_operador
  );

  delete from public.camisa_solicitacao_item_alteracoes a
  using public.camisa_solicitacao_itens i
  where a.solicitacao_item_id = i.id
    and i.solicitacao_id = p_solicitacao_id;

  delete from public.camisa_solicitacao_itens
  where solicitacao_id = p_solicitacao_id;

  delete from public.camisa_solicitacoes
  where id = p_solicitacao_id;

  return jsonb_build_object(
    'success', true,
    'solicitacao_id', p_solicitacao_id,
    'codigo', v_sol.codigo
  );
end;
$$;

revoke all on function private.camisa_excluir_solicitacao_internal(uuid,text)
from public, anon;
grant execute on function private.camisa_excluir_solicitacao_internal(uuid,text)
to authenticated;

create or replace function public.camisa_excluir_solicitacao(
  p_solicitacao_id uuid,
  p_motivo text
)
returns jsonb
language sql
security invoker
set search_path = ''
as $$
  select private.camisa_excluir_solicitacao_internal(p_solicitacao_id, p_motivo);
$$;

revoke execute on function public.camisa_excluir_solicitacao(uuid,text)
from public, anon;
grant execute on function public.camisa_excluir_solicitacao(uuid,text)
to authenticated;

notify pgrst, 'reload schema';
commit;
