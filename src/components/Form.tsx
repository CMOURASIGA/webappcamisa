import React, { useEffect, useRef, useState } from 'react';
import { CheckCircle2, ChevronLeft, ChevronRight, CircleHelp, Shirt, X } from 'lucide-react';
import { TEAMS, COLORS, SIZES, MOCK_STOCK, ShirtItem } from '../data/mockData';
import { fetchBootstrapData, isMockApiEnabled, submitOrder } from '../services/api';
import type { StockOptionRow } from '../types/api';

export default function Form() {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [team, setTeam] = useState('');
  const [otherTeam, setOtherTeam] = useState('');

  const [proofFile, setProofFile] = useState<File | null>(null);
  const [stockRows, setStockRows] = useState<StockOptionRow[]>([]);
  const [availableColors, setAvailableColors] = useState<string[]>(COLORS);
  const [allowedExtensions, setAllowedExtensions] = useState(['pdf', 'jpg', 'jpeg', 'png']);

  const [items, setItems] = useState<ShirtItem[]>([
    {
      id: 'item-1',
      color: '',
      size: '',
      quantity: 1,
      acceptAlternativeSize: false,
      acceptAlternativeColor: false,
    },
  ]);

  const [message, setMessage] = useState<{ type: 'error' | 'success' | 'info'; text: string } | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isLoadingStock, setIsLoadingStock] = useState(true);
  const [isHelpOpen, setIsHelpOpen] = useState(false);
  const [helpStep, setHelpStep] = useState(0);
  const [successModal, setSuccessModal] = useState<{ open: boolean; requestId: string; status: string }>({
    open: false,
    requestId: '',
    status: '',
  });

  const fileInputRef = useRef<HTMLInputElement>(null);

  const PRICE = 40;
  const PIX_KEY = '21980342025';
  const LOGO_URL = 'https://i.imgur.com/c5XQ7TW.jpg';
  const SHIRT_LINKS: Record<string, string> = {
    Preta: 'https://imgur.com/HaLhOb2',
  };
  const HELP_STEPS = [
    {
      title: '1. Pagamento e comprovante',
      text: 'Faca o pagamento no PIX, depois anexe o comprovante em PDF, JPG, JPEG ou PNG (maximo 10MB).',
    },
    {
      title: '2. Seus dados',
      text: 'Preencha nome, e-mail e equipe. Se escolher Outro, informe o nome da equipe no campo extra.',
    },
    {
      title: '3. Itens da solicitacao',
      text: 'Adicione os itens, escolha cor/tamanho, ajuste a quantidade e marque se aceita alternativas antes de enviar.',
    },
  ];

  useEffect(() => {
    let isMounted = true;

    async function loadBootstrap() {
      try {
        if (isMockApiEnabled()) {
          if (!isMounted) return;
          setStockRows(
            MOCK_STOCK.map((row) => ({
              tamanho: row.tamanho,
              cor: row.cor,
              quantidade: row.quantidade,
              reserva: row.reserva,
              disponivel: row.disponivel,
            })),
          );
          setAvailableColors(COLORS);
          setIsLoadingStock(false);
          return;
        }

        const data = await fetchBootstrapData();
        if (!isMounted) return;

        setStockRows(data.stockOptions.rows || []);
        setAvailableColors(data.stockOptions.colors?.length ? data.stockOptions.colors : COLORS);
        setAllowedExtensions(data.allowedExtensions?.length ? data.allowedExtensions : ['pdf', 'jpg', 'jpeg', 'png']);
        setIsLoadingStock(false);
      } catch (error) {
        if (!isMounted) return;

        setStockRows(
          MOCK_STOCK.map((row) => ({
            tamanho: row.tamanho,
            cor: row.cor,
            quantidade: row.quantidade,
            reserva: row.reserva,
            disponivel: row.disponivel,
          })),
        );
        setAvailableColors(COLORS);
        setMessage({
          type: 'error',
          text:
            error instanceof Error
              ? `${error.message} Usando dados mock para validacao local.`
              : 'Falha ao carregar estoque. Usando dados mock.',
        });
        setIsLoadingStock(false);
      }
    }

    loadBootstrap();
    return () => {
      isMounted = false;
    };
  }, []);

  const copyPix = async () => {
    try {
      await navigator.clipboard.writeText(PIX_KEY);
      setMessage({ type: 'success', text: 'Chave PIX copiada.' });
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch {
      setMessage({ type: 'error', text: `Nao foi possivel copiar. Chave: ${PIX_KEY}` });
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setProofFile(e.target.files[0]);
    } else {
      setProofFile(null);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      const file = e.dataTransfer.files[0];
      const ext = file.name.split('.').pop()?.toLowerCase();
      if (allowedExtensions.includes(ext || '')) {
        setProofFile(file);
      } else {
        setMessage({ type: 'error', text: `Arquivo invalido. Use: ${allowedExtensions.join(', ').toUpperCase()}` });
      }
    }
  };

  const addItem = () => {
    const newId = `item-${Date.now()}`;
    setItems([
      ...items,
      {
        id: newId,
        color: '',
        size: '',
        quantity: 1,
        acceptAlternativeSize: false,
        acceptAlternativeColor: false,
      },
    ]);
  };

  const removeItem = (id: string) => {
    setItems(items.filter((i) => i.id !== id));
  };

  const updateItem = (id: string, updates: Partial<ShirtItem>) => {
    setItems(items.map((i) => (i.id === id ? { ...i, ...updates } : i)));
  };

  const isSizeAvailable = (color: string, size: string) => {
    if (!color || !size) return false;
    return stockRows.some(
      (row) => row.cor === color && row.tamanho === size && Number(row.disponivel) > 0,
    );
  };

  const totalQuantity = items.reduce((acc, curr) => acc + curr.quantity, 0);
  const totalPrice = totalQuantity * PRICE;

  const fileToBase64 = (file: File) =>
    new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        const result = typeof reader.result === 'string' ? reader.result : '';
        const [, base64] = result.split(',');
        if (!base64) {
          reject(new Error('Nao foi possivel ler o comprovante.'));
          return;
        }
        resolve(base64);
      };
      reader.onerror = () => reject(new Error('Falha ao processar o comprovante.'));
      reader.readAsDataURL(file);
    });

  const handleSubmit = async (e: React.FormEvent | React.MouseEvent) => {
    e.preventDefault();

    if (!name.trim()) return setMessage({ type: 'error', text: 'Informe o nome completo.' });
    if (!email.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return setMessage({ type: 'error', text: 'Informe um e-mail valido.' });
    }
    if (!team) return setMessage({ type: 'error', text: 'Informe a equipe.' });
    if (team === 'Outro' && !otherTeam.trim()) {
      return setMessage({ type: 'error', text: 'Informe qual e a equipe.' });
    }

    if (items.length === 0) return setMessage({ type: 'error', text: 'Adicione pelo menos uma camisa.' });

    for (let i = 0; i < items.length; i++) {
      if (!items[i].color) return setMessage({ type: 'error', text: `Selecione a cor do item ${i + 1}.` });
      if (!items[i].size) return setMessage({ type: 'error', text: `Selecione o tamanho do item ${i + 1}.` });
      if (items[i].quantity <= 0) {
        return setMessage({ type: 'error', text: `Quantidade invalida no item ${i + 1}.` });
      }
    }

    if (!proofFile) return setMessage({ type: 'error', text: 'O comprovante de pagamento e obrigatorio.' });
    const ext = proofFile.name.split('.').pop()?.toLowerCase() || '';
    if (!allowedExtensions.includes(ext)) {
      return setMessage({ type: 'error', text: `Arquivo invalido. Use: ${allowedExtensions.join(', ').toUpperCase()}` });
    }
    if (proofFile.size > 10 * 1024 * 1024) {
      return setMessage({ type: 'error', text: 'O comprovante excede 10 MB.' });
    }

    setIsSubmitting(true);
    setMessage({ type: 'info', text: 'Enviando solicitacao, aguarde...' });

    try {
      const proofBase64 = await fileToBase64(proofFile);
      const payload = {
        nomeCompleto: name.trim(),
        email: email.trim(),
        equipe: team === 'Outro' ? otherTeam.trim() : team,
        items: items.map((item) => ({
          tamanho: item.size,
          cor: item.color,
          quantidade: item.quantity,
          aceitaTamanhoAlternativo: item.acceptAlternativeSize,
          aceitaOutraCor: item.acceptAlternativeColor,
        })),
        proofFile: {
          name: proofFile.name,
          type: proofFile.type,
          size: proofFile.size,
          base64: proofBase64,
        },
      };

      const response = await submitOrder(payload);
      setMessage({
        type: 'success',
        text: `Solicitacao enviada com sucesso! ID: ${response.requestId} | Status: ${response.statusGeral}`,
      });
      window.scrollTo({ top: 0, behavior: 'smooth' });
      setSuccessModal({
        open: true,
        requestId: response.requestId,
        status: response.statusGeral,
      });

      setName('');
      setEmail('');
      setTeam('');
      setOtherTeam('');
      setProofFile(null);
      setItems([
        {
          id: `item-${Date.now() + 1}`,
          color: '',
          size: '',
          quantity: 1,
          acceptAlternativeSize: false,
          acceptAlternativeColor: false,
        },
      ]);
      if (fileInputRef.current) fileInputRef.current.value = '';
    } catch (error) {
      setMessage({
        type: 'error',
        text: error instanceof Error ? error.message : 'Falha ao enviar solicitacao.',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="md:flex md:justify-center md:items-start md:p-6 min-h-screen overflow-hidden bg-background">
      <div className="w-full max-w-[420px] bg-white md:rounded-[32px] md:shadow-[0_4px_20px_rgba(0,0,0,0.05)] md:border-[8px] md:border-[#1A1C1E] relative overflow-hidden pb-[140px] md:pb-[130px] md:my-0 mx-auto flex flex-col md:h-[calc(100vh-48px)]">
        <div className="bg-primary text-white p-4 shrink-0">
          <div className="flex items-center gap-3">
            <img
              src={LOGO_URL}
              alt="Logo EAC"
              className="w-14 h-14 rounded-full object-cover border-2 border-white/40 shrink-0"
            />

            <div className="flex-1 min-w-0">
              <span className="inline-block bg-white/20 px-3 py-1 rounded-[4px] text-[10px] uppercase font-bold tracking-wider">
                EAC - Equipes
              </span>
              <h1 className="mt-2 mb-1 text-[18px] font-bold leading-tight">Solicitacao de Camisas</h1>
              <p className="m-0 opacity-90 text-[12px]">Pague no PIX, anexe o comprovante e conclua.</p>
            </div>

            <div className="w-11 h-11 rounded-full bg-white/15 border border-white/25 flex items-center justify-center shrink-0">
              <Shirt size={20} className="text-white" />
            </div>
          </div>
        </div>

        <div className="bg-gradient-to-br from-[#0F4C81] to-[#0B3B64] text-white mx-4 mt-4 p-5 rounded-[16px] relative z-10 box-border">
          <div className="flex justify-between items-start gap-2">
            <div className="w-full">
              <div className="text-[12px] opacity-80 uppercase tracking-wide">Chave PIX</div>
              <div className="font-bold text-[24px] m-0 my-1 pb-1">R$ {PRICE.toFixed(2).replace('.', ',')}</div>
              <div className="flex justify-between items-center w-full mt-2">
                <span className="font-mono bg-white/20 px-2.5 py-1 rounded-[4px] text-[14px]">{PIX_KEY}</span>
                <button
                  type="button"
                  onClick={copyPix}
                  className="bg-transparent text-white border-0 underline text-[12px] p-0 cursor-pointer opacity-90 hover:opacity-100"
                >
                  Copiar
                </button>
              </div>
            </div>
          </div>
        </div>

        <div className="mx-4 mt-3">
          <button
            type="button"
            onClick={() => {
              setHelpStep(0);
              setIsHelpOpen(true);
            }}
            className="w-full bg-white border border-[#0F4C81]/20 text-[#0F4C81] rounded-[12px] p-3 font-bold text-[13px] flex items-center justify-center gap-2 hover:bg-[#F4F8FC] transition-colors"
          >
            <CircleHelp size={16} />
            Como preencher a solicitacao
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 flex-1 bg-[#F8F9FA] overflow-y-auto custom-scrollbar">
          {message && (
            <div
              className={`rounded-xl p-3 mb-4 font-bold text-[13px] ${
                message.type === 'error'
                  ? 'bg-[#fff1f1] text-[#9b1c1c] border border-[#fecaca]'
                  : message.type === 'success'
                    ? 'bg-[#e4f5ed] text-[#065f46] border border-[#bbf7d0]'
                    : 'bg-[#ebf0fb] text-primary border border-[#bfdbfe]'
              }`}
            >
              {message.text}
            </div>
          )}

          {isLoadingStock && (
            <div className="rounded-xl p-3 mb-4 font-bold text-[13px] bg-[#ebf0fb] text-primary border border-[#bfdbfe]">
              Carregando opcoes de estoque...
            </div>
          )}

          <section className="bg-white p-4 rounded-[12px] border border-border-color mb-4">
            <h2 className="text-[15px] font-bold text-text-main m-0 mb-4">Seus dados</h2>

            <div className="flex flex-col gap-2 mb-4">
              <label className="text-[12px] font-bold text-text-main uppercase">Nome completo</label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Seu nome completo"
                className="w-full p-2.5 rounded-[8px] border border-border-color bg-white text-[14px] focus:outline-none focus:border-primary"
              />
            </div>

            <div className="flex flex-col gap-2 mb-4">
              <label className="text-[12px] font-bold text-text-main uppercase">E-mail</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="email@exemplo.com"
                className="w-full p-2.5 rounded-[8px] border border-border-color bg-white text-[14px] focus:outline-none focus:border-primary"
              />
            </div>

            <div className="flex flex-col gap-2 mb-4">
              <label className="text-[12px] font-bold text-text-main uppercase">Equipe</label>
              <select
                value={team}
                onChange={(e) => setTeam(e.target.value)}
                className="w-full p-2.5 rounded-[8px] border border-border-color bg-white text-[14px] focus:outline-none focus:border-primary appearance-none"
              >
                <option value="">Selecione sua equipe</option>
                {TEAMS.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>
            </div>

            {team === 'Outro' && (
              <div className="flex flex-col gap-2 mb-4 animate-in fade-in slide-in-from-top-2 duration-300">
                <label className="text-[12px] font-bold text-text-main uppercase">Qual equipe?</label>
                <input
                  type="text"
                  value={otherTeam}
                  onChange={(e) => setOtherTeam(e.target.value)}
                  placeholder="Digite o nome da equipe"
                  className="w-full p-2.5 rounded-[8px] border border-border-color bg-white text-[14px] focus:outline-none focus:border-primary"
                />
              </div>
            )}
          </section>

          <section className="bg-white p-4 rounded-[12px] border border-border-color mb-4">
            <h2 className="text-[15px] font-bold text-text-main m-0 mb-4">Comprovante de pagamento</h2>
            <div
              onClick={() => fileInputRef.current?.click()}
              onDragOver={handleDragOver}
              onDrop={handleDrop}
              className={`border-2 border-dashed rounded-[12px] p-5 text-center cursor-pointer transition-colors ${
                proofFile ? 'border-success bg-[#e4f5ed]' : 'border-border-color bg-[#FAFAFA] hover:bg-gray-100'
              }`}
            >
              <strong className={`block text-[13px] ${proofFile ? 'text-success' : 'text-text-main'}`}>
                {proofFile ? 'Comprovante anexado' : 'Anexar Comprovante'}
              </strong>
              <span className="block mt-1 text-[11px] text-text-muted">
                {proofFile ? proofFile.name : 'Toque para selecionar arquivo (Max 10MB)'}
              </span>
            </div>
            <input
              type="file"
              ref={fileInputRef}
              onChange={handleFileChange}
              accept={allowedExtensions.map((item) => `.${item}`).join(',')}
              className="hidden"
            />
          </section>

          <section className="bg-white p-4 rounded-[12px] border border-border-color mb-4">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-[15px] font-bold text-text-main m-0">Itens do pedido</h2>
            </div>

            <div className="flex flex-col gap-4 mb-4">
              {items.map((item, index) => (
                <div key={item.id} className="relative mb-2">
                  <div className="flex justify-between items-center mb-3 pb-2 border-b border-border-color">
                    <span className="font-bold text-[14px] text-text-main">Item #{String(index + 1).padStart(2, '0')}</span>
                    {items.length > 1 && (
                      <button
                        type="button"
                        onClick={() => removeItem(item.id)}
                        className="text-accent bg-transparent border-0 text-[12px] font-semibold cursor-pointer p-0"
                      >
                        Remover
                      </button>
                    )}
                  </div>

                  <div>
                    <div className="flex flex-col gap-1.5 mb-4">
                      <div className="flex items-center justify-between gap-2">
                        <label className="text-[11px] text-text-muted font-semibold uppercase">Cor da camisa</label>
                        {item.color === 'Preta' && SHIRT_LINKS.Preta && (
                          <a
                            href={SHIRT_LINKS.Preta}
                            target="_blank"
                            rel="noreferrer"
                            className="text-[11px] font-bold text-primary no-underline border border-primary/20 rounded-[999px] px-2 py-1 hover:bg-primary-light transition-colors"
                          >
                            Ver camisa
                          </a>
                        )}
                      </div>
                      <div className="flex flex-wrap gap-2 mt-1">
                        {availableColors.map((c) => (
                          <button
                            key={c}
                            type="button"
                            onClick={() => updateItem(item.id, { color: c, size: '' })}
                            className={`px-3 py-1.5 border rounded-[20px] text-[12px] font-semibold cursor-pointer transition-colors ${
                              item.color === c
                                ? 'bg-primary border-primary text-white'
                                : 'bg-white border-border-color text-text-main hover:bg-gray-50'
                            }`}
                          >
                            {c}
                          </button>
                        ))}
                      </div>
                    </div>

                    <div className="flex flex-col gap-1.5 mb-4 mt-3">
                      <label className="text-[11px] text-text-muted font-semibold uppercase">Tamanho</label>
                      <div className="flex flex-wrap gap-2 mt-1">
                        {SIZES.map((s) => {
                          const isAvail = isSizeAvailable(item.color, s);
                          return (
                            <button
                              key={s}
                              type="button"
                              onClick={() => {
                                if (isAvail) updateItem(item.id, { size: s });
                              }}
                              className={`px-3 py-1.5 border rounded-[20px] text-[12px] font-semibold transition-colors ${
                                item.size === s
                                  ? 'bg-primary border-primary text-white cursor-pointer'
                                  : isAvail
                                    ? 'bg-white border-border-color text-text-main cursor-pointer hover:bg-gray-50'
                                    : 'opacity-30 line-through cursor-not-allowed border-border-color text-text-main bg-white'
                              }`}
                            >
                              {s}
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    <div className="flex items-center gap-4 mt-6 mb-4">
                      <button
                        type="button"
                        onClick={() => updateItem(item.id, { quantity: Math.max(1, item.quantity - 1) })}
                        className="w-8 h-8 rounded-full border border-border-color bg-white flex items-center justify-center font-bold text-text-main cursor-pointer hover:bg-gray-50"
                      >
                        -
                      </button>
                      <div className="font-bold text-[14px]">{String(item.quantity).padStart(2, '0')}</div>
                      <button
                        type="button"
                        onClick={() => updateItem(item.id, { quantity: item.quantity + 1 })}
                        className="w-8 h-8 rounded-full border border-border-color bg-white flex items-center justify-center font-bold text-text-main cursor-pointer hover:bg-gray-50"
                      >
                        +
                      </button>
                    </div>

                    <div
                      onClick={() => updateItem(item.id, { acceptAlternativeSize: !item.acceptAlternativeSize })}
                      className="flex justify-between items-center p-3 rounded-[8px] border border-border-color border-dashed mb-2 flex-wrap cursor-pointer hover:bg-gray-50 transition-colors"
                    >
                      <span className="text-[12px] font-medium text-text-main">Aceita tamanho alternativo?</span>
                      <div className={`w-8 h-5 rounded-full relative transition-colors ${item.acceptAlternativeSize ? 'bg-primary' : 'bg-[#E0E4E9]'}`}>
                        <div className={`absolute top-[2px] w-4 h-4 bg-white rounded-full transition-all ${item.acceptAlternativeSize ? 'left-[14px]' : 'left-[2px]'}`} />
                      </div>
                    </div>

                    <div
                      onClick={() => updateItem(item.id, { acceptAlternativeColor: !item.acceptAlternativeColor })}
                      className="flex justify-between items-center p-3 rounded-[8px] border border-border-color border-dashed flex-wrap cursor-pointer hover:bg-gray-50 transition-colors"
                    >
                      <span className="text-[12px] font-medium text-text-main">Aceita outra cor?</span>
                      <div className={`w-8 h-5 rounded-full relative transition-colors ${item.acceptAlternativeColor ? 'bg-primary' : 'bg-[#E0E4E9]'}`}>
                        <div className={`absolute top-[2px] w-4 h-4 bg-white rounded-full transition-all ${item.acceptAlternativeColor ? 'left-[14px]' : 'left-[2px]'}`} />
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            <button
              type="button"
              onClick={addItem}
              className="w-full py-3 border border-border-color rounded-[8px] bg-white text-text-main font-bold text-[13px] cursor-pointer hover:bg-gray-50"
            >
              + Adicionar Item
            </button>
          </section>
        </form>

        <div className="p-5 bg-white border-t border-border-color flex flex-col gap-3 mt-auto sticky md:absolute bottom-0 left-0 right-0 z-50">
          <div className="flex justify-between items-center font-semibold text-[14px]">
            <span>Total ({totalQuantity} camisa{totalQuantity !== 1 ? 's' : ''})</span>
            <span>{new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(totalPrice)}</span>
          </div>

          <button
            type="button"
            onClick={handleSubmit}
            disabled={isSubmitting || isLoadingStock}
            className="w-full bg-primary text-white border-none p-4 rounded-[12px] font-bold text-[16px] cursor-pointer disabled:opacity-70 disabled:cursor-wait hover:bg-primary-dark transition-colors"
          >
            {isSubmitting ? 'Enviando...' : 'Enviar Solicitacao'}
          </button>
        </div>
      </div>

      {isHelpOpen && (
        <div className="fixed inset-0 z-[100] bg-black/45 flex items-center justify-center p-4">
          <div className="w-full max-w-[360px] bg-white rounded-[16px] shadow-xl border border-border-color overflow-hidden">
            <div className="bg-primary text-white px-4 py-3 flex items-center justify-between">
              <strong className="text-[14px]">Ajuda de preenchimento</strong>
              <button
                type="button"
                onClick={() => setIsHelpOpen(false)}
                className="bg-white/15 hover:bg-white/25 rounded-full p-1"
              >
                <X size={16} />
              </button>
            </div>

            <div className="p-4">
              <div className="text-[12px] text-text-muted mb-2">
                Etapa {helpStep + 1} de {HELP_STEPS.length}
              </div>
              <h3 className="m-0 text-[16px] text-text-main font-bold">{HELP_STEPS[helpStep].title}</h3>
              <p className="mt-2 mb-4 text-[13px] text-text-muted leading-relaxed">{HELP_STEPS[helpStep].text}</p>

              <div className="flex items-center justify-center gap-2 mb-4">
                {HELP_STEPS.map((_, idx) => (
                  <span
                    key={idx}
                    className={`w-2 h-2 rounded-full ${idx === helpStep ? 'bg-primary' : 'bg-border-color'}`}
                  />
                ))}
              </div>

              <div className="flex items-center justify-between gap-2">
                <button
                  type="button"
                  onClick={() => setHelpStep((prev) => Math.max(0, prev - 1))}
                  disabled={helpStep === 0}
                  className="flex-1 border border-border-color rounded-[10px] py-2 text-[13px] font-semibold disabled:opacity-40 flex items-center justify-center gap-1"
                >
                  <ChevronLeft size={14} />
                  Voltar
                </button>
                {helpStep < HELP_STEPS.length - 1 ? (
                  <button
                    type="button"
                    onClick={() => setHelpStep((prev) => Math.min(HELP_STEPS.length - 1, prev + 1))}
                    className="flex-1 bg-primary text-white rounded-[10px] py-2 text-[13px] font-semibold flex items-center justify-center gap-1"
                  >
                    Proximo
                    <ChevronRight size={14} />
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => setIsHelpOpen(false)}
                    className="flex-1 bg-primary text-white rounded-[10px] py-2 text-[13px] font-semibold"
                  >
                    Entendi
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {successModal.open && (
        <div className="fixed inset-0 z-[110] bg-black/50 flex items-center justify-center p-4">
          <div className="w-full max-w-[360px] bg-white rounded-[18px] border border-border-color shadow-2xl p-5 text-center">
            <div className="w-14 h-14 rounded-full bg-[#E7F4EC] mx-auto flex items-center justify-center mb-3">
              <CheckCircle2 size={30} className="text-success" />
            </div>
            <h3 className="m-0 text-[18px] font-extrabold text-text-main">Solicitacao processada</h3>
            <p className="mt-2 mb-4 text-[13px] text-text-muted">Seu pedido foi recebido com sucesso.</p>

            <div className="bg-[#F8F9FA] border border-border-color rounded-[12px] p-3 mb-4">
              <div className="text-[11px] uppercase tracking-wide text-text-muted">Codigo da solicitacao</div>
              <div className="text-[16px] font-black text-primary mt-1">{successModal.requestId}</div>
              <div className="text-[11px] text-text-muted mt-1">Status: {successModal.status}</div>
            </div>

            <button
              type="button"
              onClick={() => setSuccessModal({ open: false, requestId: '', status: '' })}
              className="w-full bg-primary text-white rounded-[12px] p-3 font-bold text-[14px]"
            >
              Fechar
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
