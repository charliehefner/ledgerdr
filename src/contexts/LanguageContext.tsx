import React, { createContext, useContext, useState, useMemo, ReactNode } from 'react';
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
  const [manualOverride, setManualOverride] = useState<Language | null>(null);
  
  // Derive language directly from user - no useEffect timing issues
  const language = useMemo<Language>(() => {
    // If user manually toggled, respect that
    if (manualOverride !== null) {
      return manualOverride;
    }
    
    // While loading, default to Spanish
    if (isLoading) {
      return 'es';
    }
    
    // Charles gets English, everyone else gets Spanish
    const email = user?.email?.toLowerCase();
    const result = email === 'charliehefner@gmail.com' ? 'en' : 'es';
    
    console.log('LanguageContext: Computed language =', result, 'for user:', email || 'not logged in');
    
    return result;
  }, [user?.email, isLoading, manualOverride]);

  const toggleLanguage = () => {
    setManualOverride(prev => {
      const newLang = (prev ?? language) === 'en' ? 'es' : 'en';
      console.log('LanguageContext: Manual toggle to', newLang);
      return newLang;
    });
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
