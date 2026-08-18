# Validar alteração de status da solicitação

1. Rode `supabase/PATCH_STATUS_SOLICITACAO.sql` no SQL Editor do Supabase.
2. Reinicie o Vite local (`Ctrl+C` e `npm run dev`) ou use `Ctrl+F5`.
3. Abra Dashboard > Solicitações.
4. Cada linha agora mostra duas informações distintas:
   - **Situação do item**: calculada por estoque/entrega.
   - **Status solicitação**: Aberta, Concluída ou Cancelada.
5. Clique em **Alterar status** para abrir o drawer.

Regras:
- `Aberta`: solicitação participa normalmente de estoque e reposição.
- `Cancelada`: itens pendentes deixam de consumir estoque e deixam a reposição.
- `Concluída`: só pode ser selecionada quando todos os itens já estiverem entregues ou cancelados.
- Reabrir uma cancelada devolve seus itens pendentes ao cálculo e refaz a cobertura FIFO.
