import React, { useState } from 'react';
import { Send, Sparkles, Check, Settings, ShieldCheck, Loader2 } from 'lucide-react';
import type { AISettings, ChatMessage, DiagnosticItem } from '../types/ide';
import { buildSafeLatexPrompt, extractLatexBlock, sendAiRequest } from '../utils/aiClient';

interface AiPromptPaneProps {
  aiSettings: AISettings;
  activeFileName: string;
  activeFileContent: string;
  diagnostics: DiagnosticItem[];
  onApplyLatex: (code: string, compileAfter: boolean) => void;
  onOpenSettings: () => void;
}

const QUICK_PROMPTS = [
  'Corrigir erros de compilação atuais',
  'Criar tabela profissional booktabs',
  'Gerar questão de prova (classe exam)',
  'Melhorar clareza acadêmica deste trecho',
];

export const AiPromptPane: React.FC<AiPromptPaneProps> = ({
  aiSettings,
  activeFileName,
  activeFileContent,
  diagnostics,
  onApplyLatex,
  onOpenSettings,
}) => {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSend = async (promptText?: string) => {
    const text = (promptText ?? input).trim();
    if (!text || loading) return;

    setError(null);
    const userMsg: ChatMessage = {
      id: `${Date.now()}-u`,
      role: 'user',
      content: text,
      timestamp: Date.now(),
    };
    setMessages((prev) => [...prev, userMsg]);
    if (!promptText) setInput('');
    setLoading(true);

    try {
      const fullPrompt = buildSafeLatexPrompt(
        text,
        activeFileName,
        activeFileContent,
        diagnostics
      );
      const reply = await sendAiRequest(aiSettings, fullPrompt);
      const assistantMsg: ChatMessage = {
        id: `${Date.now()}-a`,
        role: 'assistant',
        content: reply,
        extractedLatex: extractLatexBlock(reply),
        timestamp: Date.now(),
      };
      setMessages((prev) => [...prev, assistantMsg]);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  };

  const isConfigured = aiSettings.provider === 'ollama' || Boolean(aiSettings.apiKey.trim());

  return (
    <div className="tf-ai-pane">
      <div className="tf-ai-header">
        <div className="tf-ai-title">
          <Sparkles size={14} className="text-amber-400" />
          <span>Safe-Context AI Copilot</span>
        </div>
        <div className="tf-ai-badges">
          <span className="tf-safe-badge" title="Injeta apenas arquivo ativo + erros do .log">
            <ShieldCheck size={12} /> {aiSettings.provider.toUpperCase()}
          </span>
          <button type="button" className="tf-icon-btn" onClick={onOpenSettings} title="Configurar IA">
            <Settings size={13} />
          </button>
        </div>
      </div>

      {!isConfigured && (
        <div className="tf-ai-setup-banner">
          <p>Conecte sua própria API Key (Gemini, OpenAI, Anthropic ou Ollama local) para usar o copiloto.</p>
          <button type="button" className="tf-btn-secondary" onClick={onOpenSettings}>
            Configurar IA
          </button>
        </div>
      )}

      <div className="tf-ai-quick-chips">
        {QUICK_PROMPTS.map((chip) => (
          <button
            key={chip}
            type="button"
            className="tf-chip"
            onClick={() => handleSend(chip)}
            disabled={loading}
          >
            {chip}
          </button>
        ))}
      </div>

      <div className="tf-ai-messages">
        {messages.length === 0 && (
          <div className="tf-ai-empty">
            Peça para gerar tabelas, equações, questões de prova ou corrigir erros do arquivo{' '}
            <code>{activeFileName || 'ativo'}</code>.
          </div>
        )}
        {messages.map((m) => (
          <div key={m.id} className={`tf-ai-msg ${m.role}`}>
            <div className="tf-ai-msg-text">{m.content}</div>
            {m.extractedLatex && (
              <div className="tf-ai-apply-row">
                <button
                  type="button"
                  className="tf-btn-small"
                  onClick={() => onApplyLatex(m.extractedLatex!, false)}
                >
                  <Check size={12} /> Substituir no editor
                </button>
                <button
                  type="button"
                  className="tf-btn-small accent"
                  onClick={() => onApplyLatex(m.extractedLatex!, true)}
                >
                  Aplicar e Compilar
                </button>
              </div>
            )}
          </div>
        ))}
        {loading && (
          <div className="tf-ai-loading">
            <Loader2 size={14} className="animate-spin" /> Gerando resposta segura...
          </div>
        )}
        {error && <div className="tf-ai-error">{error}</div>}
      </div>

      <form
        className="tf-ai-input-bar"
        onSubmit={(e) => {
          e.preventDefault();
          handleSend();
        }}
      >
        <textarea
          rows={2}
          placeholder="Pergunte à IA sobre este documento LaTeX... (Enter envia)"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault();
              handleSend();
            }
          }}
        />
        <button type="submit" className="tf-send-btn" disabled={loading || !input.trim()}>
          <Send size={14} />
        </button>
      </form>
    </div>
  );
};
