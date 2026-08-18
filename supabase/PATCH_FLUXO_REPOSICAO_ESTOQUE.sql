-- PATCH FINAL DE FLUXO OPERACIONAL DE CAMISAS
-- Regra: solicitação é sempre livre. Estoque é somente o saldo físico recebido.
-- Reposição necessária = demanda ainda não entregue - estoque físico disponível.

begin;

-- Corrige as funções de autorização para não recursarem no RLS de usuarios.
create or replace function public.usuario_autenticado_ativo()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.usuarios u
    where u.auth_user_id = auth.uid()
      and u.status = 'ATIVO'
  );
$$;
alter function public.usuario_autenticado_ativo() owner to postgres;
revoke all on function public.usuario_autenticado_ativo() from public, anon;
grant execute on function public.usuario_autenticado_ativo() to authenticated;

create or replace function public.usuario_pode_editar()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.usuarios u
    where u.auth_user_id = auth.uid()
      and u.status = 'ATIVO'
      and u.perfil in ('ADMIN','COORDENACAO','OPERADOR')
  );
$$;
alter function public.usuario_pode_editar() owner to postgres;
revoke all on function public.usuario_pode_editar() from public, anon;
grant execute on function public.usuario_pode_editar() to authenticated;

-- Recria somente a view gerencial. Não usa pedidos de reposição no cálculo.
drop view if exists public.vw_camisa_dashboard;

create view public.vw_camisa_dashboard
with (security_invoker = true)
as
with combinacoes as (
  select s.encontro_id, i.cor, i.tamanho
  from public.camisa_solicitacoes s
  join public.camisa_solicitacao_itens i on i.solicitacao_id = s.id
  where s.status <> 'CANCELADA'
    and i.status <> 'CANCELADO'

  union

  select e.id, ce.cor, ce.tamanho
  from public.encontros e
  cross join public.camisa_estoque ce
  where e.status in ('ATIVO','PLANEJADO')
    and ce.ativo = true
),
demanda as (
  select
    s.encontro_id,
    i.cor,
    i.tamanho,
    sum(i.quantidade_solicitada)::integer as quantidade_solicitada,
    sum(i.quantidade_entregue)::integer as quantidade_entregue,
    sum(i.quantidade_solicitada - i.quantidade_entregue)::integer as demanda_aberta
  from public.camisa_solicitacoes s
  join public.camisa_solicitacao_itens i on i.solicitacao_id = s.id
  where s.status <> 'CANCELADA'
    and i.status <> 'CANCELADO'
  group by s.encontro_id, i.cor, i.tamanho
)
select
  c.encontro_id,
  e.nome as encontro_nome,
  c.cor,
  c.tamanho,
  coalesce(est.quantidade_fisica,0)::integer as estoque_fisico,
  coalesce(d.quantidade_solicitada,0)::integer as quantidade_solicitada,
  coalesce(d.quantidade_entregue,0)::integer as quantidade_entregue,
  coalesce(d.demanda_aberta,0)::integer as demanda_aberta,
  0::integer as em_reposicao,
  least(coalesce(d.demanda_aberta,0), coalesce(est.quantidade_fisica,0))::integer as pronto_para_entrega,
  greatest(
    coalesce(d.demanda_aberta,0) - coalesce(est.quantidade_fisica,0),
    0
  )::integer as solicitar_reposicao
from combinacoes c
join public.encontros e on e.id = c.encontro_id
left join demanda d on d.encontro_id=c.encontro_id and d.cor=c.cor and d.tamanho=c.tamanho
left join public.camisa_estoque est on est.cor=c.cor and est.tamanho=c.tamanho and est.ativo=true;

grant select on public.vw_camisa_dashboard to authenticated;
revoke all on public.vw_camisa_dashboard from anon;

-- A função de estoque continua aceitando ENTRADA/SAIDA para compatibilidade,
-- mas o frontend operacional usa somente ENTRADA para registrar recebimento.
-- A entrega continua debitando estoque físico e quitando a solicitação.

notify pgrst, 'reload schema';
commit;

-- VALIDAÇÃO RÁPIDA
-- select * from public.vw_camisa_dashboard
-- where encontro_id='57a08fa1-29e9-4c35-ab34-eb187f79b13a'
-- order by cor,tamanho;
