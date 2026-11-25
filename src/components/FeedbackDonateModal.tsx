import React, { useState } from 'react';
import { Bug, Heart, Lightbulb, Copy, Check, X } from 'lucide-react';

interface FeedbackDonateModalProps {
  open: boolean;
  onClose: () => void;
  compilerSummary: string;
}

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

  if (!open) return null;

  const handleCopyReport = async (e: React.FormEvent) => {
    e.preventDefault();
    const payload = [
      `[${kind === 'bug' ? 'BUG REPORT' : 'PEDIDO DE RECURSO'}] ${title}`,
      `Versão: ForjaTeX 1.0.0`,
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
      <div className="tf-modal" onClick={(e) => e.stopPropagation()}>
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
                  placeholder="Descreva o que aconteceu ou o que gostaria de ver no TeXForge..."
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
              <Heart size={32} className="text-rose-400" />
              <h3>Ajude a manter o ForjaTeX gratuito</h3>
              <p>
                Sem paywalls de compilação, sem limite de páginas e sem anúncios. Qualquer doação ajuda a
                custear certificados de assinatura (Windows/Mac) e o desenvolvimento contínuo.
              </p>
              <div className="tf-donate-cards">
                <div className="tf-donate-card">
                  <strong>Pix (Brasil)</strong>
                  <span>Configure sua chave Pix nas variáveis de release</span>
                </div>
                <div className="tf-donate-card">
                  <strong>GitHub Sponsors / Ko-fi</strong>
                  <span>Apoio mensal ou pontual em qualquer moeda</span>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

