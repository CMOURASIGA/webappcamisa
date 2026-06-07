import React, { useEffect, useMemo, useRef, useState } from 'react';
import { CheckCircle2, CircleHelp, Shirt, X } from 'lucide-react';
import { TEAMS, COLORS, SIZES } from '../data/mockData';
import { fetchBootstrapData, isMockApiEnabled, submitOrder } from '../services/api';
import type { StockOptionRow } from '../types/api';

type FormItem = {
  id: string;
  color: string;
  size: string;
  quantity: number;
};

export default function Form() {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [team, setTeam] = useState('');
  const [otherTeam, setOtherTeam] = useState('');
  const [proofFile, setProofFile] = useState<File | null>(null);
  const [stockRows, setStockRows] = useState<StockOptionRow[]>([]);
  const [availableColors, setAvailableColors] = useState<string[]>(COLORS);
  const [allowedExtensions, setAllowedExtensions] = useState(['pdf', 'jpg', 'jpeg', 'png']);
  const [items, setItems] = useState<FormItem[]>([{ id: 'item-1', color: '', size: '', quantity: 1 }]);
  const [message, setMessage] = useState<{ type: 'error' | 'success' | 'info'; text: string } | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isLoadingStock, setIsLoadingStock] = useState(true);
  const [isHelpOpen, setIsHelpOpen] = useState(false);
  const [successModal, setSuccessModal] = useState<{ open: boolean; requestId: string; status: string }>({
    open: false,
    requestId: '',
    status: '',
  });

  const fileInputRef = useRef<HTMLInputElement>(null);
  const PRICE = 40;
  const PIX_KEY = '21980342025';
  const LOGO_URL = 'https://i.imgur.com/c5XQ7TW.jpg';
  const SHIRT_LINKS: Record<string, string> = { Preta: 'https://imgur.com/HaLhOb2' };

  useEffect(() => {
    let active = true;

    async function loadBootstrap() {
      try {
        if (isMockApiEnabled()) {
          if (!active) return;
          setAvailableColors(COLORS);
          setStockRows([]);
          setIsLoadingStock(false);
          return;
        }

        const data = await fetchBootstrapData();
        if (!active) return;
        setStockRows(data.stockOptions.rows || []);
        setAvailableColors(data.stockOptions.colors?.length ? data.stockOptions.colors : COLORS);
        setAllowedExtensions(data.allowedExtensions?.length ? data.allowedExtensions : ['pdf', 'jpg', 'jpeg', 'png']);
        setIsLoadingStock(false);
      } catch (error) {
        if (!active) return;
        setAvailableColors(COLORS);
        setMessage({
          type: 'error',
          text: error instanceof Error ? `${error.message} Usando opcoes padrao.` : 'Falha ao carregar estoque. Usando opcoes padrao.',
        });
        setIsLoadingStock(false);
      }
    }

    loadBootstrap();
    return () => {
      active = false;
    };
  }, []);

  const colors = availableColors.length ? availableColors : COLORS;

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

  const sizesForColor = (color: string) => {
    if (!color) return SIZES;
    const fromSheet = stockRows.filter((row) => row.cor === color).map((row) => row.tamanho);
    const unique = [...new Set(fromSheet)];
    return unique.length ? SIZES.filter((size) => unique.includes(size)) : SIZES;
  };

  const addItem = () => setItems((prev) => [...prev, { id: `item-${Date.now()}`, color: '', size: '', quantity: 1 }]);
  const removeItem = (id: string) => setItems((prev) => prev.filter((item) => item.id !== id));
  const updateItem = (id: string, updates: Partial<FormItem>) => setItems((prev) => prev.map((item) => (item.id === id ? { ...item, ...updates } : item)));

  const totalQuantity = useMemo(() => items.reduce((acc, item) => acc + item.quantity, 0), [items]);
  const totalPrice = totalQuantity * PRICE;

  const handleSubmit = async (e: React.FormEvent | React.MouseEvent) => {
    e.preventDefault();

    if (!name.trim()) return setMessage({ type: 'error', text: 'Informe o nome completo.' });
    if (!email.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return setMessage({ type: 'error', text: 'Informe um e-mail valido.' });
    if (!team) return setMessage({ type: 'error', text: 'Informe a equipe.' });
    if (team === 'Outro' && !otherTeam.trim()) return setMessage({ type: 'error', text: 'Informe qual e a equipe.' });
    if (!items.length) return setMessage({ type: 'error', text: 'Adicione pelo menos uma camisa.' });

    for (let i = 0; i < items.length; i++) {
      if (!items[i].color) return setMessage({ type: 'error', text: `Selecione a cor do item ${i + 1}.` });
      if (!items[i].size) return setMessage({ type: 'error', text: `Selecione o tamanho do item ${i + 1}.` });
      if (items[i].quantity <= 0) return setMessage({ type: 'error', text: `Quantidade invalida no item ${i + 1}.` });
    }

    if (!proofFile) return setMessage({ type: 'error', text: 'O comprovante de pagamento e obrigatorio.' });
    const ext = proofFile.name.split('.').pop()?.toLowerCase() || '';
    if (!allowedExtensions.includes(ext)) return setMessage({ type: 'error', text: `Arquivo invalido. Use: ${allowedExtensions.join(', ').toUpperCase()}` });
    if (proofFile.size > 10 * 1024 * 1024) return setMessage({ type: 'error', text: 'O comprovante excede 10 MB.' });

    setIsSubmitting(true);
    setMessage({ type: 'info', text: 'Enviando solicitacao, aguarde...' });

    try {
      const proofBase64 = await fileToBase64(proofFile);
      const response = await submitOrder({
        nomeCompleto: name.trim(),
        email: email.trim(),
        equipe: team === 'Outro' ? otherTeam.trim() : team,
        items: items.map((item) => ({
          tamanho: item.size,
          cor: item.color,
          quantidade: item.quantity,
          aceitaTamanhoAlternativo: false,
          aceitaOutraCor: false,
        })),
        proofFile: {
          name: proofFile.name,
          type: proofFile.type,
          size: proofFile.size,
          base64: proofBase64,
        },
      });

      setMessage({ type: 'success', text: `Solicitacao enviada com sucesso! ID: ${response.requestId} | Status: ${response.statusGeral}` });
      setSuccessModal({ open: true, requestId: response.requestId, status: response.statusGeral });
      setName('');
      setEmail('');
      setTeam('');
      setOtherTeam('');
      setProofFile(null);
      setItems([{ id: `item-${Date.now()}`, color: '', size: '', quantity: 1 }]);
      if (fileInputRef.current) fileInputRef.current.value = '';
    } catch (error) {
      setMessage({ type: 'error', text: error instanceof Error ? error.message : 'Falha ao enviar solicitacao.' });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="md:flex md:justify-center md:items-start md:p-6 min-h-screen overflow-hidden bg-background">
      <div className="w-full max-w-[420px] bg-white md:rounded-[32px] md:shadow-[0_4px_20px_rgba(0,0,0,0.05)] md:border-[8px] md:border-[#1A1C1E] relative overflow-hidden pb-[140px] md:pb-[130px] mx-auto flex flex-col md:h-[calc(100vh-48px)]">
        <div className="bg-primary text-white p-4 shrink-0">
          <div className="flex items-center gap-3">
            <img src={LOGO_URL} alt="Logo EAC" className="w-14 h-14 rounded-full object-cover border-2 border-white/40 shrink-0" />
            <div className="flex-1 min-w-0">
              <span className="inline-block bg-white/20 px-3 py-1 rounded-[4px] text-[10px] uppercase font-bold tracking-wider">EAC - Equipes</span>
              <h1 className="mt-2 mb-1 text-[18px] font-bold leading-tight">Solicitacao de Camisas</h1>
              <p className="m-0 opacity-90 text-[12px]">Selecione cor, tamanho e quantidade. Se faltar saldo, o item segue direto para reposicao.</p>
            </div>
            <div className="w-11 h-11 rounded-full bg-white/15 border border-white/25 flex items-center justify-center shrink-0">
              <Shirt size={20} className="text-white" />
            </div>
          </div>
        </div>

        <div className="bg-gradient-to-br from-[#0F4C81] to-[#0B3B64] text-white mx-4 mt-4 p-5 rounded-[16px]">
          <div className="text-[12px] opacity-80 uppercase tracking-wide">Chave PIX</div>
          <div className="font-bold text-[24px] mt-1">R$ {PRICE.toFixed(2).replace('.', ',')}</div>
          <div className="flex justify-between items-center mt-3 gap-3">
            <span className="font-mono bg-white/20 px-2.5 py-1 rounded-[4px] text-[14px]">{PIX_KEY}</span>
            <button type="button" onClick={() => navigator.clipboard.writeText(PIX_KEY)} className="bg-transparent text-white border-0 underline text-[12px] cursor-pointer">Copiar</button>
          </div>
        </div>

        <div className="mx-4 mt-3">
          <button type="button" onClick={() => setIsHelpOpen(true)} className="w-full bg-white border border-[#0F4C81]/20 text-[#0F4C81] rounded-[12px] p-3 font-bold text-[13px] flex items-center justify-center gap-2 hover:bg-[#F4F8FC] transition-colors">
            <CircleHelp size={16} />
            Como funciona agora
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 flex-1 bg-[#F8F9FA] overflow-y-auto custom-scrollbar">
          {message && <div className={`rounded-xl p-3 mb-4 font-bold text-[13px] ${message.type === 'error' ? 'bg-[#fff1f1] text-[#9b1c1c] border border-[#fecaca]' : message.type === 'success' ? 'bg-[#e4f5ed] text-[#065f46] border border-[#bbf7d0]' : 'bg-[#ebf0fb] text-primary border border-[#bfdbfe]'}`}>{message.text}</div>}
          {isLoadingStock && <div className="rounded-xl p-3 mb-4 font-bold text-[13px] bg-[#ebf0fb] text-primary border border-[#bfdbfe]">Carregando opcoes de estoque...</div>}

          <section className="bg-white p-4 rounded-[12px] border border-border-color mb-4">
            <h2 className="text-[15px] font-bold text-text-main m-0 mb-4">Seus dados</h2>
            <div className="flex flex-col gap-2 mb-4"><label className="text-[12px] font-bold text-text-main uppercase">Nome completo</label><input type="text" value={name} onChange={(e) => setName(e.target.value)} className="w-full p-2.5 rounded-[8px] border border-border-color bg-white text-[14px] focus:outline-none focus:border-primary" /></div>
            <div className="flex flex-col gap-2 mb-4"><label className="text-[12px] font-bold text-text-main uppercase">E-mail</label><input type="email" value={email} onChange={(e) => setEmail(e.target.value)} className="w-full p-2.5 rounded-[8px] border border-border-color bg-white text-[14px] focus:outline-none focus:border-primary" /></div>
            <div className="flex flex-col gap-2 mb-4"><label className="text-[12px] font-bold text-text-main uppercase">Equipe</label><select value={team} onChange={(e) => setTeam(e.target.value)} className="w-full p-2.5 rounded-[8px] border border-border-color bg-white text-[14px] focus:outline-none focus:border-primary"><option value="">Selecione sua equipe</option>{TEAMS.map((t) => <option key={t} value={t}>{t}</option>)}</select></div>
            {team === 'Outro' && <div className="flex flex-col gap-2"><label className="text-[12px] font-bold text-text-main uppercase">Qual equipe?</label><input type="text" value={otherTeam} onChange={(e) => setOtherTeam(e.target.value)} className="w-full p-2.5 rounded-[8px] border border-border-color bg-white text-[14px] focus:outline-none focus:border-primary" /></div>}
          </section>

          <section className="bg-white p-4 rounded-[12px] border border-border-color mb-4">
            <h2 className="text-[15px] font-bold text-text-main m-0 mb-4">Comprovante de pagamento</h2>
            <div onClick={() => fileInputRef.current?.click()} className={`border-2 border-dashed rounded-[12px] p-5 text-center cursor-pointer ${proofFile ? 'border-success bg-[#e4f5ed]' : 'border-border-color bg-[#FAFAFA]'}`}>
              <strong className={`block text-[13px] ${proofFile ? 'text-success' : 'text-text-main'}`}>{proofFile ? 'Comprovante anexado' : 'Anexar comprovante'}</strong>
              <span className="block mt-1 text-[11px] text-text-muted">{proofFile ? proofFile.name : 'Toque para selecionar arquivo (max 10MB)'}</span>
            </div>
            <input type="file" ref={fileInputRef} onChange={(e) => setProofFile(e.target.files?.[0] || null)} accept={allowedExtensions.map((item) => `.${item}`).join(',')} className="hidden" />
          </section>

          <section className="bg-white p-4 rounded-[12px] border border-border-color mb-4">
            <h2 className="text-[15px] font-bold text-text-main m-0 mb-4">Itens do pedido</h2>
            <div className="flex flex-col gap-4 mb-4">
              {items.map((item, index) => (
                <div key={item.id} className="border border-border-color rounded-[12px] p-4 bg-[#fcfcfc]">
                  <div className="flex justify-between items-center mb-3 pb-2 border-b border-border-color">
                    <span className="font-bold text-[14px] text-text-main">Item #{String(index + 1).padStart(2, '0')}</span>
                    {items.length > 1 && <button type="button" onClick={() => removeItem(item.id)} className="text-accent bg-transparent border-0 text-[12px] font-semibold cursor-pointer">Remover</button>}
                  </div>

                  <div className="flex flex-col gap-1.5 mb-4">
                    <div className="flex items-center justify-between gap-2">
                      <label className="text-[11px] text-text-muted font-semibold uppercase">Cor da camisa</label>
                      {item.color === 'Preta' && SHIRT_LINKS.Preta && <a href={SHIRT_LINKS.Preta} target="_blank" rel="noreferrer" className="text-[11px] font-bold text-primary no-underline border border-primary/20 rounded-[999px] px-2 py-1">Ver camisa</a>}
                    </div>
                    <div className="flex flex-wrap gap-2 mt-1">{colors.map((c) => <button key={c} type="button" onClick={() => updateItem(item.id, { color: c, size: '' })} className={`px-3 py-1.5 border rounded-[20px] text-[12px] font-semibold ${item.color === c ? 'bg-primary border-primary text-white' : 'bg-white border-border-color text-text-main'}`}>{c}</button>)}</div>
                  </div>

                  <div className="flex flex-col gap-1.5 mb-4">
                    <label className="text-[11px] text-text-muted font-semibold uppercase">Tamanho</label>
                    <div className="flex flex-wrap gap-2 mt-1">{sizesForColor(item.color).map((size) => <button key={size} type="button" onClick={() => updateItem(item.id, { size })} className={`px-3 py-1.5 border rounded-[20px] text-[12px] font-semibold ${item.size === size ? 'bg-primary border-primary text-white' : 'bg-white border-border-color text-text-main'}`}>{size}</button>)}</div>
                  </div>

                  <div className="rounded-[10px] border border-[#bfdbfe] bg-[#eff6ff] p-3 mb-4 text-[12px] text-[#1d4ed8] font-semibold">Se nao houver saldo para essa combinacao, o item sera registrado automaticamente em reposicao.</div>

                  <div className="flex items-center gap-4">
                    <button type="button" onClick={() => updateItem(item.id, { quantity: Math.max(1, item.quantity - 1) })} className="w-8 h-8 rounded-full border border-border-color bg-white font-bold">-</button>
                    <div className="font-bold text-[14px]">{String(item.quantity).padStart(2, '0')}</div>
                    <button type="button" onClick={() => updateItem(item.id, { quantity: item.quantity + 1 })} className="w-8 h-8 rounded-full border border-border-color bg-white font-bold">+</button>
                  </div>
                </div>
              ))}
            </div>

            <button type="button" onClick={addItem} className="w-full py-3 border border-border-color rounded-[8px] bg-white text-text-main font-bold text-[13px]">+ Adicionar Item</button>
          </section>
        </form>

        <div className="p-5 bg-white border-t border-border-color flex flex-col gap-3 mt-auto sticky md:absolute bottom-0 left-0 right-0 z-50">
          <div className="flex justify-between items-center font-semibold text-[14px]"><span>Total ({totalQuantity} camisa{totalQuantity !== 1 ? 's' : ''})</span><span>{new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(totalPrice)}</span></div>
          <button type="button" onClick={handleSubmit} disabled={isSubmitting || isLoadingStock} className="w-full bg-primary text-white border-none p-4 rounded-[12px] font-bold text-[16px] disabled:opacity-70">{isSubmitting ? 'Enviando...' : 'Enviar Solicitacao'}</button>
        </div>
      </div>

      {isHelpOpen && (
        <div className="fixed inset-0 z-[100] bg-black/45 flex items-center justify-center p-4">
          <div className="w-full max-w-[360px] bg-white rounded-[16px] shadow-xl border border-border-color overflow-hidden">
            <div className="bg-primary text-white px-4 py-3 flex items-center justify-between">
              <strong className="text-[14px]">Como funciona</strong>
              <button type="button" onClick={() => setIsHelpOpen(false)} className="bg-white/15 rounded-full p-1"><X size={16} /></button>
            </div>
            <div className="p-4 text-[13px] text-text-muted leading-relaxed">
              <p className="m-0">1. O estoque inicial vem da aba Estoque por cor e tamanho.</p>
              <p className="mt-3 mb-0">2. Se houver saldo controlado, o pedido e abatido do estoque.</p>
              <p className="mt-3 mb-0">3. Se nao houver saldo, o pedido continua valido e entra direto em reposicao.</p>
            </div>
          </div>
        </div>
      )}

      {successModal.open && (
        <div className="fixed inset-0 z-[110] bg-black/50 flex items-center justify-center p-4">
          <div className="w-full max-w-[360px] bg-white rounded-[18px] border border-border-color shadow-2xl p-5 text-center">
            <div className="w-14 h-14 rounded-full bg-[#E7F4EC] mx-auto flex items-center justify-center mb-3"><CheckCircle2 size={30} className="text-success" /></div>
            <h3 className="m-0 text-[18px] font-extrabold text-text-main">Solicitacao processada</h3>
            <p className="mt-2 mb-4 text-[13px] text-text-muted">Seu pedido foi recebido com sucesso.</p>
            <div className="bg-[#F8F9FA] border border-border-color rounded-[12px] p-3 mb-4"><div className="text-[11px] uppercase tracking-wide text-text-muted">Codigo da solicitacao</div><div className="text-[16px] font-black text-primary mt-1">{successModal.requestId}</div><div className="text-[11px] text-text-muted mt-1">Status: {successModal.status}</div></div>
            <button type="button" onClick={() => setSuccessModal({ open: false, requestId: '', status: '' })} className="w-full bg-primary text-white rounded-[12px] p-3 font-bold text-[14px]">Fechar</button>
          </div>
        </div>
      )}
    </div>
  );
}
