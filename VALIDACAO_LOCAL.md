# Validação local - Gestão de Camisas EAC

## 1. Banco

As seis tabelas `camisa_*` já precisam existir. Execute o arquivo:

`supabase/camisas_module.sql`

Ele adiciona campos do formulário, bucket privado de comprovantes, RPCs e três views do dashboard.

## 2. Variáveis

Copie `.env.example` para `.env.local` e preencha somente a chave pública:

```env
VITE_SUPABASE_URL="https://niagdoowqmngxjcrmstd.supabase.co"
VITE_SUPABASE_ANON_KEY="SUA_PUBLISHABLE_KEY"
VITE_EAC_ENCONTRO_ID="57a08fa1-29e9-4c35-ab34-eb187f79b13a"
```

Não use `service_role` no frontend.

As variáveis legadas `VITE_GAS_WEB_APP_URL` e `VITE_USE_MOCK_API` foram mantidas no exemplo, mas esta versão não usa mais Apps Script.

## 3. Rodar

```bash
npm install
npm run lint
npm run dev
```

Formulário: `http://localhost:3000/`
Dashboard: `http://localhost:3000/dashboard`

O dashboard exige usuário do Supabase Auth que também esteja autorizado pelas funções existentes `usuario_autenticado_ativo()` e `usuario_pode_editar()`.

## 4. Cenário obrigatório de validação

1. Ajuste estoque `Azul / G` para 1 pelo dashboard, aba Estoque.
2. Faça uma solicitação de 1 `Azul / G`. O formulário deve aceitar.
3. Faça outra solicitação de 2 `Azul / G`. O formulário deve aceitar novamente, sem bloqueio.
4. Na Visão geral deve aparecer:
   - estoque físico: 1
   - demanda aberta: 3
   - pronto para entrega: 1
   - solicitar reposição: 2
5. Clique `Criar reposição sugerida`. O valor `solicitar reposição` deve cair para 0 e `em reposição` deve virar 2.
6. Na aba Reposição, receba as 2 unidades. Estoque físico deve passar de 1 para 3.
7. Na aba Solicitações, entregue primeiro 1 unidade e depois 2 unidades.
8. O estoque físico deve terminar em 0 e a demanda aberta também em 0.

## 5. Conferências SQL

```sql
select *
from public.vw_camisa_dashboard
where encontro_id = '57a08fa1-29e9-4c35-ab34-eb187f79b13a'
order by cor, tamanho;
```

```sql
select *
from public.vw_camisa_solicitacoes_detalhes
where encontro_id = '57a08fa1-29e9-4c35-ab34-eb187f79b13a'
order by criado_em desc;
```

```sql
select m.criado_em, e.cor, e.tamanho, m.tipo, m.quantidade,
       m.saldo_anterior, m.saldo_posterior, m.observacoes
from public.camisa_movimentacoes m
join public.camisa_estoque e on e.id = m.estoque_id
order by m.criado_em desc;
```

## 6. O que cada visão do dashboard responde

- **Visão geral**: o que existe, quanto foi solicitado, quanto foi entregue, quanto já está sendo comprado e quanto ainda precisa comprar.
- **Solicitações**: quem solicitou, para quem é a camisa, item, quantidade pendente, comprovante e ação de entrega.
- **Reposição**: pedidos já realizados, quantidade recebida e saldo ainda aguardado.
- **Estoque**: saldo físico por cor/tamanho e ajustes manuais auditados.

## 7. Regra central

Solicitar nunca reduz estoque e nunca é bloqueado por falta de saldo.

Reposição recebida aumenta estoque.

Somente entrega reduz estoque.

---

## Versão consolidada

Para a validação atual, priorize `VALIDAR_AGORA.md` e execute `supabase/AJUSTES_FINAIS_VALIDACAO_LOCAL.sql` após as migrações que já foram aplicadas.
