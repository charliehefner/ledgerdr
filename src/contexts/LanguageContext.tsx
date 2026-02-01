import { createContext, useContext, useState, useEffect, ReactNode, useMemo } from "react";

export type Language = "es" | "en";

interface LanguageContextType {
  language: Language;
  setLanguage: (lang: Language) => void;
  t: (key: string) => string;
}

const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

const STORAGE_KEY = "jord-language";

// Translation strings
const translations: Record<Language, Record<string, string>> = {
  es: {
    // Sidebar navigation
    "nav.dashboard": "Panel",
    "nav.transactions": "Transacciones",
    "nav.reports": "Reportes",
    "nav.hr": "Recursos Humanos",
    "nav.inventory": "Inventario",
    "nav.fuel": "Combustible",
    "nav.equipment": "Equipos",
    "nav.operations": "Operaciones",
    "nav.rainfall": "Pluviometría",
    "nav.settings": "Configuración",
    
    // Sidebar sections
    "sidebar.menu": "Menú",
    "sidebar.system": "Sistema",
    "sidebar.language": "Idioma",
    "sidebar.logout": "Cerrar sesión",
    
    // Common labels
    "common.user": "Usuario",
    "common.notifications": "Notificaciones",
    "common.search": "Buscar",
  },
  en: {
    // Sidebar navigation
    "nav.dashboard": "Dashboard",
    "nav.transactions": "Transactions",
    "nav.reports": "Reports",
    "nav.hr": "Human Resources",
    "nav.inventory": "Inventory",
    "nav.fuel": "Fuel",
    "nav.equipment": "Equipment",
    "nav.operations": "Operations",
    "nav.rainfall": "Rainfall",
    "nav.settings": "Settings",
    
    // Sidebar sections
    "sidebar.menu": "Menu",
    "sidebar.system": "System",
    "sidebar.language": "Language",
    "sidebar.logout": "Log out",
    
    // Common labels
    "common.user": "User",
    "common.notifications": "Notifications",
    "common.search": "Search",
  },
};

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [language, setLanguageState] = useState<Language>(() => {
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved === "en" || saved === "es") return saved;
    }
    return "es"; // Default to Spanish
  });

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, language);
  }, [language]);

  const setLanguage = (lang: Language) => {
    setLanguageState(lang);
  };

  const t = useMemo(() => {
    return (key: string): string => {
      return translations[language][key] || key;
    };
  }, [language]);

  const value = useMemo(
    () => ({ language, setLanguage, t }),
    [language, t]
  );

  return (
    <LanguageContext.Provider value={value}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useLanguage() {
  const context = useContext(LanguageContext);
  if (context === undefined) {
    throw new Error("useLanguage must be used within a LanguageProvider");
  }
  return context;
}
