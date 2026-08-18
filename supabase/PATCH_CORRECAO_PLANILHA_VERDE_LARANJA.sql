-- =============================================================================
-- CORRECAO DO HISTORICO IMPORTADO - PLANILHA VERDE / LARANJA
-- EAC 37
--
-- Regra validada com a planilha "Pedido de camisa (1).xlsx":
--   * Linhas 2 a 31 da aba "Itens Solicitação" = primeira leva recebida (VERDE)
--     Total original recebido: 34 camisas.
--     Entregues de fato conforme coluna "Status Entrega Item": 13.
--     Restam fisicamente 21 e todas estão direcionadas às solicitações verdes pendentes.
--   * Linha 32 em diante = solicitações sem estoque (LARANJA).
--     Incluindo os 2 itens reconstruídos de Monique (SOL-20260811-190858), total = 15.
--
-- Resultado esperado no dashboard:
--   Camisas solicitadas = 49
--   Já entregues = 13
--   Pendentes = 36
--   Com estoque = 21
--   Sem estoque / reposição = 15
--   Estoque físico = 21
--   Estoque livre = 0
-- =============================================================================

begin;

-- 1) Corrige o erro da importação anterior: Quantidade Atendida NÃO significa Entregue.
--    Zeramos entrega de todos os itens importados e reaplicamos somente os itens
--    cuja coluna "Status Entrega Item" na planilha está realmente como ENTREGUE.
update public.camisa_solicitacao_itens i
set quantidade_entregue = 0,
    quantidade_reservada = 0,
    status = 'SOLICITADO',
    entregue_em = null,
    atualizado_em = now()
from public.camisa_solicitacoes s
where s.id = i.solicitacao_id
  and s.id_solicitacao_origem is not null;

-- Gabriel Tavares Simplício - G Marrom = 1 entregue
update public.camisa_solicitacao_itens i
set quantidade_entregue = quantidade_solicitada,
    status = 'ENTREGUE',
    entregue_em = '2026-08-15 19:31:13-03'::timestamptz,
    atualizado_em = now()
from public.camisa_solicitacoes s
where s.id = i.solicitacao_id
  and s.id_solicitacao_origem = 'SOL-20260621-171818'
  and i.cor = 'Marrom' and i.tamanho = 'G';

-- Ana Marta Cysneiros - P(2), GG(1), M(1) = 4 entregues
update public.camisa_solicitacao_itens i
set quantidade_entregue = quantidade_solicitada,
    status = 'ENTREGUE',
    entregue_em = null,
    atualizado_em = now()
from public.camisa_solicitacoes s
where s.id = i.solicitacao_id
  and s.id_solicitacao_origem = 'SOL-20260621-172656';

-- Dolores Bodini - G Marrom = 1 entregue
update public.camisa_solicitacao_itens i
set quantidade_entregue = quantidade_solicitada,
    status = 'ENTREGUE',
    entregue_em = null,
    atualizado_em = now()
from public.camisa_solicitacoes s
where s.id = i.solicitacao_id
  and s.id_solicitacao_origem = 'SOL-20260622-155658'
  and i.cor = 'Marrom' and i.tamanho = 'G';

-- Wallace Gomes - P(2 itens), XG(1), XXG(1) = 4 entregues
update public.camisa_solicitacao_itens i
set quantidade_entregue = quantidade_solicitada,
    status = 'ENTREGUE',
    entregue_em = null,
    atualizado_em = now()
from public.camisa_solicitacoes s
where s.id = i.solicitacao_id
  and s.id_solicitacao_origem = 'SOL-20260623-093601';

-- Letícia Moreira Maciel - M Marrom = 1 entregue
update public.camisa_solicitacao_itens i
set quantidade_entregue = quantidade_solicitada,
    status = 'ENTREGUE',
    entregue_em = '2026-08-02 11:18:57-03'::timestamptz,
    atualizado_em = now()
from public.camisa_solicitacoes s
where s.id = i.solicitacao_id
  and s.id_solicitacao_origem = 'SOL-20260628-200455'
  and i.cor = 'Marrom' and i.tamanho = 'M';

-- DOLORES - P Marrom = 2 entregues
update public.camisa_solicitacao_itens i
set quantidade_entregue = quantidade_solicitada,
    status = 'ENTREGUE',
    entregue_em = null,
    atualizado_em = now()
from public.camisa_solicitacoes s
where s.id = i.solicitacao_id
  and s.id_solicitacao_origem = 'SOL-20260630-204535'
  and i.cor = 'Marrom' and i.tamanho = 'P';

-- 2) Corrige status geral das solicitações importadas.
update public.camisa_solicitacoes
set status = 'ABERTA', atualizado_em = now()
where id_solicitacao_origem is not null;

update public.camisa_solicitacoes s
set status = 'CONCLUIDA', atualizado_em = now()
where s.id_solicitacao_origem is not null
  and not exists (
    select 1
    from public.camisa_solicitacao_itens i
    where i.solicitacao_id = s.id
      and i.status <> 'CANCELADO'
      and i.quantidade_entregue < i.quantidade_solicitada
  );

-- 3) Saldo físico atual da primeira leva.
--    34 recebidas - 13 já entregues = 21 ainda fisicamente disponíveis para
--    as solicitações VERDES pendentes. A distribuição abaixo é exatamente
--    a soma das linhas verdes ainda não entregues.
update public.camisa_estoque
set quantidade_fisica = 0,
    ativo = false,
    atualizado_em = now();

insert into public.camisa_estoque(cor,tamanho,quantidade_fisica,ativo)
values
  ('Azul',   'XXG', 1, true),
  ('Branca', 'XXG', 1, true),
  ('Marrom', 'PP',  4, true),
  ('Marrom', 'P',   3, true),
  ('Marrom', 'M',   8, true),
  ('Marrom', 'G',   1, true),
  ('Marrom', 'GG',  2, true),
  ('Marrom', 'XG',  0, true),
  ('Marrom', 'XXG', 1, true)
on conflict(cor,tamanho)
do update set quantidade_fisica = excluded.quantidade_fisica,
              ativo = excluded.ativo,
              atualizado_em = now();

-- 4) Recalcula a cobertura FIFO. Como o saldo físico restante por combinação
--    corresponde exatamente às solicitações verdes pendentes, as verdes ficam
--    100% cobertas e todo o bloco laranja fica sem cobertura.
do $$
declare r record;
begin
  for r in
    select distinct i.cor, i.tamanho
    from public.camisa_solicitacao_itens i
    join public.camisa_solicitacoes s on s.id = i.solicitacao_id
    where s.encontro_id = '57a08fa1-29e9-4c35-ab34-eb187f79b13a'::uuid
  loop
    perform private.camisa_recalcular_reservas_combo(r.cor, r.tamanho);
  end loop;
end $$;

notify pgrst, 'reload schema';
commit;

-- =============================================================================
-- VALIDACOES
-- =============================================================================

-- A) Totais gerais esperados: 49 / 13 / 36 / 21 / 15
select
  sum(quantidade_solicitada)::int as camisas_solicitadas,
  sum(quantidade_entregue)::int as ja_entregues,
  sum(quantidade_solicitada - quantidade_entregue)::int as pendentes,
  sum(quantidade_reservada)::int as com_estoque,
  sum(greatest((quantidade_solicitada - quantidade_entregue) - quantidade_reservada,0))::int as sem_estoque_reposicao
from public.camisa_solicitacao_itens i
join public.camisa_solicitacoes s on s.id=i.solicitacao_id
where s.encontro_id='57a08fa1-29e9-4c35-ab34-eb187f79b13a'::uuid
  and s.status <> 'CANCELADA'
  and i.status <> 'CANCELADO';

-- B) Estoque esperado: físico 21 / comprometido 21 / livre 0 / reposição 15
select
  sum(estoque_fisico)::int as estoque_fisico,
  sum(estoque_comprometido)::int as direcionado_solicitacoes,
  sum(estoque_disponivel)::int as livre,
  sum(solicitar_reposicao)::int as reposicao
from public.vw_camisa_dashboard
where encontro_id='57a08fa1-29e9-4c35-ab34-eb187f79b13a'::uuid;

-- C) Lista LARANJA para confecção esperada:
-- Marrom PP=1, P=4, M=6, G=2, XXG=2. TOTAL=15.
select cor,tamanho,solicitar_reposicao
from public.vw_camisa_dashboard
where encontro_id='57a08fa1-29e9-4c35-ab34-eb187f79b13a'::uuid
  and solicitar_reposicao > 0
order by cor,
  case tamanho when 'PP' then 1 when 'P' then 2 when 'M' then 3 when 'G' then 4 when 'GG' then 5 when 'XG' then 6 when 'XXG' then 7 else 99 end;

-- D) Itens pendentes classificados como VERDE (com estoque) e LARANJA (sem estoque).
select
  s.id_solicitacao_origem,
  s.nome_solicitante,
  i.cor,
  i.tamanho,
  i.quantidade_solicitada,
  i.quantidade_entregue,
  i.quantidade_reservada as com_estoque,
  greatest((i.quantidade_solicitada-i.quantidade_entregue)-i.quantidade_reservada,0) as sem_estoque,
  case
    when i.quantidade_entregue >= i.quantidade_solicitada then 'ENTREGUE'
    when i.quantidade_reservada >= (i.quantidade_solicitada-i.quantidade_entregue) then 'VERDE - COM ESTOQUE'
    when i.quantidade_reservada > 0 then 'VERDE/LARANJA - PARCIAL'
    else 'LARANJA - SEM ESTOQUE'
  end as situacao
from public.camisa_solicitacao_itens i
join public.camisa_solicitacoes s on s.id=i.solicitacao_id
where s.encontro_id='57a08fa1-29e9-4c35-ab34-eb187f79b13a'::uuid
order by s.criado_em, i.criado_em, i.id;
