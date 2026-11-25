import React, { useEffect, useState } from 'react';
import { Bug, Heart, Lightbulb, Copy, Check, X, ExternalLink } from 'lucide-react';
import { open as openExternal } from '@tauri-apps/plugin-shell';
import {
  generatePixQrDataUrl,
  getPayPalDonateUrl,
  PAYPAL_EMAIL,
  PIX_KEY,
} from '../utils/pixDonate';

interface FeedbackDonateModalProps {
  open: boolean;
  onClose: () => void;
  compilerSummary: string;
}

const APP_DONATE_DESC = 'DoacaoFjTeXIDE';

export const FeedbackDonateModal: React.FC<FeedbackDonateModalProps> = ({
  open,
  onClose,
  compilerSummary,
}) => {
  const [tab, setTab] = useState<'feedback' | 'donate'>('feedback');
  const [kind, setKind] = useState<'feature' | 'bug'>('feature');
  const [title, setTitle] = useState('');
  const [details, setDetails] = useState('');
  const [copied, setCopied] = useState(false);
  const [copyTag, setCopyTag] = useState<string | null>(null);
  const [pixQrUrl, setPixQrUrl] = useState('');
  const [pixBrCode, setPixBrCode] = useState('');

  useEffect(() => {
    if (!open) return;
    generatePixQrDataUrl(APP_DONATE_DESC)
      .then(({ brCode, qrUrl }) => {
        setPixBrCode(brCode);
        setPixQrUrl(qrUrl);
      })
      .catch(() => {});
  }, [open]);

  if (!open) return null;

  const copyText = async (tag: string, text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopyTag(tag);
      setTimeout(() => setCopyTag(null), 2200);
    } catch {
      // ignore
    }
  };

  const handleCopyReport = async (e: React.FormEvent) => {
    e.preventDefault();
    const payload = [
      `[${kind === 'bug' ? 'BUG REPORT' : 'PEDIDO DE RECURSO'}] ${title}`,
      `Versão: ForjaTeX 1.3.0`,
      `Compilador: ${compilerSummary}`,
      `---`,
      details,
    ].join('\n');

    try {
      await navigator.clipboard.writeText(payload);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch {
      // ignore
    }
  };

  return (
    <div className="tf-modal-backdrop" onClick={onClose}>
      <div className="tf-modal tf-modal-wide" onClick={(e) => e.stopPropagation()}>
        <div className="tf-modal-header">
          <div className="tf-modal-tabs">
            <button
              type="button"
              className={`tf-modal-tab ${tab === 'feedback' ? 'active' : ''}`}
              onClick={() => setTab('feedback')}
            >
              <Lightbulb size={14} /> Pedidos &amp; Bugs
            </button>
            <button
              type="button"
              className={`tf-modal-tab ${tab === 'donate' ? 'active' : ''}`}
              onClick={() => setTab('donate')}
            >
              <Heart size={14} className="text-rose-400" /> Apoiar o ForjaTeX
            </button>
          </div>
          <button type="button" className="tf-icon-btn" onClick={onClose}>
            <X size={16} />
          </button>
        </div>

        <div className="tf-modal-body">
          {tab === 'feedback' ? (
            <form onSubmit={handleCopyReport} className="tf-feedback-form">
              <p className="tf-section-desc">
                O ForjaTeX é 100% gratuito. Envie sugestões de novos recursos ou reporte erros encontrados.
              </p>

              <div className="tf-kind-toggle">
                <button
                  type="button"
                  className={kind === 'feature' ? 'active' : ''}
                  onClick={() => setKind('feature')}
                >
                  <Lightbulb size={14} /> Sugerir Recurso
                </button>
                <button
                  type="button"
                  className={kind === 'bug' ? 'active' : ''}
                  onClick={() => setKind('bug')}
                >
                  <Bug size={14} /> Reportar Erro
                </button>
              </div>

              <label className="tf-full-label">
                <span>Resumo</span>
                <input
                  required
                  type="text"
                  placeholder={
                    kind === 'feature'
                      ? 'Ex: Exportar tabelas do Excel direto para LaTeX'
                      : 'Ex: SyncTeX não abre arquivo dentro de subpasta'
                  }
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                />
              </label>

              <label className="tf-full-label">
                <span>Descrição detalhada</span>
                <textarea
                  required
                  rows={4}
                  placeholder="Descreva o que aconteceu ou o que gostaria de ver no ForjaTeX..."
                  value={details}
                  onChange={(e) => setDetails(e.target.value)}
                />
              </label>

              <button type="submit" className="tf-btn-primary">
                {copied ? <Check size={14} /> : <Copy size={14} />}
                <span>{copied ? 'Relatório copiado! Cole no canal de suporte.' : 'Gerar e Copiar Relatório'}</span>
              </button>
            </form>
          ) : (
            <div className="tf-donate-box">
              <Heart size={28} className="text-rose-400" />
              <h3>Ajude a manter o ForjaTeX gratuito</h3>
              <p>
                Sem paywalls de compilação, sem limite de páginas e sem anúncios. Qualquer doação ajuda a
                custear certificados de assinatura digital (Code Signing) e o desenvolvimento contínuo.
              </p>
              <div className="tf-donate-cards">
                <div className="tf-donate-card">
                  <strong>Pix (Brasil — Chave Aleatória)</strong>
                  {pixQrUrl && (
                    <img
                      src={pixQrUrl}
                      alt="QR Code Pix"
                      style={{
                        width: 156,
                        height: 156,
                        borderRadius: 8,
                        background: '#fff',
                        padding: 6,
                        margin: '6px auto',
                      }}
                    />
                  )}
                  <span className="text-[11px] font-mono break-all select-all">{PIX_KEY}</span>
                  <span className="text-[11px] text-slate-400">
                    Descrição: <strong>{APP_DONATE_DESC}</strong>
                  </span>
                  <div className="flex items-center justify-center gap-2 mt-2">
                    <button
                      type="button"
                      className="tf-btn-small"
                      onClick={() => copyText('pix-key', PIX_KEY)}
                    >
                      {copyTag === 'pix-key' ? <Check size={12} /> : <Copy size={12} />}
                      {copyTag === 'pix-key' ? 'Chave copiada!' : 'Copiar Chave'}
                    </button>
                    {pixBrCode && (
                      <button
                        type="button"
                        className="tf-btn-small accent"
                        onClick={() => copyText('pix-code', pixBrCode)}
                      >
                        {copyTag === 'pix-code' ? <Check size={12} /> : <Copy size={12} />}
                        {copyTag === 'pix-code' ? 'Copiado!' : 'Copia e Cola'}
                      </button>
                    )}
                  </div>
                </div>

                <div className="tf-donate-card">
                  <strong>PayPal (Internacional / Cartão)</strong>
                  <span className="text-xs font-mono break-all select-all mt-2">{PAYPAL_EMAIL}</span>
                  <span className="text-[11px] text-slate-400">
                    Descrição sugerida: <strong>{APP_DONATE_DESC}</strong>
                  </span>
                  <div className="flex items-center justify-center gap-2 mt-3">
                    <button
                      type="button"
                      className="tf-btn-small"
                      onClick={() => copyText('paypal', PAYPAL_EMAIL)}
                    >
                      {copyTag === 'paypal' ? <Check size={12} /> : <Copy size={12} />}
                      {copyTag === 'paypal' ? 'E-mail copiado!' : 'Copiar E-mail'}
                    </button>
                    <button
                      type="button"
                      className="tf-btn-small accent"
                      onClick={() => openExternal(getPayPalDonateUrl(APP_DONATE_DESC))}
                    >
                      <ExternalLink size={12} /> Abrir PayPal
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
