export interface SelectedField {
  fieldId: string;
  fieldName: string;
  farmName: string;
  totalHectares: number;
  hectaresToApply: number;
}

export interface SelectedProduct {
  itemId: string;
  commercialName: string;
  dosePerHa: number;
  currentStock: number;
  useUnit: string;
}

export interface TankMixture {
  tankNumber: number;
  tankVolume: number;
  isPartial: boolean;
  products: {
    productName: string;
    amount: number;
    unit: string;
  }[];
}

export interface FieldApplication {
  fieldName: string;
  hectares: number;
  products: {
    productName: string;
    amount: number;
    unit: string;
  }[];
}

export interface ProductTotal {
  productName: string;
  totalAmount: number;
  unit: string;
  currentStock: number;
  shortfall: number;
}

export interface CalculationResult {
  totalHectares: number;
  tankCount: number;
  tankMixtures: TankMixture[];
  productTotals: ProductTotal[];
  fieldApplications: FieldApplication[];
}
