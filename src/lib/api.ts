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
  master_acct_code: string;
  project_code?: string;
  cbs_code?: string;
  purchase_date?: string;
  description: string;
  currency: 'DOP' | 'USD';
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
  transaction_direction?: 'purchase' | 'sale' | 'investment' | 'payment';
  destination_acct_code?: string;
  dgii_tipo_ingreso?: string;
  dgii_tipo_bienes_servicios?: string;
  due_date?: string;
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
    .select('*')
    .eq('is_void', false)
    .order('created_at', { ascending: false })
    .limit(limit);
  
  if (error) {
    console.error('Error fetching transactions:', error);
    throw new Error(error.message);
  }
  
  return (data || []).map(t => ({
    ...t,
    currency: t.currency as 'DOP' | 'USD',
    is_internal: t.is_internal ?? false,
    cost_center: (t.cost_center || 'general') as 'general' | 'agricultural' | 'industrial',
    transaction_direction: (t.transaction_direction || 'purchase') as 'purchase' | 'sale' | 'payment',
  }));
}

export async function createTransaction(transaction: Omit<Transaction, 'id'>): Promise<Transaction> {
  // Get the next legacy_id for new transactions
  const { data: maxData } = await supabase
    .from('transactions')
    .select('legacy_id')
    .order('legacy_id', { ascending: false })
    .limit(1);
  
  const nextLegacyId = ((maxData?.[0]?.legacy_id || 0) as number) + 1;

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
      legacy_id: nextLegacyId,
      transaction_date: transaction.transaction_date,
      master_acct_code: transaction.master_acct_code,
      project_code: transaction.project_code || null,
      cbs_code: transaction.cbs_code || null,
      description: transaction.description,
      currency: transaction.currency,
      amount: transaction.amount,
      itbis: transaction.itbis || null,
      itbis_retenido: transaction.itbis_retenido || null,
      isr_retenido: transaction.isr_retenido || null,
      pay_method: transaction.pay_method || null,
      document: transaction.document || null,
      name: transaction.name || null,
      rnc: transaction.rnc || null,
      comments: transaction.comments || null,
      is_void: false,
      is_internal: transaction.is_internal ?? false,
      cost_center: transaction.cost_center || 'general',
      transaction_direction: transaction.transaction_direction || 'purchase',
      destination_acct_code: transaction.destination_acct_code || null,
      dgii_tipo_ingreso: transaction.dgii_tipo_ingreso || null,
      due_date: (transaction as any).due_date || null,
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
    currency: data.currency as 'DOP' | 'USD',
    is_internal: data.is_internal ?? false,
    cost_center: (data.cost_center || 'general') as 'general' | 'agricultural' | 'industrial',
    transaction_direction: (data.transaction_direction || 'purchase') as 'purchase' | 'sale' | 'investment' | 'payment',
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

  const { data, error } = await query.select().single();
  
  if (error) {
    console.error('Error updating transaction:', error);
    throw new Error(error.message);
  }
  
  return {
    ...data,
    currency: data.currency as 'DOP' | 'USD',
    is_internal: data.is_internal ?? false,
    cost_center: (data.cost_center || 'general') as 'general' | 'agricultural' | 'industrial',
    transaction_direction: (data.transaction_direction || 'purchase') as 'purchase' | 'sale' | 'payment',
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
    currency: data.currency as 'DOP' | 'USD',
    is_internal: data.is_internal ?? false,
    cost_center: (data.cost_center || 'general') as 'general' | 'agricultural' | 'industrial',
    transaction_direction: (data.transaction_direction || 'purchase') as 'purchase' | 'sale' | 'payment',
  };
}
