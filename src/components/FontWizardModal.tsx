import React, { useEffect, useState } from 'react';
import { AlertTriangle, Check, FolderPlus, Search, Type, X } from 'lucide-react';
import type { CompilerEngine } from '../types/ide';
import {
  copyFontFilesToProject,
  listSystemFonts,
  pickFontFiles,
} from '../utils/tauriBridge';

interface FontWizardModalProps {
  open: boolean;
  projectDir: string | null;
  currentEngine: CompilerEngine;
  onClose: () => void;
  onSwitchEngine: (engine: CompilerEngine) => void;
  onInsert: (code: string) => void;
  onProjectFilesUpdated: () => void;
}

const CLASSIC_FONTS = [
  { id: 'lmodern', name: 'Latin Modern (Padrão Moderno)', pkg: '\\usepackage{lmodern}' },
  { id: 'times', name: 'Times (mathptmx)', pkg: '\\usepackage{mathptmx}' },
  { id: 'palatino', name: 'Palatino (mathpazo)', pkg: '\\usepackage{mathpazo}' },
  { id: 'helvet', name: 'Helvetica Sans (helvet)', pkg: '\\usepackage[scaled]{helvet}\n\\renewcommand{\\familydefault}{\\sfdefault}' },
  { id: 'fira', name: 'Fira Sans (FiraSans)', pkg: '\\usepackage[sfdefault]{FiraSans}' },
];

export const FontWizardModal: React.FC<FontWizardModalProps> = ({
  open,
  projectDir,
  currentEngine,
  onClose,
  onSwitchEngine,
  onInsert,
  onProjectFilesUpdated,
}) => {
  const [tab, setTab] = useState<'fontspec' | 'classic'>('fontspec');
  const [systemFonts, setSystemFonts] = useState<string[]>([]);
  const [query, setQuery] = useState('');
  const [selectedSystemFont, setSelectedSystemFont] = useState('');
  const [roleCmd, setRoleCmd] = useState<'setmainfont' | 'setsansfont' | 'setmonofont'>('setmainfont');

  // Local TTF/OTF files copied to ./fonts/
  const [localFiles, setLocalFiles] = useState<string[]>([]);
  const [classicId, setClassicId] = useState('lmodern');

  useEffect(() => {
    if (open) {
      listSystemFonts().then(setSystemFonts).catch(() => {});
    }
  }, [open]);

  if (!open) return null;

  const filteredSys = systemFonts
    .filter((f) => !query.trim() || f.toLowerCase().includes(query.trim().toLowerCase()))
    .slice(0, 60);

  const handlePickLocalFonts = async () => {
    const picked = await pickFontFiles();
    if (picked.length === 0) return;
    if (projectDir) {
      const copied = await copyFontFilesToProject(projectDir, picked);
      setLocalFiles(copied);
      onProjectFilesUpdated();
    } else {
      setLocalFiles(picked.map((p) => p.split(/[\\/]/).pop() || p));
    }
  };

  const generatedCode = (() => {
    if (tab === 'classic') {
      return CLASSIC_FONTS.find((f) => f.id === classicId)?.pkg ?? '';
    }
    if (localFiles.length > 0) {
      const regular =
        localFiles.find((f) => /regular|roman/i.test(f)) || localFiles[0];
      const bold = localFiles.find((f) => /bold/i.test(f));
      const italic = localFiles.find((f) => /italic|oblique/i.test(f));
      const opts = [`  Path = ./fonts/`];
      if (bold) opts.push(`  BoldFont = ${bold}`);
      if (italic) opts.push(`  ItalicFont = ${italic}`);
      return `\\usepackage{fontspec}\n\\${roleCmd}{${regular}}[\n${opts.join(',\n')}\n]`;
    }
    const fontName = selectedSystemFont || 'Times New Roman';
    return `\\usepackage{fontspec}\n\\${roleCmd}{${fontName}}`;
  })();

  const needsModernEngine = tab === 'fontspec' && currentEngine === 'pdflatex';

  return (
    <div className="tf-modal-backdrop" onClick={onClose}>
      <div className="tf-modal tf-modal-wide" onClick={(e) => e.stopPropagation()}>
        <div className="tf-modal-header">
          <div className="tf-modal-tabs">
            <button
              type="button"
              className={`tf-modal-tab ${tab === 'fontspec' ? 'active' : ''}`}
              onClick={() => setTab('fontspec')}
            >
              <Type size={14} /> Fontes .TTF / .OTF (fontspec)
            </button>
            <button
              type="button"
              className={`tf-modal-tab ${tab === 'classic' ? 'active' : ''}`}
              onClick={() => setTab('classic')}
            >
              Fontes Clássicas (pdflatex)
            </button>
          </div>
          <button type="button" className="tf-icon-btn" onClick={onClose}>
            <X size={16} />
          </button>
        </div>

        <div className="tf-modal-body">
          {needsModernEngine && (
            <div className="tf-ai-setup-banner">
              <div className="flex items-center gap-2">
                <AlertTriangle size={15} className="text-amber-400 shrink-0" />
                <span>
                  Fontes <code>.ttf</code> / <code>.otf</code> (<code>fontspec</code>) exigem{' '}
                  <strong>XeLaTeX</strong> ou <strong>LuaLaTeX</strong>. Seu motor atual é{' '}
                  <code>pdflatex</code>.
                </span>
              </div>
              <button
                type="button"
                className="tf-btn-primary"
                onClick={() => onSwitchEngine('xelatex')}
              >
                Mudar para XeLaTeX
              </button>
            </div>
          )}

          {tab === 'fontspec' ? (
            <>
              <div className="tf-form-grid">
                <label>
                  <span>Aplicar fonte em</span>
                  <select
                    value={roleCmd}
                    onChange={(e) => setRoleCmd(e.target.value as typeof roleCmd)}
                  >
                    <option value="setmainfont">Texto Principal (\setmainfont)</option>
                    <option value="setsansfont">Sem Serifa (\setsansfont)</option>
                    <option value="setmonofont">Monoespaçada (\setmonofont)</option>
                  </select>
                </label>

                <div className="flex flex-col justify-end">
                  <button
                    type="button"
                    className="tf-btn-secondary flex items-center justify-center gap-2"
                    onClick={handlePickLocalFonts}
                  >
                    <FolderPlus size={14} /> Importar .TTF / .OTF para ./fonts/
                  </button>
                </div>
              </div>

              {localFiles.length > 0 && (
                <div className="text-xs text-emerald-400">
                  Arquivos vinculados em <code>./fonts/</code>: {localFiles.join(', ')}
                </div>
              )}

              <div className="tf-symbol-search">
                <Search size={14} className="text-slate-400" />
                <input
                  type="text"
                  placeholder="Buscar fonte instalada no sistema..."
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                />
              </div>

              <div className="tf-font-list">
                {filteredSys.map((f) => (
                  <button
                    key={f}
                    type="button"
                    className={`tf-font-pill ${selectedSystemFont === f && localFiles.length === 0 ? 'active' : ''}`}
                    onClick={() => {
                      setLocalFiles([]);
                      setSelectedSystemFont(f);
                    }}
                  >
                    {f}
                  </button>
                ))}
              </div>
            </>
          ) : (
            <div className="tf-template-grid">
              {CLASSIC_FONTS.map((cf) => (
                <div
                  key={cf.id}
                  className={`tf-template-card ${classicId === cf.id ? 'active' : ''}`}
                  onClick={() => setClassicId(cf.id)}
                >
                  <strong>{cf.name}</strong>
                  <code>{cf.pkg}</code>
                </div>
              ))}
            </div>
          )}

          <pre className="tf-live-code">{generatedCode}</pre>
        </div>

        <div className="tf-modal-footer">
          <button
            type="button"
            className="tf-btn-primary"
            onClick={() => {
              onInsert(generatedCode);
              onClose();
            }}
          >
            <Check size={14} /> Inserir no Preâmbulo
          </button>
        </div>
      </div>
    </div>
  );
};

