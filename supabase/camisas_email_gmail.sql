-- ============================================================
-- EAC Camisas - código amigável + disparo de e-mail via Edge Function/Gmail
-- Execute APÓS camisas_module.sql na base já existente.
-- ============================================================

begin;

alter table public.camisa_solicitacoes
  add column if not exists codigo text,
  add column if not exists email_dispatch_token uuid,
  add column if not exists email_confirmacao_enviada_em timestamptz,
  add column if not exists email_confirmacao_erro text;

create unique index if not exists ux_camisa_solicitacoes_codigo
  on public.camisa_solicitacoes(codigo)
  where codigo is not null;

-- Corrige solicitações já existentes sem código amigável.
update public.camisa_solicitacoes s
set codigo = 'EAC' || coalesce(e.numero::text, 'XX') || '-' || upper(right(replace(s.id::text, '-', ''), 6))
from public.encontros e
where e.id = s.encontro_id
  and s.codigo is null;

-- Recria a função privada para gerar código e token descartável de envio.
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
  v_numero_encontro integer;
  v_codigo text;
  v_dispatch_token uuid;
begin
  select numero into v_numero_encontro from public.encontros where id = p_encontro_id;
  if not found then raise exception 'Encontro inválido.'; end if;

  if coalesce(p_eh_encontreiro, false) then
    if p_solicitante_pessoa_id is null then raise exception 'Selecione seu nome na lista de encontreiros.'; end if;
    select p.nome_completo into v_nome_solicitante
    from public.pessoas p
    where p.id = p_solicitante_pessoa_id and p.status = 'ATIVO'
      and exists (select 1 from public.encontreiros e where e.pessoa_id = p.id);
    if v_nome_solicitante is null then raise exception 'O cadastro selecionado não foi localizado como encontreiro.'; end if;
  else
    v_nome_solicitante := trim(coalesce(p_nome_solicitante,''));
    if length(v_nome_solicitante) < 3 then raise exception 'Informe o nome do solicitante.'; end if;
  end if;

  if length(trim(coalesce(p_nome_beneficiario,''))) < 3 then raise exception 'Informe o beneficiário.'; end if;
  if nullif(trim(coalesce(p_telefone_solicitante,'')), '') is null
     and nullif(trim(coalesce(p_email_solicitante,'')), '') is null then
    raise exception 'Informe telefone ou e-mail para contato.';
  end if;
  if p_itens is null or jsonb_typeof(p_itens) <> 'array' or jsonb_array_length(p_itens) = 0 then raise exception 'Informe pelo menos uma camisa.'; end if;
  if nullif(trim(coalesce(p_comprovante_path,'')), '') is null then raise exception 'Comprovante de pagamento obrigatório.'; end if;

  if nullif(trim(coalesce(p_email_solicitante,'')), '') is not null then
    v_dispatch_token := gen_random_uuid();
  else
    v_dispatch_token := null;
  end if;

  insert into public.camisa_solicitacoes (
    encontro_id, eh_encontreiro, solicitante_pessoa_id, nome_solicitante,
    telefone_solicitante, email_solicitante, equipe,
    beneficiario_pessoa_id, nome_beneficiario,
    status, origem, observacoes,
    comprovante_path, comprovante_nome, comprovante_tipo, comprovante_tamanho, valor_total,
    email_dispatch_token
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
    coalesce(p_valor_total,0), v_dispatch_token
  ) returning id into v_solicitacao_id;

  v_codigo := 'EAC' || coalesce(v_numero_encontro::text, 'XX') || '-' || upper(right(replace(v_solicitacao_id::text, '-', ''), 6));
  update public.camisa_solicitacoes set codigo = v_codigo where id = v_solicitacao_id;

  for v_item in select value from jsonb_array_elements(p_itens)
  loop
    v_cor := trim(coalesce(v_item->>'cor',''));
    v_tamanho := upper(trim(coalesce(v_item->>'tamanho','')));
    v_quantidade := coalesce((v_item->>'quantidade')::integer,0);
    if v_cor = '' then raise exception 'Cor inválida.'; end if;
    if v_tamanho not in ('PP','P','M','G','GG','XG','XXG') then raise exception 'Tamanho inválido: %', v_tamanho; end if;
    if v_quantidade <= 0 then raise exception 'Quantidade inválida.'; end if;
    insert into public.camisa_solicitacao_itens(solicitacao_id,cor,tamanho,quantidade_solicitada,quantidade_entregue,status)
    values(v_solicitacao_id,v_cor,v_tamanho,v_quantidade,0,'SOLICITADO');
  end loop;

  return jsonb_build_object(
    'success', true,
    'request_id', v_solicitacao_id,
    'codigo', v_codigo,
    'status', 'ABERTA',
    'email_dispatch_token', v_dispatch_token,
    'email_solicitante', nullif(trim(coalesce(p_email_solicitante,'')), '')
  );
end;
$$;

-- Atualiza view administrativa com o código e status de e-mail.
-- DROP evita erro 42P16 caso a view antiga ainda não tenha a coluna codigo.
drop view if exists public.vw_camisa_solicitacoes_detalhes;
create view public.vw_camisa_solicitacoes_detalhes
with (security_invoker = true)
as
select s.id solicitacao_id, s.codigo, s.criado_em, s.encontro_id, e.nome encontro_nome,
       s.eh_encontreiro, s.nome_solicitante, s.telefone_solicitante, s.email_solicitante,
       s.equipe, s.nome_beneficiario, s.status status_solicitacao, s.comprovante_path,
       s.email_confirmacao_enviada_em,
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

grant select on public.vw_camisa_solicitacoes_detalhes to authenticated;
revoke all on public.vw_camisa_solicitacoes_detalhes from anon;

-- Permissões server-side usadas pela Edge Function de e-mail.
grant usage on schema public to service_role;
grant select, update on table public.camisa_solicitacoes to service_role;
grant select on table public.camisa_solicitacao_itens to service_role;
grant select on table public.encontros to service_role;

commit;
notify pgrst, 'reload schema';
