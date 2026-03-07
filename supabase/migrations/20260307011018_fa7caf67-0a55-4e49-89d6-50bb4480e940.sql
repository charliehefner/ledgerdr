
CREATE TABLE public.exchange_rates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  rate_date date NOT NULL,
  currency_pair varchar(7) NOT NULL DEFAULT 'USD/DOP',
  buy_rate numeric NOT NULL,
  sell_rate numeric NOT NULL,
  source varchar(50) NOT NULL DEFAULT 'BCRD',
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(rate_date, currency_pair)
);

ALTER TABLE public.exchange_rates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read exchange rates"
ON public.exchange_rates FOR SELECT TO authenticated
USING (true);

CREATE POLICY "Service role can insert exchange rates"
ON public.exchange_rates FOR INSERT TO authenticated
WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE INDEX idx_exchange_rates_date ON public.exchange_rates(rate_date DESC);
