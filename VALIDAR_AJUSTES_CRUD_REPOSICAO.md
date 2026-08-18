# Validação - CRUD, filtro e reposição

## 1. Banco
Execute no SQL Editor:

`supabase/PATCH_CRUD_RESERVAS_REPOSICAO.sql`

Resultados esperados ao final do script:

- saldo físico atual: 21
- estoque comprometido: 21
- estoque disponível: 0
- reposição necessária: 13

A primeira leva possui 34 camisas recebidas nas linhas 2 a 31 da aba Itens Solicitação. Como 13 dessas unidades já constam como entregues na planilha, o saldo físico atual é 21. Essas 21 unidades continuam comprometidas com as solicitações da primeira leva.

A lista para confecção deve mostrar apenas as linhas 32 em diante:

- Marrom / PP: 1
- Marrom / P: 3
- Marrom / M: 5
- Marrom / G: 2
- Marrom / XXG: 2
- Total: 13

## 2. Solicitações
Na aba Solicitações valide o filtro por status:

- Todos os status
- Aguardando reposição
- Parcialmente coberto
- Pronto para entrega
- Parcialmente entregue
- Entregue
- Cancelado

A tabela também mostra Coberto e Sem cobertura para cada item.

## 3. Estoque - CRUD
Na aba Estoque:

1. Clique Registrar recebimento e adicione uma quantidade.
2. Confirme que o sistema direciona automaticamente o saldo às solicitações mais antigas da mesma cor/tamanho.
3. Clique Editar e corrija o saldo físico.
4. Confirme que reposição e cobertura são recalculadas.
5. Clique Excluir em um registro de teste. O saldo é zerado/inativado e as solicitações voltam para reposição.

Cor e tamanho são listas fechadas para evitar divergência de cadastro.

## 4. Entrega
O botão Entregar aparece somente quando aquela solicitação possui quantidade coberta/reservada.
Ao entregar:

- quantidade entregue aumenta;
- cobertura da solicitação diminui;
- estoque físico diminui;
- as reservas restantes são recalculadas;
- a lista de reposição continua refletindo somente demanda sem cobertura.
