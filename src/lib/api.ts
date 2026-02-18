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
  pay_method?: string;
  document?: string;
  name?: string;
  rnc?: string;
  comments?: string;
  exchange_rate?: number;
  is_internal: boolean;
  is_void?: boolean;
  void_reason?: string;
  voided_at?: string;
  attachment_url?: string;
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
  
  // Map to expected format, using legacy_id as id for attachment compatibility
  return (data || []).map(t => ({
    ...t,
    id: t.legacy_id?.toString() || t.id,
    currency: t.currency as 'DOP' | 'USD',
    is_internal: t.is_internal ?? false,
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
      pay_method: transaction.pay_method || null,
      document: transaction.document || null,
      name: transaction.name || null,
      rnc: transaction.rnc || null,
      comments: transaction.comments || null,
      is_void: false,
      is_internal: transaction.is_internal ?? false,
    })
    .select()
    .single();
  
  if (error) {
    console.error('Error creating transaction:', error);
    throw new Error(error.message);
  }
  
  return {
    ...data,
    id: data.legacy_id?.toString() || data.id,
    currency: data.currency as 'DOP' | 'USD',
    is_internal: data.is_internal ?? false,
  };
}

export async function updateTransaction(id: string | number, transaction: Partial<Transaction>): Promise<Transaction> {
  // Find by legacy_id if numeric, otherwise by uuid
  const legacyId = typeof id === 'number' ? id : parseInt(id, 10);
  
  const { data, error } = await supabase
    .from('transactions')
    .update({
      document: transaction.document,
      // Add other updatable fields as needed
    })
    .eq('legacy_id', legacyId)
    .select()
    .single();
  
  if (error) {
    console.error('Error updating transaction:', error);
    throw new Error(error.message);
  }
  
  return {
    ...data,
    id: data.legacy_id?.toString() || data.id,
    currency: data.currency as 'DOP' | 'USD',
    is_internal: data.is_internal ?? false,
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
    id: data.legacy_id?.toString() || data.id,
    currency: data.currency as 'DOP' | 'USD',
    is_internal: data.is_internal ?? false,
  };
}
