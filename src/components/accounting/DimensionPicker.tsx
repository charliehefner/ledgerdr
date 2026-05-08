import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useLanguage } from "@/contexts/LanguageContext";

export interface DimensionDef {
  id: string;
  code: string;
  name_es: string;
  name_en: string;
  display_order: number;
}

export interface DimensionValueDef {
  id: string;
  dimension_id: string;
  code: string;
  name_es: string;
  name_en: string;
}

export function useActiveDimensions() {
  return useQuery({
    queryKey: ["accounting_dimensions_active"],
    queryFn: async () => {
      const { data: dims, error: e1 } = await supabase
        .from("accounting_dimensions" as any)
        .select("id, code, name_es, name_en, display_order")
        .eq("active", true)
        .order("display_order");
      if (e1) throw e1;
      const ids = (dims ?? []).map((d: any) => d.id);
      if (!ids.length) return { dimensions: [] as DimensionDef[], values: [] as DimensionValueDef[] };
      const { data: vals, error: e2 } = await supabase
        .from("accounting_dimension_values" as any)
        .select("id, dimension_id, code, name_es, name_en")
        .eq("active", true)
        .in("dimension_id", ids)
        .order("display_order");
      if (e2) throw e2;
      return {
        dimensions: (dims ?? []) as unknown as DimensionDef[],
        values: (vals ?? []) as unknown as DimensionValueDef[],
      };
    },
    staleTime: 60_000,
  });
}

interface Props {
  dimension: DimensionDef;
  values: DimensionValueDef[];
  selectedValueId: string | null;
  onChange: (valueId: string | null) => void;
  disabled?: boolean;
  size?: "sm" | "md";
}

export function DimensionPicker({ dimension, values, selectedValueId, onChange, disabled, size = "sm" }: Props) {
  const { language } = useLanguage();
  const dimValues = values.filter((v) => v.dimension_id === dimension.id);
  const label = (v: DimensionValueDef) => (language === "en" ? v.name_en : v.name_es);

  return (
    <Select
      value={selectedValueId ?? "__none__"}
      onValueChange={(v) => onChange(v === "__none__" ? null : v)}
      disabled={disabled}
    >
      <SelectTrigger className={size === "sm" ? "h-8 text-xs" : ""}>
        <SelectValue placeholder="—" />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="__none__">—</SelectItem>
        {dimValues.map((v) => (
          <SelectItem key={v.id} value={v.id}>{label(v)}</SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
