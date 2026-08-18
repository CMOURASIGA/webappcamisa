-- AJUSTES DE ESTOQUE / RESERVAS / REPOSICAO
-- Objetivos:
-- 1) solicitacao continua 100% livre, sem bloquear por estoque;
-- 2) estoque representa saldo fisico recebido e ainda nao entregue;
-- 3) estoque recebido e automaticamente comprometido com as solicitacoes mais antigas (FIFO);
-- 4) reposicao = demanda pendente sem cobertura;
-- 5) CRUD permite corrigir ou excluir saldo informado incorretamente;
-- 6) primeira leva da planilha (linhas 2 a 31) = 34 recebidas, 13 ja entregues, saldo atual 21 totalmente comprometido;
--    linhas 32 em diante ficam sem cobertura e devem totalizar 13 para confeccao.

begin;

-- -----------------------------------------------------------------------------
-- COBERTURA / RESERVA POR ITEM
-- -----------------------------------------------------------------------------
alter table public.camisa_solicitacao_itens
  add column if not exists quantidade_reservada integer not null default 0;

alter table public.camisa_solicitacao_itens
  drop constraint if exists camisa_quantidade_reservada_valida;

alter table public.camisa_solicitacao_itens
  add constraint camisa_quantidade_reservada_valida
  check (
    quantidade_reservada >= 0
    and quantidade_reservada + quantidade_entregue <= quantidade_solicitada
  );

create index if not exists idx_camisa_itens_reserva_combo
  on public.camisa_solicitacao_itens(cor, tamanho, quantidade_reservada);

-- Recalcula quais solicitacoes estao cobertas pelo saldo fisico.
-- Regra FIFO: solicitacoes mais antigas recebem cobertura primeiro.
create or replace function private.camisa_recalcular_reservas_combo(
  p_cor text,
  p_tamanho text
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_disponivel integer := 0;
  v_pendente integer;
  v_reservar integer;
  r record;
begin
  select coalesce(sum(quantidade_fisica), 0)::integer
    into v_disponivel
  from public.camisa_estoque
  where cor = trim(p_cor)
    and tamanho = upper(trim(p_tamanho))
    and ativo = true;

  update public.camisa_solicitacao_itens i
     set quantidade_reservada = 0,
         atualizado_em = now()
  from public.camisa_solicitacoes s
  where s.id = i.solicitacao_id
    and i.cor = trim(p_cor)
    and i.tamanho = upper(trim(p_tamanho))
    and s.status <> 'CANCELADA'
    and i.status <> 'CANCELADO'
    and i.quantidade_reservada <> 0;

  for r in
    select i.id,
           greatest(i.quantidade_solicitada - i.quantidade_entregue, 0)::integer as pendente
    from public.camisa_solicitacao_itens i
    join public.camisa_solicitacoes s on s.id = i.solicitacao_id
    where i.cor = trim(p_cor)
      and i.tamanho = upper(trim(p_tamanho))
      and s.status <> 'CANCELADA'
      and i.status <> 'CANCELADO'
      and i.quantidade_solicitada > i.quantidade_entregue
    order by s.criado_em, i.criado_em, i.id
    for update of i
  loop
    exit when v_disponivel <= 0;
    v_pendente := r.pendente;
    v_reservar := least(v_pendente, v_disponivel);

    update public.camisa_solicitacao_itens
       set quantidade_reservada = v_reservar,
           atualizado_em = now()
     where id = r.id;

    v_disponivel := v_disponivel - v_reservar;
  end loop;
end;
$$;

revoke all on function private.camisa_recalcular_reservas_combo(text,text) from public, anon, authenticated;

-- Trigger para novas solicitacoes / mudancas de entrega.
create or replace function private.trg_camisa_item_recalcular_reservas()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'DELETE' then
    perform private.camisa_recalcular_reservas_combo(old.cor, old.tamanho);
    return old;
  end if;

  if tg_op = 'UPDATE' and (old.cor is distinct from new.cor or old.tamanho is distinct from new.tamanho) then
    perform private.camisa_recalcular_reservas_combo(old.cor, old.tamanho);
  end if;

  perform private.camisa_recalcular_reservas_combo(new.cor, new.tamanho);
  return new;
end;
$$;

revoke all on function private.trg_camisa_item_recalcular_reservas() from public, anon, authenticated;

drop trigger if exists trg_camisa_item_recalcular_reservas on public.camisa_solicitacao_itens;
create trigger trg_camisa_item_recalcular_reservas
after insert or delete or update of quantidade_solicitada, quantidade_entregue, status, cor, tamanho
on public.camisa_solicitacao_itens
for each row execute function private.trg_camisa_item_recalcular_reservas();

-- Trigger para qualquer alteracao do saldo fisico.
create or replace function private.trg_camisa_estoque_recalcular_reservas()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'DELETE' then
    perform private.camisa_recalcular_reservas_combo(old.cor, old.tamanho);
    return old;
  end if;

  if tg_op = 'UPDATE' and (old.cor is distinct from new.cor or old.tamanho is distinct from new.tamanho) then
    perform private.camisa_recalcular_reservas_combo(old.cor, old.tamanho);
  end if;

  perform private.camisa_recalcular_reservas_combo(new.cor, new.tamanho);
  return new;
end;
$$;

revoke all on function private.trg_camisa_estoque_recalcular_reservas() from public, anon, authenticated;

drop trigger if exists trg_camisa_estoque_recalcular_reservas on public.camisa_estoque;
create trigger trg_camisa_estoque_recalcular_reservas
after insert or delete or update of quantidade_fisica, ativo, cor, tamanho
on public.camisa_estoque
for each row execute function private.trg_camisa_estoque_recalcular_reservas();

-- -----------------------------------------------------------------------------
-- ENTREGA: somente quantidade ja coberta/reservada pode ser entregue.
-- -----------------------------------------------------------------------------
create or replace function public.camisa_entregar_item(
  p_solicitacao_item_id uuid,
  p_quantidade integer
)
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
  if not public.usuario_pode_editar() then
    raise exception 'Usuário sem permissão de edição.';
  end if;
  if p_quantidade <= 0 then raise exception 'Quantidade inválida.'; end if;

  select * into v_item
  from public.camisa_solicitacao_itens
  where id = p_solicitacao_item_id
  for update;

  if not found then raise exception 'Item não encontrado.'; end if;
  if v_item.status = 'CANCELADO' then raise exception 'Item cancelado.'; end if;

  v_nova_entregue := v_item.quantidade_entregue + p_quantidade;
  if v_nova_entregue > v_item.quantidade_solicitada then
    raise exception 'Entrega excede quantidade solicitada.';
  end if;
  if v_item.quantidade_reservada < p_quantidade then
    raise exception 'Esta solicitação ainda não possui quantidade recebida suficiente para entrega.';
  end if;

  select * into v_sol
  from public.camisa_solicitacoes
  where id = v_item.solicitacao_id
  for update;

  select * into v_est
  from public.camisa_estoque
  where cor = v_item.cor
    and tamanho = v_item.tamanho
    and ativo = true
  for update;

  if not found or v_est.quantidade_fisica < p_quantidade then
    raise exception 'Saldo físico insuficiente para esta entrega.';
  end if;

  select id into v_operador
  from public.usuarios
  where auth_user_id = auth.uid() and status = 'ATIVO'
  limit 1;

  v_status := case
    when v_nova_entregue = v_item.quantidade_solicitada then 'ENTREGUE'
    else 'PARCIALMENTE_ENTREGUE'
  end;

  -- Primeiro quita a reserva da propria solicitacao.
  update public.camisa_solicitacao_itens
     set quantidade_entregue = v_nova_entregue,
         quantidade_reservada = greatest(v_item.quantidade_reservada - p_quantidade, 0),
         status = v_status,
         entregue_em = case when v_status = 'ENTREGUE' then now() else entregue_em end,
         atualizado_em = now()
   where id = v_item.id;

  -- Depois baixa o saldo fisico. O trigger recalcula as demais coberturas.
  update public.camisa_estoque
     set quantidade_fisica = v_est.quantidade_fisica - p_quantidade,
         atualizado_em = now()
   where id = v_est.id;

  insert into public.camisa_movimentacoes(
    estoque_id, solicitacao_item_id, encontro_id, tipo, quantidade,
    saldo_anterior, saldo_posterior, operador_id
  ) values (
    v_est.id, v_item.id, v_sol.encontro_id, 'ENTREGA', p_quantidade,
    v_est.quantidade_fisica, v_est.quantidade_fisica - p_quantidade, v_operador
  );

  if not exists (
    select 1
    from public.camisa_solicitacao_itens
    where solicitacao_id = v_sol.id
      and status not in ('ENTREGUE','CANCELADO')
  ) then
    update public.camisa_solicitacoes
       set status = 'CONCLUIDA', atualizado_em = now()
     where id = v_sol.id;
  end if;

  return jsonb_build_object(
    'success', true,
    'saldo_posterior', v_est.quantidade_fisica - p_quantidade,
    'status_item', v_status
  );
end;
$$;

revoke execute on function public.camisa_entregar_item(uuid,integer) from public, anon;
grant execute on function public.camisa_entregar_item(uuid,integer) to authenticated;

-- -----------------------------------------------------------------------------
-- RECEBIMENTO / CRUD DE SALDO
-- -----------------------------------------------------------------------------
create or replace function public.camisa_ajustar_estoque(
  p_cor text,
  p_tamanho text,
  p_quantidade integer,
  p_tipo text,
  p_observacoes text default null
)
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
  if p_quantidade <= 0 then raise exception 'Quantidade inválida.'; end if;
  if upper(p_tipo) not in ('ENTRADA','SAIDA') then raise exception 'Tipo inválido.'; end if;

  insert into public.camisa_estoque(cor,tamanho,quantidade_fisica,ativo)
  values(trim(p_cor), upper(trim(p_tamanho)), 0, true)
  on conflict(cor,tamanho)
  do update set ativo = true, atualizado_em = now();

  select * into v_est
  from public.camisa_estoque
  where cor = trim(p_cor) and tamanho = upper(trim(p_tamanho))
  for update;

  v_delta := case when upper(p_tipo) = 'ENTRADA' then p_quantidade else -p_quantidade end;
  v_novo := v_est.quantidade_fisica + v_delta;
  if v_novo < 0 then raise exception 'Ajuste deixaria o estoque negativo.'; end if;

  v_mov_tipo := case when upper(p_tipo) = 'ENTRADA' then 'AJUSTE_ENTRADA' else 'AJUSTE_SAIDA' end;

  select id into v_operador
  from public.usuarios
  where auth_user_id = auth.uid() and status = 'ATIVO'
  limit 1;

  update public.camisa_estoque
     set quantidade_fisica = v_novo,
         ativo = true,
         atualizado_em = now()
   where id = v_est.id;

  insert into public.camisa_movimentacoes(
    estoque_id,tipo,quantidade,saldo_anterior,saldo_posterior,observacoes,operador_id
  ) values (
    v_est.id,v_mov_tipo,p_quantidade,v_est.quantidade_fisica,v_novo,p_observacoes,v_operador
  );

  return jsonb_build_object('success',true,'saldo_posterior',v_novo);
end;
$$;

create or replace function public.camisa_definir_estoque(
  p_estoque_id uuid,
  p_quantidade integer,
  p_observacoes text default null
)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_est public.camisa_estoque%rowtype;
  v_operador uuid;
  v_delta integer;
  v_tipo text;
begin
  if not public.usuario_pode_editar() then raise exception 'Usuário sem permissão de edição.'; end if;
  if p_quantidade < 0 then raise exception 'Quantidade não pode ser negativa.'; end if;

  select * into v_est
  from public.camisa_estoque
  where id = p_estoque_id
  for update;
  if not found then raise exception 'Registro de estoque não encontrado.'; end if;

  v_delta := p_quantidade - v_est.quantidade_fisica;

  select id into v_operador
  from public.usuarios
  where auth_user_id = auth.uid() and status = 'ATIVO'
  limit 1;

  update public.camisa_estoque
     set quantidade_fisica = p_quantidade,
         ativo = true,
         atualizado_em = now()
   where id = v_est.id;

  if v_delta <> 0 then
    v_tipo := case when v_delta > 0 then 'AJUSTE_ENTRADA' else 'AJUSTE_SAIDA' end;
    insert into public.camisa_movimentacoes(
      estoque_id,tipo,quantidade,saldo_anterior,saldo_posterior,observacoes,operador_id
    ) values (
      v_est.id,v_tipo,abs(v_delta),v_est.quantidade_fisica,p_quantidade,
      coalesce(p_observacoes,'Correção manual de saldo'),v_operador
    );
  end if;

  return jsonb_build_object('success',true,'saldo_posterior',p_quantidade);
end;
$$;

create or replace function public.camisa_excluir_estoque(
  p_estoque_id uuid,
  p_observacoes text default null
)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_est public.camisa_estoque%rowtype;
  v_operador uuid;
begin
  if not public.usuario_pode_editar() then raise exception 'Usuário sem permissão de edição.'; end if;

  select * into v_est
  from public.camisa_estoque
  where id = p_estoque_id
  for update;
  if not found then raise exception 'Registro de estoque não encontrado.'; end if;

  select id into v_operador
  from public.usuarios
  where auth_user_id = auth.uid() and status = 'ATIVO'
  limit 1;

  if v_est.quantidade_fisica > 0 then
    insert into public.camisa_movimentacoes(
      estoque_id,tipo,quantidade,saldo_anterior,saldo_posterior,observacoes,operador_id
    ) values (
      v_est.id,'AJUSTE_SAIDA',v_est.quantidade_fisica,v_est.quantidade_fisica,0,
      coalesce(p_observacoes,'Registro de estoque excluído/cancelado'),v_operador
    );
  end if;

  update public.camisa_estoque
     set quantidade_fisica = 0,
         ativo = false,
         atualizado_em = now()
   where id = v_est.id;

  return jsonb_build_object('success',true);
end;
$$;

revoke execute on function public.camisa_ajustar_estoque(text,text,integer,text,text) from public, anon;
revoke execute on function public.camisa_definir_estoque(uuid,integer,text) from public, anon;
revoke execute on function public.camisa_excluir_estoque(uuid,text) from public, anon;
grant execute on function public.camisa_ajustar_estoque(text,text,integer,text,text) to authenticated;
grant execute on function public.camisa_definir_estoque(uuid,integer,text) to authenticated;
grant execute on function public.camisa_excluir_estoque(uuid,text) to authenticated;

-- -----------------------------------------------------------------------------
-- CORRECAO DA PRIMEIRA LEVA IMPORTADA
-- Linhas 2..31 da aba Itens Solicitacao = 34 recebidas.
-- Destas, 13 ja constam como entregues na planilha; saldo fisico atual = 21.
-- O saldo remanescente fica integralmente reservado para as solicitacoes antigas.
-- -----------------------------------------------------------------------------
update public.camisa_estoque set quantidade_fisica = 0, ativo = false, atualizado_em = now();

insert into public.camisa_estoque(cor,tamanho,quantidade_fisica,ativo)
values
  ('Azul','XXG',1,true),
  ('Branca','XXG',1,true),
  ('Marrom','PP',4,true),
  ('Marrom','P',3,true),
  ('Marrom','M',8,true),
  ('Marrom','G',1,true),
  ('Marrom','GG',2,true),
  ('Marrom','XG',0,true),
  ('Marrom','XXG',1,true)
on conflict(cor,tamanho)
do update set quantidade_fisica = excluded.quantidade_fisica,
              ativo = excluded.ativo,
              atualizado_em = now();

-- Recalcula explicitamente todas as combinacoes ativas apos a carga.
do $$
declare r record;
begin
  for r in select cor,tamanho from public.camisa_estoque where ativo=true loop
    perform private.camisa_recalcular_reservas_combo(r.cor,r.tamanho);
  end loop;
end $$;

-- -----------------------------------------------------------------------------
-- VIEWS
-- -----------------------------------------------------------------------------
drop view if exists public.vw_camisa_dashboard;
drop view if exists public.vw_camisa_solicitacoes_detalhes;

create view public.vw_camisa_dashboard
with (security_invoker = true)
as
with combinacoes as (
  select s.encontro_id, i.cor, i.tamanho
  from public.camisa_solicitacoes s
  join public.camisa_solicitacao_itens i on i.solicitacao_id = s.id
  where s.status <> 'CANCELADA' and i.status <> 'CANCELADO'

  union

  select e.id, ce.cor, ce.tamanho
  from public.encontros e
  cross join public.camisa_estoque ce
  where e.status in ('ATIVO','PLANEJADO') and ce.ativo = true
),
demanda as (
  select s.encontro_id, i.cor, i.tamanho,
         sum(i.quantidade_solicitada)::integer as quantidade_solicitada,
         sum(i.quantidade_entregue)::integer as quantidade_entregue,
         sum(i.quantidade_solicitada-i.quantidade_entregue)::integer as demanda_aberta,
         sum(i.quantidade_reservada)::integer as quantidade_reservada
  from public.camisa_solicitacoes s
  join public.camisa_solicitacao_itens i on i.solicitacao_id=s.id
  where s.status <> 'CANCELADA' and i.status <> 'CANCELADO'
  group by s.encontro_id,i.cor,i.tamanho
)
select c.encontro_id,
       e.nome as encontro_nome,
       c.cor,
       c.tamanho,
       coalesce(est.quantidade_fisica,0)::integer as estoque_fisico,
       coalesce(d.quantidade_reservada,0)::integer as estoque_comprometido,
       greatest(coalesce(est.quantidade_fisica,0)-coalesce(d.quantidade_reservada,0),0)::integer as estoque_disponivel,
       coalesce(d.quantidade_solicitada,0)::integer as quantidade_solicitada,
       coalesce(d.quantidade_entregue,0)::integer as quantidade_entregue,
       coalesce(d.demanda_aberta,0)::integer as demanda_aberta,
       0::integer as em_reposicao,
       coalesce(d.quantidade_reservada,0)::integer as pronto_para_entrega,
       greatest(coalesce(d.demanda_aberta,0)-coalesce(d.quantidade_reservada,0),0)::integer as solicitar_reposicao
from combinacoes c
join public.encontros e on e.id=c.encontro_id
left join demanda d on d.encontro_id=c.encontro_id and d.cor=c.cor and d.tamanho=c.tamanho
left join public.camisa_estoque est on est.cor=c.cor and est.tamanho=c.tamanho and est.ativo=true;

create view public.vw_camisa_solicitacoes_detalhes
with (security_invoker = true)
as
select s.id as solicitacao_id,
       s.codigo,
       s.criado_em,
       s.encontro_id,
       e.nome as encontro_nome,
       s.eh_encontreiro,
       s.nome_solicitante,
       s.telefone_solicitante,
       s.email_solicitante,
       s.equipe,
       s.nome_beneficiario,
       s.status as status_solicitacao,
       s.comprovante_path,
       s.email_confirmacao_enviada_em,
       s.email_confirmacao_erro,
       i.id as item_id,
       i.cor,
       i.tamanho,
       i.quantidade_solicitada,
       i.quantidade_entregue,
       i.quantidade_reservada,
       (i.quantidade_solicitada-i.quantidade_entregue)::integer as quantidade_pendente,
       greatest((i.quantidade_solicitada-i.quantidade_entregue)-i.quantidade_reservada,0)::integer as quantidade_sem_cobertura,
       case
         when i.status='CANCELADO' then 'CANCELADO'
         when i.quantidade_entregue >= i.quantidade_solicitada then 'ENTREGUE'
         when i.quantidade_entregue > 0 then 'PARCIALMENTE_ENTREGUE'
         when i.quantidade_reservada >= (i.quantidade_solicitada-i.quantidade_entregue) then 'PRONTO_ENTREGA'
         when i.quantidade_reservada > 0 then 'PARCIALMENTE_COBERTO'
         else 'PENDENTE_REPOSICAO'
       end as status_item
from public.camisa_solicitacoes s
join public.encontros e on e.id=s.encontro_id
join public.camisa_solicitacao_itens i on i.solicitacao_id=s.id;

grant select on public.vw_camisa_dashboard to authenticated;
grant select on public.vw_camisa_solicitacoes_detalhes to authenticated;
revoke all on public.vw_camisa_dashboard from anon;
revoke all on public.vw_camisa_solicitacoes_detalhes from anon;

notify pgrst, 'reload schema';
commit;

-- VALIDACOES ESPERADAS APOS O PATCH
-- 1) saldo fisico atual da primeira leva = 21
select sum(quantidade_fisica) as saldo_fisico_atual
from public.camisa_estoque where ativo=true;

-- 2) todo o saldo fisico atual deve estar comprometido = 21 e disponivel = 0
select sum(estoque_fisico) as estoque_fisico,
       sum(estoque_comprometido) as comprometido,
       sum(estoque_disponivel) as disponivel,
       sum(solicitar_reposicao) as reposicao
from public.vw_camisa_dashboard
where encontro_id='57a08fa1-29e9-4c35-ab34-eb187f79b13a';

-- 3) lista para confeccao esperada (linhas 32 em diante):
-- Marrom PP=1, P=3, M=5, G=2, XXG=2, TOTAL=13
select cor,tamanho,demanda_aberta,estoque_comprometido,estoque_disponivel,solicitar_reposicao
from public.vw_camisa_dashboard
where encontro_id='57a08fa1-29e9-4c35-ab34-eb187f79b13a'
  and solicitar_reposicao > 0
order by cor,tamanho;
