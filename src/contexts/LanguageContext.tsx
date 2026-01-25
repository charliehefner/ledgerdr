import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { useAuth } from './AuthContext';

type Language = 'en' | 'es';

interface LanguageContextType {
  language: Language;
  toggleLanguage: () => void;
  getDescription: (item: { english_description: string; spanish_description: string }) => string;
}

const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

export function LanguageProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  
  const [language, setLanguage] = useState<Language>('es');

  // Update language when user changes (login/logout)
  // Charles gets English, everyone else gets Spanish
  useEffect(() => {
    if (user?.email === 'charliehefner@gmail.com') {
      setLanguage('en');
    } else if (user?.email) {
      // Only set to Spanish once we have a confirmed user that isn't Charles
      setLanguage('es');
    }
  }, [user?.email]);

  const toggleLanguage = () => {
    setLanguage(prev => prev === 'en' ? 'es' : 'en');
  };

  const getDescription = (item: { english_description: string; spanish_description: string }) => {
    return language === 'en' ? item.english_description : item.spanish_description;
  };

  return (
    <LanguageContext.Provider value={{ language, toggleLanguage, getDescription }}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useLanguage() {
  const context = useContext(LanguageContext);
  if (!context) {
    throw new Error('useLanguage must be used within a LanguageProvider');
  }
  return context;
}
