import { ColumnConfig } from "@/hooks/useColumnVisibility";

export const operationsColumns: ColumnConfig[] = [
  { key: "date", label: "Fecha", defaultVisible: true },
  { key: "field", label: "Campo", defaultVisible: true },
  { key: "farm", label: "Finca", defaultVisible: true },
  { key: "operation", label: "Operación", defaultVisible: true },
  { key: "tractor", label: "Tractor/Obreros", defaultVisible: true },
  { key: "driver", label: "Operador", defaultVisible: true },
  { key: "implement", label: "Implemento", defaultVisible: true },
  { key: "hours", label: "Horas", defaultVisible: true },
  { key: "hectares", label: "Hectáreas", defaultVisible: true },
  { key: "inputs", label: "Insumos", defaultVisible: true },
  { key: "notes", label: "Notas", defaultVisible: false },
];
