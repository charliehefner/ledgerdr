ALTER TYPE public.journal_source_type ADD VALUE IF NOT EXISTS 'home_office_advance';
ALTER TYPE public.journal_source_type ADD VALUE IF NOT EXISTS 'home_office_repayment';
ALTER TYPE public.journal_source_type ADD VALUE IF NOT EXISTS 'home_office_accrual';
ALTER TYPE public.journal_source_type ADD VALUE IF NOT EXISTS 'home_office_fx_reval';
ALTER TYPE public.journal_source_type ADD VALUE IF NOT EXISTS 'cip_capitalize';