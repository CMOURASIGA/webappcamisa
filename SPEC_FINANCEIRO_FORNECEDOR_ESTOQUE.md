# SPEC — Financeiro, Fornecedor, Reposição, Estoque e Solicitações

## Status

Especificação funcional para desenvolvimento futuro do `webappcamisa`.

Esta SPEC consolida as decisões operacionais tomadas após a revisão do fluxo de solicitação, validação financeira, compra junto ao fornecedor, estoque e entrega.

Ela deve ser lida em conjunto com:

- Issue #1 — confirmação enviada sem persistência;
- Issue #2 — hardening/idempotência/reconciliação;
- Issue #3 — fail-closed e validação financeira.

---

# 1. Princípio central

A fonte de verdade é o banco Supabase.

Nenhuma informação apresentada ao usuário como confirmada pode existir apenas no frontend, e-mail ou processo externo.

Qualquer número oficial de solicitação só pode existir depois que o pagamento PIX for confirmado pelo Financeiro.

---

# 2. Pré-solicitação e validação financeira

## 2.1 Fluxo

1. Cliente preenche a solicitação.
2. Cliente anexa o comprovante PIX.
3. Backend valida dados mínimos e arquivo.
4. Pré-solicitação + itens + comprovante são persistidos.
5. Commit é confirmado no banco.
6. Sistema gera um protocolo de recebimento, por exemplo `REC-XXXXXX`.
7. Cliente recebe e-mail informando:
   - dados recebidos;
   - comprovante recebido;
   - pagamento aguardando validação;
   - protocolo de recebimento;
   - esse protocolo ainda não é número oficial do pedido.
8. Financeiro recebe e-mail de nova validação pendente.
9. Financeiro acessa a tela financeira e confere o PIX.
10. Financeiro decide:
    - `PAGAMENTO_CONFIRMADO`; ou
    - `PAGAMENTO_NAO_LOCALIZADO`.
11. Se confirmado:
    - sistema gera o número oficial da solicitação;
    - pedido passa a participar da demanda/estoque/reposição;
    - cliente recebe e-mail de compra confirmada com o número oficial.
12. Se não localizado:
    - cliente recebe e-mail informando a pendência;
    - é orientado a contatar o Financeiro;
    - a pré-solicitação permanece registrada e recuperável.
13. Após regularização, Financeiro pode alterar:
    - `PAGAMENTO_NAO_LOCALIZADO -> PAGAMENTO_CONFIRMADO`.
14. Nessa transição:
    - número oficial é gerado;
    - pedido é ativado;
    - cliente recebe automaticamente o e-mail de confirmação.

## 2.2 Regra fail-closed

Antes de `PAGAMENTO_CONFIRMADO`:

- não gerar número oficial;
- não reservar estoque;
- não aumentar reposição;
- não permitir entrega;
- não considerar receita confirmada;
- não enviar e-mail de compra confirmada.

Falha técnica antes do commit:
- não apresentar protocolo;
- não apresentar número;
- não enviar confirmação.

Falha de e-mail depois do commit:
- não desfaz a pré-solicitação;
- registrar falha;
- reprocessar envio.

---

# 3. Estados

## 3.1 Financeiro da solicitação

Estados mínimos:

- `AGUARDANDO_CONFIRMACAO_FINANCEIRA`
- `PAGAMENTO_CONFIRMADO`
- `PAGAMENTO_NAO_LOCALIZADO`
- `CANCELADO`
- `ERRO_TECNICO`

`PAGAMENTO_NAO_LOCALIZADO` é recuperável.

## 3.2 Comunicação

Controlar separadamente:

- e-mail de recebimento ao cliente;
- e-mail de notificação ao Financeiro;
- e-mail de confirmação da compra;
- e-mail de pagamento não localizado.

Cada envio deve ter:
- status;
- tentativas;
- último erro;
- data/hora;
- correlation id.

---

# 4. Tela Financeiro — validação de recebimentos

Criar área específica para o Financeiro.

## 4.1 Fila

Exibir pré-solicitações aguardando validação com:

- protocolo;
- solicitante;
- beneficiário;
- quantidade total;
- valor esperado;
- data/hora;
- comprovante;
- status;
- idade da pendência.

## 4.2 Ações

- Confirmar pagamento;
- Pagamento não localizado;
- Reabrir pendência;
- Visualizar histórico.

Ao marcar como não localizado, exigir motivo, por exemplo:

- valor não localizado;
- valor divergente;
- comprovante ilegível;
- pagamento para chave diferente;
- comprovante possivelmente reutilizado;
- outro.

Toda alteração deve registrar:
- usuário;
- data/hora;
- status anterior;
- status novo;
- observação.

---

# 5. Cadastro de fornecedores

Criar cadastro próprio de fornecedor.

Campos mínimos:

- id;
- nome / razão social;
- nome de contato;
- telefone;
- e-mail;
- ativo;
- valor unitário padrão da camisa;
- percentual padrão de entrada;
- percentual padrão de saldo;
- prazo padrão, se aplicável;
- observações.

## 5.1 Valor histórico

O valor cadastrado no fornecedor é apenas o padrão atual.

Ao criar um lote, copiar e congelar no lote:
- valor unitário praticado;
- percentual de entrada;
- percentual de saldo.

Alterar o cadastro do fornecedor no futuro não pode mudar lotes antigos.

---

# 6. Regra de demanda e reposição

Somente solicitações com pagamento confirmado participam da demanda operacional.

Portanto:

```
DEMANDA_APROVADA =
somatório das quantidades pendentes
de solicitações PAGAMENTO_CONFIRMADO
```

```
NECESSIDADE_REPOSICAO =
DEMANDA_APROVADA
- QUANTIDADE_ENTREGUE
- QUANTIDADE_COBERTA_POR_ESTOQUE
- QUANTIDADE_JA_ENVIADA_AO_FORNECEDOR_E_NAO_RECEBIDA
```

Nunca incluir:
- aguardando Financeiro;
- pagamento não localizado;
- cancelados.

---

# 7. A enviar ao fornecedor

Criar tela específica com visão por cor/tamanho:

| Cor | Tamanho | Demanda aprovada pendente | Estoque comprometido | Em produção | Disponível para novo lote |
|---|---|---:|---:|---:|---:|

O valor de `Disponível para novo lote` representa somente necessidade:
- financeiramente aprovada;
- ainda sem estoque;
- ainda não enviada ao fornecedor.

## 7.1 Envio parcial

Mesmo que existam 43 unidades aprovadas para reposição, o operador pode decidir enviar somente 30 ao fornecedor por decisão operacional.

Isso NÃO tem relação com falta de aprovação financeira.

Nesse caso:
- 30 = em produção;
- 13 = aprovadas e ainda não enviadas.

O sistema deve mostrar explicitamente esse saldo.

---

# 8. Lotes do fornecedor

Cada envio deve virar um lote formal.

Exemplo:
`LOTE-2026-003`

## 8.1 Dados do lote

- fornecedor;
- encontro;
- data de criação;
- data de envio;
- status operacional;
- status financeiro;
- quantidade total;
- valor unitário congelado;
- valor total;
- percentual de entrada;
- valor da entrada;
- percentual do saldo;
- valor do saldo;
- observações;
- criado por;
- timestamps.

## 8.2 Itens

Por cor/tamanho:

- quantidade enviada;
- quantidade recebida;
- quantidade pendente;
- valor unitário;
- valor total.

## 8.3 Confirmação do lote

Antes de confirmar, mostrar resumo:

- quantidade total;
- composição por cor/tamanho;
- fornecedor;
- valor unitário;
- valor total;
- entrada de 50% ou percentual configurado;
- saldo futuro.

Ao confirmar o lote:

- congelar valores;
- registrar itens como enviados ao fornecedor;
- reduzir `disponível para novo lote`;
- criar obrigação financeira da entrada;
- manter saldo pendente separado.

---

# 9. Financeiro do fornecedor

Status financeiros mínimos:

- `AGUARDANDO_ENTRADA`
- `ENTRADA_PAGA`
- `SALDO_PENDENTE`
- `PAGO_INTEGRALMENTE`

Registrar pagamentos separadamente:

- tipo: `ENTRADA | SALDO | OUTRO`;
- valor;
- data;
- comprovante;
- registrado por;
- observações.

Permitir mais de um pagamento se necessário.

Não assumir que sempre será exatamente 50/50, apesar de esse ser o padrão atual.

---

# 10. Status operacional do lote

Estados mínimos:

- `RASCUNHO`
- `ENVIADO_AO_FORNECEDOR`
- `EM_PRODUCAO`
- `RECEBIMENTO_PARCIAL`
- `RECEBIDO`
- `CONCLUIDO`
- `CANCELADO`

Status operacional e financeiro são independentes.

Exemplo válido:

```
Operacional: RECEBIDO
Financeiro: SALDO_PENDENTE
```

---

# 11. Recebimento do fornecedor

Permitir recebimento parcial por item.

Exemplo:

```
Marrom / M
enviado: 20
recebido anteriormente: 8
recebido agora: 7
total recebido: 15
pendente: 5
```

Ao registrar recebimento:

1. validar que não excede quantidade enviada;
2. aumentar estoque físico;
3. registrar movimentação;
4. reduzir quantidade em produção;
5. recalcular reservas;
6. manter rastreabilidade do lote de origem.

---

# 12. Regras de estoque e reserva

## 12.1 Quantidades independentes

Nunca confundir:

- quantidade solicitada;
- quantidade reservada;
- quantidade entregue;
- quantidade pendente.

Exemplo obrigatório:

```
Solicitado: 2
Reservado: 1
Entregue: 1
Pendente: 1
Status: PARCIALMENTE_ENTREGUE
```

Nunca considerar esse pedido quitado.

## 12.2 FIFO

A distribuição de estoque deve obedecer:

```
solicitação financeiramente confirmada mais antiga
→ solicitação confirmada mais nova
```

Critério primário:
- timestamp real da confirmação/ativação da solicitação.

Em empate:
- criado_em;
- item criado_em;
- id.

Nenhuma solicitação mais nova pode consumir cobertura antes de uma solicitação mais antiga equivalente, salvo exceção administrativa explícita e auditada.

## 12.3 Ajustes de pedido

O Financeiro/administrador pode precisar corrigir um pedido informado incorretamente.

Ajustes permitidos devem ocorrer por ação estruturada, nunca por edição direta improvisada.

Ao alterar:
- quantidade;
- cor;
- tamanho;
- item;

o sistema deve:

1. registrar before/after;
2. registrar usuário e motivo;
3. recalcular demanda;
4. recalcular FIFO/reservas;
5. recalcular reposição;
6. preservar histórico.

Se já houver entrega associada, restringir alterações que tornem o histórico impossível.

Exemplo:
- entregue 1;
- não permitir reduzir solicitado para 0.

---

# 13. Tela de solicitações — ordenação e filtros

Manter ordenação padrão cronológica por chegada/confirmação.

Adicionar filtros combináveis para todos os principais atributos controlados.

Filtros mínimos:

## Identificação
- protocolo;
- número oficial;
- solicitante;
- beneficiário;
- telefone;
- e-mail.

## Origem
- encontreiro / externo;
- equipe;
- encontro.

## Pedido
- cor;
- tamanho;
- quantidade solicitada;
- quantidade entregue;
- quantidade reservada;
- quantidade pendente.

## Financeiro
- aguardando confirmação;
- pagamento confirmado;
- pagamento não localizado;
- cancelado.

## Estoque
- sem cobertura;
- parcialmente coberto;
- pronto para entrega;
- parcialmente entregue;
- entregue.

## Comunicação
- e-mail de recebimento enviado/pendente/falha;
- Financeiro notificado/pendente/falha;
- confirmação enviada/pendente/falha.

## Período
- data da pré-solicitação;
- data da confirmação financeira;
- data da entrega.

Permitir:
- múltiplos filtros simultâneos;
- limpar filtros;
- totalizadores coerentes com os filtros;
- exportação CSV apenas com dados úteis ao humano;
- campos sensíveis a Excel/CSV exportados como texto quando necessário.

---

# 14. Estrutura sugerida de dados

Avaliar criação/evolução de:

- `camisa_solicitacoes`
- `camisa_solicitacao_itens`
- `camisa_pagamentos`
- `camisa_fornecedores`
- `camisa_fornecedor_lotes`
- `camisa_fornecedor_lote_itens`
- `camisa_fornecedor_pagamentos`
- `camisa_fornecedor_recebimentos`
- `camisa_email_outbox`
- `camisa_auditoria`

Os nomes finais podem mudar, mas as responsabilidades devem permanecer separadas.

---

# 15. Indicadores financeiros

## Clientes

- valor aguardando validação;
- valor confirmado;
- pagamentos não localizados;
- quantidade de solicitações confirmadas.

## Fornecedor

- valor contratado;
- entrada prevista;
- entrada paga;
- saldo pendente;
- valor total pago;
- quantidade enviada;
- quantidade recebida;
- quantidade em produção.

## Resultado

Quando houver custo unitário:

```
Receita confirmada
- custo contratado
= margem bruta prevista
```

Não misturar receita aguardando validação com receita confirmada.

---

# 16. Invariantes obrigatórias

O desenvolvimento deve proteger no banco, não apenas na UI:

- entregue <= solicitado;
- reservado + entregue <= solicitado;
- recebido do fornecedor <= enviado ao fornecedor;
- pagamentos registrados não podem ser negativos;
- lote confirmado deve ter fornecedor;
- lote confirmado deve congelar preço;
- somente pedidos financeiramente confirmados entram na demanda;
- somente itens confirmados podem receber reserva;
- número oficial só existe após confirmação financeira;
- histórico financeiro não pode ser apagado silenciosamente.

---

# 17. Human Validation

Antes de aprovar a implementação, testar no mínimo:

1. pré-solicitação gravada com sucesso;
2. falha antes do commit sem protocolo;
3. Financeiro confirma pagamento;
4. Financeiro marca pagamento não localizado;
5. regularização posterior;
6. geração do número oficial somente após confirmação;
7. pedido de quantidade 2 com apenas 1 disponível;
8. entrega parcial;
9. FIFO entre duas solicitações;
10. ajuste de quantidade antes de entrega;
11. tentativa de ajuste incompatível após entrega;
12. criação de fornecedor;
13. alteração de preço do fornecedor sem alterar lote antigo;
14. criação de lote com 50% de entrada;
15. lote parcial em relação à necessidade total;
16. recebimento parcial do fornecedor;
17. saldo financeiro do lote;
18. filtros combinados da tela de solicitações;
19. falha de e-mail sem perda de pedido;
20. reconciliação entre demanda aprovada, estoque, em produção e reposição.

---

# 18. Critério de aceite

A solução só deve ser homologada quando for possível provar que:

- nenhum pedido não pago influencia estoque/reposição;
- nenhum pedido confirmado fica fora da demanda;
- FIFO é respeitado;
- entrega parcial permanece parcial;
- quantidade 2 não é quitada com entrega 1;
- lote do fornecedor possui quantidade e financeiro conciliados;
- preço histórico do lote é imutável;
- entrada e saldo são rastreáveis;
- recebimento parcial atualiza estoque corretamente;
- filtros permitem localizar qualquer situação operacional relevante;
- todas as alterações críticas possuem auditoria.
