import React, { createContext, useContext, useEffect, useState } from 'react';
import ptBR from './locales/pt-BR.json';
import en from './locales/en.json';

export type LocaleCode = 'pt-BR' | 'en';

export interface LocaleMeta {
  code: LocaleCode;
  label: string;
  dict: Record<string, string>;
}

export const AVAILABLE_LOCALES: LocaleMeta[] = [
  { code: 'pt-BR', label: 'Português (Brasil)', dict: ptBR },
  { code: 'en', label: 'English', dict: en },
];

const STORAGE_LOCALE_KEY = 'forjatex_locale_v1';

interface I18nContextValue {
  locale: LocaleCode;
  setLocale: (next: LocaleCode) => void;
  t: (key: string, fallback?: string) => string;
}

const I18nContext = createContext<I18nContextValue>({
  locale: 'pt-BR',
  setLocale: () => {},
  t: (key, fallback) => fallback ?? ptBR[key as keyof typeof ptBR] ?? key,
});

export const I18nProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [locale, setLocale] = useState<LocaleCode>(() => {
    const saved = localStorage.getItem(STORAGE_LOCALE_KEY);
    if (saved === 'en' || saved === 'pt-BR') return saved;
    const sys = (typeof navigator !== 'undefined' ? navigator.language : 'en').toLowerCase();
    return sys.startsWith('pt') ? 'pt-BR' : 'en';
  });

  useEffect(() => {
    localStorage.setItem(STORAGE_LOCALE_KEY, locale);
  }, [locale]);

  const activeDict: Record<string, string> =
    AVAILABLE_LOCALES.find((l) => l.code === locale)?.dict ?? ptBR;

  const t = (key: string, fallback?: string): string => {
    return activeDict[key] ?? ptBR[key as keyof typeof ptBR] ?? fallback ?? key;
  };

  return (
    <I18nContext.Provider value={{ locale, setLocale, t }}>
      {children}
    </I18nContext.Provider>
  );
};

export function useI18n() {
  return useContext(I18nContext);
}
