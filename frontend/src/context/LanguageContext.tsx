import React, { createContext, useContext, useState, useEffect, useMemo, useCallback } from 'react';
import { en, type TranslationDictionary } from '../locales/en';
import { id } from '../locales/id';

export type Language = 'en' | 'id';

interface LanguageContextType {
  language: Language;
  setLanguage: (lang: Language) => void;
  toggleLanguage: () => void;
  t: TranslationDictionary;
  format: (template: string, params?: Record<string, string | number>) => string;
}

const STORAGE_KEY = 'patchops_language';

const dictionaries: Record<Language, TranslationDictionary> = {
  en,
  id,
};

const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

export const LanguageProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [language, setLanguageState] = useState<Language>(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved === 'id' || saved === 'en') return saved;
    // Auto-detect browser language if Indonesian
    if (typeof navigator !== 'undefined' && navigator.language?.toLowerCase().startsWith('id')) {
      return 'id';
    }
    return 'en';
  });

  const setLanguage = useCallback((lang: Language) => {
    setLanguageState(lang);
    try {
      localStorage.setItem(STORAGE_KEY, lang);
    } catch {
      // Ignore localStorage write failures
    }
  }, []);

  const toggleLanguage = useCallback(() => {
    setLanguageState((prev) => {
      const next = prev === 'en' ? 'id' : 'en';
      try {
        localStorage.setItem(STORAGE_KEY, next);
      } catch {
        // Ignore localStorage write failures
      }
      return next;
    });
  }, []);

  useEffect(() => {
    document.documentElement.lang = language;
  }, [language]);

  const t = useMemo(() => dictionaries[language], [language]);

  const format = useCallback((template: string, params?: Record<string, string | number>): string => {
    if (!params) return template;
    return Object.entries(params).reduce((acc, [key, val]) => {
      return acc.replace(new RegExp(`\\{${key}\\}`, 'g'), String(val));
    }, template);
  }, []);

  const value = useMemo(
    () => ({
      language,
      setLanguage,
      toggleLanguage,
      t,
      format,
    }),
    [language, setLanguage, toggleLanguage, t, format]
  );

  return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>;
};

// eslint-disable-next-line react-refresh/only-export-components
export const useLanguage = (): LanguageContextType => {
  const context = useContext(LanguageContext);
  if (!context) {
    throw new Error('useLanguage must be used within a LanguageProvider');
  }
  return context;
};
