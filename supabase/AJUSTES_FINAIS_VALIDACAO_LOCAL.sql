-- ============================================================
-- EAC Camisas - ajustes finais para validação local
-- Seguro para executar na base que já recebeu camisas_module.sql
-- e camisas_email_gmail.sql.
-- Não apaga tabelas nem solicitações.
-- ============================================================

begin;

-- Campos finais do fluxo de formulário/e-mail.
alter table public.camisa_solicitacoes
  add column if not exists origem text not null default 'SISTEMA',
  add column if not exists codigo text,
  add column if not exists email_dispatch_token uuid,
  add column if not exists email_confirmacao_enviada_em timestamptz,
  add column if not exists email_confirmacao_erro text;

alter table public.camisa_solicitacoes
  drop constraint if exists camisa_solicitacoes_origem_check;
alter table public.camisa_solicitacoes
  add constraint camisa_solicitacoes_origem_check
  check (origem in ('SISTEMA','FORMULARIO_PUBLICO','IMPORTACAO','ADMINISTRATIVO'));

-- Permite entrega parcial.
alter table public.camisa_solicitacao_itens
  drop constraint if exists camisa_solicitacao_itens_status_check;
alter table public.camisa_solicitacao_itens
  add constraint camisa_solicitacao_itens_status_check
  check (status in (
    'SOLICITADO','AGUARDANDO_REPOSICAO','PRONTO_ENTREGA',
    'PARCIALMENTE_ENTREGUE','ENTREGUE','CANCELADO'
  ));

create unique index if not exists ux_camisa_solicitacoes_codigo
  on public.camisa_solicitacoes(codigo)
  where codigo is not null;

-- Completa códigos antigos sem alterar os UUIDs internos.
update public.camisa_solicitacoes s
set codigo = 'EAC' || coalesce(e.numero::text, 'XX') || '-' || upper(right(replace(s.id::text, '-', ''), 6))
from public.encontros e
where e.id = s.encontro_id
  and s.codigo is null;

-- A Edge Function usa uma chave server-side. RLS continua ativo.
-- Estes GRANTs apenas permitem que o papel interno consulte os dados necessários.
grant usage on schema public to service_role;
grant select, update on table public.camisa_solicitacoes to service_role;
grant select on table public.camisa_solicitacao_itens to service_role;
grant select on table public.encontros to service_role;

-- Recria as três views para evitar conflito de posição/nome de coluna.
drop view if exists public.vw_camisa_solicitacoes_detalhes;
drop view if exists public.vw_camisa_reposicoes_detalhes;
drop view if exists public.vw_camisa_dashboard;

create view public.vw_camisa_dashboard
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
  from public.encontros e
  cross join public.camisa_estoque ce
  where e.status in ('ATIVO','PLANEJADO') and ce.ativo = true
),
demanda as (
  select s.encontro_id, i.cor, i.tamanho,
         sum(i.quantidade_solicitada)::integer as quantidade_solicitada,
         sum(i.quantidade_entregue)::integer as quantidade_entregue,
         sum(i.quantidade_solicitada - i.quantidade_entregue)::integer as demanda_aberta
  from public.camisa_solicitacoes s
  join public.camisa_solicitacao_itens i on i.solicitacao_id = s.id
  where s.status <> 'CANCELADA' and i.status <> 'CANCELADO'
  group by s.encontro_id, i.cor, i.tamanho
),
reposicao as (
  select r.encontro_id, ri.cor, ri.tamanho,
         sum(ri.quantidade_pedida - ri.quantidade_recebida)::integer as em_reposicao
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
       greatest(
         coalesce(d.demanda_aberta,0)
         - coalesce(est.quantidade_fisica,0)
         - coalesce(r.em_reposicao,0),
         0
       )::integer as solicitar_reposicao
from combinacoes c
join public.encontros e on e.id = c.encontro_id
left join demanda d on d.encontro_id=c.encontro_id and d.cor=c.cor and d.tamanho=c.tamanho
left join reposicao r on r.encontro_id=c.encontro_id and r.cor=c.cor and r.tamanho=c.tamanho
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
       (i.quantidade_solicitada - i.quantidade_entregue)::integer as quantidade_pendente,
       case
         when i.status='CANCELADO' then 'CANCELADO'
         when i.quantidade_entregue >= i.quantidade_solicitada then 'ENTREGUE'
         when i.quantidade_entregue > 0 then 'PARCIALMENTE_ENTREGUE'
         else 'PENDENTE'
       end as status_item
from public.camisa_solicitacoes s
join public.encontros e on e.id=s.encontro_id
join public.camisa_solicitacao_itens i on i.solicitacao_id=s.id;

create view public.vw_camisa_reposicoes_detalhes
with (security_invoker = true)
as
select r.id as reposicao_id,
       r.encontro_id,
       e.nome as encontro_nome,
       r.criado_em,
       r.status as status_reposicao,
       r.fornecedor,
       ri.id as item_id,
       ri.cor,
       ri.tamanho,
       ri.quantidade_pedida,
       ri.quantidade_recebida,
       (ri.quantidade_pedida - ri.quantidade_recebida)::integer as quantidade_pendente
from public.camisa_reposicoes r
left join public.encontros e on e.id=r.encontro_id
join public.camisa_reposicao_itens ri on ri.reposicao_id=r.id;

grant select on public.vw_camisa_dashboard to authenticated;
grant select on public.vw_camisa_solicitacoes_detalhes to authenticated;
grant select on public.vw_camisa_reposicoes_detalhes to authenticated;
revoke all on public.vw_camisa_dashboard from anon;
revoke all on public.vw_camisa_solicitacoes_detalhes from anon;
revoke all on public.vw_camisa_reposicoes_detalhes from anon;

commit;

notify pgrst, 'reload schema';
