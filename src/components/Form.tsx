import React, { useState, useRef } from 'react';
import { TEAMS, COLORS, SIZES, MOCK_STOCK, ShirtItem } from '../data/mockData';

export default function Form() {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [team, setTeam] = useState('');
  const [otherTeam, setOtherTeam] = useState('');
  
  const [proofFile, setProofFile] = useState<File | null>(null);
  
  const [items, setItems] = useState<ShirtItem[]>([{
    id: 'item-1',
    color: '',
    size: '',
    quantity: 1,
    acceptAlternativeSize: false,
    acceptAlternativeColor: false
  }]);

  const [message, setMessage] = useState<{type: 'error' | 'success' | 'info', text: string} | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const PRICE = 40;
  const PIX_KEY = '21980342025';

  const copyPix = async () => {
    try {
      await navigator.clipboard.writeText(PIX_KEY);
      setMessage({ type: 'success', text: 'Chave PIX copiada.'});
      window.scrollTo({top: 0, behavior: 'smooth'});
    } catch {
      setMessage({ type: 'error', text: `Não foi possível copiar. Chave: ${PIX_KEY}`});
      window.scrollTo({top: 0, behavior: 'smooth'});
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
      if (['pdf', 'jpg', 'jpeg', 'png'].includes(ext || '')) {
        setProofFile(file);
      } else {
        setMessage({type: 'error', text: 'Arquivo inválido. Use PDF, JPG, JPEG ou PNG.'});
      }
    }
  };

  const addItem = () => {
    const newId = `item-${Date.now()}`;
    setItems([...items, {
      id: newId,
      color: '',
      size: '',
      quantity: 1,
      acceptAlternativeSize: false,
      acceptAlternativeColor: false
    }]);
  };

  const removeItem = (id: string) => {
    setItems(items.filter(i => i.id !== id));
  };

  const updateItem = (id: string, updates: Partial<ShirtItem>) => {
    setItems(items.map(i => i.id === id ? { ...i, ...updates } : i));
  };

  const isSizeAvailable = (color: string, size: string) => {
    if (!color) return false;
    const stock = MOCK_STOCK.find(s => s.cor === color && s.tamanho === size);
    return stock ? stock.disponivel > 0 : false;
  };

  const totalQuantity = items.reduce((acc, curr) => acc + curr.quantity, 0);
  const totalPrice = totalQuantity * PRICE;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!name.trim()) return setMessage({type: 'error', text: 'Informe o nome completo.'});
    if (!email.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return setMessage({type: 'error', text: 'Informe um e-mail válido.'});
    if (!team) return setMessage({type: 'error', text: 'Informe a equipe.'});
    if (team === 'Outro' && !otherTeam.trim()) return setMessage({type: 'error', text: 'Informe qual é a equipe.'});
    
    if (items.length === 0) return setMessage({type: 'error', text: 'Adicione pelo menos uma camisa.'});
    
    for (let i = 0; i < items.length; i++) {
      if (!items[i].color) return setMessage({type: 'error', text: `Selecione a cor do item ${i + 1}.`});
      if (!items[i].size) return setMessage({type: 'error', text: `Selecione o tamanho do item ${i + 1}.`});
      if (items[i].quantity <= 0) return setMessage({type: 'error', text: `Quantidade inválida no item ${i + 1}.`});
    }

    if (!proofFile) return setMessage({type: 'error', text: 'O comprovante de pagamento é obrigatório.'});
    const ext = proofFile.name.split('.').pop()?.toLowerCase() || '';
    if (!['pdf', 'jpg', 'jpeg', 'png'].includes(ext)) return setMessage({type: 'error', text: 'Arquivo inválido. Use PDF, JPG, JPEG ou PNG.'});
    if (proofFile.size > 10 * 1024 * 1024) return setMessage({type: 'error', text: 'O comprovante excede 10 MB.'});

    setIsSubmitting(true);
    setMessage({type: 'info', text: 'Enviando solicitação, aguarde...'});

    setTimeout(() => {
      setIsSubmitting(false);
      setMessage({type: 'success', text: `Solicitação enviada com sucesso! ID: MOCK-${Date.now()}`});
      window.scrollTo({top: 0, behavior: 'smooth'});
      
      // Reset form
      setName('');
      setEmail('');
      setTeam('');
      setOtherTeam('');
      setProofFile(null);
      setItems([{
        id: `item-${Date.now()+1}`,
        color: '',
        size: '',
        quantity: 1,
        acceptAlternativeSize: false,
        acceptAlternativeColor: false
      }]);
    }, 1500);
  };

  return (
    <div className="md:flex md:justify-center md:items-start md:p-6 min-h-screen overflow-hidden bg-background">
      <div className="w-full max-w-[420px] bg-white md:rounded-[32px] md:shadow-[0_4px_20px_rgba(0,0,0,0.05)] md:border-[8px] md:border-[#1A1C1E] relative overflow-hidden pb-[140px] md:pb-[130px] md:my-0 mx-auto flex flex-col md:h-[calc(100vh-48px)]">
        
        {/* Header Hero */}
        <div className="bg-primary text-white p-5 text-center shrink-0">
          <span className="inline-block bg-white/20 px-3 py-1 rounded-[4px] text-[10px] uppercase font-bold tracking-wider">
            EAC · Equipes
          </span>
          <h1 className="mt-2 mb-1 text-[18px] font-bold leading-tight">Solicitação de Camisas</h1>
          <p className="m-0 opacity-90 text-[12px]">Pague no PIX, anexe o comprovante e conclua.</p>
        </div>

        {/* PIX Card (overlaps header) */}
        <div className="bg-gradient-to-br from-[#0056D2] to-[#003B91] text-white mx-4 mt-4 p-5 rounded-[16px] relative z-10 box-border">
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

        <form onSubmit={handleSubmit} className="p-5 flex-1 bg-[#F8F9FA] overflow-y-auto custom-scrollbar">
          
          {message && (
            <div className={`rounded-xl p-3 mb-4 font-bold text-[13px] ${
              message.type === 'error' ? 'bg-[#fff1f1] text-[#9b1c1c] border border-[#fecaca]' : 
              message.type === 'success' ? 'bg-[#e4f5ed] text-[#065f46] border border-[#bbf7d0]' :
              'bg-[#ebf0fb] text-primary border border-[#bfdbfe]'
            }`}>
              {message.text}
            </div>
          )}

          {/* User Details */}
          <section className="bg-white p-4 rounded-[12px] border border-border-color mb-4">
            <h2 className="text-[15px] font-bold text-text-main m-0 mb-4">Seus dados</h2>
            
            <div className="flex flex-col gap-2 mb-4">
              <label className="text-[12px] font-bold text-text-main uppercase">Nome completo</label>
              <input 
                type="text" 
                value={name}
                onChange={e => setName(e.target.value)}
                placeholder="Seu nome completo" 
                className="w-full p-2.5 rounded-[8px] border border-border-color bg-white text-[14px] focus:outline-none focus:border-primary"
              />
            </div>
            
            <div className="flex flex-col gap-2 mb-4">
              <label className="text-[12px] font-bold text-text-main uppercase">E-mail</label>
              <input 
                type="email" 
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="email@exemplo.com" 
                className="w-full p-2.5 rounded-[8px] border border-border-color bg-white text-[14px] focus:outline-none focus:border-primary"
              />
            </div>

            <div className="flex flex-col gap-2 mb-4">
              <label className="text-[12px] font-bold text-text-main uppercase">Equipe</label>
              <select 
                value={team}
                onChange={e => setTeam(e.target.value)}
                className="w-full p-2.5 rounded-[8px] border border-border-color bg-white text-[14px] focus:outline-none focus:border-primary appearance-none"
              >
                <option value="">Selecione sua equipe</option>
                {TEAMS.map(t => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>

            {team === 'Outro' && (
              <div className="flex flex-col gap-2 mb-4 animate-in fade-in slide-in-from-top-2 duration-300">
                <label className="text-[12px] font-bold text-text-main uppercase">Qual equipe?</label>
                <input 
                  type="text" 
                  value={otherTeam}
                  onChange={e => setOtherTeam(e.target.value)}
                  placeholder="Digite o nome da equipe" 
                  className="w-full p-2.5 rounded-[8px] border border-border-color bg-white text-[14px] focus:outline-none focus:border-primary"
                />
              </div>
            )}
          </section>

          {/* Proof Upload */}
          <section className="bg-white p-4 rounded-[12px] border border-border-color mb-4">
            <h2 className="text-[15px] font-bold text-text-main m-0 mb-4">Comprovante de pagamento</h2>
            <div 
              onClick={() => fileInputRef.current?.click()}
              onDragOver={handleDragOver}
              onDrop={handleDrop}
              className={`border-2 border-dashed rounded-[12px] p-5 text-center cursor-pointer transition-colors ${
                proofFile 
                  ? 'border-success bg-[#e4f5ed]' 
                  : 'border-border-color bg-[#FAFAFA] hover:bg-gray-100'
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
              accept=".pdf,.jpg,.jpeg,.png"
              className="hidden" 
            />
          </section>

          {/* Items */}
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
                      <label className="text-[11px] text-text-muted font-semibold uppercase">Cor da camisa</label>
                      <div className="flex flex-wrap gap-2 mt-1">
                        {COLORS.map(c => (
                          <button
                            key={c}
                            type="button"
                            onClick={() => {
                              updateItem(item.id, { color: c });
                              updateItem(item.id, { color: c, size: '' });
                            }}
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
                        {SIZES.map(s => {
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
                        −
                      </button>
                      <div className="font-bold text-[14px]">
                        {String(item.quantity).padStart(2, '0')}
                      </div>
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

        {/* Sticky Bottom Bar */}
        <div className="p-5 bg-white border-t border-border-color flex flex-col gap-3 mt-auto sticky md:absolute bottom-0 left-0 right-0 z-50">
          <div className="flex justify-between items-center font-semibold text-[14px]">
            <span>Total ({totalQuantity} camisa{totalQuantity !== 1 ? 's' : ''})</span>
            <span>{new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(totalPrice)}</span>
          </div>
          
          <button 
            type="submit" 
            onClick={handleSubmit} 
            disabled={isSubmitting}
            className="w-full bg-primary text-white border-none p-4 rounded-[12px] font-bold text-[16px] cursor-pointer disabled:opacity-70 disabled:cursor-wait hover:bg-primary-dark transition-colors"
          >
            {isSubmitting ? 'Enviando...' : 'Enviar Solicitação'}
          </button>
        </div>
      </div>
    </div>
  );
}
