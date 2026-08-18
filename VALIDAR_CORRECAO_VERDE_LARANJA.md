# Validação da correção verde / laranja

1. Execute `supabase/PATCH_CORRECAO_PLANILHA_VERDE_LARANJA.sql`.
2. Confirme os totais finais:
   - Camisas solicitadas: 49
   - Já entregues: 13
   - Pendentes: 36
   - Com estoque: 21
   - Sem estoque / reposição: 15
   - Estoque físico: 21
   - Estoque livre: 0
3. A lista para confecção deve conter:
   - Marrom / PP: 1
   - Marrom / P: 4
   - Marrom / M: 6
   - Marrom / G: 2
   - Marrom / XXG: 2
   - Total: 15
4. No Dashboard > Solicitações:
   - pendentes cobertas aparecem em verde e possuem botão Entregar;
   - pendentes sem estoque aparecem em laranja e não possuem botão Entregar;
   - entregues aparecem neutras com status Entregue.
5. O cadastro público continua sem consultar estoque.
