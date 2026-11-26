import React from 'react';
import {
  BookOpen,
  Eraser,
  FileArchive,
  FolderOpen,
  FolderPlus,
  GitBranch,
  Heart,
  ListTree,
  Moon,
  Settings,
  Sparkles,
  Sun,
} from 'lucide-react';
import { useI18n } from '../i18n';

export type SidebarTabId = 'files' | 'structure' | 'git';

interface ActivityBarProps {
  sidebarOpen: boolean;
  sidebarTab: SidebarTabId;
  rightTab: 'pdf' | 'ai';
  hasProject: boolean;
  theme: 'dark' | 'light';
  onSelectSidebarTab: (tab: SidebarTabId) => void;
  onOpenTemplates: () => void;
  onOpenMarkdownImport: () => void;
  onImportOverleafZip: () => void;
  onCleanAux: () => void;
  onOpenQuickRef: () => void;
  onToggleAi: () => void;
  onToggleTheme: () => void;
  onToggleLocale: () => void;
  onOpenSettings: () => void;
  onOpenFeedback: () => void;
}

export const ActivityBar: React.FC<ActivityBarProps> = ({
  sidebarOpen,
  sidebarTab,
  rightTab,
  hasProject,
  theme,
  onSelectSidebarTab,
  onOpenTemplates,
  onOpenMarkdownImport,
  onImportOverleafZip,
  onCleanAux,
  onOpenQuickRef,
  onToggleAi,
  onToggleTheme,
  onToggleLocale,
  onOpenSettings,
  onOpenFeedback,
}) => {
  const { t, locale } = useI18n();

  return (
    <aside className="tf-activity-bar" aria-label="Activity Bar">
      <div className="tf-activity-group">
        <button
          type="button"
          className={`tf-activity-btn ${sidebarOpen && sidebarTab === 'files' ? 'active' : ''}`}
          onClick={() => onSelectSidebarTab('files')}
          data-tooltip={t('activity.explorer')}
          aria-label={t('activity.explorer')}
        >
          <FolderOpen size={18} />
        </button>

        <button
          type="button"
          className={`tf-activity-btn ${sidebarOpen && sidebarTab === 'structure' ? 'active' : ''}`}
          onClick={() => onSelectSidebarTab('structure')}
          data-tooltip={t('activity.structure')}
          aria-label={t('activity.structure')}
        >
          <ListTree size={18} />
        </button>

        <button
          type="button"
          className="tf-activity-btn"
          onClick={onOpenTemplates}
          data-tooltip={t('activity.templates')}
          aria-label={t('activity.templates')}
        >
          <FolderPlus size={18} />
        </button>

        <button
          type="button"
          className="tf-activity-btn tf-activity-md-btn"
          onClick={onOpenMarkdownImport}
          data-tooltip={t('activity.importMd')}
          aria-label={t('activity.importMd')}
        >
          <span className="tf-activity-md-badge">MD</span>
        </button>

        <button
          type="button"
          className="tf-activity-btn"
          onClick={onImportOverleafZip}
          data-tooltip={t('activity.importZip')}
          aria-label={t('activity.importZip')}
        >
          <FileArchive size={18} />
        </button>

        <button
          type="button"
          className={`tf-activity-btn ${sidebarOpen && sidebarTab === 'git' ? 'active' : ''}`}
          onClick={() => onSelectSidebarTab('git')}
          data-tooltip={t('activity.git')}
          aria-label={t('activity.git')}
        >
          <GitBranch size={18} />
        </button>

        <div className="tf-activity-divider" />

        <button
          type="button"
          className="tf-activity-btn"
          disabled={!hasProject}
          onClick={onCleanAux}
          data-tooltip={t('activity.cleanAux')}
          aria-label={t('activity.cleanAux')}
        >
          <Eraser size={18} />
        </button>

        <button
          type="button"
          className="tf-activity-btn"
          onClick={onOpenQuickRef}
          data-tooltip={t('activity.quickRef')}
          aria-label={t('activity.quickRef')}
        >
          <BookOpen size={18} />
        </button>

        <button
          type="button"
          className={`tf-activity-btn ${rightTab === 'ai' ? 'active' : ''}`}
          onClick={onToggleAi}
          data-tooltip={t('activity.ai')}
          aria-label={t('activity.ai')}
        >
          <Sparkles size={18} />
        </button>
      </div>

      <div className="tf-activity-group tf-activity-bottom">
        <button
          type="button"
          className="tf-activity-btn tf-activity-lang-btn"
          onClick={onToggleLocale}
          data-tooltip={t('activity.language')}
          aria-label={t('activity.language')}
        >
          <span>{locale === 'pt-BR' ? 'PT' : 'EN'}</span>
        </button>

        <button
          type="button"
          className="tf-activity-btn"
          onClick={onToggleTheme}
          data-tooltip={t('activity.theme')}
          aria-label={t('activity.theme')}
        >
          {theme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
        </button>

        <button
          type="button"
          className="tf-activity-btn"
          onClick={onOpenSettings}
          data-tooltip={t('activity.settings')}
          aria-label={t('activity.settings')}
        >
          <Settings size={18} />
        </button>

        <button
          type="button"
          className="tf-activity-btn"
          onClick={onOpenFeedback}
          data-tooltip={t('activity.donate')}
          aria-label={t('activity.donate')}
        >
          <Heart size={18} className="text-rose-400" />
        </button>
      </div>
    </aside>
  );
};

