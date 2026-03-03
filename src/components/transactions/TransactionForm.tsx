import { useState, useMemo, useRef } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { CalendarIcon } from 'lucide-react';
import { getDescription } from '@/lib/getDescription';
import { useLanguage } from '@/contexts/LanguageContext';
import { formatDateLocal } from '@/lib/dateUtils';
import { TIPO_INGRESO } from '@/components/accounting/dgiiConstants';
import {
  fetchAccounts,
  fetchProjects,
  fetchCbsCodes,
  fetchRecentTransactions,
  createTransaction,
  Account,
  Project,
  CbsCode,
} from '@/lib/api';
import { supabase } from '@/integrations/supabase/client';
import { saveAttachment, AttachmentCategory } from '@/lib/attachments';
import { MultiAttachmentUpload, CategoryAttachments } from './MultiAttachmentUpload';
import { NameAutocomplete } from './NameAutocomplete';
import { ScanReceiptButton, OcrResult } from './ScanReceiptButton';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { cn } from '@/lib/utils';

interface TransactionFormProps {
  onSuccess: () => void;
}

const initialFormState = {
  transaction_date: undefined as Date | undefined,
  master_acct_code: '',
  project_code: '',
  cbs_code: '',
  purchase_date: undefined as Date | undefined,
  description: '',
  currency: 'DOP' as 'DOP' | 'USD',
  amount: '',
  itbis: '',
  itbis_retenido: '',
  isr_retenido: '',
  pay_method: '',
  document: '',
  name: '',
  rnc: '',
  comments: '',
  exchange_rate: '',
  cost_center: 'general' as 'general' | 'agricultural' | 'industrial',
  transaction_direction: 'purchase' as 'purchase' | 'sale' | 'investment',
  destination_acct_code: '',
  dgii_tipo_ingreso: '',
  due_date: '',
  attachments: {
    ncf: null,
    payment_receipt: null,
    quote: null,
  } as CategoryAttachments,
};

export function TransactionForm({ onSuccess }: TransactionFormProps) {
  const queryClient = useQueryClient();
  const [form, setForm] = useState(initialFormState);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { t } = useLanguage();

  const { data: accounts = [], isLoading: loadingAccounts } = useQuery({
    queryKey: ['accounts'],
    queryFn: fetchAccounts,
  });

  // Fetch postable chart of accounts for destination account (investment)
  const { data: chartOfAccounts = [] } = useQuery({
    queryKey: ['chartOfAccountsPostable'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('chart_of_accounts')
        .select('id, account_code, account_name')
        .eq('allow_posting', true)
        .is('deleted_at', null)
        .order('account_code');
      if (error) throw error;
      return data || [];
    },
  });

  const { data: projects = [], isLoading: loadingProjects } = useQuery({
    queryKey: ['projects'],
    queryFn: fetchProjects,
  });

  const { data: cbsCodes = [], isLoading: loadingCbsCodes } = useQuery({
    queryKey: ['cbsCodes'],
    queryFn: fetchCbsCodes,
  });

  const { data: existingTransactions = [] } = useQuery({
    queryKey: ['existingTransactions'],
    queryFn: () => fetchRecentTransactions(500),
  });

  // Fetch vendor rules for auto-fill
  const { data: vendorRules = [] } = useQuery({
    queryKey: ['vendorRules'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('vendor_account_rules')
        .select('*')
        .order('vendor_name');
      if (error) throw error;
      return data || [];
    },
  });

  const uniqueNames = useMemo(() => {
    const names = new Set<string>();
    existingTransactions.forEach(tx => {
      if (tx.name?.trim()) names.add(tx.name.trim());
    });
    return Array.from(names).sort((a, b) => a.localeCompare(b, 'es'));
  }, [existingTransactions]);

  const requires1180Fields = form.master_acct_code === '1180';

  const checkForDuplicate = () => {
    if (!form.transaction_date || !form.master_acct_code || !form.amount) {
      return false;
    }
    
    // Skip duplicate check for Nomina (payroll) transactions
    if (form.description.toLowerCase().includes('nomina')) {
      return false;
    }
    
    const formDate = formatDateLocal(form.transaction_date);
    const formAmount = parseFloat(form.amount);
    const formName = (form.name || '').trim().toLowerCase();
    
    return existingTransactions.some(tx => {
      const txDate = tx.transaction_date?.split('T')[0];
      const txName = (tx.name || '').trim().toLowerCase();
      return (
        txDate === formDate &&
        tx.master_acct_code === form.master_acct_code &&
        tx.amount === formAmount &&
        txName === formName
      );
    });
  };

  const isValid = () => {
    if (!form.transaction_date || !form.master_acct_code || !form.description || !form.amount) {
      return false;
    }
    if (requires1180Fields && (!form.project_code || !form.cbs_code)) {
      return false;
    }
    if (form.transaction_direction === 'investment' && !form.destination_acct_code) {
      return false;
    }
    // ITBIS cannot exceed 18% of amount
    if (form.itbis && form.amount) {
      const itbisValue = parseFloat(form.itbis);
      const amountValue = parseFloat(form.amount);
      if (itbisValue > amountValue * 0.18) {
        return false;
      }
    }
    return true;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!isValid()) {
      if (requires1180Fields && (!form.project_code || !form.cbs_code)) {
        toast.error(t('txForm.projectCbsRequired'));
      } else if (form.itbis && form.amount && parseFloat(form.itbis) > parseFloat(form.amount) * 0.18) {
        toast.error(t('txForm.itbisExceeds'));
      } else {
        toast.error(t('txForm.requiredFields'));
      }
      return;
    }

    if (checkForDuplicate()) {
      toast.error(t('txForm.duplicate'));
      return;
    }

    setIsSubmitting(true);

    try {
      const isB11 = form.document?.toUpperCase().startsWith('B11');
      const result = await createTransaction({
        transaction_date: formatDateLocal(form.transaction_date!),
        master_acct_code: form.master_acct_code,
        project_code: form.project_code || undefined,
        cbs_code: form.cbs_code || undefined,
        purchase_date: form.purchase_date ? formatDateLocal(form.purchase_date) : undefined,
        description: form.description,
        currency: form.currency,
        amount: parseFloat(form.amount),
        itbis: form.itbis ? parseFloat(form.itbis) : undefined,
        itbis_retenido: isB11 && form.itbis_retenido ? parseFloat(form.itbis_retenido) : undefined,
        isr_retenido: isB11 && form.isr_retenido ? parseFloat(form.isr_retenido) : undefined,
        pay_method: form.pay_method || undefined,
        document: form.document || undefined,
        name: form.name || undefined,
        rnc: form.rnc || undefined,
        comments: form.comments || undefined,
        exchange_rate: form.exchange_rate ? parseFloat(form.exchange_rate) : undefined,
        is_internal: form.master_acct_code === '0000',
        cost_center: form.cost_center,
        transaction_direction: form.transaction_direction,
        destination_acct_code: form.transaction_direction === 'investment' ? form.destination_acct_code || undefined : undefined,
        dgii_tipo_ingreso: form.transaction_direction === 'sale' ? form.dgii_tipo_ingreso || undefined : undefined,
        due_date: form.due_date || undefined,
      });

      // Save all attachments to local database
      if (result.id) {
        const attachmentCategories: AttachmentCategory[] = ['ncf', 'payment_receipt', 'quote'];
        for (const category of attachmentCategories) {
          if (form.attachments[category]) {
            await saveAttachment(result.id, form.attachments[category]!, category);
          }
        }
        // Invalidate attachment queries
        queryClient.invalidateQueries({ queryKey: ['transactionAttachments'] });
        queryClient.invalidateQueries({ queryKey: ['reportAttachments'] });
      }

      toast.success(t('txForm.success'));
      setForm(initialFormState);
      onSuccess();
    } catch (error) {
      toast.error(t('txForm.error'));
      console.error(error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const updateField = <K extends keyof typeof form>(field: K, value: typeof form[K]) => {
    setForm(prev => {
      const updated = { ...prev, [field]: value };

      // Auto-fill ITBIS Retenido when document changes to B11
      if (field === 'document' && typeof value === 'string') {
        const isNowB11 = value.toUpperCase().startsWith('B11');
        const wasB11 = prev.document?.toUpperCase().startsWith('B11');
        if (isNowB11 && !wasB11 && prev.itbis && !prev.itbis_retenido) {
          updated.itbis_retenido = prev.itbis;
        }
      }
      
      // Auto-fill RNC when name changes and matches a previous transaction
      if (field === 'name' && typeof value === 'string' && value.trim()) {
        const normalizedName = value.trim().toLowerCase();
        const matchingTx = existingTransactions.find(
          tx => tx.name?.trim().toLowerCase() === normalizedName && tx.rnc
        );
        if (matchingTx?.rnc && !prev.rnc) {
          updated.rnc = matchingTx.rnc;
        }

        // Auto-fill from vendor rules
        const upperName = value.trim().toUpperCase();
        const rule = vendorRules.find(
          (r: any) => upperName.includes(r.vendor_name) || r.vendor_name.includes(upperName)
        );
        if (rule) {
          if (!prev.master_acct_code) updated.master_acct_code = rule.master_acct_code;
          if (!prev.project_code && rule.project_code) updated.project_code = rule.project_code;
          if (!prev.cbs_code && rule.cbs_code) updated.cbs_code = rule.cbs_code;
          if (!prev.description && rule.description_template) updated.description = rule.description_template;
        }
      }
      
      return updated;
    });
  };

  const handleOcrResult = (result: OcrResult) => {
    setForm(prev => {
      const updated = { ...prev };
      // Only fill empty fields
      if (result.vendor_name && !prev.name) updated.name = result.vendor_name;
      if (result.rnc && !prev.rnc) updated.rnc = result.rnc;
      if (result.date && !prev.transaction_date) {
        updated.transaction_date = new Date(result.date + 'T12:00:00');
      }
      if (result.amount != null && !prev.amount) updated.amount = result.amount.toString();
      if (result.itbis != null && !prev.itbis) updated.itbis = result.itbis.toString();
      if (result.document && !prev.document) updated.document = result.document;
      if (result.pay_method && !prev.pay_method) updated.pay_method = result.pay_method;
      if (result.master_acct_code && !prev.master_acct_code) updated.master_acct_code = result.master_acct_code;

      // Auto-fill description from OCR
      if (result.description && !updated.description) {
        updated.description = result.description;
      }

      // Apply vendor rules if name was filled
      if (result.vendor_name) {
        const upperName = result.vendor_name.trim().toUpperCase();
        const rule = vendorRules.find(
          (r: any) => upperName.includes(r.vendor_name) || r.vendor_name.includes(upperName)
        );
        if (rule) {
          if (!prev.master_acct_code) updated.master_acct_code = rule.master_acct_code;
          if (!prev.project_code && rule.project_code) updated.project_code = rule.project_code;
          if (!prev.cbs_code && rule.cbs_code) updated.cbs_code = rule.cbs_code;
          if (!updated.description && rule.description_template) updated.description = rule.description_template;
        }
      }

      // Diesel < 10k rule: auto-assign account 5611
      const amt = parseFloat(updated.amount || '0');
      const desc = (updated.description || '').toLowerCase();
      if (!updated.master_acct_code && desc.includes('diesel') && amt > 0 && amt < 10000) {
        updated.master_acct_code = '5611';
      }

      return updated;
    });
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0">
        <CardTitle>{t('txForm.title')}</CardTitle>
        <ScanReceiptButton onResult={handleOcrResult} disabled={isSubmitting} />
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Dates Row */}
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label>{t('txForm.transactionDate')}</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={cn(
                      'w-full justify-start text-left font-normal',
                      !form.transaction_date && 'text-muted-foreground'
                    )}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {form.transaction_date ? format(form.transaction_date, 'PPP') : t('txForm.selectDate')}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0 bg-popover" align="start">
                  <Calendar
                    mode="single"
                    selected={form.transaction_date}
                    onSelect={(date) => updateField('transaction_date', date)}
                    initialFocus
                  />
                </PopoverContent>
              </Popover>
            </div>

            <div className="space-y-2">
              <Label>{t('txForm.purchaseDate')}</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={cn(
                      'w-full justify-start text-left font-normal',
                      !form.purchase_date && 'text-muted-foreground'
                    )}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {form.purchase_date ? format(form.purchase_date, 'PPP') : t('txForm.selectDate')}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0 bg-popover" align="start">
                  <Calendar
                    mode="single"
                    selected={form.purchase_date}
                    onSelect={(date) => updateField('purchase_date', date)}
                    initialFocus
                  />
                </PopoverContent>
              </Popover>
            </div>
          </div>

          {/* Account Dropdowns + Cost Center */}
          <div className="grid gap-4 md:grid-cols-5">
            <div className="space-y-2">
              <Label>{t('txForm.direction')}</Label>
              <Select
                value={form.transaction_direction}
                onValueChange={(value: 'purchase' | 'sale' | 'investment') => {
                  updateField('transaction_direction', value);
                  if (value !== 'investment') {
                    updateField('destination_acct_code', '');
                  }
                }}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-popover">
                  <SelectItem value="purchase">{t('txForm.purchase')}</SelectItem>
                  <SelectItem value="sale">{t('txForm.sale')}</SelectItem>
                  <SelectItem value="investment">{t('txForm.investment')}</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>{t('txForm.costCenter')}</Label>
              <Select
                value={form.cost_center}
                onValueChange={(value: 'general' | 'agricultural' | 'industrial') => updateField('cost_center', value)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-popover">
                  <SelectItem value="general">{t('txForm.general')}</SelectItem>
                  <SelectItem value="agricultural">{t('txForm.agricultural')}</SelectItem>
                  <SelectItem value="industrial">{t('txForm.industrial')}</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>{t('txForm.mainAccount')}</Label>
              <Select
                value={form.master_acct_code}
                onValueChange={(value) => updateField('master_acct_code', value)}
              >
                <SelectTrigger>
                  <SelectValue placeholder={loadingAccounts ? t('txForm.loadingAccounts') : t('txForm.selectAccount')} />
                </SelectTrigger>
                <SelectContent className="bg-popover max-h-[300px]">
                  {accounts.map((account: Account) => (
                    <SelectItem key={account.code} value={account.code}>
                      {account.code} - {getDescription(account)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>
                {t('txForm.project')} {requires1180Fields && '*'}
              </Label>
              <Select
                value={form.project_code}
                onValueChange={(value) => updateField('project_code', value)}
              >
                <SelectTrigger className={cn(requires1180Fields && !form.project_code && 'border-destructive')}>
                  <SelectValue placeholder={loadingProjects ? t('txForm.loadingProjects') : t('txForm.selectProject')}>
                    {form.project_code && (() => {
                      const selected = projects.find(p => p.code === form.project_code);
                      return selected ? `${selected.code} - ${getDescription(selected)}` : form.project_code;
                    })()}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent className="bg-popover max-h-[300px] z-50">
                  {projects.map((project: Project) => (
                    <SelectItem key={project.code} value={project.code}>
                      {project.code} - {getDescription(project)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>
                {t('txForm.cbsCode')} {requires1180Fields && '*'}
              </Label>
              <Select
                value={form.cbs_code}
                onValueChange={(value) => updateField('cbs_code', value)}
              >
                <SelectTrigger className={cn(requires1180Fields && !form.cbs_code && 'border-destructive')}>
                  <SelectValue placeholder={loadingCbsCodes ? t('txForm.loadingCbs') : t('txForm.selectCbs')}>
                    {form.cbs_code && (() => {
                      const selected = cbsCodes.find(c => String(c.code) === form.cbs_code);
                      return selected ? `${selected.code} - ${getDescription(selected)}` : form.cbs_code;
                    })()}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent className="bg-popover max-h-[300px] z-50">
                  {cbsCodes.map((cbs: CbsCode) => (
                    <SelectItem key={cbs.code} value={String(cbs.code)}>
                      {cbs.code} - {getDescription(cbs)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Destination Account - only for investment transactions */}
          {form.transaction_direction === 'investment' && (
            <div className="space-y-2">
              <Label>{t('txForm.destinationAccount')} *</Label>
              <Select
                value={form.destination_acct_code}
                onValueChange={(value) => updateField('destination_acct_code', value)}
              >
                <SelectTrigger>
                  <SelectValue placeholder={t('txForm.selectDestinationAccount')} />
                </SelectTrigger>
                <SelectContent className="bg-popover max-h-[300px]">
                  {chartOfAccounts.map((acct) => (
                    <SelectItem key={acct.id} value={acct.account_code}>
                      {acct.account_code} - {acct.account_name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {form.destination_acct_code?.startsWith('12') && (
                <p className="text-xs text-amber-600 dark:text-amber-400">
                  💡 {t('txForm.fixedAssetReminder')}
                </p>
              )}
            </div>
          )}

          {/* Description */}
          <div className="space-y-2">
            <Label>{t('txForm.description')}</Label>
            <Input
              value={form.description}
              onChange={(e) => updateField('description', e.target.value)}
              placeholder={t('txForm.descriptionPlaceholder')}
            />
          </div>

          {/* Tipo de Ingreso - only for sales */}
          {form.transaction_direction === 'sale' && (
            <div className="space-y-2 max-w-xs">
              <Label>{t('txForm.tipoIngreso')}</Label>
              <Select
                value={form.dgii_tipo_ingreso}
                onValueChange={(value) => updateField('dgii_tipo_ingreso', value)}
              >
                <SelectTrigger>
                  <SelectValue placeholder={t('txForm.selectTipoIngreso')} />
                </SelectTrigger>
                <SelectContent className="bg-popover">
                  {Object.entries(TIPO_INGRESO).map(([code, desc]) => (
                    <SelectItem key={code} value={code}>
                      {code} - {desc}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
          <div className="grid gap-4 md:grid-cols-4">
            <div className="space-y-2">
              <Label>{t('txForm.currency')}</Label>
              <Select
                value={form.currency}
                onValueChange={(value: 'DOP' | 'USD') => updateField('currency', value)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-popover">
                  <SelectItem value="DOP">DOP</SelectItem>
                  <SelectItem value="USD">USD</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>{t('txForm.amount')}</Label>
              <Input
                type="number"
                step="0.01"
                value={form.amount}
                onChange={(e) => updateField('amount', e.target.value)}
                placeholder="0.00"
                className="font-mono"
              />
            </div>

            <div className="space-y-2">
              <Label>ITBIS</Label>
              <Input
                type="number"
                step="0.01"
                value={form.itbis}
                onChange={(e) => {
                  const newItbis = e.target.value;
                  updateField('itbis', newItbis);
                  // Auto-fill ITBIS Retenido for B11 if currently empty
                  const isB11 = form.document?.toUpperCase().startsWith('B11');
                  if (isB11 && newItbis && !form.itbis_retenido) {
                    updateField('itbis_retenido', newItbis);
                  }
                }}
                placeholder="0.00"
                className="font-mono"
              />
            </div>

            <div className="space-y-2">
              <Label>{t('txForm.exchangeRate')}</Label>
              <Input
                type="number"
                step="0.0001"
                value={form.exchange_rate}
                onChange={(e) => updateField('exchange_rate', e.target.value)}
                placeholder="0.0000"
                className="font-mono"
              />
            </div>
          </div>

          {/* B11 Withholding Fields - visible only for B11 documents */}
          {form.document?.toUpperCase().startsWith('B11') && (
            <div className="grid gap-4 md:grid-cols-2 max-w-md">
              <div className="space-y-2">
                <Label>ITBIS Retenido</Label>
                <Input
                  type="number"
                  step="0.01"
                  value={form.itbis_retenido}
                  onChange={(e) => updateField('itbis_retenido', e.target.value)}
                  placeholder="0.00"
                  className="font-mono"
                />
                <p className="text-xs text-muted-foreground">100% del ITBIS</p>
              </div>
              <div className="space-y-2">
                <Label>ISR Retenido</Label>
                <Input
                  type="number"
                  step="0.01"
                  value={form.isr_retenido}
                  onChange={(e) => updateField('isr_retenido', e.target.value)}
                  placeholder="0.00"
                  className="font-mono"
                />
                <p className="text-xs text-muted-foreground">10% renta / 2% bienes</p>
              </div>
            </div>
          )}

          {/* Additional Fields */}
          <div className="grid gap-4 md:grid-cols-4">
            <div className="space-y-2">
              <Label>{t('txForm.payMethod')}</Label>
              <Select
                value={form.pay_method}
                onValueChange={(value) => updateField('pay_method', value)}
              >
                <SelectTrigger>
                  <SelectValue placeholder={t('txForm.selectMethod')} />
                </SelectTrigger>
                <SelectContent className="bg-popover">
                  <SelectItem value="transfer_bdi">{t('txForm.transferBdi')}</SelectItem>
                  <SelectItem value="transfer_bhd">{t('txForm.transferBhd')}</SelectItem>
                  <SelectItem value="cash">{t('txForm.cash')}</SelectItem>
                  <SelectItem value="petty_cash">{t('txForm.pettyCash')}</SelectItem>
                  <SelectItem value="cc_management">{t('txForm.ccManagement')}</SelectItem>
                  <SelectItem value="cc_agri">{t('txForm.ccAgri')}</SelectItem>
                  <SelectItem value="cc_industry">{t('txForm.ccIndustry')}</SelectItem>
                  <SelectItem value="credit">{t('txForm.credit')}</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>{t('txForm.document')}</Label>
              <Input
                value={form.document}
                onChange={(e) => updateField('document', e.target.value)}
                placeholder={t('txForm.documentPlaceholder')}
              />
            </div>

            <div className="space-y-2 relative">
              <Label>{form.transaction_direction === 'sale' ? t('txForm.cliente') : t('txForm.name')}</Label>
              <NameAutocomplete
                value={form.name}
                onChange={(value) => updateField('name', value)}
                suggestions={uniqueNames}
              />
            </div>

            <div className="space-y-2">
              <Label>{t('txForm.rnc')}</Label>
              <Input
                value={form.rnc}
                onChange={(e) => updateField('rnc', e.target.value)}
                placeholder={t('txForm.rncPlaceholder')}
              />
            </div>

            <div className="space-y-2">
              <Label>Fecha Vencimiento</Label>
              <Input
                type="date"
                value={form.due_date || ''}
                onChange={(e) => updateField('due_date', e.target.value)}
              />
            </div>
          </div>

          {/* Comments and Attachment */}
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label>{t('txForm.comments')}</Label>
              <Textarea
                value={form.comments}
                onChange={(e) => updateField('comments', e.target.value)}
                placeholder={t('txForm.commentsPlaceholder')}
                rows={3}
              />
            </div>

            <div className="space-y-2">
              <Label>{t('txForm.attachments')}</Label>
              <MultiAttachmentUpload
                attachments={form.attachments}
                onUpload={(category, url) => 
                  updateField('attachments', { ...form.attachments, [category]: url })
                }
                onClear={(category) => 
                  updateField('attachments', { ...form.attachments, [category]: null })
                }
              />
              <p className="text-xs text-muted-foreground">
                {t('txForm.attachmentHelp')}
              </p>
            </div>
          </div>

          {/* Submit */}
          <div className="flex justify-end gap-2 pt-4 border-t">
            <Button type="button" variant="outline" onClick={() => setForm(initialFormState)} disabled={isSubmitting}>
              {t('common.clear') || 'Limpiar'}
            </Button>
            <Button type="submit" disabled={isSubmitting || !isValid()}>
              {isSubmitting ? t('txForm.saving') : t('txForm.saveTransaction')}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
