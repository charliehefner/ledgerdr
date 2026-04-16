import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export function useExchangeRate(date: string) {
  const { data: rate, isLoading } = useQuery({
    queryKey: ["exchange-rate", date],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("exchange_rates")
        .select("sell_rate")
        .eq("currency_pair", "USD/DOP")
        .lte("rate_date", date)
        .order("rate_date", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (error) {
        console.error("Error fetching exchange rate:", error);
        return null;
      }
      return data?.sell_rate ?? null;
    },
    staleTime: 1000 * 60 * 30, // 30 min
  });

  return { rate: rate ?? null, isLoading };
}
