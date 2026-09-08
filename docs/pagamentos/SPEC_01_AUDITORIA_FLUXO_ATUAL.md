# SPEC 01 - Auditoria do Fluxo Atual

## Objetivo

Identificar como foi possível existir pedido sem comprovante aparente mesmo com validação no frontend e no SQL atual.

## Escopo

### 1. Validar versão publicada

- Identificar commit atualmente publicado na Vercel.
- Comparar com `main`.
- Confirmar se `Form.tsx` publicado contém a trava de `proofFile`.
- Confirmar se o deploy usa a mesma URL e projeto Supabase esperados.

### 2. Validar Supabase real

Conferir no ambiente atualmente usado pelo app:

- Definição atual de `public.camisa_registrar_solicitacao_publica`.
- Definição atual de `private.camisa_registrar_solicitacao`.
- Grants de execução.
- Policies/RLS de `camisa_solicitacoes`.
- Possibilidade de INSERT direto por `anon` ou `authenticated`.
- Existência de funções antigas com finalidade equivalente.
- Triggers que possam criar ou alterar solicitações.

### 3. Auditar registros sem comprovante

Executar levantamento equivalente a:

```sql
select
  id,
  criado_em,
  nome_solicitante,
  nome_beneficiario,
  valor_total,
  comprovante_path,
  comprovante_nome,
  origem,
  status
from public.camisa_solicitacoes
where comprovante_path is null
   or trim(comprovante_path) = ''
order by criado_em desc;
```

Para cada ocorrência registrar:

- Data/hora.
- Origem.
- Versão do sistema vigente à época, se possível.
- Dados do pedido.
- Existência de arquivo órfão no bucket.
- Se houve alteração administrativa posterior.

### 4. Verificar storage

Bucket atual: `camisas-comprovantes`.

Validar:

- Políticas de upload.
- Políticas de leitura.
- Arquivos sem solicitação vinculada.
- Solicitações apontando para arquivos inexistentes.
- Tipos de arquivo permitidos.
- Limite de tamanho.

### 5. Legado

O repositório ainda contém `google-apps-script/code.gs`.

Confirmar se existe qualquer deploy, endpoint ou automação legado capaz de registrar solicitação fora do fluxo Supabase atual.

## Critérios de aceite

A SPEC estará concluída quando:

- A causa do pedido sem comprovante estiver identificada ou as hipóteses tiverem sido eliminadas com evidência.
- Não existir INSERT público direto em `camisa_solicitacoes` fora das operações aprovadas.
- Todas as funções públicas que criam pedido estiverem inventariadas.
- Registros históricos inconsistentes estiverem listados.
- Houver um relatório curto em `docs/pagamentos/RESULTADO_SPEC_01.md`.

## Não fazer nesta SPEC

- Não integrar Nubank.
- Não alterar UX do checkout.
- Não migrar status.
- Não apagar registros históricos.
