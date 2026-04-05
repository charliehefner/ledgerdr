import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger
} from '@/components/ui/alert-dialog';
import { Plus, Search, Trash2, Star, Building2, History, Check } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useLanguage } from '@/contexts/LanguageContext';
import { MainLayout } from '@/components/layout/MainLayout';
import { HelpPanelButton } from '@/components/layout/HelpPanelButton';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter
} from '@/components/ui/dialog';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue
} from '@/components/ui/select';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow
} from '@/components/ui/table';
import {
  Collapsible, CollapsibleContent, CollapsibleTrigger
} from '@/components/ui/collapsible';
import { useEntityFilter } from "@/hooks/useEntityFilter";

type Contact = {
  id: string;
  name: string;
  rnc: string | null;
  contact_type: string;
  contact_person: string | null;
  phone: string | null;
  email: string | null;
  address: string | null;
  notes: string | null;
  is_active: boolean;
};

type BankAccount = {
  id?: string;
  contact_id?: string;
  bank_name: string;
  account_number: string;
  account_type: string;
  currency: string;
  is_default: boolean;
};

const emptyContact = {
  name: '', rnc: '', contact_type: 'supplier', contact_person: '',
  phone: '', email: '', address: '', notes: '', is_active: true,
};

const emptyBank: BankAccount = {
  bank_name: '', account_number: '', account_type: 'checking', currency: 'DOP', is_default: false,
};

export default function Contacts() {
  const { t } = useLanguage();
  const queryClient = useQueryClient();
  const { applyEntityFilter, selectedEntityId, isAllEntities } = useEntityFilter();
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState('all');
  const [showInactive, setShowInactive] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(emptyContact);
  const [bankAccounts, setBankAccounts] = useState<BankAccount[]>([]);
  const [bankOpen, setBankOpen] = useState(false);
  const [historyContact, setHistoryContact] = useState<Contact | null>(null);
  const [historyData, setHistoryData] = useState<{ id: string; transaction_date: string; amount: number; currency: string; document: string | null; has_ncf: boolean }[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);

  const openHistory = async (c: Contact) => {
    setHistoryContact(c);
    setHistoryLoading(true);
    setHistoryData([]);

    let query = supabase
      .from('transactions')
      .select('id, transaction_date, amount, currency, document')
      .eq('is_void', false)
      .order('transaction_date', { ascending: false })
      .limit(10);

    if (c.rnc) {
      query = query.eq('rnc', c.rnc);
    } else {
      query = query.ilike('name', c.name);
    }

    const { data: txns } = await query;
    if (!txns || txns.length === 0) {
      setHistoryData([]);
      setHistoryLoading(false);
      return;
    }

    const txIds = txns.map(t => t.id);
    const { data: ncfAttachments } = await supabase
      .from('transaction_attachments')
      .select('transaction_id')
      .in('transaction_id', txIds)
      .eq('attachment_category', 'ncf');

    const ncfSet = new Set((ncfAttachments || []).map(a => a.transaction_id));

    setHistoryData(txns.map(t => ({
      ...t,
      has_ncf: ncfSet.has(t.id),
    })));
    setHistoryLoading(false);
  };

  const { data: contacts = [], isLoading } = useQuery({
    queryKey: ['contacts', selectedEntityId],
    queryFn: async () => {
      let query = supabase
        .from('contacts')
        .select('*')
        .order('name');
      if (!isAllEntities && selectedEntityId) {
        query = query.eq('entity_id', selectedEntityId);
      }
      const { data, error } = await query;
      if (error) throw error;
      return data as Contact[];
    },
  });

  const { data: allBankAccounts = [] } = useQuery({
    queryKey: ['contactBankAccounts'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('contact_bank_accounts')
        .select('*')
        .order('is_default', { ascending: false });
      if (error) throw error;
      return data as (BankAccount & { id: string; contact_id: string })[];
    },
  });

  const saveMutation = useMutation({
    mutationFn: async () => {
      let contactId = editingId;
      if (editingId) {
        const { error } = await supabase.from('contacts').update({
          name: form.name, rnc: form.rnc || null, contact_type: form.contact_type,
          contact_person: form.contact_person || null, phone: form.phone || null,
          email: form.email || null, address: form.address || null,
          notes: form.notes || null, is_active: form.is_active,
        }).eq('id', editingId);
        if (error) throw error;
      } else {
        const { data, error } = await supabase.from('contacts').insert({
          name: form.name, rnc: form.rnc || null, contact_type: form.contact_type,
          contact_person: form.contact_person || null, phone: form.phone || null,
          email: form.email || null, address: form.address || null,
          notes: form.notes || null, is_active: form.is_active,
        }).select('id').single();
        if (error) throw error;
        contactId = data.id;
      }

      // Sync bank accounts
      if (contactId) {
        await supabase.from('contact_bank_accounts').delete().eq('contact_id', contactId);
        if (bankAccounts.length > 0) {
          const rows = bankAccounts.map(b => ({
            contact_id: contactId!,
            bank_name: b.bank_name,
            account_number: b.account_number,
            account_type: b.account_type,
            currency: b.currency,
            is_default: b.is_default,
          }));
          const { error } = await supabase.from('contact_bank_accounts').insert(rows);
          if (error) throw error;
        }
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['contacts'] });
      queryClient.invalidateQueries({ queryKey: ['contactBankAccounts'] });
      toast.success(t('common.save') + ' ✓');
      setDialogOpen(false);
    },
    onError: (e: any) => toast.error(e.message),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('contacts').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['contacts'] });
      queryClient.invalidateQueries({ queryKey: ['contactBankAccounts'] });
      toast.success(t('common.delete') + ' ✓');
    },
  });

  const openNew = () => {
    setEditingId(null);
    setForm(emptyContact);
    setBankAccounts([]);
    setBankOpen(false);
    setDialogOpen(true);
  };

  const openEdit = (c: Contact) => {
    setEditingId(c.id);
    setForm({
      name: c.name, rnc: c.rnc || '', contact_type: c.contact_type,
      contact_person: c.contact_person || '', phone: c.phone || '',
      email: c.email || '', address: c.address || '',
      notes: c.notes || '', is_active: c.is_active,
    });
    setBankAccounts(allBankAccounts.filter(b => b.contact_id === c.id).map(b => ({
      bank_name: b.bank_name, account_number: b.account_number,
      account_type: b.account_type, currency: b.currency, is_default: b.is_default,
    })));
    setBankOpen(false);
    setDialogOpen(true);
  };

  const addBankRow = () => setBankAccounts(prev => [...prev, { ...emptyBank }]);
  const removeBankRow = (i: number) => setBankAccounts(prev => prev.filter((_, idx) => idx !== i));
  const updateBank = (i: number, field: keyof BankAccount, value: any) => {
    setBankAccounts(prev => prev.map((b, idx) => {
      if (idx !== i) return field === 'is_default' && value ? { ...b, is_default: false } : b;
      return { ...b, [field]: value };
    }));
  };

  const filtered = contacts.filter(c => {
    if (!showInactive && !c.is_active) return false;
    if (typeFilter !== 'all' && c.contact_type !== typeFilter) return false;
    if (search) {
      const q = search.toLowerCase();
      return c.name.toLowerCase().includes(q) || (c.rnc || '').toLowerCase().includes(q) ||
        (c.contact_person || '').toLowerCase().includes(q);
    }
    return true;
  });

  const typeBadge = (type: string) => {
    const colors: Record<string, string> = {
      supplier: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200',
      customer: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200',
      both: 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200',
    };
    return <Badge className={colors[type] || ''}>{t(`contacts.type_${type}`)}</Badge>;
  };

  return (
    <MainLayout>
      <div className="space-y-4">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold">{t('contacts.title')}</h1>
            <HelpPanelButton chapter="03-navigation" />
          </div>
          <Button onClick={openNew}><Plus className="h-4 w-4 mr-1" />{t('common.add')}</Button>
        </div>

        <Card>
          <CardContent className="pt-4">
            <div className="flex flex-col sm:flex-row gap-3 mb-4">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input className="pl-9" placeholder={t('common.search')} value={search} onChange={e => setSearch(e.target.value)} />
              </div>
              <Select value={typeFilter} onValueChange={setTypeFilter}>
                <SelectTrigger className="w-[160px]"><SelectValue /></SelectTrigger>
                <SelectContent className="bg-popover">
                  <SelectItem value="all">{t('common.all')}</SelectItem>
                  <SelectItem value="supplier">{t('contacts.type_supplier')}</SelectItem>
                  <SelectItem value="customer">{t('contacts.type_customer')}</SelectItem>
                  <SelectItem value="both">{t('contacts.type_both')}</SelectItem>
                </SelectContent>
              </Select>
              <div className="flex items-center gap-2">
                <Switch checked={showInactive} onCheckedChange={setShowInactive} />
                <span className="text-sm text-muted-foreground">{t('common.inactive')}</span>
              </div>
            </div>

            <div className="overflow-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t('common.name')}</TableHead>
                    <TableHead>RNC</TableHead>
                    <TableHead>{t('common.type')}</TableHead>
                    <TableHead>{t('contacts.contactPerson')}</TableHead>
                    <TableHead>{t('contacts.phone')}</TableHead>
                    <TableHead>{t('contacts.banks')}</TableHead>
                    <TableHead>{t('common.actions')}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {isLoading ? (
                    <TableRow><TableCell colSpan={7} className="text-center">{t('common.loading')}</TableCell></TableRow>
                  ) : filtered.length === 0 ? (
                    <TableRow><TableCell colSpan={7} className="text-center">{t('common.noData')}</TableCell></TableRow>
                  ) : filtered.map(c => {
                    const banks = allBankAccounts.filter(b => b.contact_id === c.id);
                    return (
                      <TableRow key={c.id} className={!c.is_active ? 'opacity-50' : ''} onClick={() => openEdit(c)} role="button">
                        <TableCell className="font-medium">{c.name}</TableCell>
                        <TableCell className="font-mono text-xs">{c.rnc || '—'}</TableCell>
                        <TableCell>{typeBadge(c.contact_type)}</TableCell>
                        <TableCell>{c.contact_person || '—'}</TableCell>
                        <TableCell>{c.phone || '—'}</TableCell>
                        <TableCell>
                          {banks.length > 0 ? (
                            <span className="text-xs text-muted-foreground">
                              {banks.map(b => `${b.bank_name} (${b.currency})`).join(', ')}
                            </span>
                          ) : '—'}
                        </TableCell>
                        <TableCell onClick={e => e.stopPropagation()} className="flex items-center gap-1">
                          <Button variant="ghost" size="sm" onClick={() => openHistory(c)} title="Historial">
                            <History className="h-4 w-4 text-muted-foreground" />
                          </Button>
                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <Button variant="ghost" size="sm">
                                <Trash2 className="h-4 w-4 text-destructive" />
                              </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                              <AlertDialogHeader>
                                <AlertDialogTitle>{t('common.delete')}</AlertDialogTitle>
                                <AlertDialogDescription>
                                  ¿Está seguro que desea eliminar <strong>{c.name}</strong>?
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>{t('common.cancel')}</AlertDialogCancel>
                                <AlertDialogAction onClick={() => deleteMutation.mutate(c.id)} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                                  {t('common.delete')}
                                </AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Contact Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              <Building2 className="inline h-5 w-5 mr-2" />
              {editingId ? t('common.edit') : t('common.add')} {t('contacts.contact')}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            {/* General Info */}
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1">
                <Label>{t('common.name')} *</Label>
                <Input value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))} />
              </div>
              <div className="space-y-1">
                <Label>RNC</Label>
                <Input value={form.rnc} onChange={e => setForm(p => ({ ...p, rnc: e.target.value }))} placeholder="000-00000-0" />
              </div>
              <div className="space-y-1">
                <Label>{t('common.type')}</Label>
                <Select value={form.contact_type} onValueChange={v => setForm(p => ({ ...p, contact_type: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent className="bg-popover">
                    <SelectItem value="supplier">{t('contacts.type_supplier')}</SelectItem>
                    <SelectItem value="customer">{t('contacts.type_customer')}</SelectItem>
                    <SelectItem value="both">{t('contacts.type_both')}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label>{t('contacts.contactPerson')}</Label>
                <Input value={form.contact_person} onChange={e => setForm(p => ({ ...p, contact_person: e.target.value }))} />
              </div>
              <div className="space-y-1">
                <Label>{t('contacts.phone')}</Label>
                <Input value={form.phone} onChange={e => setForm(p => ({ ...p, phone: e.target.value }))} />
              </div>
              <div className="space-y-1">
                <Label>{t('contacts.email')}</Label>
                <Input type="email" value={form.email} onChange={e => setForm(p => ({ ...p, email: e.target.value }))} />
              </div>
            </div>
            <div className="space-y-1">
              <Label>{t('contacts.address')}</Label>
              <Input value={form.address} onChange={e => setForm(p => ({ ...p, address: e.target.value }))} />
            </div>
            <div className="space-y-1">
              <Label>{t('common.notes')}</Label>
              <Textarea value={form.notes} onChange={e => setForm(p => ({ ...p, notes: e.target.value }))} rows={2} />
            </div>
            <div className="flex items-center gap-2">
              <Switch checked={form.is_active} onCheckedChange={v => setForm(p => ({ ...p, is_active: v }))} />
              <Label>{t('common.active')}</Label>
            </div>

            {/* Bank Accounts Section */}
            <Collapsible open={bankOpen} onOpenChange={setBankOpen}>
              <CollapsibleTrigger asChild>
                <Button variant="outline" className="w-full justify-between">
                  {t('contacts.bankAccounts')} ({bankAccounts.length})
                  <span className="text-xs">{bankOpen ? '▲' : '▼'}</span>
                </Button>
              </CollapsibleTrigger>
              <CollapsibleContent className="space-y-3 pt-3">
                {bankAccounts.map((b, i) => (
                  <div key={i} className="grid gap-2 sm:grid-cols-6 items-end border rounded-lg p-3">
                    <div className="sm:col-span-2 space-y-1">
                      <Label className="text-xs">{t('contacts.bankName')}</Label>
                      <Input value={b.bank_name} onChange={e => updateBank(i, 'bank_name', e.target.value)} placeholder="Banco Popular" />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">{t('contacts.accountNumber')}</Label>
                      <Input value={b.account_number} onChange={e => updateBank(i, 'account_number', e.target.value)} />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">{t('common.type')}</Label>
                      <Select value={b.account_type} onValueChange={v => updateBank(i, 'account_type', v)}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent className="bg-popover">
                          <SelectItem value="checking">{t('contacts.checking')}</SelectItem>
                          <SelectItem value="savings">{t('contacts.savings')}</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">{t('contacts.currency')}</Label>
                      <Select value={b.currency} onValueChange={v => updateBank(i, 'currency', v)}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent className="bg-popover">
                          <SelectItem value="DOP">DOP</SelectItem>
                          <SelectItem value="USD">USD</SelectItem>
                          <SelectItem value="EUR">EUR</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="flex items-center gap-1">
                      <Button type="button" variant={b.is_default ? 'default' : 'ghost'} size="icon"
                        onClick={() => updateBank(i, 'is_default', !b.is_default)} title={t('contacts.default')}>
                        <Star className={`h-4 w-4 ${b.is_default ? 'fill-current' : ''}`} />
                      </Button>
                      <Button type="button" variant="ghost" size="icon" onClick={() => removeBankRow(i)}>
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </div>
                  </div>
                ))}
                <Button type="button" variant="outline" size="sm" onClick={addBankRow}>
                  <Plus className="h-4 w-4 mr-1" />{t('contacts.addBank')}
                </Button>
              </CollapsibleContent>
            </Collapsible>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>{t('common.cancel')}</Button>
            <Button onClick={() => saveMutation.mutate()} disabled={!form.name || saveMutation.isPending}>
              {saveMutation.isPending ? t('common.saving') : t('common.save')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      {/* Transaction History Dialog */}
      <Dialog open={!!historyContact} onOpenChange={open => { if (!open) setHistoryContact(null); }}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>
              <History className="inline h-5 w-5 mr-2" />
              {historyContact?.name} — Últimas transacciones
            </DialogTitle>
          </DialogHeader>
          {historyLoading ? (
            <p className="text-center text-muted-foreground py-4">{t('common.loading')}</p>
          ) : historyData.length === 0 ? (
            <p className="text-center text-muted-foreground py-4">Sin transacciones</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Fecha</TableHead>
                  <TableHead className="text-right">Monto</TableHead>
                  <TableHead className="text-center">NCF</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {historyData.map(tx => (
                  <TableRow key={tx.id}>
                    <TableCell>{tx.transaction_date}</TableCell>
                    <TableCell className="text-right font-mono">
                      {tx.currency === 'USD' ? '$' : 'RD$'}{Number(tx.amount).toLocaleString('en', { minimumFractionDigits: 2 })}
                    </TableCell>
                    <TableCell className="text-center">
                      {tx.has_ncf ? <Check className="h-4 w-4 text-green-600 mx-auto" /> : '—'}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </DialogContent>
      </Dialog>
    </MainLayout>
  );
}
