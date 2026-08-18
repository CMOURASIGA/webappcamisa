# Gestão de Camisas EAC

Versão Supabase do sistema de solicitação, reposição, estoque e entrega de camisas.

## Arquitetura

- Formulário público com busca controlada de encontreiro.
- Solicitante externo pode digitar o nome livremente.
- Beneficiário é obrigatório.
- Solicitação não depende de estoque.
- Dashboard autenticado com Supabase Auth.
- Reposição, recebimento e entrega são operações distintas.
- Estoque físico só baixa na entrega.
- Movimentações mantêm auditoria do saldo.

## Banco

Base configurada por variável `VITE_SUPABASE_URL`.

O SQL complementar está em `supabase/camisas_module.sql`.

## Apps Script

A pasta `google-apps-script/` foi preservada apenas como histórico do projeto. O frontend desta versão não importa nem chama `Code.gs`.

Consulte `VALIDACAO_LOCAL.md` para o roteiro completo.

## Gmail API e código amigável

Para habilitar confirmação por e-mail usando o Gmail oficial do EAC, veja `GMAIL_OAUTH_SETUP.md` e rode `supabase/camisas_email_gmail.sql`.
