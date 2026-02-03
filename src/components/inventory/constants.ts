import { ColumnConfig } from "@/hooks/useColumnVisibility";

export const inventoryColumns: ColumnConfig[] = [
  { key: "commercial_name", label: "Commercial Name", defaultVisible: true },
  { key: "molecule_name", label: "Molecule Name", defaultVisible: true },
  { key: "function", label: "Function", defaultVisible: true },
  { key: "stock", label: "Stock", defaultVisible: true },
  { key: "amount_purchased", label: "Amount Purchased", defaultVisible: true },
  { key: "amount_used", label: "Amount Used", defaultVisible: false },
  { key: "suppliers", label: "Suppliers", defaultVisible: true },
  { key: "documents", label: "Documents", defaultVisible: false },
  { key: "co2_equivalent", label: "CO₂ Equivalent", defaultVisible: false },
];

export const functionLabels: Record<string, string> = {
  fertilizer: "Fertilizer",
  fuel: "Fuel",
  pre_emergent_herbicide: "Pre-emergent Herbicide",
  post_emergent_herbicide: "Post-emergent Herbicide",
  pesticide: "Pesticide",
  fungicide: "Fungicide",
  insecticide: "Insecticide",
  seed: "Seed",
  other: "Other",
  condicionador: "Condicionador",
  adherente: "Adherente",
};

export const functionColors: Record<string, string> = {
  fertilizer: "bg-green-100 text-green-800",
  fuel: "bg-amber-100 text-amber-800",
  pre_emergent_herbicide: "bg-blue-100 text-blue-800",
  post_emergent_herbicide: "bg-cyan-100 text-cyan-800",
  pesticide: "bg-red-100 text-red-800",
  fungicide: "bg-purple-100 text-purple-800",
  insecticide: "bg-orange-100 text-orange-800",
  seed: "bg-lime-100 text-lime-800",
  other: "bg-gray-100 text-gray-800",
  condicionador: "bg-teal-100 text-teal-800",
  adherente: "bg-indigo-100 text-indigo-800",
};
