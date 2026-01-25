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
  
  // Default to Spanish, only Charles gets English
  const [language, setLanguage] = useState<Language>(() => {
    // Initial state - default to Spanish
    return 'es';
  });

  // Update language when user changes (login/logout)
  // Charles gets English, everyone else gets Spanish
  useEffect(() => {
    // Wait for auth to finish loading before setting language
    if (isLoading) {
      console.log('LanguageContext: Still loading auth...');
      return;
    }
    
    const email = user?.email?.toLowerCase();
    console.log('LanguageContext: Auth loaded. User email =', email);
    
    if (email === 'charliehefner@gmail.com') {
      console.log('LanguageContext: Setting English for Charles');
      setLanguage('en');
    } else {
      console.log('LanguageContext: Setting Spanish (user:', email || 'not logged in', ')');
      setLanguage('es');
    }
  }, [user, isLoading]);

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
