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
  comments?: string;
  exchange_rate?: number;
  is_internal: boolean;
  is_void?: boolean;
  attachment_url?: string;
}

// Helper function to call the API proxy edge function
async function callApiProxy<T>(endpoint: string, method: string = 'GET', body?: unknown): Promise<T> {
  const { data: sessionData } = await supabase.auth.getSession();
  const accessToken = sessionData?.session?.access_token;
  
  if (!accessToken) {
    throw new Error('Not authenticated');
  }

  const response = await supabase.functions.invoke('api-proxy', {
    body: { endpoint, method, body },
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });

  if (response.error) {
    throw new Error(response.error.message || 'API request failed');
  }

  return response.data as T;
}

export async function fetchAccounts(): Promise<Account[]> {
  return callApiProxy<Account[]>('/accounts');
}

export async function fetchProjects(): Promise<Project[]> {
  return callApiProxy<Project[]>('/projects');
}

export async function fetchCbsCodes(): Promise<CbsCode[]> {
  return callApiProxy<CbsCode[]>('/cbs-codes');
}

export async function fetchRecentTransactions(limit: number = 20): Promise<Transaction[]> {
  return callApiProxy<Transaction[]>(`/transactions/recent?limit=${limit}`);
}

export async function createTransaction(transaction: Omit<Transaction, 'id'>): Promise<Transaction> {
  return callApiProxy<Transaction>('/transactions', 'POST', transaction);
}

export async function updateTransaction(id: string | number, transaction: Partial<Transaction>): Promise<Transaction> {
  return callApiProxy<Transaction>(`/transactions/${id}`, 'PUT', transaction);
}

export async function deleteTransaction(id: string | number): Promise<void> {
  return callApiProxy<void>(`/transactions/${id}`, 'DELETE');
}

export async function voidTransaction(id: string | number): Promise<Transaction> {
  return callApiProxy<Transaction>(`/transactions/${id}/void`, 'POST');
}
