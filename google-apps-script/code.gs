const SPREADSHEET_ID = '1OfgrdYC9CHQRPuJshQc5ds5RWC_qlVrJ1akosGq1gt8';

const STOCK_SHEET_NAME = 'Estoque';
const RESPONSE_SHEET_NAME = 'Respostas ao formulário 1';
const ITEMS_SHEET_NAME = 'Itens Solicitação';
const GERENCIAL_SHEET_NAME = 'Gerencial';

const PROOF_FOLDER_NAME = 'Comprovantes Camisas EAC';
const RESERVE_GLOBAL_INITIAL = 72;

const DASHBOARD_LOGO_URL = 'https://i.imgur.com/c5XQ7TW.jpg';
const INSTAGRAM_URL = 'https://www.instagram.com/eacporciunculadesantana/';

const ALLOWED_EXTENSIONS = ['pdf', 'jpg', 'jpeg', 'png'];
const MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024;

const SIZE_ORDER = ['PP', 'P', 'M', 'G', 'GG', 'XG', 'XXG'];

function doGet(e) {
  const action = (e && e.parameter && e.parameter.action)
    ? String(e.parameter.action)
    : '';

  if (action) {
    return handleApiAction_(action, null);
  }

  const page = (e && e.parameter && e.parameter.page)
    ? String(e.parameter.page).toLowerCase()
    : 'form';

  if (page === 'dashboard' && htmlFileExists_('Dashboard')) {
    return HtmlService.createHtmlOutputFromFile('Dashboard')
      .setTitle('Dashboard EAC - Controle de Camisas')
      .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
  }

  if (htmlFileExists_('Form')) {
    return HtmlService.createHtmlOutputFromFile('Form')
      .setTitle('EAC - Solicitacao de Camisas')
      .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
  }

  return jsonResponse_({
    ok: true,
    mode: 'api',
    message: 'Web App ativo. Use POST com { action, payload }.',
    actions: ['getBootstrapData', 'submitOrder', 'getDashboardData', 'markOrderDelivered', 'setupWebappEnvironment']
  });
}

function doPost(e) {
  try {
    const body = parseJsonBody_(e);
    const action = String(body.action || '').trim();
    const payload = body.payload;

    if (!action) {
      return jsonResponse_({ ok: false, error: 'Parametro action obrigatorio.' });
    }

    return handleApiAction_(action, payload);
  } catch (error) {
    return jsonResponse_({ ok: false, error: getErrorMessage_(error) });
  }
}

function handleApiAction_(action, payload) {
  try {
    switch (action) {
      case 'getBootstrapData':
        return jsonResponse_({ ok: true, data: getBootstrapData() });
      case 'getDashboardData':
        return jsonResponse_({ ok: true, data: getDashboardData() });
      case 'markOrderDelivered':
        return jsonResponse_({ ok: true, data: markOrderDelivered(payload) });
      case 'setupWebappEnvironment':
        return jsonResponse_({ ok: true, data: setupWebappEnvironment() });
      case 'submitOrder':
        return jsonResponse_({ ok: true, data: submitOrder(payload) });
      default:
        return jsonResponse_({ ok: false, error: 'Action invalida: ' + action });
    }
  } catch (error) {
    return jsonResponse_({ ok: false, error: getErrorMessage_(error) });
  }
}

function parseJsonBody_(e) {
  const raw = e && e.postData && e.postData.contents ? String(e.postData.contents) : '';
  if (!raw) return {};
  return JSON.parse(raw);
}

function jsonResponse_(obj) {
  return ContentService
    .createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}

function getErrorMessage_(error) {
  if (!error) return 'Erro inesperado.';
  if (typeof error === 'string') return error;
  if (error && error.message) return String(error.message);
  return String(error);
}

function htmlFileExists_(name) {
  try {
    HtmlService.createHtmlOutputFromFile(name);
    return true;
  } catch (error) {
    return false;
  }
}

function setupWebappEnvironment() {
  ensureMainResponseSheet_();
  ensureItemsSheet_();
  ensureGerencialSheet_();
  updateGerencialSheet_();

  return {
    ok: true,
    message: 'Ambiente preparado com sucesso.'
  };
}

function getBootstrapData() {
  ensureMainResponseSheet_();
  ensureItemsSheet_();
  ensureGerencialSheet_();

  return {
    logoUrl: DASHBOARD_LOGO_URL,
    instagramUrl: INSTAGRAM_URL,
    allowedExtensions: ALLOWED_EXTENSIONS,
    stockOptions: getAvailableStockOptions_()
  };
}

function submitOrder(payload) {
  const lock = LockService.getScriptLock();
  lock.waitLock(30000);

  try {
    validatePayload_(payload);

    ensureMainResponseSheet_();
    ensureItemsSheet_();
    ensureGerencialSheet_();

    const requestId = generateRequestId_();
    const submittedAt = new Date();
    const reserveGlobalStatusBefore = getReserveGlobalStatus_();
    const isSpecificReserveClient = !!payload.clienteEspecificoReserva;

    const proofInfo = saveProofFile_(payload.proofFile, requestId, payload.nomeCompleto);
    const processResult = processOrderItems_(payload.items, {
      isSpecificReserveClient,
      reserveExceptionReason: payload.motivoExcecaoReserva,
      reserveGlobalRemaining: reserveGlobalStatusBefore.remaining
    });
    const mainStatus = buildMainStatus_(processResult.itemsProcessed);

    appendMainRequestRow_({
      requestId,
      submittedAt,
      email: payload.email,
      nomeCompleto: payload.nomeCompleto,
      equipe: payload.equipe,
      comprovanteUrl: proofInfo.url,
      comprovanteNome: proofInfo.name,
      resumoPedido: buildOrderSummary_(processResult.itemsProcessed),
      statusGeral: mainStatus.statusGeral,
      observacaoGeral: mainStatus.observacaoGeral,
      quantidadeItens: payload.items.length,
      clienteEspecificoReserva: isSpecificReserveClient,
      motivoExcecaoReserva: payload.motivoExcecaoReserva
    });

    appendItemRows_(requestId, submittedAt, payload, processResult.itemsProcessed, proofInfo);
    updateGerencialSheet_();

    sendOrderStatusEmail_({
      to: payload.email,
      nomeCompleto: payload.nomeCompleto,
      equipe: payload.equipe,
      requestId,
      itemsProcessed: processResult.itemsProcessed
    });

    return {
      success: true,
      requestId,
      statusGeral: mainStatus.statusGeral,
      observacaoGeral: mainStatus.observacaoGeral,
      proofUrl: proofInfo.url,
      reservaGlobal: {
        inicial: RESERVE_GLOBAL_INITIAL,
        consumida: reserveGlobalStatusBefore.consumed + processResult.reserveGlobalUsedTotal,
        restante: reserveGlobalStatusBefore.remaining - processResult.reserveGlobalUsedTotal
      },
      message: 'Solicitação enviada com sucesso.'
    };

  } finally {
    lock.releaseLock();
  }
}

function getDashboardData() {
  ensureMainResponseSheet_();
  ensureItemsSheet_();
  const reserveGlobalStatus = getReserveGlobalStatus_();
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  const stockSheet = ss.getSheetByName(STOCK_SHEET_NAME);
  const itemsSheet = ss.getSheetByName(ITEMS_SHEET_NAME);
  const responseSheet = ss.getSheetByName(RESPONSE_SHEET_NAME);

  if (!stockSheet) throw new Error(`Aba "${STOCK_SHEET_NAME}" não encontrada.`);
  if (!itemsSheet) throw new Error(`Aba "${ITEMS_SHEET_NAME}" não encontrada.`);
  if (!responseSheet) throw new Error(`Aba "${RESPONSE_SHEET_NAME}" não encontrada.`);

  const stockData = stockSheet.getDataRange().getValues();
  const stockHeaders = stockData[0];

  const idxTamanho = stockHeaders.indexOf('Tamanho');
  const idxQtd = stockHeaders.indexOf('Quantidade');
  const idxCor = stockHeaders.indexOf('Cor');
  const idxReserva = stockHeaders.indexOf('Reserva Brinde');
  const idxDisponivel = stockHeaders.indexOf('Disponível');

  if ([idxTamanho, idxQtd, idxCor, idxReserva, idxDisponivel].includes(-1)) {
    throw new Error('A aba Estoque precisa conter: Tamanho, Quantidade, Cor, Reserva Brinde, Disponível');
  }

  let totalFisico = 0;
  let totalReserva = 0;
  let totalDisponivel = 0;
  let totalPretaDisponivel = 0;
  let totalAzulDisponivel = 0;

  const tabelaEstoque = stockData.slice(1).map(row => {
    const tamanho = String(row[idxTamanho] || '').trim();
    const cor = String(row[idxCor] || '').trim();
    const quantidade = Number(row[idxQtd]) || 0;
    const reserva = Number(row[idxReserva]) || 0;
    const disponivel = Number(row[idxDisponivel]) || 0;

    totalFisico += quantidade;
    totalReserva += reserva;
    totalDisponivel += disponivel;

    if (normalizeText_(cor) === 'PRETA') totalPretaDisponivel += disponivel;
    if (normalizeText_(cor) === 'AZUL') totalAzulDisponivel += disponivel;

    return {
      tamanho,
      cor,
      quantidade,
      reserva,
      disponivel,
      chave: `${tamanho} | ${cor}`
    };
  });

  const itemsData = itemsSheet.getDataRange().getValues();
  const itemHeaders = itemsData[0];

  const idxItemChave = itemHeaders.indexOf('Chave');
  const idxItemQtdSolicitada = itemHeaders.indexOf('Quantidade Solicitada');
  const idxItemQtdAtendida = itemHeaders.indexOf('Quantidade Atendida');
  const idxItemStatus = itemHeaders.indexOf('Status Item');
  const idxItemAlternativa = itemHeaders.indexOf('Alternativa Sugerida');
  const idxItemOrigemAbatimento = findHeaderIndex_(itemHeaders, ['Origem Abatimento']);
  const idxItemQtdReserva = findHeaderIndex_(itemHeaders, ['Quantidade da Reserva']);
  const idxItemQtdDisponivel = findHeaderIndex_(itemHeaders, ['Quantidade do Disponível', 'Quantidade do Disponivel']);
  const idxItemExcecaoReserva = findHeaderIndex_(itemHeaders, ['Exceção de Reserva', 'Excecao de Reserva']);
  const idxItemMotivoExcecao = findHeaderIndex_(itemHeaders, ['Motivo Exceção Reserva', 'Motivo Excecao Reserva']);
  const idxItemAbateReservaGlobal = findHeaderIndex_(itemHeaders, ['Abate Reserva Global']);

  let totalReservados = 0;
  let totalAlternativa = 0;
  let totalReposicao = 0;

  const statsMap = {};

  itemsData.slice(1).forEach(row => {
    const chave = String(row[idxItemChave] || '').trim();
    const qtdSolicitada = Number(row[idxItemQtdSolicitada]) || 0;
    const qtdAtendida = Number(row[idxItemQtdAtendida]) || 0;
    const status = String(row[idxItemStatus] || '').trim();

    if (!chave) return;

    if (!statsMap[chave]) {
      statsMap[chave] = {
        solicitacoes: 0,
        reservados: 0,
        alternativas: 0,
        reposicoes: 0
      };
    }

    statsMap[chave].solicitacoes += qtdSolicitada;

    if (status === 'RESERVADO') {
      statsMap[chave].reservados += qtdAtendida;
      totalReservados += qtdAtendida;
    }

    if (status === 'SUGERIR ALTERNATIVA') {
      statsMap[chave].alternativas += qtdSolicitada;
      totalAlternativa += qtdSolicitada;
    }

    if (status === 'SOLICITAR REPOSIÇÃO') {
      statsMap[chave].reposicoes += qtdSolicitada;
      totalReposicao += qtdSolicitada;
    }
  });

  const tabelaGerencial = tabelaEstoque
    .sort((a, b) => {
      const corCmp = normalizeText_(a.cor).localeCompare(normalizeText_(b.cor));
      if (corCmp !== 0) return corCmp;
      return SIZE_ORDER.indexOf(a.tamanho) - SIZE_ORDER.indexOf(b.tamanho);
    })
    .map(item => {
      const s = statsMap[item.chave] || {
        solicitacoes: 0,
        reservados: 0,
        alternativas: 0,
        reposicoes: 0
      };

      return {
        ...item,
        solicitacoes: s.solicitacoes,
        reservados: s.reservados,
        alternativas: s.alternativas,
        reposicoes: s.reposicoes
      };
    });

  const responseData = responseSheet.getDataRange().getValues();
  const responseHeaders = responseData[0] || [];

  const idxRequestId = findHeaderIndex_(responseHeaders, ['ID Solicitacao', 'ID Solicitação']);
  const idxDataHora = findHeaderIndex_(responseHeaders, ['Carimbo de data/hora', 'Data/Hora']);
  const idxEmail = findHeaderIndex_(responseHeaders, ['Endereco de e-mail', 'Endereço de e-mail']);
  const idxNomeCompleto = findHeaderIndex_(responseHeaders, ['Nome Completo']);
  const idxEquipe = findHeaderIndex_(responseHeaders, ['Equipe']);
  const idxResumoPedido = findHeaderIndex_(responseHeaders, ['Resumo Pedido']);
  const idxStatusGeral = findHeaderIndex_(responseHeaders, ['Status Geral', 'Status Estoque']);
  const idxStatusEntrega = findHeaderIndex_(responseHeaders, ['Status Entrega']);
  const idxDataEntrega = findHeaderIndex_(responseHeaders, ['Data/Hora Entrega']);

  const idxItemRequestId = findHeaderIndex_(itemHeaders, ['ID Solicitacao', 'ID Solicitação']);
  const idxItemTamanho = findHeaderIndex_(itemHeaders, ['Tamanho']);
  const idxItemCor = findHeaderIndex_(itemHeaders, ['Cor']);

  const itemsByRequestId = {};
  itemsData.slice(1).forEach(row => {
    const requestId = idxItemRequestId >= 0 ? String(row[idxItemRequestId] || '').trim() : '';
    if (!requestId) return;

    if (!itemsByRequestId[requestId]) itemsByRequestId[requestId] = [];
    itemsByRequestId[requestId].push({
      tamanho: idxItemTamanho >= 0 ? String(row[idxItemTamanho] || '').trim() : '',
      cor: idxItemCor >= 0 ? String(row[idxItemCor] || '').trim() : '',
      quantidadeSolicitada: Number(row[idxItemQtdSolicitada]) || 0,
      quantidadeAtendida: Number(row[idxItemQtdAtendida]) || 0,
      statusItem: String(row[idxItemStatus] || '').trim(),
      alternativaSugerida: idxItemAlternativa >= 0 ? String(row[idxItemAlternativa] || '').trim() : '',
      origemAbatimento: idxItemOrigemAbatimento >= 0 ? String(row[idxItemOrigemAbatimento] || '').trim() : '',
      quantidadeDaReserva: idxItemQtdReserva >= 0 ? Number(row[idxItemQtdReserva]) || 0 : 0,
      quantidadeDoDisponivel: idxItemQtdDisponivel >= 0 ? Number(row[idxItemQtdDisponivel]) || 0 : 0,
      excecaoReserva: idxItemExcecaoReserva >= 0 ? String(row[idxItemExcecaoReserva] || '').trim() : '',
      motivoExcecaoReserva: idxItemMotivoExcecao >= 0 ? String(row[idxItemMotivoExcecao] || '').trim() : '',
      abateReservaGlobal: idxItemAbateReservaGlobal >= 0 ? Number(row[idxItemAbateReservaGlobal]) || 0 : 0
    });
  });

  const pedidos = responseData
    .slice(1)
    .map(row => {
      const requestId = idxRequestId >= 0 ? String(row[idxRequestId] || '').trim() : '';
      if (!requestId) return null;

      const rawDataHora = idxDataHora >= 0 ? row[idxDataHora] : '';
      const rawDataEntrega = idxDataEntrega >= 0 ? row[idxDataEntrega] : '';
      const statusEntrega = idxStatusEntrega >= 0 ? String(row[idxStatusEntrega] || '').trim() : '';

      return {
        requestId,
        dataHora: formatDateTimeSafe_(rawDataHora),
        nomeCompleto: idxNomeCompleto >= 0 ? String(row[idxNomeCompleto] || '').trim() : '',
        email: idxEmail >= 0 ? String(row[idxEmail] || '').trim() : '',
        equipe: idxEquipe >= 0 ? String(row[idxEquipe] || '').trim() : '',
        resumoPedido: idxResumoPedido >= 0 ? String(row[idxResumoPedido] || '').trim() : '',
        statusGeral: idxStatusGeral >= 0 ? String(row[idxStatusGeral] || '').trim() : '',
        statusEntrega: statusEntrega || 'PENDENTE',
        entregueEm: formatDateTimeSafe_(rawDataEntrega),
        items: itemsByRequestId[requestId] || [],
        _timestamp: parseDateTimeSafe_(rawDataHora).getTime()
      };
    })
    .filter(item => item)
    .sort((a, b) => b._timestamp - a._timestamp)
    .map(item => {
      delete item._timestamp;
      return item;
    });

  return {
    logoUrl: DASHBOARD_LOGO_URL,
    instagramUrl: INSTAGRAM_URL,
    atualizadoEm: Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'dd/MM/yyyy HH:mm:ss'),
    indicadores: {
      totalFisico,
      totalReserva,
      totalDisponivel,
      totalPretaDisponivel,
      totalAzulDisponivel,
      totalReservados,
      totalAlternativa,
      totalReposicao,
      reservaGlobalInicial: reserveGlobalStatus.initial,
      reservaGlobalConsumida: reserveGlobalStatus.consumed,
      reservaGlobalRestante: reserveGlobalStatus.remaining
    },
    tabelaGerencial,
    pedidos
  };
}

function markOrderDelivered(payload) {
  const requestId = payload && payload.requestId ? String(payload.requestId).trim() : '';
  if (!requestId) throw new Error('Informe o requestId para marcar como entregue.');

  ensureMainResponseSheet_();
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  const responseSheet = ss.getSheetByName(RESPONSE_SHEET_NAME);
  if (!responseSheet) throw new Error(`Aba "${RESPONSE_SHEET_NAME}" nao encontrada.`);

  const headers = responseSheet.getRange(1, 1, 1, responseSheet.getLastColumn()).getValues()[0];
  const idxRequestId = findHeaderIndex_(headers, ['ID Solicitacao', 'ID Solicitação']);
  const idxStatusEntrega = findHeaderIndex_(headers, ['Status Entrega']);
  const idxDataEntrega = findHeaderIndex_(headers, ['Data/Hora Entrega']);

  if (idxRequestId < 0 || idxStatusEntrega < 0 || idxDataEntrega < 0) {
    throw new Error('A aba de respostas precisa conter os campos de ID e entrega.');
  }

  const data = responseSheet.getDataRange().getValues();
  let targetRow = -1;

  for (let i = 1; i < data.length; i++) {
    const currentRequestId = String(data[i][idxRequestId] || '').trim();
    if (currentRequestId === requestId) {
      targetRow = i + 1;
      break;
    }
  }

  if (targetRow === -1) {
    throw new Error(`Pedido ${requestId} nao encontrado.`);
  }

  const now = new Date();
  responseSheet.getRange(targetRow, idxStatusEntrega + 1).setValue('ENTREGUE');
  responseSheet.getRange(targetRow, idxDataEntrega + 1).setValue(now);

  return {
    success: true,
    requestId: requestId,
    deliveredAt: Utilities.formatDate(now, Session.getScriptTimeZone(), 'dd/MM/yyyy HH:mm:ss')
  };
}

function getAvailableStockOptions_() {
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  const sheet = ss.getSheetByName(STOCK_SHEET_NAME);
  if (!sheet) throw new Error(`Aba "${STOCK_SHEET_NAME}" não encontrada.`);

  const data = sheet.getDataRange().getValues();
  const headers = data[0];

  const idxTamanho = headers.indexOf('Tamanho');
  const idxQtd = headers.indexOf('Quantidade');
  const idxCor = headers.indexOf('Cor');
  const idxReserva = headers.indexOf('Reserva Brinde');
  const idxDisponivel = headers.indexOf('Disponível');

  if ([idxTamanho, idxQtd, idxCor, idxReserva, idxDisponivel].includes(-1)) {
    throw new Error('A aba Estoque precisa conter: Tamanho, Quantidade, Cor, Reserva Brinde, Disponível');
  }

  const rows = data.slice(1)
    .map(row => ({
      tamanho: String(row[idxTamanho] || '').trim(),
      cor: String(row[idxCor] || '').trim(),
      quantidade: Number(row[idxQtd]) || 0,
      reserva: Number(row[idxReserva]) || 0,
      disponivel: Number(row[idxDisponivel]) || 0
    }))
    .filter(item => item.tamanho && item.cor && (item.disponivel > 0 || item.reserva > 0))
    .sort((a, b) => {
      const corCmp = normalizeText_(a.cor).localeCompare(normalizeText_(b.cor));
      if (corCmp !== 0) return corCmp;
      return SIZE_ORDER.indexOf(a.tamanho) - SIZE_ORDER.indexOf(b.tamanho);
    });

  const colors = [...new Set(rows.map(r => r.cor))];
  const specificReserveColors = [...new Set(
    rows
      .filter(r => r.reserva > 0)
      .map(r => r.cor)
  )];

  return {
    colors,
    specificReserveColors,
    rows
  };
}

function processOrderItems_(items, options) {
  const opts = options || {};
  const isSpecificReserveClient = !!opts.isSpecificReserveClient;
  const reserveExceptionReason = String(opts.reserveExceptionReason || '').trim();
  let reserveGlobalRemaining = Number(opts.reserveGlobalRemaining) || 0;
  let reserveGlobalUsedTotal = 0;

  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  const stockSheet = ss.getSheetByName(STOCK_SHEET_NAME);
  const stockData = stockSheet.getDataRange().getValues();
  const headers = stockData[0];

  const idxTamanho = headers.indexOf('Tamanho');
  const idxQtd = headers.indexOf('Quantidade');
  const idxCor = headers.indexOf('Cor');
  const idxReserva = headers.indexOf('Reserva Brinde');
  const idxDisponivel = headers.indexOf('Disponível');

  if ([idxTamanho, idxQtd, idxCor, idxReserva, idxDisponivel].includes(-1)) {
    throw new Error('A aba Estoque precisa conter: Tamanho, Quantidade, Cor, Reserva Brinde, Disponível');
  }

  const stockRows = stockData.slice(1).map((row, i) => ({
    rowIndex: i + 2,
    tamanho: String(row[idxTamanho] || '').trim(),
    cor: String(row[idxCor] || '').trim(),
    quantidade: Number(row[idxQtd]) || 0,
    reserva: Number(row[idxReserva]) || 0
  }));
  const allowedSpecificReserveColors = [...new Set(
    stockRows
      .filter(row => row.reserva > 0)
      .map(row => normalizeText_(row.cor))
  )];

  const itemsProcessed = [];

  items.forEach((item, index) => {
    const quantidadeSolicitada = Number(item.quantidade) || 0;
    const tamanho = String(item.tamanho || '').trim();
    const cor = String(item.cor || '').trim();

    if (isSpecificReserveClient && !allowedSpecificReserveColors.includes(normalizeText_(cor))) {
      throw new Error(
        `A cor ${cor} nao esta habilitada para cliente especifico de reserva.`
      );
    }

    const exact = findStockMutableRow_(stockRows, tamanho, cor);

    if (exact) {
      const reservaAtual = Math.max(exact.reserva, 0);
      const disponivelLivreAtual = Math.max(exact.quantidade - exact.reserva, 0);
      const estoqueTotalAtual = Math.max(exact.quantidade, 0);
      const quantidadeDaReserva = isSpecificReserveClient ? Math.min(quantidadeSolicitada, reservaAtual) : 0;
      const quantidadeDoDisponivel = isSpecificReserveClient
        ? Math.max(Math.min(quantidadeSolicitada - quantidadeDaReserva, disponivelLivreAtual), 0)
        : 0;
      const atendeComRegraEspecifica = isSpecificReserveClient
        ? (quantidadeDaReserva + quantidadeDoDisponivel) >= quantidadeSolicitada
        : false;

      if ((!isSpecificReserveClient && disponivelLivreAtual >= quantidadeSolicitada) ||
          (isSpecificReserveClient && atendeComRegraEspecifica && estoqueTotalAtual >= quantidadeSolicitada)) {
        if (isSpecificReserveClient && reserveGlobalRemaining < quantidadeSolicitada) {
          throw new Error(
            `Saldo global da reserva insuficiente. Restante: ${reserveGlobalRemaining}. Pedido item ${index + 1}: ${quantidadeSolicitada}.`
          );
        }

        if (isSpecificReserveClient &&
            quantidadeDoDisponivel > 0 &&
            quantidadeDaReserva < quantidadeSolicitada &&
            !reserveExceptionReason) {
          throw new Error(
            `Informe o motivo da excecao de reserva para o item ${index + 1} (${tamanho} | ${cor}).`
          );
        }

        const quantidadeAntes = exact.quantidade;
        exact.quantidade = Math.max(exact.quantidade - quantidadeSolicitada, 0);
        if (isSpecificReserveClient) {
          exact.reserva = Math.max(exact.reserva - quantidadeDaReserva, 0);
          reserveGlobalRemaining -= quantidadeSolicitada;
          reserveGlobalUsedTotal += quantidadeSolicitada;
        }
        const quantidadeDepois = exact.quantidade;
        const houveExcecaoReserva = isSpecificReserveClient &&
          quantidadeDoDisponivel > 0 &&
          quantidadeDaReserva < quantidadeSolicitada;

        itemsProcessed.push({
          ordem: index + 1,
          tamanho,
          cor,
          chave: `${tamanho} | ${cor}`,
          quantidadeSolicitada,
          quantidadeAtendida: quantidadeSolicitada,
          statusItem: 'RESERVADO',
          alternativaSugerida: '',
          observacao: houveExcecaoReserva
            ? 'Item reservado com uso parcial de saldo disponivel por excecao.'
            : 'Item reservado com sucesso.',
          aceitaTamanhoAlternativo: item.aceitaTamanhoAlternativo ? 'SIM' : 'NÃO',
          aceitaOutraCor: item.aceitaOutraCor ? 'SIM' : 'NÃO',
          origemAbatimento: isSpecificReserveClient
            ? (houveExcecaoReserva ? 'RESERVA+DISPONIVEL' : 'RESERVA')
            : 'DISPONIVEL',
          quantidadeDaReserva: isSpecificReserveClient ? quantidadeDaReserva : 0,
          quantidadeDoDisponivel: isSpecificReserveClient ? quantidadeDoDisponivel : quantidadeSolicitada,
          excecaoReserva: houveExcecaoReserva ? 'SIM' : 'NÃO',
          motivoExcecaoReserva: houveExcecaoReserva ? reserveExceptionReason : '',
          abateReservaGlobal: isSpecificReserveClient ? quantidadeSolicitada : 0,
          quantidadeAntes,
          quantidadeDepois
        });
        return;
      }
    }

    let alternativa = null;

    if (item.aceitaTamanhoAlternativo) {
      alternativa = findAlternativeSizeMutable_(stockRows, tamanho, cor, quantidadeSolicitada);
    }

    if (!alternativa && item.aceitaOutraCor) {
      alternativa = findAlternativeColorMutable_(stockRows, tamanho, cor, quantidadeSolicitada);
    }

    if (alternativa) {
      itemsProcessed.push({
        ordem: index + 1,
        tamanho,
        cor,
        chave: `${tamanho} | ${cor}`,
        quantidadeSolicitada,
        quantidadeAtendida: 0,
        statusItem: 'SUGERIR ALTERNATIVA',
        alternativaSugerida: `${alternativa.tamanho} | ${alternativa.cor}`,
        observacao: 'Sem saldo suficiente. Alternativa encontrada.',
        aceitaTamanhoAlternativo: item.aceitaTamanhoAlternativo ? 'SIM' : 'NÃO',
        aceitaOutraCor: item.aceitaOutraCor ? 'SIM' : 'NÃO',
        origemAbatimento: 'NAO_ABATIDO',
        quantidadeDaReserva: 0,
        quantidadeDoDisponivel: 0,
        excecaoReserva: 'NÃO',
        motivoExcecaoReserva: '',
        abateReservaGlobal: 0,
        quantidadeAntes: exact ? exact.quantidade : 0,
        quantidadeDepois: exact ? exact.quantidade : 0
      });
    } else {
      itemsProcessed.push({
        ordem: index + 1,
        tamanho,
        cor,
        chave: `${tamanho} | ${cor}`,
        quantidadeSolicitada,
        quantidadeAtendida: 0,
        statusItem: 'SOLICITAR REPOSIÇÃO',
        alternativaSugerida: '',
        observacao: 'Sem saldo suficiente e sem alternativa disponível.',
        aceitaTamanhoAlternativo: item.aceitaTamanhoAlternativo ? 'SIM' : 'NÃO',
        aceitaOutraCor: item.aceitaOutraCor ? 'SIM' : 'NÃO',
        origemAbatimento: 'NAO_ABATIDO',
        quantidadeDaReserva: 0,
        quantidadeDoDisponivel: 0,
        excecaoReserva: 'NÃO',
        motivoExcecaoReserva: '',
        abateReservaGlobal: 0,
        quantidadeAntes: exact ? exact.quantidade : 0,
        quantidadeDepois: exact ? exact.quantidade : 0
      });
    }
  });

  stockRows.forEach(row => {
    stockSheet.getRange(row.rowIndex, idxQtd + 1).setValue(row.quantidade);
  });

  return {
    itemsProcessed,
    reserveGlobalUsedTotal
  };
}

function saveProofFile_(proofFile, requestId, nomeCompleto) {
  if (!proofFile) throw new Error('Comprovante não informado.');

  const fileName = String(proofFile.name || '').trim();
  const mimeType = String(proofFile.type || '').trim();
  const base64 = String(proofFile.base64 || '').trim();
  const size = Number(proofFile.size) || 0;

  if (!fileName || !base64) throw new Error('Arquivo de comprovante inválido.');
  if (size > MAX_FILE_SIZE_BYTES) throw new Error('O comprovante excede o limite de 10 MB.');

  const extension = getFileExtension_(fileName);
  if (!ALLOWED_EXTENSIONS.includes(extension)) {
    throw new Error('Arquivo inválido. Envie o comprovante em PDF, JPG, JPEG ou PNG.');
  }

  const folder = getOrCreateFolderByName_(PROOF_FOLDER_NAME);
  const cleanName = sanitizeFileName_(nomeCompleto || 'Solicitante');
  const finalName = `${requestId}_${cleanName}.${extension}`;

  const bytes = Utilities.base64Decode(base64);
  const blob = Utilities.newBlob(bytes, mimeType || getMimeTypeFromExtension_(extension), finalName);

  const file = folder.createFile(blob);

  return {
    id: file.getId(),
    name: finalName,
    url: file.getUrl()
  };
}

function appendMainRequestRow_(data) {
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  const sheet = ss.getSheetByName(RESPONSE_SHEET_NAME);
  const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
  const row = new Array(headers.length).fill('');

  setValueByHeader_(row, headers, 'Carimbo de data/hora', data.submittedAt);
  setValueByHeader_(row, headers, 'Endereço de e-mail', data.email);
  setValueByHeader_(row, headers, 'Nome Completo', data.nomeCompleto);
  setValueByHeader_(row, headers, 'Tamanho', `Pedido com ${data.quantidadeItens} item(ns)`);
  setValueByHeader_(row, headers, 'Equipe', data.equipe);
  setValueByHeader_(row, headers, 'Comprovante', data.comprovanteUrl);
  setValueByHeader_(row, headers, 'Status Estoque', data.statusGeral);
  setValueByHeader_(row, headers, 'Observação Estoque', data.observacaoGeral);

  setValueByHeader_(row, headers, 'ID Solicitação', data.requestId);
  setValueByHeader_(row, headers, 'Resumo Pedido', data.resumoPedido);
  setValueByHeader_(row, headers, 'Status Geral', data.statusGeral);
  setValueByHeader_(row, headers, 'Observação Geral', data.observacaoGeral);
  setValueByHeader_(row, headers, 'Nome Arquivo Comprovante', data.comprovanteNome);
  setValueByHeader_(row, headers, 'Link Comprovante', data.comprovanteUrl);
  setValueByHeader_(row, headers, 'Status Entrega', 'PENDENTE');
  setValueByHeader_(row, headers, 'Data/Hora Entrega', '');
  setValueByHeader_(row, headers, 'Cliente Específico Reserva', data.clienteEspecificoReserva ? 'SIM' : 'NÃO');
  setValueByHeader_(row, headers, 'Motivo Exceção Reserva', data.motivoExcecaoReserva || '');

  sheet.appendRow(row);
}

function appendItemRows_(requestId, submittedAt, payload, itemsProcessed, proofInfo) {
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  const sheet = ss.getSheetByName(ITEMS_SHEET_NAME);
  const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];

  itemsProcessed.forEach(item => {
    const row = new Array(headers.length).fill('');

    setValueByHeader_(row, headers, 'ID Solicitação', requestId);
    setValueByHeader_(row, headers, 'Data/Hora', submittedAt);
    setValueByHeader_(row, headers, 'Endereço de e-mail', payload.email);
    setValueByHeader_(row, headers, 'Nome Completo', payload.nomeCompleto);
    setValueByHeader_(row, headers, 'Equipe', payload.equipe);
    setValueByHeader_(row, headers, 'Ordem Item', item.ordem);
    setValueByHeader_(row, headers, 'Tamanho', item.tamanho);
    setValueByHeader_(row, headers, 'Cor', item.cor);
    setValueByHeader_(row, headers, 'Chave', item.chave);
    setValueByHeader_(row, headers, 'Quantidade Solicitada', item.quantidadeSolicitada);
    setValueByHeader_(row, headers, 'Quantidade Atendida', item.quantidadeAtendida);
    setValueByHeader_(row, headers, 'Status Item', item.statusItem);
    setValueByHeader_(row, headers, 'Alternativa Sugerida', item.alternativaSugerida);
    setValueByHeader_(row, headers, 'Aceita Tamanho Alternativo', item.aceitaTamanhoAlternativo);
    setValueByHeader_(row, headers, 'Aceita Outra Cor', item.aceitaOutraCor);
    setValueByHeader_(row, headers, 'Qtd Antes', item.quantidadeAntes);
    setValueByHeader_(row, headers, 'Qtd Depois', item.quantidadeDepois);
    setValueByHeader_(row, headers, 'Observação', item.observacao);
    setValueByHeader_(row, headers, 'Nome Arquivo Comprovante', proofInfo.name);
    setValueByHeader_(row, headers, 'Link Comprovante', proofInfo.url);
    setValueByHeader_(row, headers, 'Cliente Específico Reserva', payload.clienteEspecificoReserva ? 'SIM' : 'NÃO');
    setValueByHeader_(row, headers, 'Origem Abatimento', item.origemAbatimento || '');
    setValueByHeader_(row, headers, 'Quantidade da Reserva', item.quantidadeDaReserva || 0);
    setValueByHeader_(row, headers, 'Quantidade do Disponível', item.quantidadeDoDisponivel || 0);
    setValueByHeader_(row, headers, 'Exceção de Reserva', item.excecaoReserva || 'NÃO');
    setValueByHeader_(row, headers, 'Motivo Exceção Reserva', item.motivoExcecaoReserva || '');
    setValueByHeader_(row, headers, 'Abate Reserva Global', item.abateReservaGlobal || 0);

    sheet.appendRow(row);
  });
}

function updateGerencialSheet_() {
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  const stockSheet = ss.getSheetByName(STOCK_SHEET_NAME);
  const itemsSheet = ss.getSheetByName(ITEMS_SHEET_NAME);
  const gerencialSheet = ss.getSheetByName(GERENCIAL_SHEET_NAME);

  const stockData = stockSheet.getDataRange().getValues();
  const stockHeaders = stockData[0];

  const idxTamanho = stockHeaders.indexOf('Tamanho');
  const idxQtd = stockHeaders.indexOf('Quantidade');
  const idxCor = stockHeaders.indexOf('Cor');
  const idxReserva = stockHeaders.indexOf('Reserva Brinde');
  const idxDisponivel = stockHeaders.indexOf('Disponível');

  const itemsData = itemsSheet.getDataRange().getValues();
  const itemHeaders = itemsData[0];

  const idxItemChave = itemHeaders.indexOf('Chave');
  const idxItemQtdSolicitada = itemHeaders.indexOf('Quantidade Solicitada');
  const idxItemQtdAtendida = itemHeaders.indexOf('Quantidade Atendida');
  const idxItemStatus = itemHeaders.indexOf('Status Item');

  const itemStats = {};

  itemsData.slice(1).forEach(row => {
    const chave = String(row[idxItemChave] || '').trim();
    const qtdSolicitada = Number(row[idxItemQtdSolicitada]) || 0;
    const qtdAtendida = Number(row[idxItemQtdAtendida]) || 0;
    const status = String(row[idxItemStatus] || '').trim();

    if (!chave) return;

    if (!itemStats[chave]) {
      itemStats[chave] = {
        solicitacoes: 0,
        reservados: 0,
        alternativas: 0,
        reposicoes: 0
      };
    }

    itemStats[chave].solicitacoes += qtdSolicitada;
    if (status === 'RESERVADO') itemStats[chave].reservados += qtdAtendida;
    if (status === 'SUGERIR ALTERNATIVA') itemStats[chave].alternativas += qtdSolicitada;
    if (status === 'SOLICITAR REPOSIÇÃO') itemStats[chave].reposicoes += qtdSolicitada;
  });

  const output = [[
    'Tamanho',
    'Cor',
    'Chave',
    'Quantidade Atual',
    'Reserva Brinde',
    'Disponível',
    'Solicitações',
    'Reservados',
    'Sugestões Alternativa',
    'Reposição'
  ]];

  stockData.slice(1).forEach(row => {
    const tamanho = String(row[idxTamanho] || '').trim();
    const cor = String(row[idxCor] || '').trim();
    const chave = `${tamanho} | ${cor}`;
    const stats = itemStats[chave] || {
      solicitacoes: 0,
      reservados: 0,
      alternativas: 0,
      reposicoes: 0
    };

    output.push([
      tamanho,
      cor,
      chave,
      Number(row[idxQtd]) || 0,
      Number(row[idxReserva]) || 0,
      Number(row[idxDisponivel]) || 0,
      stats.solicitacoes,
      stats.reservados,
      stats.alternativas,
      stats.reposicoes
    ]);
  });

  gerencialSheet.clear();
  gerencialSheet.getRange(1, 1, output.length, output[0].length).setValues(output);
  gerencialSheet.getRange(1, 1, 1, output[0].length)
    .setFontWeight('bold')
    .setBackground('#0f4c81')
    .setFontColor('#ffffff');
  gerencialSheet.autoResizeColumns(1, output[0].length);
}

function sendOrderStatusEmail_(params) {
  const to = params.to;
  const nome = params.nomeCompleto || 'Solicitante';
  const equipe = params.equipe || '-';
  const requestId = params.requestId;
  const items = params.itemsProcessed || [];

  if (!to) return;

  const reservedItems = items.filter(i => i.statusItem === 'RESERVADO');
  const altItems = items.filter(i => i.statusItem === 'SUGERIR ALTERNATIVA');
  const repoItems = items.filter(i => i.statusItem === 'SOLICITAR REPOSIÇÃO');

  let statusTitle = 'Solicitação registrada';
  if (reservedItems.length === items.length) statusTitle = 'Solicitação registrada com sucesso';
  if (repoItems.length === items.length) statusTitle = 'Solicitação registrada com necessidade de reposição';
  if (altItems.length > 0 && reservedItems.length === 0) statusTitle = 'Solicitação registrada com sugestão de alternativa';

  const rowsHtml = items.map(item => `
    <tr>
      <td style="padding:10px; border:1px solid #d9e2ec;">${escapeHtml_(item.tamanho)} | ${escapeHtml_(item.cor)}</td>
      <td style="padding:10px; border:1px solid #d9e2ec; text-align:center;">${item.quantidadeSolicitada}</td>
      <td style="padding:10px; border:1px solid #d9e2ec;">${escapeHtml_(item.statusItem)}</td>
      <td style="padding:10px; border:1px solid #d9e2ec;">${escapeHtml_(item.alternativaSugerida || '-')}</td>
    </tr>
  `).join('');

  const htmlBody = `
    <div style="background:#f3f4f6; margin:0; padding:24px 12px; font-family:Arial, Helvetica, sans-serif;">
      <div style="max-width:680px; margin:0 auto; background:#ffffff; border:1px solid #d1d5db; border-radius:16px; overflow:hidden;">
        <div style="background:#0f4c81; padding:26px 20px; text-align:center;">
          <img src="${DASHBOARD_LOGO_URL}" alt="Logo EAC" style="max-width:90px; height:auto; display:block; margin:0 auto;" />
        </div>

        <div style="padding:36px 28px;">
          <h1 style="margin:0 0 18px 0; font-size:22px; color:#0f4c81;">
            Olá, ${escapeHtml_(nome)}!
          </h1>

          <p style="margin:0 0 14px 0; font-size:16px; line-height:1.7; color:#1f2937;">
            Sua solicitação foi registrada com o identificador <strong>${escapeHtml_(requestId)}</strong>.
          </p>

          <p style="margin:0 0 18px 0; font-size:16px; line-height:1.7; color:#1f2937;">
            <strong>Equipe:</strong> ${escapeHtml_(equipe)}<br>
            <strong>Status geral:</strong> ${escapeHtml_(statusTitle)}
          </p>

          <table style="width:100%; border-collapse:collapse; margin-top:18px; margin-bottom:22px;">
            <thead>
              <tr style="background:#eaf2fb;">
                <th style="padding:10px; border:1px solid #d9e2ec; text-align:left;">Item</th>
                <th style="padding:10px; border:1px solid #d9e2ec; text-align:center;">Qtd</th>
                <th style="padding:10px; border:1px solid #d9e2ec; text-align:left;">Status</th>
                <th style="padding:10px; border:1px solid #d9e2ec; text-align:left;">Alternativa</th>
              </tr>
            </thead>
            <tbody>
              ${rowsHtml}
            </tbody>
          </table>

          <p style="margin:0 0 16px 0; font-size:15px; line-height:1.7; color:#1f2937;">
            Fique atento ao seu e-mail e WhatsApp caso a coordenação precise entrar em contato.
          </p>

          <p style="margin:24px 0 0 0; font-size:15px; line-height:1.7; color:#1f2937;">
            Fraternalmente,<br>
            <strong>Coordenação EAC</strong>
          </p>

          <div style="text-align:center; margin:30px 0 0 0;">
            <a href="${INSTAGRAM_URL}" target="_blank"
              style="display:inline-block; background:#0f4c81; color:#ffffff; text-decoration:none; font-weight:bold; padding:14px 22px; border-radius:10px; font-size:15px;">
              SIGA NOSSO INSTAGRAM
            </a>
          </div>
        </div>
      </div>
    </div>
  `;

  GmailApp.sendEmail(to, `EAC - ${statusTitle}`, 'Seu e-mail não suporta HTML.', {
    name: 'EAC Porciúncula de Santana',
    htmlBody: htmlBody
  });
}

function buildMainStatus_(itemsProcessed) {
  const allReserved = itemsProcessed.every(i => i.statusItem === 'RESERVADO');
  const hasAlternative = itemsProcessed.some(i => i.statusItem === 'SUGERIR ALTERNATIVA');
  const hasReposicao = itemsProcessed.some(i => i.statusItem === 'SOLICITAR REPOSIÇÃO');

  if (allReserved) {
    return {
      statusGeral: 'RESERVADO',
      observacaoGeral: 'Todos os itens foram reservados com sucesso.'
    };
  }

  if (hasAlternative && !hasReposicao) {
    return {
      statusGeral: 'SUGERIR ALTERNATIVA',
      observacaoGeral: 'Há itens sem saldo suficiente com alternativa sugerida.'
    };
  }

  if (hasReposicao && !hasAlternative) {
    return {
      statusGeral: 'SOLICITAR REPOSIÇÃO',
      observacaoGeral: 'Há itens sem saldo suficiente e sem alternativa disponível.'
    };
  }

  return {
    statusGeral: 'PROCESSAMENTO PARCIAL',
    observacaoGeral: 'A solicitação contém itens reservados, alternativas e ou necessidade de reposição.'
  };
}

function buildOrderSummary_(itemsProcessed) {
  return itemsProcessed.map(item =>
    `${item.quantidadeSolicitada}x ${item.tamanho} | ${item.cor} [${item.statusItem}]`
  ).join(' ; ');
}

function findStockMutableRow_(stockRows, tamanho, cor) {
  return stockRows.find(row =>
    normalizeText_(row.tamanho) === normalizeText_(tamanho) &&
    normalizeText_(row.cor) === normalizeText_(cor)
  ) || null;
}

function findAlternativeSizeMutable_(stockRows, tamanhoEscolhido, corEscolhida, quantidadeSolicitada) {
  const currentIndex = SIZE_ORDER.indexOf(tamanhoEscolhido);
  if (currentIndex === -1) return null;

  for (let distance = 1; distance < SIZE_ORDER.length; distance++) {
    const candidates = [];
    const lower = currentIndex - distance;
    const upper = currentIndex + distance;

    if (lower >= 0) candidates.push(SIZE_ORDER[lower]);
    if (upper < SIZE_ORDER.length) candidates.push(SIZE_ORDER[upper]);

    for (const candidateSize of candidates) {
      const match = stockRows.find(row => {
        const disponivel = Math.max(row.quantidade - row.reserva, 0);
        return normalizeText_(row.tamanho) === normalizeText_(candidateSize) &&
               normalizeText_(row.cor) === normalizeText_(corEscolhida) &&
               disponivel >= quantidadeSolicitada;
      });

      if (match) return match;
    }
  }

  return null;
}

function findAlternativeColorMutable_(stockRows, tamanhoEscolhido, corEscolhida, quantidadeSolicitada) {
  return stockRows.find(row => {
    const disponivel = Math.max(row.quantidade - row.reserva, 0);
    return normalizeText_(row.tamanho) === normalizeText_(tamanhoEscolhido) &&
           normalizeText_(row.cor) !== normalizeText_(corEscolhida) &&
           disponivel >= quantidadeSolicitada;
  }) || null;
}

function validatePayload_(payload) {
  if (!payload) throw new Error('Payload não informado.');

  const nome = String(payload.nomeCompleto || '').trim();
  const email = String(payload.email || '').trim();
  const equipe = String(payload.equipe || '').trim();
  const items = Array.isArray(payload.items) ? payload.items : [];
  const proofFile = payload.proofFile;

  if (!nome) throw new Error('Informe o nome completo.');
  if (!email) throw new Error('Informe o e-mail.');
  if (!equipe) throw new Error('Informe a equipe.');
  if (!items.length) throw new Error('Adicione pelo menos um item ao pedido.');
  if (!proofFile) throw new Error('O comprovante é obrigatório.');

  items.forEach((item, index) => {
    const tamanho = String(item.tamanho || '').trim();
    const cor = String(item.cor || '').trim();
    const quantidade = Number(item.quantidade) || 0;

    if (!tamanho) throw new Error(`Informe o tamanho do item ${index + 1}.`);
    if (!cor) throw new Error(`Informe a cor do item ${index + 1}.`);
    if (quantidade <= 0) throw new Error(`Informe uma quantidade válida para o item ${index + 1}.`);
  });

  const fileName = String(proofFile.name || '').trim();
  const extension = getFileExtension_(fileName);
  const size = Number(proofFile.size) || 0;

  if (!ALLOWED_EXTENSIONS.includes(extension)) {
    throw new Error('Arquivo inválido. Envie o comprovante em PDF, JPG, JPEG ou PNG.');
  }

  if (size > MAX_FILE_SIZE_BYTES) {
    throw new Error('O comprovante excede o limite de 10 MB.');
  }
}

function ensureMainResponseSheet_() {
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  let sheet = ss.getSheetByName(RESPONSE_SHEET_NAME);

  if (!sheet) {
    sheet = ss.insertSheet(RESPONSE_SHEET_NAME);
    sheet.appendRow([
      'Carimbo de data/hora',
      'Endereço de e-mail',
      'Nome Completo',
      'Tamanho',
      'Equipe',
      'Comprovante',
      'Aceita tamanho alternativo ?',
      'Caso não haja estoque, aceita outra cor?',
      'Status Estoque',
      'Alternativa Sugerida',
      'Ação Estoque',
      'Qtd Antes',
      'Qtd Depois',
      'Observação Estoque'
    ]);
  }

  const requiredHeaders = [
    'ID Solicitação',
    'Resumo Pedido',
    'Status Geral',
    'Observação Geral',
    'Nome Arquivo Comprovante',
    'Link Comprovante',
    'Status Entrega',
    'Data/Hora Entrega',
    'Cliente Específico Reserva',
    'Motivo Exceção Reserva'
  ];

  ensureHeaders_(sheet, requiredHeaders);
}

function ensureItemsSheet_() {
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  let sheet = ss.getSheetByName(ITEMS_SHEET_NAME);

  if (!sheet) {
    sheet = ss.insertSheet(ITEMS_SHEET_NAME);
    sheet.appendRow([
      'ID Solicitação',
      'Data/Hora',
      'Endereço de e-mail',
      'Nome Completo',
      'Equipe',
      'Ordem Item',
      'Tamanho',
      'Cor',
      'Chave',
      'Quantidade Solicitada',
      'Quantidade Atendida',
      'Status Item',
      'Alternativa Sugerida',
      'Aceita Tamanho Alternativo',
      'Aceita Outra Cor',
      'Qtd Antes',
      'Qtd Depois',
      'Observação',
      'Nome Arquivo Comprovante',
      'Link Comprovante',
      'Cliente Específico Reserva',
      'Origem Abatimento',
      'Quantidade da Reserva',
      'Quantidade do Disponível',
      'Exceção de Reserva',
      'Motivo Exceção Reserva',
      'Abate Reserva Global'
    ]);
  }

  ensureHeaders_(sheet, [
    'Cliente Específico Reserva',
    'Origem Abatimento',
    'Quantidade da Reserva',
    'Quantidade do Disponível',
    'Exceção de Reserva',
    'Motivo Exceção Reserva',
    'Abate Reserva Global'
  ]);
}

function ensureGerencialSheet_() {
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  let sheet = ss.getSheetByName(GERENCIAL_SHEET_NAME);
  if (!sheet) {
    sheet = ss.insertSheet(GERENCIAL_SHEET_NAME);
  }
}

function ensureHeaders_(sheet, requiredHeaders) {
  const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
  let appendAt = headers.length;

  requiredHeaders.forEach(header => {
    if (!headers.includes(header)) {
      appendAt += 1;
      sheet.getRange(1, appendAt).setValue(header);
    }
  });
}

function setValueByHeader_(rowArray, headers, headerName, value) {
  const idx = headers.indexOf(headerName);
  if (idx >= 0) rowArray[idx] = value;
}

function findHeaderIndex_(headers, candidates) {
  if (!headers || !headers.length) return -1;
  const normalizedCandidates = (candidates || []).map(item => normalizeText_(item));
  for (let i = 0; i < headers.length; i++) {
    if (normalizedCandidates.includes(normalizeText_(headers[i]))) return i;
  }
  return -1;
}

function parseDateTimeSafe_(value) {
  if (!value) return new Date(0);
  if (Object.prototype.toString.call(value) === '[object Date]' && !isNaN(value.getTime())) return value;

  const parsed = new Date(value);
  if (!isNaN(parsed.getTime())) return parsed;
  return new Date(0);
}

function formatDateTimeSafe_(value) {
  const dt = parseDateTimeSafe_(value);
  if (dt.getTime() === 0) return '';
  return Utilities.formatDate(dt, Session.getScriptTimeZone(), 'dd/MM/yyyy HH:mm:ss');
}

function getOrCreateFolderByName_(folderName) {
  const folders = DriveApp.getFoldersByName(folderName);
  if (folders.hasNext()) return folders.next();
  return DriveApp.createFolder(folderName);
}

function getFileExtension_(fileName) {
  const parts = String(fileName || '').toLowerCase().split('.');
  return parts.length > 1 ? parts.pop() : '';
}

function sanitizeFileName_(name) {
  return String(name || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9_-]/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_+|_+$/g, '');
}

function getMimeTypeFromExtension_(extension) {
  const map = {
    pdf: MimeType.PDF,
    jpg: MimeType.JPEG,
    jpeg: MimeType.JPEG,
    png: MimeType.PNG
  };
  return map[extension] || MimeType.PLAIN_TEXT;
}

function generateRequestId_() {
  const now = new Date();
  return 'SOL-' + Utilities.formatDate(now, Session.getScriptTimeZone(), 'yyyyMMdd-HHmmss');
}

function normalizeText_(value) {
  return String(value || '')
    .trim()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toUpperCase();
}

function getReserveGlobalStatus_() {
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  const itemsSheet = ss.getSheetByName(ITEMS_SHEET_NAME);
  if (!itemsSheet) {
    return {
      initial: RESERVE_GLOBAL_INITIAL,
      consumed: 0,
      remaining: RESERVE_GLOBAL_INITIAL
    };
  }

  const data = itemsSheet.getDataRange().getValues();
  const headers = data[0] || [];
  const idxAbateReservaGlobal = findHeaderIndex_(headers, ['Abate Reserva Global']);

  if (idxAbateReservaGlobal < 0) {
    return {
      initial: RESERVE_GLOBAL_INITIAL,
      consumed: 0,
      remaining: RESERVE_GLOBAL_INITIAL
    };
  }

  const consumed = data.slice(1).reduce((sum, row) => {
    const value = Number(row[idxAbateReservaGlobal]) || 0;
    return sum + Math.max(value, 0);
  }, 0);

  return {
    initial: RESERVE_GLOBAL_INITIAL,
    consumed,
    remaining: Math.max(RESERVE_GLOBAL_INITIAL - consumed, 0)
  };
}

function escapeHtml_(text) {
  return String(text || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}
