-- ============================================================
-- EAC - Gestão de Camisas
-- Complemento para as 6 tabelas camisa_* já criadas.
-- Execute no SQL Editor da base EAC.
-- ============================================================

begin;

-- ------------------------------------------------------------
-- 1. CAMPOS QUE PRESERVAM O FORMULÁRIO ATUAL
-- ------------------------------------------------------------
alter table public.camisa_solicitacoes
  add column if not exists origem text not null default 'SISTEMA',
  add column if not exists equipe text,
  add column if not exists comprovante_path text,
  add column if not exists comprovante_nome text,
  add column if not exists comprovante_tipo text,
  add column if not exists comprovante_tamanho bigint,
  add column if not exists valor_total numeric(12,2) not null default 0;

-- Permite registrar entrega parcial de um item.
alter table public.camisa_solicitacao_itens
  drop constraint if exists camisa_solicitacao_itens_status_check;

alter table public.camisa_solicitacao_itens
  add constraint camisa_solicitacao_itens_status_check
  check (status in ('SOLICITADO','AGUARDANDO_REPOSICAO','PRONTO_ENTREGA','PARCIALMENTE_ENTREGUE','ENTREGUE','CANCELADO'));

-- ------------------------------------------------------------
-- 2. BUCKET PRIVADO PARA COMPROVANTES
-- ------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'camisas-comprovantes',
  'camisas-comprovantes',
  false,
  10485760,
  array['application/pdf','image/jpeg','image/png']
)
on conflict (id) do update
set public = excluded.public,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

-- Upload público somente no bucket específico. Não existe leitura pública.
drop policy if exists "camisas comprovante upload anon" on storage.objects;
create policy "camisas comprovante upload anon"
on storage.objects
for insert
to anon
with check (bucket_id = 'camisas-comprovantes');

drop policy if exists "camisas comprovante upload auth" on storage.objects;
create policy "camisas comprovante upload auth"
on storage.objects
for insert
to authenticated
with check (bucket_id = 'camisas-comprovantes' and usuario_pode_editar());

drop policy if exists "camisas comprovante leitura auth" on storage.objects;
create policy "camisas comprovante leitura auth"
on storage.objects
for select
to authenticated
using (bucket_id = 'camisas-comprovantes' and usuario_autenticado_ativo());

-- ------------------------------------------------------------
-- 3. CAMADA PRIVADA PARA O FORMULÁRIO PÚBLICO
-- ------------------------------------------------------------
create schema if not exists private;
revoke all on schema private from public;
grant usage on schema private to anon, authenticated;

create or replace function private.camisa_buscar_encontreiros(p_termo text)
returns table (pessoa_id uuid, nome_completo text)
language sql
stable
security definer
set search_path = ''
as $$
  select distinct p.id, p.nome_completo
  from public.pessoas p
  where p.status = 'ATIVO'
    and length(trim(coalesce(p_termo,''))) >= 3
    and exists (
      select 1 from public.encontreiros e where e.pessoa_id = p.id
    )
    and translate(lower(p.nome_completo),
      'áàâãäéèêëíìîïóòôõöúùûüç',
      'aaaaaeeeeiiiiooooouuuuc')
      like '%' || translate(lower(trim(p_termo)),
      'áàâãäéèêëíìîïóòôõöúùûüç',
      'aaaaaeeeeiiiiooooouuuuc') || '%'
  order by p.nome_completo
  limit 5;
$$;

create or replace function private.camisa_registrar_solicitacao(
  p_encontro_id uuid,
  p_eh_encontreiro boolean,
  p_solicitante_pessoa_id uuid,
  p_nome_solicitante text,
  p_telefone_solicitante text,
  p_email_solicitante text,
  p_equipe text,
  p_beneficiario_pessoa_id uuid,
  p_nome_beneficiario text,
  p_observacoes text,
  p_comprovante_path text,
  p_comprovante_nome text,
  p_comprovante_tipo text,
  p_comprovante_tamanho bigint,
  p_valor_total numeric,
  p_itens jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_solicitacao_id uuid;
  v_nome_solicitante text;
  v_item jsonb;
  v_cor text;
  v_tamanho text;
  v_quantidade integer;
begin
  if not exists (select 1 from public.encontros where id = p_encontro_id) then
    raise exception 'Encontro inválido.';
  end if;

  if coalesce(p_eh_encontreiro, false) then
    if p_solicitante_pessoa_id is null then
      raise exception 'Selecione seu nome na lista de encontreiros.';
    end if;

    select p.nome_completo into v_nome_solicitante
    from public.pessoas p
    where p.id = p_solicitante_pessoa_id
      and p.status = 'ATIVO'
      and exists (select 1 from public.encontreiros e where e.pessoa_id = p.id);

    if v_nome_solicitante is null then
      raise exception 'O cadastro selecionado não foi localizado como encontreiro.';
    end if;
  else
    v_nome_solicitante := trim(coalesce(p_nome_solicitante,''));
    if length(v_nome_solicitante) < 3 then
      raise exception 'Informe o nome do solicitante.';
    end if;
  end if;

  if length(trim(coalesce(p_nome_beneficiario,''))) < 3 then
    raise exception 'Informe o beneficiário.';
  end if;

  if (nullif(trim(coalesce(p_telefone_solicitante,'')), '') is null)
     and (nullif(trim(coalesce(p_email_solicitante,'')), '') is null) then
    raise exception 'Informe telefone ou e-mail para contato.';
  end if;

  if p_itens is null or jsonb_typeof(p_itens) <> 'array' or jsonb_array_length(p_itens) = 0 then
    raise exception 'Informe pelo menos uma camisa.';
  end if;

  if nullif(trim(coalesce(p_comprovante_path,'')), '') is null then
    raise exception 'Comprovante de pagamento obrigatório.';
  end if;

  insert into public.camisa_solicitacoes (
    encontro_id, eh_encontreiro, solicitante_pessoa_id, nome_solicitante,
    telefone_solicitante, email_solicitante, equipe,
    beneficiario_pessoa_id, nome_beneficiario,
    status, origem, observacoes,
    comprovante_path, comprovante_nome, comprovante_tipo, comprovante_tamanho, valor_total
  ) values (
    p_encontro_id, coalesce(p_eh_encontreiro,false),
    case when p_eh_encontreiro then p_solicitante_pessoa_id else null end,
    v_nome_solicitante,
    nullif(trim(coalesce(p_telefone_solicitante,'')), ''),
    nullif(trim(coalesce(p_email_solicitante,'')), ''),
    nullif(trim(coalesce(p_equipe,'')), ''),
    p_beneficiario_pessoa_id,
    trim(p_nome_beneficiario),
    'ABERTA', 'FORMULARIO_PUBLICO', p_observacoes,
    p_comprovante_path, p_comprovante_nome, p_comprovante_tipo, p_comprovante_tamanho,
    coalesce(p_valor_total,0)
  ) returning id into v_solicitacao_id;

  for v_item in select value from jsonb_array_elements(p_itens)
  loop
    v_cor := trim(coalesce(v_item->>'cor',''));
    v_tamanho := upper(trim(coalesce(v_item->>'tamanho','')));
    v_quantidade := coalesce((v_item->>'quantidade')::integer,0);

    if v_cor = '' then raise exception 'Cor inválida.'; end if;
    if v_tamanho not in ('PP','P','M','G','GG','XG','XXG') then raise exception 'Tamanho inválido: %', v_tamanho; end if;
    if v_quantidade <= 0 then raise exception 'Quantidade inválida.'; end if;

    insert into public.camisa_solicitacao_itens (
      solicitacao_id, cor, tamanho, quantidade_solicitada, quantidade_entregue, status
    ) values (
      v_solicitacao_id, v_cor, v_tamanho, v_quantidade, 0, 'SOLICITADO'
    );
  end loop;

  return jsonb_build_object('success', true, 'request_id', v_solicitacao_id, 'status', 'ABERTA');
end;
$$;

-- Wrappers expostos via RPC. As funções privilegiadas continuam fora do schema exposto.
create or replace function public.camisa_buscar_encontreiros_publico(p_termo text)
returns table (pessoa_id uuid, nome_completo text)
language sql
stable
security invoker
set search_path = ''
as $$
  select * from private.camisa_buscar_encontreiros(p_termo);
$$;

create or replace function public.camisa_registrar_solicitacao_publica(
  p_encontro_id uuid,
  p_eh_encontreiro boolean,
  p_solicitante_pessoa_id uuid,
  p_nome_solicitante text,
  p_telefone_solicitante text,
  p_email_solicitante text,
  p_equipe text,
  p_beneficiario_pessoa_id uuid,
  p_nome_beneficiario text,
  p_observacoes text,
  p_comprovante_path text,
  p_comprovante_nome text,
  p_comprovante_tipo text,
  p_comprovante_tamanho bigint,
  p_valor_total numeric,
  p_itens jsonb
)
returns jsonb
language sql
security invoker
set search_path = ''
as $$
  select private.camisa_registrar_solicitacao(
    p_encontro_id, p_eh_encontreiro, p_solicitante_pessoa_id, p_nome_solicitante,
    p_telefone_solicitante, p_email_solicitante, p_equipe,
    p_beneficiario_pessoa_id, p_nome_beneficiario, p_observacoes,
    p_comprovante_path, p_comprovante_nome, p_comprovante_tipo, p_comprovante_tamanho,
    p_valor_total, p_itens
  );
$$;

revoke execute on function private.camisa_buscar_encontreiros(text) from public;
revoke execute on function private.camisa_registrar_solicitacao(uuid,boolean,uuid,text,text,text,text,uuid,text,text,text,text,text,bigint,numeric,jsonb) from public;
grant execute on function private.camisa_buscar_encontreiros(text) to anon, authenticated;
grant execute on function private.camisa_registrar_solicitacao(uuid,boolean,uuid,text,text,text,text,uuid,text,text,text,text,text,bigint,numeric,jsonb) to anon, authenticated;

revoke execute on function public.camisa_buscar_encontreiros_publico(text) from public;
revoke execute on function public.camisa_registrar_solicitacao_publica(uuid,boolean,uuid,text,text,text,text,uuid,text,text,text,text,text,bigint,numeric,jsonb) from public;
grant execute on function public.camisa_buscar_encontreiros_publico(text) to anon, authenticated;
grant execute on function public.camisa_registrar_solicitacao_publica(uuid,boolean,uuid,text,text,text,text,uuid,text,text,text,text,text,bigint,numeric,jsonb) to anon, authenticated;

-- ------------------------------------------------------------
-- 4. VIEWS DO DASHBOARD
-- ------------------------------------------------------------
create or replace view public.vw_camisa_dashboard
with (security_invoker = true)
as
with combinacoes as (
  select s.encontro_id, i.cor, i.tamanho
  from public.camisa_solicitacoes s
  join public.camisa_solicitacao_itens i on i.solicitacao_id = s.id
  where s.status <> 'CANCELADA' and i.status <> 'CANCELADO'
  union
  select r.encontro_id, ri.cor, ri.tamanho
  from public.camisa_reposicoes r
  join public.camisa_reposicao_itens ri on ri.reposicao_id = r.id
  where r.encontro_id is not null and r.status <> 'CANCELADA'
  union
  select e.id, ce.cor, ce.tamanho
  from public.encontros e cross join public.camisa_estoque ce
  where e.status in ('ATIVO','PLANEJADO') and ce.ativo = true
), demanda as (
  select s.encontro_id, i.cor, i.tamanho,
         sum(i.quantidade_solicitada)::integer quantidade_solicitada,
         sum(i.quantidade_entregue)::integer quantidade_entregue,
         sum(i.quantidade_solicitada - i.quantidade_entregue)::integer demanda_aberta
  from public.camisa_solicitacoes s
  join public.camisa_solicitacao_itens i on i.solicitacao_id = s.id
  where s.status <> 'CANCELADA' and i.status <> 'CANCELADO'
  group by s.encontro_id, i.cor, i.tamanho
), reposicao as (
  select r.encontro_id, ri.cor, ri.tamanho,
         sum(ri.quantidade_pedida - ri.quantidade_recebida)::integer em_reposicao
  from public.camisa_reposicoes r
  join public.camisa_reposicao_itens ri on ri.reposicao_id = r.id
  where r.status not in ('CANCELADA','RECEBIDA')
  group by r.encontro_id, ri.cor, ri.tamanho
)
select c.encontro_id,
       e.nome as encontro_nome,
       c.cor,
       c.tamanho,
       coalesce(est.quantidade_fisica,0)::integer as estoque_fisico,
       coalesce(d.quantidade_solicitada,0)::integer as quantidade_solicitada,
       coalesce(d.quantidade_entregue,0)::integer as quantidade_entregue,
       coalesce(d.demanda_aberta,0)::integer as demanda_aberta,
       coalesce(r.em_reposicao,0)::integer as em_reposicao,
       least(coalesce(d.demanda_aberta,0), coalesce(est.quantidade_fisica,0))::integer as pronto_para_entrega,
       greatest(coalesce(d.demanda_aberta,0) - coalesce(est.quantidade_fisica,0) - coalesce(r.em_reposicao,0), 0)::integer as solicitar_reposicao
from combinacoes c
join public.encontros e on e.id = c.encontro_id
left join demanda d on d.encontro_id=c.encontro_id and d.cor=c.cor and d.tamanho=c.tamanho
left join reposicao r on r.encontro_id=c.encontro_id and r.cor=c.cor and r.tamanho=c.tamanho
left join public.camisa_estoque est on est.cor=c.cor and est.tamanho=c.tamanho and est.ativo=true;

create or replace view public.vw_camisa_solicitacoes_detalhes
with (security_invoker = true)
as
select s.id solicitacao_id, s.criado_em, s.encontro_id, e.nome encontro_nome,
       s.eh_encontreiro, s.nome_solicitante, s.telefone_solicitante, s.email_solicitante,
       s.equipe, s.nome_beneficiario, s.status status_solicitacao, s.comprovante_path,
       i.id item_id, i.cor, i.tamanho, i.quantidade_solicitada, i.quantidade_entregue,
       (i.quantidade_solicitada - i.quantidade_entregue)::integer quantidade_pendente,
       case
         when i.status='CANCELADO' then 'CANCELADO'
         when i.quantidade_entregue >= i.quantidade_solicitada then 'ENTREGUE'
         when i.quantidade_entregue > 0 then 'PARCIALMENTE_ENTREGUE'
         else 'PENDENTE'
       end status_item
from public.camisa_solicitacoes s
join public.encontros e on e.id=s.encontro_id
join public.camisa_solicitacao_itens i on i.solicitacao_id=s.id;

create or replace view public.vw_camisa_reposicoes_detalhes
with (security_invoker = true)
as
select r.id reposicao_id, r.encontro_id, e.nome encontro_nome, r.criado_em,
       r.status status_reposicao, r.fornecedor,
       ri.id item_id, ri.cor, ri.tamanho, ri.quantidade_pedida, ri.quantidade_recebida,
       (ri.quantidade_pedida-ri.quantidade_recebida)::integer quantidade_pendente
from public.camisa_reposicoes r
left join public.encontros e on e.id=r.encontro_id
join public.camisa_reposicao_itens ri on ri.reposicao_id=r.id;

grant select on public.vw_camisa_dashboard to authenticated;
grant select on public.vw_camisa_solicitacoes_detalhes to authenticated;
grant select on public.vw_camisa_reposicoes_detalhes to authenticated;
revoke all on public.vw_camisa_dashboard from anon;
revoke all on public.vw_camisa_solicitacoes_detalhes from anon;
revoke all on public.vw_camisa_reposicoes_detalhes from anon;

-- ------------------------------------------------------------
-- 5. OPERAÇÕES ADMINISTRATIVAS ATÔMICAS
-- ------------------------------------------------------------
create or replace function public.camisa_criar_reposicao(p_encontro_id uuid, p_itens jsonb, p_observacoes text default null)
returns uuid
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_id uuid;
  v_item jsonb;
  v_operador uuid;
begin
  if not public.usuario_pode_editar() then raise exception 'Usuário sem permissão de edição.'; end if;
  select id into v_operador from public.usuarios where auth_user_id = auth.uid() and status='ATIVO' limit 1;
  insert into public.camisa_reposicoes(encontro_id,status,observacoes,criado_por)
  values(p_encontro_id,'PEDIDO_REALIZADO',p_observacoes,v_operador) returning id into v_id;
  for v_item in select value from jsonb_array_elements(p_itens)
  loop
    insert into public.camisa_reposicao_itens(reposicao_id,cor,tamanho,quantidade_pedida)
    values(v_id, trim(v_item->>'cor'), upper(trim(v_item->>'tamanho')), (v_item->>'quantidade')::integer);
  end loop;
  update public.camisa_reposicoes set pedido_em=now(), atualizado_em=now() where id=v_id;
  return v_id;
end;
$$;

create or replace function public.camisa_receber_reposicao(p_reposicao_item_id uuid, p_quantidade integer)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_item public.camisa_reposicao_itens%rowtype;
  v_rep public.camisa_reposicoes%rowtype;
  v_est public.camisa_estoque%rowtype;
  v_operador uuid;
  v_nova_recebida integer;
begin
  if not public.usuario_pode_editar() then raise exception 'Usuário sem permissão de edição.'; end if;
  if p_quantidade <= 0 then raise exception 'Quantidade inválida.'; end if;
  select * into v_item from public.camisa_reposicao_itens where id=p_reposicao_item_id for update;
  if not found then raise exception 'Item de reposição não encontrado.'; end if;
  v_nova_recebida := v_item.quantidade_recebida + p_quantidade;
  if v_nova_recebida > v_item.quantidade_pedida then raise exception 'Recebimento excede quantidade pedida.'; end if;
  select * into v_rep from public.camisa_reposicoes where id=v_item.reposicao_id for update;
  select id into v_operador from public.usuarios where auth_user_id=auth.uid() and status='ATIVO' limit 1;

  insert into public.camisa_estoque(cor,tamanho,quantidade_fisica)
  values(v_item.cor,v_item.tamanho,0)
  on conflict(cor,tamanho) do nothing;
  select * into v_est from public.camisa_estoque where cor=v_item.cor and tamanho=v_item.tamanho for update;
  update public.camisa_estoque set quantidade_fisica=v_est.quantidade_fisica+p_quantidade, atualizado_em=now() where id=v_est.id;
  update public.camisa_reposicao_itens set quantidade_recebida=v_nova_recebida, atualizado_em=now() where id=v_item.id;
  insert into public.camisa_movimentacoes(estoque_id,reposicao_item_id,encontro_id,tipo,quantidade,saldo_anterior,saldo_posterior,operador_id)
  values(v_est.id,v_item.id,v_rep.encontro_id,'REPOSICAO_RECEBIDA',p_quantidade,v_est.quantidade_fisica,v_est.quantidade_fisica+p_quantidade,v_operador);

  if not exists(select 1 from public.camisa_reposicao_itens where reposicao_id=v_rep.id and quantidade_recebida<quantidade_pedida) then
    update public.camisa_reposicoes set status='RECEBIDA', recebido_em=now(), atualizado_em=now() where id=v_rep.id;
  else
    update public.camisa_reposicoes set status='RECEBIMENTO_PARCIAL', atualizado_em=now() where id=v_rep.id;
  end if;
  return jsonb_build_object('success',true,'saldo_posterior',v_est.quantidade_fisica+p_quantidade);
end;
$$;

create or replace function public.camisa_entregar_item(p_solicitacao_item_id uuid, p_quantidade integer)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_item public.camisa_solicitacao_itens%rowtype;
  v_sol public.camisa_solicitacoes%rowtype;
  v_est public.camisa_estoque%rowtype;
  v_operador uuid;
  v_nova_entregue integer;
  v_status text;
begin
  if not public.usuario_pode_editar() then raise exception 'Usuário sem permissão de edição.'; end if;
  if p_quantidade <= 0 then raise exception 'Quantidade inválida.'; end if;
  select * into v_item from public.camisa_solicitacao_itens where id=p_solicitacao_item_id for update;
  if not found then raise exception 'Item não encontrado.'; end if;
  if v_item.status='CANCELADO' then raise exception 'Item cancelado.'; end if;
  v_nova_entregue := v_item.quantidade_entregue+p_quantidade;
  if v_nova_entregue > v_item.quantidade_solicitada then raise exception 'Entrega excede quantidade solicitada.'; end if;
  select * into v_sol from public.camisa_solicitacoes where id=v_item.solicitacao_id for update;
  select * into v_est from public.camisa_estoque where cor=v_item.cor and tamanho=v_item.tamanho and ativo=true for update;
  if not found or v_est.quantidade_fisica < p_quantidade then raise exception 'Estoque insuficiente para esta entrega.'; end if;
  select id into v_operador from public.usuarios where auth_user_id=auth.uid() and status='ATIVO' limit 1;
  v_status := case when v_nova_entregue=v_item.quantidade_solicitada then 'ENTREGUE' else 'PARCIALMENTE_ENTREGUE' end;
  update public.camisa_estoque set quantidade_fisica=v_est.quantidade_fisica-p_quantidade, atualizado_em=now() where id=v_est.id;
  update public.camisa_solicitacao_itens set quantidade_entregue=v_nova_entregue,status=v_status,entregue_em=case when v_status='ENTREGUE' then now() else entregue_em end,atualizado_em=now() where id=v_item.id;
  insert into public.camisa_movimentacoes(estoque_id,solicitacao_item_id,encontro_id,tipo,quantidade,saldo_anterior,saldo_posterior,operador_id)
  values(v_est.id,v_item.id,v_sol.encontro_id,'ENTREGA',p_quantidade,v_est.quantidade_fisica,v_est.quantidade_fisica-p_quantidade,v_operador);
  if not exists(select 1 from public.camisa_solicitacao_itens where solicitacao_id=v_sol.id and status not in ('ENTREGUE','CANCELADO')) then
    update public.camisa_solicitacoes set status='CONCLUIDA', atualizado_em=now() where id=v_sol.id;
  end if;
  return jsonb_build_object('success',true,'saldo_posterior',v_est.quantidade_fisica-p_quantidade,'status_item',v_status);
end;
$$;

create or replace function public.camisa_ajustar_estoque(p_cor text,p_tamanho text,p_quantidade integer,p_tipo text,p_observacoes text default null)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_est public.camisa_estoque%rowtype;
  v_operador uuid;
  v_delta integer;
  v_novo integer;
  v_mov_tipo text;
begin
  if not public.usuario_pode_editar() then raise exception 'Usuário sem permissão de edição.'; end if;
  if p_quantidade<=0 then raise exception 'Quantidade inválida.'; end if;
  if upper(p_tipo) not in ('ENTRADA','SAIDA') then raise exception 'Tipo inválido.'; end if;
  insert into public.camisa_estoque(cor,tamanho,quantidade_fisica) values(trim(p_cor),upper(trim(p_tamanho)),0) on conflict(cor,tamanho) do nothing;
  select * into v_est from public.camisa_estoque where cor=trim(p_cor) and tamanho=upper(trim(p_tamanho)) for update;
  v_delta := case when upper(p_tipo)='ENTRADA' then p_quantidade else -p_quantidade end;
  v_novo := v_est.quantidade_fisica+v_delta;
  if v_novo<0 then raise exception 'Ajuste deixaria o estoque negativo.'; end if;
  v_mov_tipo := case when upper(p_tipo)='ENTRADA' then 'AJUSTE_ENTRADA' else 'AJUSTE_SAIDA' end;
  select id into v_operador from public.usuarios where auth_user_id=auth.uid() and status='ATIVO' limit 1;
  update public.camisa_estoque set quantidade_fisica=v_novo, atualizado_em=now() where id=v_est.id;
  insert into public.camisa_movimentacoes(estoque_id,tipo,quantidade,saldo_anterior,saldo_posterior,observacoes,operador_id)
  values(v_est.id,v_mov_tipo,p_quantidade,v_est.quantidade_fisica,v_novo,p_observacoes,v_operador);
  return jsonb_build_object('success',true,'saldo_posterior',v_novo);
end;
$$;

revoke execute on function public.camisa_criar_reposicao(uuid,jsonb,text) from public, anon;
revoke execute on function public.camisa_receber_reposicao(uuid,integer) from public, anon;
revoke execute on function public.camisa_entregar_item(uuid,integer) from public, anon;
revoke execute on function public.camisa_ajustar_estoque(text,text,integer,text,text) from public, anon;
grant execute on function public.camisa_criar_reposicao(uuid,jsonb,text) to authenticated;
grant execute on function public.camisa_receber_reposicao(uuid,integer) to authenticated;
grant execute on function public.camisa_entregar_item(uuid,integer) to authenticated;
grant execute on function public.camisa_ajustar_estoque(text,text,integer,text,text) to authenticated;

commit;

-- Atualiza cache do PostgREST para novas views/RPCs.
notify pgrst, 'reload schema';
