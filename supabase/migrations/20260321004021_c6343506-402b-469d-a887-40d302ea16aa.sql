
-- Enable RLS on all five tables
ALTER TABLE public.chart_of_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.accounting_periods ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.journals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.journal_lines ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fixed_assets ENABLE ROW LEVEL SECURITY;

-- chart_of_accounts policies
CREATE POLICY "Admin full access" ON public.chart_of_accounts FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Management full access" ON public.chart_of_accounts FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'management')) WITH CHECK (public.has_role(auth.uid(), 'management'));
CREATE POLICY "Accountant full access" ON public.chart_of_accounts FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'accountant')) WITH CHECK (public.has_role(auth.uid(), 'accountant'));
CREATE POLICY "Viewer can view" ON public.chart_of_accounts FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'viewer'));

-- accounting_periods policies
CREATE POLICY "Admin full access" ON public.accounting_periods FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Management full access" ON public.accounting_periods FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'management')) WITH CHECK (public.has_role(auth.uid(), 'management'));
CREATE POLICY "Accountant full access" ON public.accounting_periods FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'accountant')) WITH CHECK (public.has_role(auth.uid(), 'accountant'));
CREATE POLICY "Viewer can view" ON public.accounting_periods FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'viewer'));

-- journals policies
CREATE POLICY "Admin full access" ON public.journals FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Management full access" ON public.journals FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'management')) WITH CHECK (public.has_role(auth.uid(), 'management'));
CREATE POLICY "Accountant full access" ON public.journals FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'accountant')) WITH CHECK (public.has_role(auth.uid(), 'accountant'));
CREATE POLICY "Viewer can view" ON public.journals FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'viewer'));

-- journal_lines policies
CREATE POLICY "Admin full access" ON public.journal_lines FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Management full access" ON public.journal_lines FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'management')) WITH CHECK (public.has_role(auth.uid(), 'management'));
CREATE POLICY "Accountant full access" ON public.journal_lines FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'accountant')) WITH CHECK (public.has_role(auth.uid(), 'accountant'));
CREATE POLICY "Viewer can view" ON public.journal_lines FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'viewer'));

-- fixed_assets policies
CREATE POLICY "Admin full access" ON public.fixed_assets FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Management full access" ON public.fixed_assets FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'management')) WITH CHECK (public.has_role(auth.uid(), 'management'));
CREATE POLICY "Accountant full access" ON public.fixed_assets FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'accountant')) WITH CHECK (public.has_role(auth.uid(), 'accountant'));
CREATE POLICY "Viewer can view" ON public.fixed_assets FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'viewer'));
