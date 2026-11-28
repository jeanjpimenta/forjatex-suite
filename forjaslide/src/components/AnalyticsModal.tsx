import React from 'react';
import { X } from 'lucide-react';
import { SessionData } from '../types';
import { computeInsights, formatClock } from '../analyticsUtils';

interface AnalyticsModalProps {
  open: boolean;
  numPages: number;
  targetMinutes: number;
  session: SessionData;
  prevSession: SessionData | null;
  onGoPage: (page: number) => void;
  onClose: () => void;
}

export const AnalyticsModal: React.FC<AnalyticsModalProps> = ({
  open,
  numPages,
  targetMinutes,
  session,
  prevSession,
  onGoPage,
  onClose,
}) => {
  if (!open) return null;

  const insights = computeInsights(session, numPages, targetMinutes);
  const maxSec = Math.max(
    1,
    ...Array.from({ length: numPages }, (_, i) => session.perFrame[i + 1] || 0)
  );

  return (
    <div className="fs-modal-backdrop" onClick={onClose}>
      <div className="fs-modal fs-analytics-modal" onClick={(e) => e.stopPropagation()}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <strong>Analytics do Ensaio</strong>
          <button type="button" className="fs-btn" onClick={onClose}>
            <X size={14} />
          </button>
        </div>

        <div className="fs-analytics-summary">
          <div className="fs-stat-box">
            <span>Tempo Total</span>
            <strong>{formatClock(session.totalSecs)}</strong>
          </div>
          <div className="fs-stat-box">
            <span>Meta</span>
            <strong>{targetMinutes} min</strong>
          </div>
          <div className="fs-stat-box">
            <span>Traços de Tinta</span>
            <strong>{session.inkStrokes}</strong>
          </div>
          <div className="fs-stat-box">
            <span>Dúvidas Marcadas</span>
            <strong>{session.questions.length}</strong>
          </div>
        </div>

        {prevSession && (
          <div className="fs-analytics-prev">
            Ensaio anterior: <strong>{formatClock(prevSession.totalSecs)}</strong> (
            {session.totalSecs - prevSession.totalSecs >= 0 ? '+' : ''}
            {Math.round(session.totalSecs - prevSession.totalSecs)}s vs. anterior)
          </div>
        )}

        <div className="fs-analytics-insights">
          <div className="fs-pane-head" style={{ marginBottom: 4 }}>
            <span>Insights Automáticos</span>
          </div>
          {insights.map((msg, i) => (
            <div key={i} className="fs-insight-item">
              • {msg}
            </div>
          ))}
        </div>

        <div className="fs-analytics-bars">
          <div className="fs-pane-head" style={{ marginBottom: 6 }}>
            <span>Tempo por Slide (clique para ir)</span>
          </div>
          <div className="fs-bars-list">
            {Array.from({ length: numPages }, (_, i) => i + 1).map((p) => {
              const sec = session.perFrame[p] || 0;
              const prevSec = prevSession?.perFrame[p] || 0;
              const pct = Math.min(100, (sec / maxSec) * 100);
              const hasQ = session.questions.includes(p);
              return (
                <button
                  key={p}
                  type="button"
                  className="fs-bar-row"
                  onClick={() => {
                    onGoPage(p);
                    onClose();
                  }}
                >
                  <span className="fs-bar-label">
                    #{p} {hasQ ? '❓' : ''}
                  </span>
                  <div className="fs-bar-track">
                    <div className="fs-bar-fill" style={{ width: `${pct}%` }} />
                  </div>
                  <span className="fs-bar-time">
                    {formatClock(sec)}
                    {prevSession ? ` (${formatClock(prevSec)})` : ''}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
};
