-- Corrige a gravação da auditoria sem liberar INSERT direto aos usuários.

begin;

create or replace function private.camisa_registrar_alteracao_item(
  p_solicitacao_item_id uuid,
  p_cor_anterior text,
  p_tamanho_anterior text,
  p_cor_nova text,
  p_tamanho_novo text,
  p_motivo text,
  p_operador_id uuid
)
returns void
language sql
security definer
set search_path = ''
as $$
  insert into public.camisa_solicitacao_item_alteracoes (
    solicitacao_item_id, cor_anterior, tamanho_anterior,
    cor_nova, tamanho_novo, motivo, operador_id
  ) values (
    p_solicitacao_item_id, p_cor_anterior, p_tamanho_anterior,
    p_cor_nova, p_tamanho_novo, p_motivo, p_operador_id
  );
$$;

revoke all on function private.camisa_registrar_alteracao_item(uuid,text,text,text,text,text,uuid)
from public, anon, authenticated;

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

  perform private.camisa_registrar_alteracao_item(
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

revoke execute on function public.camisa_alterar_item_solicitacao(uuid,text,text,text)
from public, anon;
grant execute on function public.camisa_alterar_item_solicitacao(uuid,text,text,text)
to authenticated;

notify pgrst, 'reload schema';
commit;
