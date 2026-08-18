# Validação do fluxo final de camisas

## Regra funcional fechada

1. A solicitação NUNCA consulta nem bloqueia por estoque.
2. Toda solicitação válida entra como demanda pendente.
3. Estoque representa somente camisa recebida fisicamente e ainda não entregue.
4. Reposição necessária = pendente - estoque recebido, mínimo zero.
5. Ao entregar uma camisa, o sistema baixa o estoque físico e reduz a pendência da solicitação.
6. Não existe conceito de estoque mínimo.

## Antes de abrir o frontend

No SQL Editor da base EAC execute:

`supabase/PATCH_FLUXO_REPOSICAO_ESTOQUE.sql`

Depois reinicie o Vite se necessário:

```cmd
npm run dev
```

## Teste 1 - Solicitação livre

Com estoque Azul / P = 0, faça duas solicitações Azul / P.

Resultado esperado:

- ambas são registradas normalmente;
- nenhuma é bloqueada;
- Dashboard mostra demanda pendente 2;
- Reposição necessária 2.

## Teste 2 - Registrar recebimento

Dashboard > Estoque > Registrar recebimento.

Selecione:

- Cor: Azul
- Tamanho: P
- Quantidade recebida: 1

Resultado esperado:

- estoque recebido Azul/P = 1;
- demanda pendente continua 2;
- pronto para entrega = 1;
- reposição necessária cai para 1.

## Teste 3 - Entregar

Abra Solicitações e marque uma solicitação Azul/P como entregue.

Resultado esperado:

- estoque Azul/P cai de 1 para 0;
- demanda pendente cai de 2 para 1;
- reposição necessária continua 1;
- solicitação entregue fica quitada.

## Teste 4 - Lista para confecção

Abra Reposição.

A tela deve mostrar somente as combinações com falta, com:

- Cor
- Tamanho
- Pendente
- Estoque recebido
- Qtd reposição

O botão `Copiar lista` deve copiar uma lista pronta para enviar à confecção.

## Opções fechadas

Cores disponíveis:

- Branca
- Azul
- Marrom

Tamanhos disponíveis:

- PP
- P
- M
- G
- GG
- XG
- XXG

Essas listas são usadas tanto no formulário quanto no drawer de recebimento para evitar digitação divergente.
