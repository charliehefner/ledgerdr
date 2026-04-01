import { supabase } from '@/integrations/supabase/client';

export interface Account {
  code: string;
  english_description: string;
  spanish_description: string;
}

export interface Project {
  code: string;
  english_description: string;
  spanish_description: string;
}

export interface CbsCode {
  code: string;
  english_description: string;
  spanish_description: string;
}

export interface Transaction {
  id?: string;
  legacy_id?: number;
  transaction_date: string;
  /** @deprecated Use account_id + joined account_name/account_english_description instead. Backfilled from FK join for compatibility. */
  master_acct_code: string;
  /** @deprecated Use project_id + joined project_english_description instead. Backfilled from FK join for compatibility. */
  project_code?: string;
  /** @deprecated Use cbs_id + joined cbs_english_description instead. Backfilled from FK join for compatibility. */
  cbs_code?: string;
  purchase_date?: string;
  description: string;
  currency: 'DOP' | 'USD' | 'EUR';
  amount: number;
  itbis?: number;
  itbis_retenido?: number;
  isr_retenido?: number;
  pay_method?: string;
  document?: string;
  name?: string;
  rnc?: string;
  comments?: string;
  exchange_rate?: number;
  cost_center?: 'general' | 'agricultural' | 'industrial';
  is_internal: boolean;
  is_void?: boolean;
  void_reason?: string;
  voided_at?: string;
  attachment_url?: string;
  transaction_direction?: 'purchase' | 'sale' | 'payment' | 'investment';
  destination_acct_code?: string;
  dgii_tipo_ingreso?: string;
  dgii_tipo_bienes_servicios?: string;
  due_date?: string;
  destination_amount?: number;
  itbis_override_reason?: string;
  // UUID FK columns (preferred)
  account_id?: string;
  project_id?: string;
  cbs_id?: string;
  // Joined descriptions (populated by fetchRecentTransactions FK joins)
  account_name?: string;
  account_english_description?: string;
  account_spanish_description?: string;
  project_name?: string;
  project_english_description?: string;
  project_spanish_description?: string;
  cbs_english_description?: string;
  cbs_spanish_description?: string;
}

// ============================================
// LOCAL SUPABASE QUERIES (Migrated from DigitalOcean)
// ============================================

export async function fetchAccounts(): Promise<Account[]> {
  const { data, error } = await supabase
    .from('chart_of_accounts')
    .select('account_code, english_description, spanish_description')
    .is('deleted_at', null)
    .order('account_code');
  
  if (error) {
    console.error('Error fetching accounts:', error);
    throw new Error(error.message);
  }
  
  return (data || []).map(row => ({
    code: row.account_code,
    english_description: row.english_description || row.account_code,
    spanish_description: row.spanish_description || row.account_code,
  }));
}

export async function fetchProjects(): Promise<Project[]> {
  const { data, error } = await supabase
    .from('projects')
    .select('code, english_description, spanish_description')
    .order('code');
  
  if (error) {
    console.error('Error fetching projects:', error);
    throw new Error(error.message);
  }
  
  return data || [];
}

export async function fetchCbsCodes(): Promise<CbsCode[]> {
  const { data, error } = await supabase
    .from('cbs_codes')
    .select('code, english_description, spanish_description')
    .order('code');
  
  if (error) {
    console.error('Error fetching CBS codes:', error);
    throw new Error(error.message);
  }
  
  return data || [];
}

export async function fetchRecentTransactions(limit: number = 500): Promise<Transaction[]> {
  const { data, error } = await supabase
    .from('transactions')
    .select(`
      *,
      chart_of_accounts:chart_of_accounts!transactions_account_id_fkey (account_code, account_name, english_description, spanish_description),
      projects:projects!transactions_project_id_fkey (code, english_description, spanish_description),
      cbs_codes:cbs_codes!transactions_cbs_id_fkey (code, english_description, spanish_description)
    `)
    .eq('is_void', false)
    .order('created_at', { ascending: false })
    .limit(limit);
  
  if (error) {
    console.error('Error fetching transactions:', error);
    throw new Error(error.message);
  }
  
  return (data || []).map((t: any) => ({
    ...t,
    currency: t.currency as 'DOP' | 'USD' | 'EUR',
    is_internal: t.is_internal ?? false,
    cost_center: (t.cost_center || 'general') as 'general' | 'agricultural' | 'industrial',
    transaction_direction: (t.transaction_direction || 'purchase') as 'purchase' | 'sale' | 'payment' | 'investment',
    account_name: t.chart_of_accounts?.account_name || null,
    account_english_description: t.chart_of_accounts?.english_description || null,
    account_spanish_description: t.chart_of_accounts?.spanish_description || null,
    master_acct_code: t.master_acct_code || t.chart_of_accounts?.account_code || '',
    project_name: t.projects?.english_description || null,
    project_english_description: t.projects?.english_description || null,
    project_spanish_description: t.projects?.spanish_description || null,
    project_code: t.project_code || t.projects?.code || null,
    cbs_english_description: t.cbs_codes?.english_description || null,
    cbs_spanish_description: t.cbs_codes?.spanish_description || null,
    cbs_code: t.cbs_code || t.cbs_codes?.code || null,
    chart_of_accounts: undefined,
    projects: undefined,
    cbs_codes: undefined,
  }));
}

export async function createTransaction(transaction: Omit<Transaction, 'id'>): Promise<Transaction> {
  // Resolve FK IDs from text codes
  const fkFields: Record<string, unknown> = {};
  if (transaction.master_acct_code) {
    const { data: acct } = await supabase
      .from('chart_of_accounts')
      .select('id')
      .eq('account_code', transaction.master_acct_code)
      .maybeSingle();
    if (acct) fkFields.account_id = acct.id;
  }
  if (transaction.project_code) {
    const { data: proj } = await supabase
      .from('projects')
      .select('id')
      .eq('code', transaction.project_code)
      .maybeSingle();
    if (proj) fkFields.project_id = proj.id;
  }
  if (transaction.cbs_code) {
    const { data: cbs } = await supabase
      .from('cbs_codes')
      .select('id')
      .eq('code', transaction.cbs_code)
      .maybeSingle();
    if (cbs) fkFields.cbs_id = cbs.id;
  }

  const { data, error } = await supabase
    .from('transactions')
    .insert({
      transaction_date: transaction.transaction_date,
      master_acct_code: transaction.master_acct_code,
      project_code: transaction.project_code || null,
      cbs_code: transaction.cbs_code || null,
      purchase_date: transaction.purchase_date || null,
      description: transaction.description,
      currency: transaction.currency,
      amount: transaction.amount,
      itbis: transaction.itbis ?? 0,
      itbis_retenido: transaction.itbis_retenido ?? 0,
      isr_retenido: transaction.isr_retenido ?? 0,
      pay_method: transaction.pay_method || null,
      document: transaction.document || null,
      name: transaction.name || null,
      rnc: transaction.rnc || null,
      comments: transaction.comments || null,
      exchange_rate: transaction.exchange_rate || null,
      is_void: false,
      is_internal: transaction.is_internal ?? false,
      cost_center: transaction.cost_center || 'general',
      transaction_direction: transaction.transaction_direction || 'purchase',
      destination_acct_code: transaction.destination_acct_code || null,
      dgii_tipo_ingreso: transaction.dgii_tipo_ingreso || null,
      due_date: transaction.due_date || null,
      destination_amount: transaction.destination_amount || null,
      itbis_override_reason: transaction.itbis_override_reason || null,
      ...fkFields,
    })
    .select()
    .single();
  
  if (error) {
    console.error('Error creating transaction:', error);
    throw new Error(error.message);
  }
  
  return {
    ...data,
    currency: data.currency as 'DOP' | 'USD' | 'EUR',
    is_internal: data.is_internal ?? false,
    cost_center: (data.cost_center || 'general') as 'general' | 'agricultural' | 'industrial',
    transaction_direction: (data.transaction_direction || 'purchase') as 'purchase' | 'sale' | 'payment' | 'investment',
    destination_acct_code: data.destination_acct_code || undefined,
  };
}

export async function updateTransaction(id: string, transaction: Partial<Transaction>): Promise<Transaction> {
  // Try legacy_id first (numeric string), fall back to UUID
  const legacyId = parseInt(id, 10);
  
  // Build update payload from provided fields
  const updatePayload: Record<string, unknown> = {};
  if (transaction.document !== undefined) updatePayload.document = transaction.document;
  if (transaction.description !== undefined) updatePayload.description = transaction.description;
  if (transaction.rnc !== undefined) updatePayload.rnc = transaction.rnc;
  if (transaction.itbis !== undefined) updatePayload.itbis = transaction.itbis;
  if (transaction.itbis_retenido !== undefined) updatePayload.itbis_retenido = transaction.itbis_retenido;
  if (transaction.isr_retenido !== undefined) updatePayload.isr_retenido = transaction.isr_retenido;
  if (transaction.pay_method !== undefined) updatePayload.pay_method = transaction.pay_method;
  if (transaction.dgii_tipo_bienes_servicios !== undefined) updatePayload.dgii_tipo_bienes_servicios = transaction.dgii_tipo_bienes_servicios;
  if (transaction.transaction_date !== undefined) updatePayload.transaction_date = transaction.transaction_date;
  if (transaction.currency !== undefined) updatePayload.currency = transaction.currency;
  if (transaction.amount !== undefined) updatePayload.amount = transaction.amount;
  if (transaction.name !== undefined) updatePayload.name = transaction.name;
  if (transaction.comments !== undefined) updatePayload.comments = transaction.comments;
  if (transaction.transaction_direction !== undefined) updatePayload.transaction_direction = transaction.transaction_direction;
  if (transaction.destination_acct_code !== undefined) updatePayload.destination_acct_code = transaction.destination_acct_code;
  if (transaction.cost_center !== undefined) updatePayload.cost_center = transaction.cost_center;
  if (transaction.itbis_override_reason !== undefined) updatePayload.itbis_override_reason = transaction.itbis_override_reason;
  if (transaction.due_date !== undefined) updatePayload.due_date = transaction.due_date;
  if (transaction.purchase_date !== undefined) updatePayload.purchase_date = transaction.purchase_date || null;

  // Resolve FK IDs when code fields change
  if (transaction.master_acct_code !== undefined) {
    updatePayload.master_acct_code = transaction.master_acct_code;
    if (transaction.master_acct_code) {
      const { data: acct } = await supabase
        .from('chart_of_accounts')
        .select('id')
        .eq('account_code', transaction.master_acct_code)
        .maybeSingle();
      if (acct) updatePayload.account_id = acct.id;
    }
  }
  if (transaction.project_code !== undefined) {
    updatePayload.project_code = transaction.project_code || null;
    if (transaction.project_code) {
      const { data: proj } = await supabase
        .from('projects')
        .select('id')
        .eq('code', transaction.project_code)
        .maybeSingle();
      if (proj) updatePayload.project_id = proj.id;
    } else {
      updatePayload.project_id = null;
    }
  }
  if (transaction.cbs_code !== undefined) {
    updatePayload.cbs_code = transaction.cbs_code || null;
    if (transaction.cbs_code) {
      const { data: cbs } = await supabase
        .from('cbs_codes')
        .select('id')
        .eq('code', transaction.cbs_code)
        .maybeSingle();
      if (cbs) updatePayload.cbs_id = cbs.id;
    } else {
      updatePayload.cbs_id = null;
    }
  }

  // Try legacy_id first, fall back to UUID
  let query = supabase.from('transactions').update(updatePayload);
  if (!isNaN(legacyId) && legacyId > 0) {
    query = query.eq('legacy_id', legacyId);
  } else {
    query = query.eq('id', String(id));
  }

  const { data, error } = await query.select().maybeSingle();
  
  if (error) {
    console.error('Error updating transaction:', error);
    throw new Error(error.message);
  }
  
  return {
    ...data,
    currency: data.currency as 'DOP' | 'USD' | 'EUR',
    is_internal: data.is_internal ?? false,
    cost_center: (data.cost_center || 'general') as 'general' | 'agricultural' | 'industrial',
    transaction_direction: (data.transaction_direction || 'purchase') as 'purchase' | 'sale' | 'payment' | 'investment',
  };
}

export async function deleteTransaction(id: string | number): Promise<void> {
  const legacyId = typeof id === 'number' ? id : parseInt(id, 10);
  
  const { error } = await supabase
    .from('transactions')
    .delete()
    .eq('legacy_id', legacyId);
  
  if (error) {
    console.error('Error deleting transaction:', error);
    throw new Error(error.message);
  }
}

export async function voidTransaction(id: string | number): Promise<Transaction> {
  const legacyId = typeof id === 'number' ? id : parseInt(id, 10);
  
  const { data, error } = await supabase
    .from('transactions')
    .update({
      is_void: true,
      voided_at: new Date().toISOString(),
    })
    .eq('legacy_id', legacyId)
    .select()
    .single();
  
  if (error) {
    console.error('Error voiding transaction:', error);
    throw new Error(error.message);
  }
  
  return {
    ...data,
    currency: data.currency as 'DOP' | 'USD' | 'EUR',
    is_internal: data.is_internal ?? false,
    cost_center: (data.cost_center || 'general') as 'general' | 'agricultural' | 'industrial',
    transaction_direction: (data.transaction_direction || 'purchase') as 'purchase' | 'sale' | 'payment' | 'investment',
  };
}
