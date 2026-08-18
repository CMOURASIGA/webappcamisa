-- Validação rápida do módulo de camisas
select table_name
from information_schema.tables
where table_schema='public' and table_name like 'camisa_%'
order by table_name;

select table_name
from information_schema.views
where table_schema='public' and table_name like 'vw_camisa_%'
order by table_name;

select routine_schema, routine_name
from information_schema.routines
where routine_schema in ('public','private')
  and routine_name like 'camisa_%'
order by routine_schema, routine_name;

select *
from public.vw_camisa_dashboard
where encontro_id='57a08fa1-29e9-4c35-ab34-eb187f79b13a'
order by cor,tamanho;
