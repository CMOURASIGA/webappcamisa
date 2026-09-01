-- Permite corrigir cor e tamanho de uma camisa pelo dashboard.
-- Mantém auditoria e recalcula automaticamente as reservas FIFO.

begin;

create table if not exists public.camisa_solicitacao_item_alteracoes (
  id uuid primary key default gen_random_uuid(),
  solicitacao_item_id uuid not null references public.camisa_solicitacao_itens(id),
  cor_anterior text not null,
  tamanho_anterior text not null,
  cor_nova text not null,
  tamanho_novo text not null,
  motivo text not null,
  operador_id uuid references public.usuarios(id),
  criado_em timestamptz not null default now()
);

alter table public.camisa_solicitacao_item_alteracoes enable row level security;

drop policy if exists "camisa alteracoes leitura auth" on public.camisa_solicitacao_item_alteracoes;
create policy "camisa alteracoes leitura auth"
on public.camisa_solicitacao_item_alteracoes
for select to authenticated
using (public.usuario_autenticado_ativo());

create or replace function public.camisa_alterar_item_solicitacao(
  p_solicitacao_item_id uuid,
  p_cor text,
  p_tamanho text,
  p_motivo text
)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_item public.camisa_solicitacao_itens%rowtype;
  v_cor text := trim(coalesce(p_cor, ''));
  v_tamanho text := upper(trim(coalesce(p_tamanho, '')));
  v_motivo text := trim(coalesce(p_motivo, ''));
  v_operador uuid;
begin
  if not public.usuario_pode_editar() then
    raise exception 'Usuário sem permissão de edição.';
  end if;

  if v_cor = '' then raise exception 'Cor inválida.'; end if;
  if v_tamanho not in ('PP','P','M','G','GG','XG','XXG') then
    raise exception 'Tamanho inválido.';
  end if;
  if length(v_motivo) < 5 then
    raise exception 'Informe o motivo da alteração.';
  end if;

  select * into v_item
  from public.camisa_solicitacao_itens
  where id = p_solicitacao_item_id
  for update;

  if not found then raise exception 'Item da solicitação não encontrado.'; end if;
  if v_item.status = 'CANCELADO' then raise exception 'Não é possível alterar um item cancelado.'; end if;
  if v_item.quantidade_entregue > 0 then
    raise exception 'Este item já possui entrega. Reabra a solicitação antes de alterar a camisa.';
  end if;
  if v_item.cor = v_cor and v_item.tamanho = v_tamanho then
    raise exception 'A nova cor e o novo tamanho são iguais aos atuais.';
  end if;

  select id into v_operador
  from public.usuarios
  where auth_user_id = auth.uid() and status = 'ATIVO'
  limit 1;

  insert into public.camisa_solicitacao_item_alteracoes (
    solicitacao_item_id, cor_anterior, tamanho_anterior,
    cor_nova, tamanho_novo, motivo, operador_id
  ) values (
    v_item.id, v_item.cor, v_item.tamanho,
    v_cor, v_tamanho, v_motivo, v_operador
  );

  update public.camisa_solicitacao_itens
  set cor = v_cor,
      tamanho = v_tamanho,
      quantidade_reservada = 0,
      status = 'SOLICITADO',
      atualizado_em = now()
  where id = v_item.id;

  -- O trigger existente recalcula as combinações antiga e nova após o update.
  return jsonb_build_object(
    'success', true,
    'solicitacao_item_id', v_item.id,
    'cor_anterior', v_item.cor,
    'tamanho_anterior', v_item.tamanho,
    'cor_nova', v_cor,
    'tamanho_novo', v_tamanho
  );
end;
$$;

revoke execute on function public.camisa_alterar_item_solicitacao(uuid,text,text,text) from public, anon;
grant execute on function public.camisa_alterar_item_solicitacao(uuid,text,text,text) to authenticated;

grant select on public.camisa_solicitacao_item_alteracoes to authenticated;

notify pgrst, 'reload schema';
commit;
