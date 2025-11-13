import React, { createContext, useState, useContext, ReactNode, useCallback } from 'react';
import { translations } from './translations';

type Language = 'en' | 'ar';

type Translations = typeof translations.en;

interface LanguageContextType {
    language: Language;
    setLanguage: (language: Language) => void;
    t: (key: keyof Translations, ...args: any[]) => string;
    dir: 'ltr' | 'rtl';
}

const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

export const LanguageProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
    const [language, setLanguage] = useState<Language>('ar');

    const t = useCallback((key: keyof Translations, ...args: any[]): string => {
        const stringOrFn = translations[language][key] || translations['en'][key];
        if (typeof stringOrFn === 'function') {
            // FIX: Add type assertion to allow spreading `args`.
            return (stringOrFn as (...args: any[]) => string)(...args);
        }
        return stringOrFn as string;
    }, [language]);
    
    const dir = language === 'ar' ? 'rtl' : 'ltr';

    return (
        <LanguageContext.Provider value={{ language, setLanguage, t, dir }}>
            {children}
        </LanguageContext.Provider>
    );
};

export const useLanguage = (): LanguageContextType => {
    const context = useContext(LanguageContext);
    if (context === undefined) {
        throw new Error('useLanguage must be used within a LanguageProvider');
    }
    return context;
};
