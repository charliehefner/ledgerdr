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
 * - viewer: Read-only access (limited sections)
 */

export type UserRole = "admin" | "management" | "accountant" | "supervisor" | "viewer" | "driver";

export type Section = 
  | "dashboard"
  | "transactions"
  | "invoices"
  | "reports"
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
  | "driver-portal";

// HR sub-tabs for granular access control
export type HrTab = "payroll" | "day-labor" | "jornaleros" | "employees" | "add-employee" | "servicios" | "prestadores" | "tss";

// Which HR tabs each role can access
const hrTabPermissions: Record<HrTab, UserRole[]> = {
  payroll: ["admin", "management", "accountant"],
  "day-labor": ["admin", "management", "accountant", "supervisor"],
  servicios: ["admin", "management", "accountant", "supervisor"],
  jornaleros: ["admin", "management", "accountant", "supervisor"],
  prestadores: ["admin", "management", "accountant", "supervisor"],
  employees: ["admin", "management", "accountant"],
  "add-employee": ["admin", "management"],
  tss: ["admin", "management", "accountant"],
};

// Which HR tabs each role can write to (add/edit/delete)
const hrTabWritePermissions: Record<HrTab, UserRole[]> = {
  payroll: ["admin", "management", "accountant"],
  "day-labor": ["admin", "management", "accountant", "supervisor"],
  servicios: ["admin", "management", "accountant", "supervisor"],
  jornaleros: ["admin", "management", "accountant", "supervisor"],
  prestadores: ["admin", "management", "accountant", "supervisor"],
  employees: ["admin", "management", "accountant"],
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
  "/driver-portal": "driver-portal",
};

// Permission matrix: which roles can access which sections
const sectionPermissions: Record<Section, UserRole[]> = {
  dashboard: ["admin", "management", "accountant", "viewer"],
  transactions: ["admin", "management", "accountant", "viewer"],
  invoices: ["admin", "management", "accountant", "viewer"],
  reports: ["admin", "management", "accountant", "viewer"],
  hr: ["admin", "management", "accountant", "supervisor"],
  inventory: ["admin", "management", "supervisor", "viewer"],
  fuel: ["admin", "management", "supervisor", "viewer"],
  equipment: ["admin", "management", "supervisor", "viewer"],
  operations: ["admin", "management", "supervisor", "viewer"],
  herbicide: ["admin", "management", "supervisor", "viewer"],
  rainfall: ["admin", "management", "supervisor", "viewer"],
  cronograma: ["admin", "management", "supervisor", "viewer"],
  alerts: ["admin", "management", "supervisor"],
  settings: ["admin"],
  accounting: ["admin", "management", "accountant", "viewer"],
  "ap-ar": ["admin", "management", "accountant"],
  budget: ["admin", "management", "accountant"],
  "driver-portal": ["driver"],
};

// Roles that have write access (can modify data) for each section
// Viewer role is read-only for all sections they can access
// Driver role can only write to driver-portal (fuel transactions)
const writePermissions: Record<Section, UserRole[]> = {
  dashboard: ["admin", "management", "accountant"],
  transactions: ["admin", "management", "accountant"],
  invoices: ["admin", "management", "accountant"],
  reports: ["admin", "management", "accountant"],
  hr: ["admin", "management", "accountant"],
  inventory: ["admin", "management", "supervisor"],
  fuel: ["admin", "management", "supervisor"],
  equipment: ["admin", "management", "supervisor"],
  operations: ["admin", "management", "supervisor"],
  herbicide: ["admin", "management", "supervisor"],
  rainfall: ["admin", "management", "supervisor"],
  cronograma: ["admin", "management", "supervisor"],
  alerts: ["admin", "management", "supervisor"],
  settings: ["admin"],
  accounting: ["admin", "management", "accountant"],
  "ap-ar": ["admin", "management", "accountant"],
  budget: ["admin", "management", "accountant"],
  "driver-portal": ["driver"],
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
  viewer: "Solo lectura en secciones asignadas",
  driver: "Portal de combustible móvil para conductores",
};
