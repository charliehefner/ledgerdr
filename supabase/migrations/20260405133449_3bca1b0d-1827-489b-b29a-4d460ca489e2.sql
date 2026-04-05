
-- 1. Entity Groups table
CREATE TABLE public.entity_groups (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  code TEXT NOT NULL UNIQUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.entity_groups ENABLE ROW LEVEL SECURITY;

-- 2. Add entity_group_id to entities
ALTER TABLE public.entities
  ADD COLUMN entity_group_id UUID REFERENCES public.entity_groups(id) DEFAULT NULL;
CREATE INDEX idx_entities_entity_group_id ON public.entities(entity_group_id);

-- 3. Add is_shared to bank_accounts
ALTER TABLE public.bank_accounts
  ADD COLUMN is_shared BOOLEAN NOT NULL DEFAULT false;

-- 4. Add entity_group_id to user_roles
ALTER TABLE public.user_roles
  ADD COLUMN entity_group_id UUID REFERENCES public.entity_groups(id) DEFAULT NULL;
ALTER TABLE public.user_roles
  ADD CONSTRAINT chk_role_scope CHECK (
    (entity_id IS NULL AND entity_group_id IS NULL)
    OR (entity_id IS NOT NULL AND entity_group_id IS NULL)
    OR (entity_id IS NULL AND entity_group_id IS NOT NULL)
  );
CREATE INDEX idx_user_roles_entity_group_id ON public.user_roles(entity_group_id);

-- 5. Intercompany Transactions table
CREATE TABLE public.intercompany_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id UUID NOT NULL REFERENCES public.entity_groups(id),
  source_entity_id UUID NOT NULL REFERENCES public.entities(id),
  target_entity_id UUID NOT NULL REFERENCES public.entities(id),
  journal_id_source UUID REFERENCES public.journals(id),
  journal_id_target UUID REFERENCES public.journals(id),
  amount NUMERIC NOT NULL,
  currency VARCHAR(3) NOT NULL DEFAULT 'DOP',
  description TEXT,
  transaction_date DATE NOT NULL,
  is_settled BOOLEAN NOT NULL DEFAULT false,
  settled_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.intercompany_transactions ENABLE ROW LEVEL SECURITY;
CREATE INDEX idx_ic_txn_group ON public.intercompany_transactions(group_id);
CREATE INDEX idx_ic_txn_source ON public.intercompany_transactions(source_entity_id);
CREATE INDEX idx_ic_txn_target ON public.intercompany_transactions(target_entity_id);

-- 6. Intercompany Account Config table
CREATE TABLE public.intercompany_account_config (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id UUID NOT NULL REFERENCES public.entity_groups(id) UNIQUE,
  receivable_account_id UUID NOT NULL REFERENCES public.chart_of_accounts(id),
  payable_account_id UUID NOT NULL REFERENCES public.chart_of_accounts(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.intercompany_account_config ENABLE ROW LEVEL SECURITY;

-- 7. Helper: user_has_group_access
CREATE OR REPLACE FUNCTION public.user_has_group_access(p_group_id UUID)
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO public AS $$
  SELECT (
    public.is_global_admin()
    OR EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_id = auth.uid() AND entity_group_id = p_group_id
    )
    OR EXISTS (
      SELECT 1 FROM user_roles ur
      JOIN entities e ON e.id = ur.entity_id
      WHERE ur.user_id = auth.uid() AND e.entity_group_id = p_group_id
    )
  );
$$;

-- 8. Update user_has_entity_access with group check
CREATE OR REPLACE FUNCTION public.user_has_entity_access(p_entity_id UUID)
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO public AS $$
  SELECT (
    public.is_global_admin()
    OR EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_id = auth.uid() AND entity_id = p_entity_id
    )
    OR EXISTS (
      SELECT 1 FROM user_roles ur
      JOIN entities e ON e.entity_group_id = ur.entity_group_id
      WHERE ur.user_id = auth.uid()
        AND ur.entity_group_id IS NOT NULL
        AND e.id = p_entity_id
    )
  );
$$;

-- 9. Update has_role_for_entity with group check
CREATE OR REPLACE FUNCTION public.has_role_for_entity(p_user_id UUID, p_role app_role, p_entity_id UUID)
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO public AS $$
  SELECT EXISTS (
    SELECT 1 FROM user_roles ur
    WHERE ur.user_id = p_user_id
      AND ur.role = p_role
      AND (
        (ur.entity_id IS NULL AND ur.entity_group_id IS NULL)
        OR ur.entity_id = p_entity_id
        OR (
          ur.entity_group_id IS NOT NULL
          AND EXISTS (
            SELECT 1 FROM entities e
            WHERE e.id = p_entity_id
              AND e.entity_group_id = ur.entity_group_id
          )
        )
      )
  );
$$;

-- 10. Drop and recreate user_entity_ids
DROP FUNCTION IF EXISTS public.user_entity_ids();
CREATE FUNCTION public.user_entity_ids()
RETURNS SETOF UUID LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO public AS $$
  SELECT DISTINCT entity_id FROM user_roles
  WHERE user_id = auth.uid() AND entity_id IS NOT NULL
  UNION
  SELECT DISTINCT e.id FROM user_roles ur
  JOIN entities e ON e.entity_group_id = ur.entity_group_id
  WHERE ur.user_id = auth.uid() AND ur.entity_group_id IS NOT NULL
  UNION
  SELECT id FROM entities WHERE public.is_global_admin();
$$;

-- 11. RLS: entity_groups
CREATE POLICY "Admin full access" ON public.entity_groups
  FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Management full access" ON public.entity_groups
  FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'management'::app_role))
  WITH CHECK (has_role(auth.uid(), 'management'::app_role));
CREATE POLICY "Accountant can view" ON public.entity_groups
  FOR SELECT TO authenticated
  USING (has_role(auth.uid(), 'accountant'::app_role));

-- 12. RLS: intercompany_transactions
CREATE POLICY "Group members full access" ON public.intercompany_transactions
  FOR ALL TO authenticated
  USING (public.user_has_group_access(group_id) AND (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'management'::app_role)))
  WITH CHECK (public.user_has_group_access(group_id) AND (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'management'::app_role)));
CREATE POLICY "Accountant can view" ON public.intercompany_transactions
  FOR SELECT TO authenticated
  USING (public.user_has_group_access(group_id) AND has_role(auth.uid(), 'accountant'::app_role));

-- 13. RLS: intercompany_account_config
CREATE POLICY "Admin Management full access" ON public.intercompany_account_config
  FOR ALL TO authenticated
  USING (public.user_has_group_access(group_id) AND (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'management'::app_role)))
  WITH CHECK (public.user_has_group_access(group_id) AND (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'management'::app_role)));
CREATE POLICY "Accountant can view" ON public.intercompany_account_config
  FOR SELECT TO authenticated
  USING (public.user_has_group_access(group_id) AND has_role(auth.uid(), 'accountant'::app_role));

-- 14. Timestamp trigger
CREATE TRIGGER update_entity_groups_updated_at
  BEFORE UPDATE ON public.entity_groups
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
