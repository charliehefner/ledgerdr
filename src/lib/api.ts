const API_BASE_URL = 'https://api.dallasagro.org';
const API_KEY = '4660849108298395380';

const headers = {
  'Content-Type': 'application/json',
  'x-api-key': API_KEY,
};

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
}

export async function fetchAccounts(): Promise<Account[]> {
  const response = await fetch(`${API_BASE_URL}/accounts`, { headers });
  if (!response.ok) throw new Error('Failed to fetch accounts');
  return response.json();
}

export async function fetchProjects(): Promise<Project[]> {
  const response = await fetch(`${API_BASE_URL}/projects`, { headers });
  if (!response.ok) throw new Error('Failed to fetch projects');
  return response.json();
}

export async function fetchCbsCodes(): Promise<CbsCode[]> {
  const response = await fetch(`${API_BASE_URL}/cbs-codes`, { headers });
  if (!response.ok) throw new Error('Failed to fetch CBS codes');
  return response.json();
}

export async function fetchRecentTransactions(limit: number = 20): Promise<Transaction[]> {
  const response = await fetch(`${API_BASE_URL}/transactions/recent?limit=${limit}`, { headers });
  if (!response.ok) throw new Error('Failed to fetch recent transactions');
  return response.json();
}

export async function createTransaction(transaction: Omit<Transaction, 'id'>): Promise<Transaction> {
  const response = await fetch(`${API_BASE_URL}/transactions`, {
    method: 'POST',
    headers,
    body: JSON.stringify(transaction),
  });
  if (!response.ok) throw new Error('Failed to create transaction');
  return response.json();
}

export async function updateTransaction(id: string | number, transaction: Partial<Transaction>): Promise<Transaction> {
  const response = await fetch(`${API_BASE_URL}/transactions/${id}`, {
    method: 'PUT',
    headers,
    body: JSON.stringify(transaction),
  });
  if (!response.ok) throw new Error('Failed to update transaction');
  return response.json();
}

export async function deleteTransaction(id: string | number): Promise<void> {
  const response = await fetch(`${API_BASE_URL}/transactions/${id}`, {
    method: 'DELETE',
    headers,
  });
  if (!response.ok) throw new Error('Failed to delete transaction');
}
