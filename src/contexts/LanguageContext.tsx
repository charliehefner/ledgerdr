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
  const { user, isLoading } = useAuth();
  
  const [language, setLanguage] = useState<Language>('es');

  // Update language when user changes (login/logout)
  // Charles gets English, everyone else gets Spanish
  useEffect(() => {
    // Wait for auth to finish loading before setting language
    if (isLoading) return;
    
    console.log('LanguageContext: user email =', user?.email, 'setting language...');
    
    if (user?.email === 'charliehefner@gmail.com') {
      console.log('LanguageContext: Setting English for Charles');
      setLanguage('en');
    } else {
      console.log('LanguageContext: Setting Spanish for non-Charles user');
      setLanguage('es');
    }
  }, [user?.email, isLoading]);

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
