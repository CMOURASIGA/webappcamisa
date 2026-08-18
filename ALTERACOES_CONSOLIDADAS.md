# Alterações consolidadas desta versão

- Corrigido cabeçalho MIME `From` para exibir corretamente `EAC Porciúncula de Santana` no Gmail.
- Assunto permanece codificado em UTF-8.
- Edge Function prioriza `SUPABASE_SECRET_KEYS['default']` e mantém compatibilidade com `SUPABASE_SERVICE_ROLE_KEY` legado.
- Erros da Edge Function agora são registrados em `email_confirmacao_erro` e retornam mensagem legível, sem `[object Object]`.
- Envio de confirmação ocorre automaticamente após a solicitação quando há e-mail e token de despacho.
- Token de despacho continua descartável e é removido após envio bem-sucedido.
- Modal usa código amigável `EAC37-XXXXXX`.
- Área do comprovante deixa explícito que é clicável e mostra estado do arquivo anexado.
- Dashboard mostra situação do e-mail em cada solicitação.
- Adicionado `AJUSTES_FINAIS_VALIDACAO_LOCAL.sql` para consolidar views, constraint de entrega parcial e grants da Edge Function.
- Se `.env.local` estiver incompleto, o frontend exibe uma tela de configuração em vez de tela branca.


## Fluxo operacional final - 17/08/2026

- Solicitação sempre liberada, sem consulta a estoque.
- Estoque representa somente quantidade fisicamente recebida e ainda disponível.
- Reposição necessária = demanda pendente - estoque físico, mínimo zero.
- Tela Reposição virou lista objetiva para confecção por cor, tamanho e quantidade.
- Tela Estoque ganhou drawer de recebimento com opções fechadas de cor e tamanho.
- Removido estoque mínimo da interface e da lógica gerencial.
- Entrega individual continua baixando estoque e quitando a solicitação.
