/**
 * Role-Based Access Control Configuration
 * 
 * This file defines which sections each role can access.
 * Changes to permissions require code updates and redeployment.
 * 
 * Roles:
 * - admin: Full access to everything
 * - management: Full access except Settings
 * - accountant: Financial sections + HR
 * - supervisor: Field operations sections only
 * - office: Inputs transactions and most operational data; read-only on accounting/treasury (except petty cash writes)
 * - viewer: Read-only access (limited sections)
 * - driver: Mobile fuel portal
 */

export type UserRole = "admin" | "management" | "accountant" | "supervisor" | "office" | "viewer" | "driver";

export type Section = 
  | "dashboard"
  | "transactions"
  | "invoices"
  | "reports"
  | "analytics"
  | "hr"
  | "inventory"
  | "fuel"
  | "equipment"
  | "operations"
  | "herbicide"
  | "rainfall"
  | "cronograma"
  | "alerts"
  | "settings"
  | "accounting"
  | "ap-ar"
  | "budget"
  | "treasury"
  | "contacts"
  | "industrial"
  | "driver-portal"
  | "approvals";

// HR sub-tabs for granular access control
export type HrTab = "payroll" | "day-labor" | "jornaleros" | "employees" | "add-employee" | "servicios" | "prestadores" | "tss";

// Which HR tabs each role can access
const hrTabPermissions: Record<HrTab, UserRole[]> = {
  payroll: ["admin", "management", "accountant", "office"],
  "day-labor": ["admin", "management", "accountant", "supervisor", "office"],
  servicios: ["admin", "management", "accountant", "supervisor", "office"],
  jornaleros: ["admin", "management", "accountant", "supervisor", "office"],
  prestadores: ["admin", "management", "accountant", "supervisor", "office"],
  employees: ["admin", "management", "accountant", "office"],
  "add-employee": ["admin", "management"],
  tss: ["admin", "management", "accountant"],
};

// Which HR tabs each role can write to (add/edit/delete)
const hrTabWritePermissions: Record<HrTab, UserRole[]> = {
  payroll: ["admin", "management", "accountant", "office"],
  "day-labor": ["admin", "management", "accountant", "supervisor", "office"],
  servicios: ["admin", "management", "accountant", "supervisor", "office"],
  jornaleros: ["admin", "management", "accountant", "supervisor", "office"],
  prestadores: ["admin", "management", "accountant", "supervisor", "office"],
  employees: ["admin", "management", "accountant", "office"],
  "add-employee": ["admin", "management"],
  tss: ["admin", "management", "accountant"],
};

/**
 * Check if a role can access a specific HR tab
 */
export function canAccessHrTab(role: UserRole | undefined, tab: HrTab): boolean {
  if (!role) return false;
  return hrTabPermissions[tab]?.includes(role) ?? false;
}

/**
 * Check if a role can write to a specific HR tab
 */
export function canWriteHrTab(role: UserRole | undefined, tab: HrTab): boolean {
  if (!role) return false;
  return hrTabWritePermissions[tab]?.includes(role) ?? false;
}

/**
 * Get the default HR tab for a role
 */
export function getDefaultHrTabForRole(role: UserRole): HrTab {
  if (role === "supervisor") return "day-labor";
  if (role === "office") return "day-labor";
  return "payroll";
}

// Maps routes to sections
export const routeToSection: Record<string, Section> = {
  "/": "dashboard",
  "/transactions": "transactions",
  "/invoices": "invoices",
  "/reports": "reports",
  "/hr": "hr",
  "/inventory": "inventory",
  "/fuel": "fuel",
  "/equipment": "equipment",
  "/operations": "operations",
  "/herbicide": "herbicide",
  "/rainfall": "rainfall",
  "/cronograma": "cronograma",
  "/alerts": "alerts",
  "/settings": "settings",
  "/accounting": "accounting",
  "/accounts": "ap-ar",
  "/budget": "budget",
  "/treasury": "treasury",
  "/contacts": "contacts",
  "/industrial": "industrial",
  "/driver-portal": "driver-portal",
  "/analytics": "analytics",
  "/approvals": "approvals",
};

// Permission matrix: which roles can access which sections
const sectionPermissions: Record<Section, UserRole[]> = {
  dashboard: ["admin", "management", "accountant", "viewer"],
  transactions: ["admin", "management", "accountant", "office", "viewer"], // supervisor intentionally excluded
  invoices: ["admin", "management", "accountant", "viewer"],
  reports: ["admin", "management", "accountant", "viewer"],
  analytics: ["admin", "management", "accountant", "viewer"],
  hr: ["admin", "management", "accountant", "supervisor", "office"],
  inventory: ["admin", "management", "supervisor", "office", "viewer"],
  fuel: ["admin", "management", "supervisor", "office", "viewer"],
  equipment: ["admin", "management", "supervisor", "office", "viewer"],
  operations: ["admin", "management", "supervisor", "office", "viewer"],
  herbicide: ["admin", "management", "supervisor", "office", "viewer"],
  rainfall: ["admin", "management", "supervisor", "office", "viewer"],
  cronograma: ["admin", "management", "supervisor", "office", "viewer"],
  alerts: ["admin", "management", "supervisor", "office"],
  settings: ["admin"],
  accounting: ["admin", "management", "accountant", "viewer"],
  "ap-ar": ["admin", "management", "accountant"],
  budget: ["admin"],
  treasury: ["admin", "management", "accountant", "office"],
  contacts: ["admin", "management", "accountant", "office", "viewer"],
  industrial: ["admin", "supervisor", "office"],
  "driver-portal": ["driver"],
  approvals: ["admin", "management"],
};

// Roles that have write access (can modify data) for each section
// Viewer role is read-only for all sections they can access
// Driver role can only write to driver-portal (fuel transactions)
// Office: writes to operational sections; read-only on accounting/treasury (petty cash writes
// happen via transactions and are handled separately by canWritePettyCash)
const writePermissions: Record<Section, UserRole[]> = {
  dashboard: ["admin", "management", "accountant"],
  transactions: ["admin", "management", "accountant", "office"],
  invoices: ["admin", "management", "accountant"],
  reports: ["admin", "management", "accountant"],
  analytics: ["admin", "management", "accountant"],
  hr: ["admin", "management", "accountant", "office"],
  inventory: ["admin", "management", "supervisor", "office"],
  fuel: ["admin", "management", "supervisor", "office"],
  equipment: ["admin", "management", "supervisor", "office"],
  operations: ["admin", "management", "supervisor", "office"],
  herbicide: ["admin", "management", "supervisor", "office"],
  rainfall: ["admin", "management", "supervisor", "office"],
  cronograma: ["admin", "management", "supervisor", "office"],
  alerts: ["admin", "management", "supervisor"],
  settings: ["admin"],
  accounting: ["admin", "management", "accountant"],
  "ap-ar": ["admin", "management", "accountant"],
  budget: ["admin"],
  treasury: ["admin", "management", "accountant"], // office is read-only here; petty cash gated separately
  contacts: ["admin", "management", "accountant", "office"],
  industrial: ["admin", "supervisor", "office"],
  "driver-portal": ["driver"],
  approvals: ["admin", "management"],
};

/**
 * Check if a role can access a specific section
 */
export function canAccessSection(role: UserRole | undefined, section: Section): boolean {
  if (!role) return false;
  return sectionPermissions[section]?.includes(role) ?? false;
}

/**
 * Check if a role can write/modify data in a section
 */
export function canWriteSection(role: UserRole | undefined, section: Section): boolean {
  if (!role) return false;
  return writePermissions[section]?.includes(role) ?? false;
}

/**
 * Petty cash is the only Treasury area Office can write to.
 * Petty cash movements are recorded as transactions; fund setup remains admin-only.
 */
export function canWritePettyCash(role: UserRole | undefined): boolean {
  if (!role) return false;
  return ["admin", "management", "accountant", "office"].includes(role);
}

/**
 * Petty cash fund setup (creating/editing the fund itself, stored in bank_accounts).
 * Office cannot create funds — only record movements against existing ones.
 */
export function canManagePettyCashFunds(role: UserRole | undefined): boolean {
  if (!role) return false;
  return ["admin", "management", "accountant"].includes(role);
}

/**
 * Check if a role can access a specific route
 */
export function canAccessRoute(role: UserRole | undefined, route: string): boolean {
  // Find matching route pattern
  const exactMatch = routeToSection[route];
  if (exactMatch) {
    return canAccessSection(role, exactMatch);
  }
  
  // Check if route starts with any known pattern
  for (const [routePattern, section] of Object.entries(routeToSection)) {
    if (routePattern !== "/" && route.startsWith(routePattern)) {
      return canAccessSection(role, section);
    }
  }
  
  // Default: allow access to unknown routes (like /login, /reset-password)
  return true;
}

/**
 * Get the default route for a role (where to redirect after login)
 */
export function getDefaultRouteForRole(role: UserRole): string {
  switch (role) {
    case "supervisor":
      return "/operations"; // Supervisors don't have dashboard access
    case "office":
      return "/transactions"; // Office primarily inputs transactions
    case "driver":
      return "/driver-portal"; // Drivers can only access driver portal
    default:
      return "/";
  }
}

/**
 * Get all sections a role can access
 */
export function getAccessibleSections(role: UserRole): Section[] {
  return Object.entries(sectionPermissions)
    .filter(([_, roles]) => roles.includes(role))
    .map(([section]) => section as Section);
}

/**
 * Role display names in Spanish
 */
export const roleDisplayNames: Record<UserRole, string> = {
  admin: "Administrador",
  management: "Gerencia",
  accountant: "Contador",
  supervisor: "Supervisor",
  office: "Oficina",
  viewer: "Visor",
  driver: "Conductor",
};

/**
 * Role descriptions for UI
 */
export const roleDescriptions: Record<UserRole, string> = {
  admin: "Acceso total a todas las secciones y configuración",
  management: "Acceso total excepto configuración del sistema",
  accountant: "Transacciones, facturas, reportes y recursos humanos",
  supervisor: "Inventario, combustible, equipos y operaciones",
  office: "Hoja de tiempo de nómina, transacciones, operaciones, directorio de empleados (cartas, vacaciones, documentos) y caja chica",
  viewer: "Solo lectura en secciones asignadas",
  driver: "Portal de combustible móvil para conductores",
};
