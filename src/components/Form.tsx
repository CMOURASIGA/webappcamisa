import React, { useEffect, useMemo, useRef, useState } from 'react';
import { CheckCircle2, CircleHelp, FileCheck2, Paperclip, Search, Shirt, Upload, X } from 'lucide-react';
import { COLORS, SIZES, TEAMS, getColorLabel } from '../data/mockData';
import { searchEncontreiros, sendConfirmationEmail, submitOrder, uploadProof } from '../services/api';
import type { EncontreiroOption } from '../types/api';

type FormItem = { id: string; color: string; size: string; quantity: number };

const ENCONTRO_ID = import.meta.env.VITE_EAC_ENCONTRO_ID || '57a08fa1-29e9-4c35-ab34-eb187f79b13a';
const ENCONTRO_NOME = import.meta.env.VITE_EAC_ENCONTRO_NOME || 'EAC 37';
const PRICE = Number(import.meta.env.VITE_SHIRT_PRICE || '40');
const PIX_KEY = import.meta.env.VITE_PIX_KEY || '21980342025';
const LOGO_URL = import.meta.env.VITE_EAC_LOGO_URL || 'https://i.imgur.com/c5XQ7TW.jpg';

export default function Form() {
  const [isEncontreiro, setIsEncontreiro] = useState<boolean | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [searchResults, setSearchResults] = useState<EncontreiroOption[]>([]);
  const [selectedPerson, setSelectedPerson] = useState<EncontreiroOption | null>(null);
  const [name, setName] = useState('');
  const [beneficiary, setBeneficiary] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [team, setTeam] = useState('');
  const [otherTeam, setOtherTeam] = useState('');
  const [proofFile, setProofFile] = useState<File | null>(null);
  const [items, setItems] = useState<FormItem[]>([{ id: 'item-1', color: '', size: '', quantity: 1 }]);
  const [message, setMessage] = useState<{ type: 'error' | 'success' | 'info'; text: string } | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSearching, setIsSearching] = useState(false);
  const [isHelpOpen, setIsHelpOpen] = useState(false);
  const [successModal, setSuccessModal] = useState<{ open: boolean; code: string; emailStatus: 'sent' | 'skipped' | 'failed' | 'pending' }>({ open: false, code: '', emailStatus: 'pending' });
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!isEncontreiro || searchTerm.trim().length < 3 || selectedPerson) {
      setSearchResults([]);
      return;
    }
    const timer = window.setTimeout(async () => {
      setIsSearching(true);
      try {
        setSearchResults(await searchEncontreiros(searchTerm));
      } catch (err) {
        setMessage({ type: 'error', text: err instanceof Error ? err.message : 'Falha ao pesquisar encontreiro.' });
      } finally {
        setIsSearching(false);
      }
    }, 300);
    return () => window.clearTimeout(timer);
  }, [searchTerm, isEncontreiro, selectedPerson]);

  const totalQuantity = useMemo(() => items.reduce((sum, item) => sum + item.quantity, 0), [items]);
  const totalPrice = totalQuantity * PRICE;

  const choosePerson = (person: EncontreiroOption) => {
    setSelectedPerson(person);
    setSearchTerm(person.nome_completo);
    setName(person.nome_completo);
    setBeneficiary(person.nome_completo);
    setSearchResults([]);
  };

  const changeEncontreiro = (value: boolean) => {
    setIsEncontreiro(value);
    setSelectedPerson(null);
    setSearchTerm('');
    setName('');
    setBeneficiary('');
    setTeam('');
    setOtherTeam('');
    setSearchResults([]);
  };

  const addItem = () => setItems((prev) => [...prev, { id: crypto.randomUUID(), color: '', size: '', quantity: 1 }]);
  const removeItem = (id: string) => setItems((prev) => prev.length === 1 ? prev : prev.filter((item) => item.id !== id));
  const updateItem = (id: string, patch: Partial<FormItem>) => setItems((prev) => prev.map((item) => item.id === id ? { ...item, ...patch } : item));

  const reset = () => {
    setIsEncontreiro(null);
    setSelectedPerson(null);
    setSearchTerm('');
    setName('');
    setBeneficiary('');
    setPhone('');
    setEmail('');
    setTeam('');
    setOtherTeam('');
    setProofFile(null);
    setItems([{ id: crypto.randomUUID(), color: '', size: '', quantity: 1 }]);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setMessage(null);

    if (isEncontreiro === null) return setMessage({ type: 'error', text: 'Informe se você é encontreiro.' });
    if (isEncontreiro && !selectedPerson) return setMessage({ type: 'error', text: 'Pesquise e selecione seu nome na lista de encontreiros.' });
    if (!name.trim()) return setMessage({ type: 'error', text: 'Informe o nome do solicitante.' });
    if (!beneficiary.trim()) return setMessage({ type: 'error', text: 'Informe obrigatoriamente o beneficiário da camisa.' });
    if (!phone.trim() && !email.trim()) return setMessage({ type: 'error', text: 'Informe ao menos telefone ou e-mail para contato.' });
    if (email.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return setMessage({ type: 'error', text: 'Informe um e-mail válido.' });
    if (isEncontreiro && !team) return setMessage({ type: 'error', text: 'Informe sua equipe.' });
    if (team === 'Outro' && !otherTeam.trim()) return setMessage({ type: 'error', text: 'Informe qual é a equipe.' });
    if (items.some((item) => !item.color || !item.size || item.quantity <= 0)) return setMessage({ type: 'error', text: 'Preencha cor, tamanho e quantidade de todos os itens.' });
    if (!proofFile) return setMessage({ type: 'error', text: 'O comprovante de pagamento é obrigatório.' });
    if (proofFile.size > 10 * 1024 * 1024) return setMessage({ type: 'error', text: 'O comprovante deve ter no máximo 10 MB.' });

    setIsSubmitting(true);
    setMessage({ type: 'info', text: 'Registrando sua solicitação...' });
    try {
      const proofPath = await uploadProof(proofFile);
      const result = await submitOrder({
        encontroId: ENCONTRO_ID,
        ehEncontreiro: isEncontreiro,
        solicitantePessoaId: selectedPerson?.pessoa_id || null,
        nomeSolicitante: name.trim(),
        telefoneSolicitante: phone.trim() || null,
        emailSolicitante: email.trim() || null,
        equipe: isEncontreiro ? (team === 'Outro' ? otherTeam.trim() : team) : null,
        beneficiarioPessoaId: isEncontreiro && beneficiary.trim() === selectedPerson?.nome_completo ? selectedPerson.pessoa_id : null,
        nomeBeneficiario: beneficiary.trim(),
        observacoes: null,
        comprovantePath: proofPath,
        comprovanteNome: proofFile.name,
        comprovanteTipo: proofFile.type,
        comprovanteTamanho: proofFile.size,
        valorTotal: totalPrice,
        items: items.map((item) => ({ cor: item.color, tamanho: item.size, quantidade: item.quantity })),
      });
      let emailStatus: 'sent' | 'skipped' | 'failed' = result.email_solicitante ? 'failed' : 'skipped';
      if (result.email_solicitante && result.email_dispatch_token) {
        try {
          await sendConfirmationEmail(result.request_id, result.email_dispatch_token);
          emailStatus = 'sent';
        } catch (emailError) {
          console.error('Falha no e-mail de confirmação:', emailError);
          emailStatus = 'failed';
        }
      }
      setMessage({ type: 'success', text: 'Solicitação registrada com sucesso.' });
      setSuccessModal({ open: true, code: result.codigo || result.request_id, emailStatus });
      reset();
    } catch (err) {
      setMessage({ type: 'error', text: err instanceof Error ? err.message : 'Falha ao registrar solicitação.' });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-background md:p-6">
      <div className="mx-auto w-full max-w-[520px] overflow-hidden bg-white md:rounded-[28px] md:border md:border-border-color md:shadow-sm">
        <div className="bg-primary p-5 text-white">
          <div className="flex items-center gap-3">
            <img src={LOGO_URL} alt="EAC" className="h-14 w-14 rounded-full border-2 border-white/40 object-cover" />
            <div className="flex-1">
              <div className="text-[11px] font-bold uppercase tracking-wider opacity-85">{ENCONTRO_NOME}</div>
              <h1 className="m-0 mt-1 text-[22px] font-black">Solicitação de Camisas</h1>
              <p className="m-0 mt-1 text-[12px] opacity-90">A solicitação é livre. O estoque não bloqueia novos pedidos.</p>
            </div>
            <Shirt size={24} />
          </div>
        </div>

        <div className="m-4 rounded-[16px] bg-gradient-to-br from-[#0F4C81] to-[#0B3B64] p-4 text-white">
          <div className="text-[11px] uppercase opacity-75">Valor por camisa</div>
          <div className="mt-1 text-[24px] font-black">R$ {PRICE.toFixed(2).replace('.', ',')}</div>
          <div className="mt-3 flex items-center justify-between gap-3">
            <span className="rounded bg-white/15 px-2 py-1 font-mono text-[13px]">PIX {PIX_KEY}</span>
            <button type="button" onClick={() => navigator.clipboard.writeText(PIX_KEY)} className="text-[12px] underline">Copiar</button>
          </div>
        </div>

        <div className="mx-4 mb-2">
          <button type="button" onClick={() => setIsHelpOpen(true)} className="flex w-full items-center justify-center gap-2 rounded-xl border border-primary/20 bg-white p-3 text-[13px] font-bold text-primary">
            <CircleHelp size={16} /> Como funciona
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5 bg-[#F8F9FA] p-5">
          {message && <div className={`rounded-xl border p-3 text-[13px] font-semibold ${message.type === 'error' ? 'border-red-200 bg-red-50 text-red-700' : message.type === 'success' ? 'border-green-200 bg-green-50 text-green-700' : 'border-blue-200 bg-blue-50 text-blue-700'}`}>{message.text}</div>}

          <section className="rounded-2xl border border-border-color bg-white p-4">
            <label className="text-[13px] font-bold text-text-main">Você é encontreiro?</label>
            <div className="mt-3 grid grid-cols-2 gap-3">
              <button type="button" onClick={() => changeEncontreiro(true)} className={`rounded-xl border p-3 font-bold ${isEncontreiro === true ? 'border-primary bg-primary text-white' : 'border-border-color bg-white'}`}>Sim</button>
              <button type="button" onClick={() => changeEncontreiro(false)} className={`rounded-xl border p-3 font-bold ${isEncontreiro === false ? 'border-primary bg-primary text-white' : 'border-border-color bg-white'}`}>Não</button>
            </div>

            {isEncontreiro === true && (
              <div className="relative mt-4">
                <label className="text-[12px] font-bold">Encontre seu nome</label>
                <div className="relative mt-1">
                  <Search size={16} className="absolute left-3 top-3.5 text-text-muted" />
                  <input value={searchTerm} onChange={(e) => { setSelectedPerson(null); setSearchTerm(e.target.value); setName(''); }} placeholder="Digite pelo menos 3 letras..." className="w-full rounded-xl border border-border-color bg-white p-3 pl-9 text-[14px]" />
                </div>
                {isSearching && <div className="mt-2 text-[12px] text-text-muted">Pesquisando...</div>}
                {searchResults.length > 0 && (
                  <div className="absolute z-20 mt-1 w-full overflow-hidden rounded-xl border border-border-color bg-white shadow-lg">
                    {searchResults.map((person) => <button type="button" key={person.pessoa_id} onClick={() => choosePerson(person)} className="block w-full border-b border-border-color p-3 text-left text-[13px] last:border-0 hover:bg-primary-light">{person.nome_completo}</button>)}
                  </div>
                )}
              </div>
            )}

            {isEncontreiro === false && (
              <div className="mt-4">
                <label className="text-[12px] font-bold">Seu nome</label>
                <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Nome completo" className="mt-1 w-full rounded-xl border border-border-color bg-white p-3 text-[14px]" />
              </div>
            )}
          </section>

          <section className="rounded-2xl border border-border-color bg-white p-4 space-y-3">
            <div>
              <label className="text-[12px] font-bold">Beneficiário *</label>
              <input value={beneficiary} onChange={(e) => setBeneficiary(e.target.value)} placeholder="Quem receberá a camisa" className="mt-1 w-full rounded-xl border border-border-color p-3 text-[14px]" />
              <div className="mt-1 text-[11px] text-text-muted">Se você for encontreiro, o campo começa preenchido com seu nome, mas pode ser alterado.</div>
            </div>
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
              <div><label className="text-[12px] font-bold">Telefone</label><input value={phone} onChange={(e) => setPhone(e.target.value)} className="mt-1 w-full rounded-xl border border-border-color p-3 text-[14px]" /></div>
              <div><label className="text-[12px] font-bold">E-mail</label><input value={email} onChange={(e) => setEmail(e.target.value)} className="mt-1 w-full rounded-xl border border-border-color p-3 text-[14px]" /></div>
            </div>
            {isEncontreiro && (
              <div>
                <label className="text-[12px] font-bold">Equipe *</label>
                <select value={team} onChange={(e) => setTeam(e.target.value)} className="mt-1 w-full rounded-xl border border-border-color bg-white p-3 text-[14px]"><option value="">Selecione...</option>{TEAMS.map((value) => <option key={value}>{value}</option>)}</select>
                {team === 'Outro' && <input value={otherTeam} onChange={(e) => setOtherTeam(e.target.value)} placeholder="Informe a equipe" className="mt-2 w-full rounded-xl border border-border-color p-3 text-[14px]" />}
              </div>
            )}
          </section>

          <section className="rounded-2xl border border-border-color bg-white p-4">
            <div className="flex items-center justify-between"><div><h2 className="m-0 text-[15px] font-black">Camisas</h2><div className="text-[11px] text-text-muted">Cor, tamanho e quantidade.</div></div><button type="button" onClick={addItem} className="rounded-lg bg-primary-light px-3 py-2 text-[12px] font-bold text-primary">+ Adicionar</button></div>
            <div className="mt-4 space-y-3">
              {items.map((item, index) => (
                <div key={item.id} className="rounded-xl border border-border-color bg-[#FAFBFC] p-3">
                  <div className="mb-2 flex items-center justify-between"><strong className="text-[12px]">Item {index + 1}</strong>{items.length > 1 && <button type="button" onClick={() => removeItem(item.id)} className="text-[11px] font-bold text-danger">Remover</button>}</div>
                  <div className="grid grid-cols-2 gap-2">
                    <select value={item.color} onChange={(e) => updateItem(item.id, { color: e.target.value })} className="rounded-lg border border-border-color bg-white p-2.5 text-[13px]"><option value="">Cor</option>{COLORS.map((c) => <option key={c} value={c}>{getColorLabel(c)}</option>)}</select>
                    <select value={item.size} onChange={(e) => updateItem(item.id, { size: e.target.value })} className="rounded-lg border border-border-color bg-white p-2.5 text-[13px]"><option value="">Tamanho</option>{SIZES.map((s) => <option key={s}>{s}</option>)}</select>
                  </div>
                  <div className="mt-2"><label className="text-[11px] font-bold">Quantidade</label><input type="number" min={1} value={item.quantity} onChange={(e) => updateItem(item.id, { quantity: Math.max(1, Number(e.target.value) || 1) })} className="mt-1 w-full rounded-lg border border-border-color bg-white p-2.5 text-[13px]" /></div>
                </div>
              ))}
            </div>
            <div className="mt-4 rounded-xl bg-primary-light p-3 text-[13px]"><div className="flex justify-between"><span>Total de camisas</span><strong>{totalQuantity}</strong></div><div className="mt-1 flex justify-between"><span>Total</span><strong>R$ {totalPrice.toFixed(2).replace('.', ',')}</strong></div></div>
          </section>

          <section className="rounded-2xl border border-border-color bg-white p-4">
            <label className="text-[12px] font-bold">Comprovante de pagamento *</label>
            <input
              ref={fileInputRef}
              type="file"
              accept=".pdf,.jpg,.jpeg,.png"
              onChange={(e) => setProofFile(e.target.files?.[0] || null)}
              className="hidden"
            />
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className={`mt-2 flex w-full items-center gap-3 rounded-xl border-2 border-dashed p-4 text-left transition ${proofFile ? 'border-success/40 bg-success/5' : 'border-primary/25 bg-primary-light/40 hover:border-primary/50'}`}
            >
              <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full ${proofFile ? 'bg-success/10 text-success' : 'bg-white text-primary'}`}>
                {proofFile ? <FileCheck2 size={20} /> : <Upload size={20} />}
              </div>
              <div className="min-w-0 flex-1">
                <div className="text-[13px] font-black text-text">{proofFile ? 'Comprovante selecionado' : 'Clique para anexar o comprovante'}</div>
                <div className="mt-0.5 truncate text-[11px] text-text-muted">{proofFile ? proofFile.name : 'Selecionar arquivo do celular ou computador'}</div>
                <div className="mt-2 inline-flex rounded-full bg-white px-2.5 py-1 text-[10px] font-black uppercase tracking-wide text-primary shadow-sm">{proofFile ? 'Arquivo anexado' : 'Anexar arquivo'}</div>
                <div className="mt-1 text-[10px] text-text-muted">PDF, JPG ou PNG, até 10 MB.</div>
              </div>
              <Paperclip size={18} className="shrink-0 text-primary" />
            </button>
            {proofFile && <button type="button" onClick={() => fileInputRef.current?.click()} className="mt-2 text-[11px] font-bold text-primary underline">Trocar comprovante</button>}
          </section>

          <button disabled={isSubmitting} className="w-full rounded-xl bg-primary p-4 text-[14px] font-black text-white disabled:opacity-60">{isSubmitting ? 'Enviando...' : 'Enviar solicitação'}</button>
        </form>
      </div>

      {isHelpOpen && <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"><div className="w-full max-w-[420px] rounded-2xl bg-white p-5"><div className="flex items-center justify-between"><strong>Como funciona</strong><button onClick={() => setIsHelpOpen(false)}><X size={18} /></button></div><div className="mt-4 space-y-3 text-[13px] text-text-muted"><p>1. Se você é encontreiro, pesquise e selecione seu nome.</p><p>2. Se não é encontreiro, digite seu nome livremente.</p><p>3. O beneficiário é sempre obrigatório.</p><p>4. O pedido é registrado mesmo sem estoque. A falta aparece no dashboard como necessidade de reposição.</p><p>5. O estoque só é baixado quando a camisa é marcada como entregue.</p></div></div></div>}

      {successModal.open && <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 p-4"><div className="w-full max-w-[360px] rounded-2xl bg-white p-5 text-center"><CheckCircle2 size={38} className="mx-auto text-success" /><h3 className="mt-3 text-[18px] font-black">Solicitação registrada</h3><p className="text-[13px] text-text-muted">Guarde o código abaixo para acompanhamento.</p><div className="rounded-xl bg-[#F6F8FA] p-3 font-mono text-[16px] font-black tracking-wide text-primary">{successModal.code}</div>{successModal.emailStatus === 'sent' && <p className="mt-3 text-[11px] font-semibold text-success">Confirmação enviada para o e-mail informado.</p>}{successModal.emailStatus === 'failed' && <p className="mt-3 text-[11px] font-semibold text-warning">Solicitação gravada, mas o e-mail de confirmação não pôde ser enviado.</p>}{successModal.emailStatus === 'skipped' && <p className="mt-3 text-[11px] text-text-muted">Nenhum e-mail foi informado. A solicitação permanece registrada normalmente.</p>}<button onClick={() => setSuccessModal({ open: false, code: '', emailStatus: 'pending' })} className="mt-4 w-full rounded-xl bg-primary p-3 font-bold text-white">Fechar</button></div></div>}
    </div>
  );
}
