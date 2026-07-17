import React, { createContext, useContext, useState, useEffect } from 'react';
import zhTW from '@/locales/zh-TW.json';
import en from '@/locales/en.json';
import zhCN from '@/locales/zh-CN.json';
import ja from '@/locales/ja.json';

const translations = {
    'zh-TW': zhTW,
    'en': en,
    'zh-CN': zhCN,
    'ja': ja
};

export type Language = keyof typeof translations;

interface I18nContextType {
    language: Language;
    setLanguage: (lang: Language) => void;
    t: (key: string, variables?: Record<string, string | number>) => string;
}

const I18nContext = createContext<I18nContextType | undefined>(undefined);

export const I18nProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [language, setLanguageState] = useState<Language>('zh-TW');

    useEffect(() => {
        const savedLang = localStorage.getItem('sonicpulse_language') as Language;
        if (savedLang && translations[savedLang]) {
            setLanguageState(savedLang);
        }
    }, []);

    const setLanguage = (lang: Language) => {
        setLanguageState(lang);
        localStorage.setItem('sonicpulse_language', lang);
    };

    const t = (key: string, variables?: Record<string, string | number>): string => {
        const keys = key.split('.');
        let value: any = translations[language];
        
        for (const k of keys) {
            if (value && typeof value === 'object' && k in value) {
                value = value[k];
            } else {
                value = key; // Fallback to key if not found
                break;
            }
        }

        if (typeof value === 'string' && variables) {
            let interpolated = value;
            for (const [k, v] of Object.entries(variables)) {
                interpolated = interpolated.replace(new RegExp(`{{\\s*${k}\\s*}}`, 'g'), String(v));
            }
            return interpolated;
        }

        return typeof value === 'string' ? value : key;
    };

    return (
        <I18nContext.Provider value={{ language, setLanguage, t }}>
            {children}
        </I18nContext.Provider>
    );
};

export const useTranslation = () => {
    const context = useContext(I18nContext);
    if (!context) {
        throw new Error('useTranslation must be used within an I18nProvider');
    }
    return context;
};
