import React, { useEffect, useRef, useState } from 'react';
import { Pause, Play, X } from 'lucide-react';

interface TeleprompterModalProps {
  open: boolean;
  numPages: number;
  currentPage: number;
  notes: Record<number, string>;
  onGoPage: (page: number) => void;
  onClose: () => void;
}

export const TeleprompterModal: React.FC<TeleprompterModalProps> = ({
  open,
  numPages,
  currentPage,
  notes,
  onGoPage,
  onClose,
}) => {
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState(4); // 1..10
  const [followSlides, setFollowSlides] = useState(true);
  const [fontSize, setFontSize] = useState(26);
  const [palette, setPalette] = useState<'dark' | 'sepia' | 'light'>('dark');

  const scrollRef = useRef<HTMLDivElement | null>(null);
  const slideRefs = useRef<Record<number, HTMLDivElement | null>>({});
  const lastFollowedRef = useRef<number>(currentPage);

  // Scroll to current slide when opening
  useEffect(() => {
    if (!open) return;
    lastFollowedRef.current = currentPage;
    const el = slideRefs.current[currentPage];
    if (el && scrollRef.current) {
      scrollRef.current.scrollTop = Math.max(0, el.offsetTop - 90);
    }
  }, [open]);

  // Smooth RAF auto-scroll
  useEffect(() => {
    if (!open || !playing) return;
    let rafId = 0;
    let lastTime = performance.now();

    const step = (now: number) => {
      const dt = Math.min(0.1, (now - lastTime) / 1000);
      lastTime = now;
      const container = scrollRef.current;
      if (container) {
        const pxPerSec = 14 + speed * 14; // 28..154 px/s
        container.scrollTop += pxPerSec * dt;

        if (followSlides) {
          const bandY = container.scrollTop + container.clientHeight * 0.28;
          let activeSlide = lastFollowedRef.current;
          for (let p = 1; p <= numPages; p++) {
            const el = slideRefs.current[p];
            if (el && el.offsetTop <= bandY) {
              activeSlide = p;
            }
          }
          if (activeSlide !== lastFollowedRef.current) {
            lastFollowedRef.current = activeSlide;
            onGoPage(activeSlide);
          }
        }
      }
      rafId = requestAnimationFrame(step);
    };

    rafId = requestAnimationFrame(step);
    return () => cancelAnimationFrame(rafId);
  }, [open, playing, speed, followSlides, numPages, onGoPage]);

  // Keyboard shortcuts inside Teleprompter
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
      } else if (e.key.toLowerCase() === 'k' || e.key === ' ') {
        e.preventDefault();
        setPlaying((p) => !p);
      } else if (e.key === '[') {
        e.preventDefault();
        setSpeed((s) => Math.max(1, s - 1));
      } else if (e.key === ']') {
        e.preventDefault();
        setSpeed((s) => Math.min(10, s + 1));
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;

  const paletteStyle =
    palette === 'sepia'
      ? { background: '#f5ecd7', color: '#2c2216' }
      : palette === 'light'
      ? { background: '#f8fafc', color: '#0f172a' }
      : { background: '#070b14', color: '#f1f5f9' };

  return (
    <div className="fs-teleprompter-backdrop">
      <div className="fs-teleprompter-bar">
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <strong>Teleprompter</strong>
          <button
            type="button"
            className={`fs-btn ${playing ? 'primary' : ''}`}
            onClick={() => setPlaying((p) => !p)}
            title="Play/Pause (K ou Espaço)"
          >
            {playing ? <Pause size={14} /> : <Play size={14} />}
            {playing ? 'Pausar (K)' : 'Iniciar (K)'}
          </button>
          <label className="fs-tp-label">
            Velocidade: <strong>{speed}</strong>
            <input
              type="range"
              min={1}
              max={10}
              value={speed}
              onChange={(e) => setSpeed(Number(e.target.value))}
            />
          </label>
          <label className="fs-tp-label">
            Fonte: <strong>{fontSize}px</strong>
            <input
              type="range"
              min={16}
              max={48}
              value={fontSize}
              onChange={(e) => setFontSize(Number(e.target.value))}
            />
          </label>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <label className="fs-tp-check">
            <input
              type="checkbox"
              checked={followSlides}
              onChange={(e) => setFollowSlides(e.target.checked)}
            />
            Seguir slides automaticamente
          </label>
          <select
            className="fs-select"
            value={palette}
            onChange={(e) => setPalette(e.target.value as 'dark' | 'sepia' | 'light')}
          >
            <option value="dark">Escuro</option>
            <option value="sepia">Sépia</option>
            <option value="light">Claro</option>
          </select>
          <button type="button" className="fs-btn" onClick={onClose} title="Fechar (Esc)">
            <X size={14} /> Fechar
          </button>
        </div>
      </div>

      <div className="fs-teleprompter-stage" style={paletteStyle}>
        <div className="fs-teleprompter-band" />
        <div className="fs-teleprompter-scroll" ref={scrollRef}>
          <div style={{ height: '24vh' }} />
          {Array.from({ length: numPages }, (_, i) => i + 1).map((p) => {
            const text = (notes[p] || '').trim();
            return (
              <div
                key={p}
                ref={(el) => {
                  slideRefs.current[p] = el;
                }}
                className={`fs-tp-block ${p === currentPage ? 'current' : ''}`}
              >
                <div
                  className="fs-tp-slide-tag"
                  onClick={() => {
                    lastFollowedRef.current = p;
                    onGoPage(p);
                  }}
                >
                  Slide {p} {p === currentPage ? '· ATUAL' : ''}
                </div>
                <div className="fs-tp-text" style={{ fontSize }} dir="auto">
                  {text || '(Sem anotações neste slide)'}
                </div>
              </div>
            );
          })}
          <div style={{ height: '55vh' }} />
        </div>
      </div>
    </div>
  );
};
