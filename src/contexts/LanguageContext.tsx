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
    "common.save": "Guardar",
    "common.cancel": "Cancelar",
    "common.delete": "Eliminar",
    "common.edit": "Editar",
    "common.add": "Agregar",
    "common.close": "Cerrar",
    "common.loading": "Cargando...",
    "common.noData": "Sin datos",
    "common.viewAll": "Ver Todo",
    "common.export": "Exportar",
    "common.actions": "Acciones",
    "common.date": "Fecha",
    "common.amount": "Monto",
    "common.description": "Descripción",
    "common.status": "Estado",
    "common.name": "Nombre",
    "common.type": "Tipo",
    "common.notes": "Notas",
    "common.total": "Total",
    "common.active": "Activo",
    "common.inactive": "Inactivo",
    "common.all": "Todos",

    // Page titles and subtitles
    "page.dashboard.title": "Panel",
    "page.dashboard.subtitle": "Resumen de sus facturas de gastos",
    "page.transactions.title": "Transacciones",
    "page.transactions.subtitle": "Gestionar gastos e ingresos",
    "page.reports.title": "Reportes",
    "page.reports.subtitle": "Análisis de transacciones y exportaciones",
    "page.hr.title": "Recursos Humanos",
    "page.hr.subtitle": "Gestionar nómina y registros de empleados",
    "page.inventory.title": "Inventario",
    "page.inventory.subtitle": "Gestionar insumos agrícolas y suministros",
    "page.fuel.title": "Gestión de Combustible",
    "page.fuel.subtitle": "Seguimiento de tanques y consumo",
    "page.equipment.title": "Equipos",
    "page.equipment.subtitle": "Gestionar tractores e implementos",
    "page.operations.title": "Operaciones",
    "page.operations.subtitle": "Seguimiento de operaciones de campo",
    "page.rainfall.title": "Pluviometría",
    "page.rainfall.subtitle": "Registro de precipitación por ubicación",
    "page.settings.title": "Configuración",
    "page.settings.subtitle": "Configure su aplicación",

    // HR Module
    "hr.payroll": "Nómina",
    "hr.dayLabor": "Jornales",
    "hr.timesheet": "Hoja de Tiempo",
    "hr.employees": "Directorio de Empleados",
    "hr.addEmployee": "Agregar Empleado",
    "hr.editEmployee": "Editar Empleado",
    "hr.summary": "Resumen y Cierre",

    // Inventory Module
    "inventory.addItem": "Agregar Artículo",
    "inventory.recordPurchase": "Registrar Compra",
    "inventory.currentStock": "Inventario Actual",
    "inventory.purchases": "Compras",

    // Fuel Module
    "fuel.agriculture": "Agricultura",
    "fuel.industry": "Industria",
    "fuel.tanks": "Tanques",
    "fuel.dispense": "Despachar",
    "fuel.refill": "Recargar",
    "fuel.history": "Historial",

    // Equipment Module
    "equipment.tractors": "Tractores",
    "equipment.implements": "Implementos",
    "equipment.addTractor": "Agregar Tractor",
    "equipment.editTractor": "Editar Tractor",
    "equipment.addNewTractor": "Agregar Nuevo Tractor",
    "equipment.addImplement": "Agregar Implemento",
    "equipment.editImplement": "Editar Implemento",
    "equipment.addNewImplement": "Agregar Nuevo Implemento",
    "equipment.tractorName": "Nombre del Tractor",
    "equipment.implementName": "Nombre del Implemento",
    "equipment.loadingTractors": "Cargando tractores...",
    "equipment.loadingImplements": "Cargando implementos...",
    "equipment.noTractors": "No hay tractores agregados. Haga clic en \"Agregar Tractor\" para comenzar.",
    "equipment.noImplements": "No hay implementos agregados. Haga clic en \"Agregar Implemento\" para comenzar.",
    "equipment.tractorUpdated": "Tractor actualizado",
    "equipment.tractorAdded": "Tractor agregado",
    "equipment.implementUpdated": "Implemento actualizado",
    "equipment.implementAdded": "Implemento agregado",
    "equipment.successMessage": "ha sido {action} exitosamente.",
    "equipment.enterTractorName": "Ingrese el nombre del tractor.",
    "equipment.validationError": "Error de Validación",
    "equipment.completeRequired": "Complete todos los campos requeridos.",
    "equipment.saving": "Guardando...",
    "equipment.update": "Actualizar",

    // Equipment table columns
    "equipment.col.name": "Nombre",
    "equipment.col.brandModel": "Marca / Modelo",
    "equipment.col.serial": "# Serie",
    "equipment.col.hp": "HP",
    "equipment.col.hourMeter": "Horómetro",
    "equipment.col.purchaseDate": "Fecha Compra",
    "equipment.col.price": "Precio",
    "equipment.col.status": "Estado",
    "equipment.col.actions": "Acciones",
    "equipment.col.type": "Tipo",

    // Equipment form labels
    "equipment.form.brand": "Marca",
    "equipment.form.model": "Modelo",
    "equipment.form.serialNumber": "Número de Serie",
    "equipment.form.hp": "Caballos de Fuerza (HP)",
    "equipment.form.hourMeter": "Horómetro Actual",
    "equipment.form.purchaseDate": "Fecha de Compra",
    "equipment.form.purchasePrice": "Precio de Compra ($)",
    "equipment.form.type": "Tipo",

    // Operations Module
    "operations.log": "Registro de Operaciones",
    "operations.fieldProgress": "Progreso de Campos",
    "operations.inputUsage": "Uso de Insumos",
    "operations.fieldInputs": "Insumos por Campo",
    "operations.farmsFields": "Fincas y Campos",
    "operations.operationTypes": "Tipos de Operación",

    // Dashboard specific
    "dashboard.pendingNcf": "Transacciones Pendientes de NCF",
    "dashboard.pendingNcfSubtitle": "Falta número de comprobante fiscal",
    "dashboard.noAttachment": "Transacciones Sin Adjunto",
    "dashboard.noAttachmentSubtitle": "Pendiente de subir recibo/imagen",
    "dashboard.allDocsAttached": "Todas las transacciones tienen documentos adjuntos",
    "dashboard.allAttached": "Todas las transacciones tienen adjuntos subidos",

    // Reports specific
    "reports.purchaseTotals": "Totales de Compra por Cuenta y CBS",
    "reports.transactions": "Transacciones",
    "reports.searchPlaceholder": "Buscar por descripción, nombre, cuenta o documento...",
    "reports.allAccounts": "Todas las Cuentas",
    "reports.exportExcel": "Exportar a Excel",
    "reports.exportPdf": "Exportar a PDF",

    // Table columns
    "col.id": "ID",
    "col.date": "Fecha",
    "col.account": "Cuenta",
    "col.project": "Proyecto",
    "col.cbsCode": "Código CBS",
    "col.purchaseDate": "Fecha Compra",
    "col.currency": "Moneda",
    "col.itbis": "ITBIS",
    "col.payMethod": "Método Pago",
    "col.document": "Documento",
    "col.comments": "Comentarios",
    "col.exchangeRate": "Tasa Cambio",
    "col.attachment": "Adjunto",
    "col.internal": "Interno",

    // Settings
    "settings.readOnlyAccess": "Acceso Solo Lectura",
    "settings.readOnlyMessage": "Puede ver la configuración pero no puede hacer cambios estructurales.",
    "settings.database": "Conexión de Base de Datos",
    "settings.databaseSubtitle": "Conectar a su base de datos PostgreSQL",
    "settings.preferences": "Preferencias",
    "settings.preferencesSubtitle": "Personalice su experiencia",
    "settings.notifications": "Notificaciones",
    "settings.notificationsSubtitle": "Administre sus preferencias de notificación",
    "settings.defaultCurrency": "Moneda Predeterminada",
    "settings.dateFormat": "Formato de Fecha",
    "settings.taxRate": "Tasa de Impuesto Predeterminada (%)",
    "settings.testConnection": "Probar Conexión",
    "settings.saveSettings": "Guardar Configuración",
    "settings.dueAlerts": "Alertas de Vencimiento",
    "settings.dueAlertsDesc": "Reciba notificaciones cuando las facturas se venzan",
    "settings.paymentReminders": "Recordatorios de Pago",
    "settings.paymentRemindersDesc": "Recordar sobre fechas de vencimiento próximas",
    "settings.weeklySummary": "Resumen Semanal",
    "settings.weeklySummaryDesc": "Recibir un resumen semanal de gastos por correo",
    "settings.securityNote": "Nota de Seguridad",
    "settings.securityNoteText": "Las credenciales de la base de datos se almacenan de forma segura y encriptada.",

    // Form labels
    "form.host": "Host",
    "form.port": "Puerto",
    "form.databaseName": "Nombre de Base de Datos",
    "form.username": "Usuario",
    "form.password": "Contraseña",

    // Messages
    "msg.connectionSuccess": "¡Conexión a base de datos exitosa!",
    "msg.settingsSaved": "¡Configuración guardada exitosamente!",
    "msg.noPermission": "No tiene permiso para modificar la configuración",
    "msg.testingConnection": "Probando conexión a base de datos...",
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
    "common.save": "Save",
    "common.cancel": "Cancel",
    "common.delete": "Delete",
    "common.edit": "Edit",
    "common.add": "Add",
    "common.close": "Close",
    "common.loading": "Loading...",
    "common.noData": "No data",
    "common.viewAll": "View All",
    "common.export": "Export",
    "common.actions": "Actions",
    "common.date": "Date",
    "common.amount": "Amount",
    "common.description": "Description",
    "common.status": "Status",
    "common.name": "Name",
    "common.type": "Type",
    "common.notes": "Notes",
    "common.total": "Total",
    "common.active": "Active",
    "common.inactive": "Inactive",
    "common.all": "All",

    // Page titles and subtitles
    "page.dashboard.title": "Dashboard",
    "page.dashboard.subtitle": "Summary of your expense invoices",
    "page.transactions.title": "Transactions",
    "page.transactions.subtitle": "Manage expenses and income",
    "page.reports.title": "Reports",
    "page.reports.subtitle": "Transaction analytics and exports",
    "page.hr.title": "Human Resources",
    "page.hr.subtitle": "Manage payroll and employee records",
    "page.inventory.title": "Inventory",
    "page.inventory.subtitle": "Manage agricultural inputs and supplies",
    "page.fuel.title": "Fuel Management",
    "page.fuel.subtitle": "Track fuel tanks and consumption",
    "page.equipment.title": "Equipment",
    "page.equipment.subtitle": "Manage tractors and implements",
    "page.operations.title": "Operations",
    "page.operations.subtitle": "Track field operations across farms",
    "page.rainfall.title": "Rainfall",
    "page.rainfall.subtitle": "Track precipitation by location",
    "page.settings.title": "Settings",
    "page.settings.subtitle": "Configure your application",

    // HR Module
    "hr.payroll": "Payroll",
    "hr.dayLabor": "Day Labor",
    "hr.timesheet": "Timesheet",
    "hr.employees": "Employee Directory",
    "hr.addEmployee": "Add Employee",
    "hr.editEmployee": "Edit Employee",
    "hr.summary": "Summary & Close",

    // Inventory Module
    "inventory.addItem": "Add Item",
    "inventory.recordPurchase": "Record Purchase",
    "inventory.currentStock": "Current Stock",
    "inventory.purchases": "Purchases",

    // Fuel Module
    "fuel.agriculture": "Agriculture",
    "fuel.industry": "Industry",
    "fuel.tanks": "Tanks",
    "fuel.dispense": "Dispense",
    "fuel.refill": "Refill",
    "fuel.history": "History",

    // Equipment Module
    "equipment.tractors": "Tractors",
    "equipment.implements": "Implements",
    "equipment.addTractor": "Add Tractor",
    "equipment.editTractor": "Edit Tractor",
    "equipment.addNewTractor": "Add New Tractor",
    "equipment.addImplement": "Add Implement",
    "equipment.editImplement": "Edit Implement",
    "equipment.addNewImplement": "Add New Implement",
    "equipment.tractorName": "Tractor Name",
    "equipment.implementName": "Implement Name",
    "equipment.loadingTractors": "Loading tractors...",
    "equipment.loadingImplements": "Loading implements...",
    "equipment.noTractors": "No tractors added. Click \"Add Tractor\" to begin.",
    "equipment.noImplements": "No implements added. Click \"Add Implement\" to begin.",
    "equipment.tractorUpdated": "Tractor updated",
    "equipment.tractorAdded": "Tractor added",
    "equipment.implementUpdated": "Implement updated",
    "equipment.implementAdded": "Implement added",
    "equipment.successMessage": "has been {action} successfully.",
    "equipment.enterTractorName": "Enter the tractor name.",
    "equipment.validationError": "Validation Error",
    "equipment.completeRequired": "Complete all required fields.",
    "equipment.saving": "Saving...",
    "equipment.update": "Update",

    // Equipment table columns
    "equipment.col.name": "Name",
    "equipment.col.brandModel": "Brand / Model",
    "equipment.col.serial": "Serial #",
    "equipment.col.hp": "HP",
    "equipment.col.hourMeter": "Hour Meter",
    "equipment.col.purchaseDate": "Purchase Date",
    "equipment.col.price": "Price",
    "equipment.col.status": "Status",
    "equipment.col.actions": "Actions",
    "equipment.col.type": "Type",

    // Equipment form labels
    "equipment.form.brand": "Brand",
    "equipment.form.model": "Model",
    "equipment.form.serialNumber": "Serial Number",
    "equipment.form.hp": "Horsepower (HP)",
    "equipment.form.hourMeter": "Current Hour Meter",
    "equipment.form.purchaseDate": "Purchase Date",
    "equipment.form.purchasePrice": "Purchase Price ($)",
    "equipment.form.type": "Type",

    // Operations Module
    "operations.log": "Operations Log",
    "operations.fieldProgress": "Field Progress",
    "operations.inputUsage": "Input Usage",
    "operations.fieldInputs": "Inputs by Field",
    "operations.farmsFields": "Farms & Fields",
    "operations.operationTypes": "Operation Types",

    // Dashboard specific
    "dashboard.pendingNcf": "Transactions Pending NCF",
    "dashboard.pendingNcfSubtitle": "Missing fiscal receipt number",
    "dashboard.noAttachment": "Transactions Without Attachment",
    "dashboard.noAttachmentSubtitle": "Pending receipt/image upload",
    "dashboard.allDocsAttached": "All transactions have documents attached",
    "dashboard.allAttached": "All transactions have attachments uploaded",

    // Reports specific
    "reports.purchaseTotals": "Purchase Totals by Account & CBS",
    "reports.transactions": "Transactions",
    "reports.searchPlaceholder": "Search by description, name, account or document...",
    "reports.allAccounts": "All Accounts",
    "reports.exportExcel": "Export to Excel",
    "reports.exportPdf": "Export to PDF",

    // Table columns
    "col.id": "ID",
    "col.date": "Date",
    "col.account": "Account",
    "col.project": "Project",
    "col.cbsCode": "CBS Code",
    "col.purchaseDate": "Purchase Date",
    "col.currency": "Currency",
    "col.itbis": "ITBIS",
    "col.payMethod": "Pay Method",
    "col.document": "Document",
    "col.comments": "Comments",
    "col.exchangeRate": "Exchange Rate",
    "col.attachment": "Attachment",
    "col.internal": "Internal",

    // Settings
    "settings.readOnlyAccess": "Read-Only Access",
    "settings.readOnlyMessage": "You can view settings but cannot make structural changes.",
    "settings.database": "Database Connection",
    "settings.databaseSubtitle": "Connect to your PostgreSQL database",
    "settings.preferences": "Preferences",
    "settings.preferencesSubtitle": "Customize your experience",
    "settings.notifications": "Notifications",
    "settings.notificationsSubtitle": "Manage your notification preferences",
    "settings.defaultCurrency": "Default Currency",
    "settings.dateFormat": "Date Format",
    "settings.taxRate": "Default Tax Rate (%)",
    "settings.testConnection": "Test Connection",
    "settings.saveSettings": "Save Settings",
    "settings.dueAlerts": "Due Date Alerts",
    "settings.dueAlertsDesc": "Receive notifications when invoices are due",
    "settings.paymentReminders": "Payment Reminders",
    "settings.paymentRemindersDesc": "Remind about upcoming due dates",
    "settings.weeklySummary": "Weekly Summary",
    "settings.weeklySummaryDesc": "Receive a weekly expense summary by email",
    "settings.securityNote": "Security Note",
    "settings.securityNoteText": "Database credentials are stored securely and encrypted.",

    // Form labels
    "form.host": "Host",
    "form.port": "Port",
    "form.databaseName": "Database Name",
    "form.username": "Username",
    "form.password": "Password",

    // Messages
    "msg.connectionSuccess": "Database connection successful!",
    "msg.settingsSaved": "Settings saved successfully!",
    "msg.noPermission": "You do not have permission to modify settings",
    "msg.testingConnection": "Testing database connection...",
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
