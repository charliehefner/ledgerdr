import { useState, useMemo, useRef, useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { CalendarIcon, AlertTriangle } from 'lucide-react';
import { getDescription } from '@/lib/getDescription';
import { useLanguage } from '@/contexts/LanguageContext';
import { formatDateLocal } from '@/lib/dateUtils';
import { TIPO_INGRESO, TIPO_BIENES_SERVICIOS } from '@/components/accounting/dgiiConstants';
import {
  fetchAccounts,
  fetchProjects,
  fetchCbsCodes,
  fetchRecentTransactions,
  Account,
  Project,
  CbsCode,
} from '@/lib/api';
import { supabase } from '@/integrations/supabase/client';
import { useEntity } from '@/contexts/EntityContext';
import { useAuth } from '@/contexts/AuthContext';
import {
  evaluatePostingRules,
  mergeRuleActions,
  logRuleApplications,
  detectRuleConflicts,
  type MatchedRule,
  type RuleConflict,
} from '@/lib/postingRules';
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
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectSeparator,
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
import { Alert, AlertDescription } from '@/components/ui/alert';
import { cn } from '@/lib/utils';
// apArUtils business rules are now enforced in the create_transaction_with_ap_ar DB function.
// The utility module is kept for use by other consumers (AP/AR list views, etc.).

interface TransactionFormProps {
  onSuccess: () => void;
}

const getInitialFormState = () => ({
  transaction_date: undefined as Date | undefined,
  master_acct_code: '',
  project_code: '',
  cbs_code: '',
  purchase_date: undefined as Date | undefined,
  description: '',
  currency: 'DOP' as 'DOP' | 'USD' | 'EUR',
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
  transaction_direction: 'purchase' as 'purchase' | 'sale' | 'payment' | 'investment',
  itbis_override_reason: '',
  destination_acct_code: '',
  dgii_tipo_ingreso: '',
  dgii_tipo_bienes_servicios: '',
  due_date: '',
  transfer_from_account: '',
  transfer_to_account: '',
  transfer_dest_amount: '',
  attachments: {
    ncf: null,
    payment_receipt: null,
    quote: null,
  } as CategoryAttachments,
});

export function TransactionForm({ onSuccess }: TransactionFormProps) {
  const queryClient = useQueryClient();
  const [form, setForm] = useState(getInitialFormState);
  const [formKey, setFormKey] = useState(0);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showCrmPrompt, setShowCrmPrompt] = useState(false);
  const [pendingCrmContact, setPendingCrmContact] = useState<{ name: string; rnc: string } | null>(null);
  const { t } = useLanguage();
  const { selectedEntityId } = useEntity();
  const { user } = useAuth();
  const isOffice = user?.role === "office";

  // Posting-rule engine state — captured silently. Used at submit time to
  // (a) set manual_credit_account_code on the new transaction row, and
  // (b) write audit rows to posting_rule_applications.
  const matchedPostingRulesRef = useRef<MatchedRule[]>([]);
  const [ruleConflicts, setRuleConflicts] = useState<RuleConflict[]>([]);
  const pendingCreditCodeRef = useRef<string | null>(null);
  const ruleAppliedFieldsRef = useRef<Record<string, unknown>>({});

  const { data: accounts = [], isLoading: loadingAccounts } = useQuery({
    queryKey: ['accounts'],
    queryFn: fetchAccounts,
  });


  // Fetch active bank accounts for transfer From/To dropdowns
  const { data: bankAccounts = [] } = useQuery({
    queryKey: ['bankAccountsForTransfer'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('bank_accounts')
        .select('id, account_name, account_type, bank_name, chart_account_id, currency, is_shared, entity_id')
        .eq('is_active', true)
        .order('account_type, account_name');
      if (error) throw error;
      return data || [];
    },
  });

  // Fetch current entity's group to detect sibling shared accounts
  const { data: currentEntityGroup } = useQuery({
    queryKey: ['entity-group-for-tx', selectedEntityId],
    queryFn: async () => {
      if (!selectedEntityId) return null;
      const { data: ent } = await supabase
        .from('entities')
        .select('id, entity_group_id, code')
        .eq('id', selectedEntityId)
        .maybeSingle();
      return ent;
    },
    enabled: !!selectedEntityId,
  });

  // Fetch sibling entities in same group for labeling
  const { data: siblingEntities = [] } = useQuery({
    queryKey: ['sibling-entities', currentEntityGroup?.entity_group_id],
    queryFn: async () => {
      if (!currentEntityGroup?.entity_group_id) return [];
      const { data } = await supabase
        .from('entities')
        .select('id, code, name')
        .eq('entity_group_id', currentEntityGroup.entity_group_id)
        .eq('is_active', true)
        .neq('id', currentEntityGroup.id);
      return data || [];
    },
    enabled: !!currentEntityGroup?.entity_group_id,
  });

  // Filter sibling shared bank accounts
  const siblingSharedAccounts = bankAccounts.filter(a =>
    a.is_shared &&
    a.entity_id &&
    currentEntityGroup?.id &&
    a.entity_id !== currentEntityGroup.id &&
    siblingEntities.some(s => s.id === a.entity_id)
  );

  const isIntercompanyPayment = (payMethodId: string) => {
    return siblingSharedAccounts.some(a => a.id === payMethodId);
  };

  // Fetch JORD AB head office account for transfer destination
  const { data: headOfficeAccounts = [] } = useQuery({
    queryKey: ['headOfficeAccount'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('chart_of_accounts')
        .select('id, account_code, account_name')
        .eq('account_code', '2160')
        .is('deleted_at', null);
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

  // Credit note alert state
  const [creditNotes, setCreditNotes] = useState<{ id: string; balance_remaining: number; currency: string; document_number: string | null }[]>([]);
  
  useEffect(() => {
    const name = form.name?.trim();
    if (!name || name.length < 2) {
      setCreditNotes([]);
      return;
    }
    const timer = setTimeout(async () => {
      const { data } = await supabase
        .from('ap_ar_documents')
        .select('id, balance_remaining, currency, document_number')
        .eq('contact_name', name)
        .eq('document_type', 'credit_memo')
        .not('status', 'in', '("paid","void")')
        .gt('balance_remaining', 0);
      setCreditNotes(data || []);
    }, 400);
    return () => clearTimeout(timer);
  }, [form.name]);

  const uniqueNames = useMemo(() => {
    const names = new Set<string>();
    existingTransactions.forEach(tx => {
      if (tx.name?.trim()) names.add(tx.name.trim());
    });
    return Array.from(names).sort((a, b) => a.localeCompare(b, 'es'));
  }, [existingTransactions]);

  const requires1180Fields = form.master_acct_code === '1180';

  const checkForDuplicate = () => {
    const doc = (form.document || '').trim();
    // No NCF entered — nothing to check
    if (!doc) return null;
    // Skip duplicate check for Nomina (payroll) transactions
    if (form.description.toLowerCase().includes('nomina')) return null;
    // Only check duplicates for real NCFs (e.g. B0100000001) or numeric sequences
    // Skip generic words like "Recibo", "Factura", etc.
    const isNcf = /^[BbEe]\d{2}/i.test(doc) || /^\d{8,}$/.test(doc);
    if (!isNcf) return null;

    return existingTransactions.find(tx => {
      const txDoc = (tx.document || '').trim();
      return txDoc === doc;
    }) || null;
  };

  const isValid = () => {
    if (!form.transaction_date || !form.master_acct_code || !form.description || !form.amount) {
      return false;
    }
    if (requires1180Fields && (!form.project_code || !form.cbs_code)) {
      return false;
    }
    if (form.transaction_direction === 'payment' || form.transaction_direction === 'investment') {
      if (!form.transfer_from_account || !form.transfer_to_account) return false;
      // Prevent self-transfer
      if (form.transfer_from_account === form.transfer_to_account) return false;
      // Require destination amount for cross-currency
      const fromAcct = bankAccounts.find(a => a.id === form.transfer_from_account);
      const toAcct = bankAccounts.find(a => a.id === form.transfer_to_account);
      const fromCur = fromAcct?.currency || 'DOP';
      const toCur = toAcct?.currency || 'DOP';
      if (fromCur !== toCur && !form.transfer_dest_amount) return false;
    }
    // ITBIS cannot exceed 18% of amount (unless override reason provided)
    if (form.itbis && form.amount && !form.itbis_override_reason) {
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
      const isTransfer = form.transaction_direction === 'payment' || form.transaction_direction === 'investment';
      if (isTransfer && !form.transfer_from_account) {
        toast.error("Seleccione cuenta origen");
      } else if (isTransfer && !form.transfer_to_account) {
        toast.error("Seleccione cuenta destino");
      } else if (isTransfer && form.transfer_from_account === form.transfer_to_account) {
        toast.error("Origen y destino no pueden ser iguales");
      } else if (isTransfer && !form.transfer_dest_amount) {
        const fromAcct = bankAccounts.find(a => a.id === form.transfer_from_account);
        const toAcct = bankAccounts.find(a => a.id === form.transfer_to_account);
        const fromCur = fromAcct?.currency || 'DOP';
        const toCur = toAcct?.currency || 'DOP';
        if (fromCur !== toCur) {
          toast.error("Ingrese monto destino para transferencia multi-moneda");
        } else {
          toast.error(t('txForm.requiredFields'));
        }
      } else if (requires1180Fields && (!form.project_code || !form.cbs_code)) {
        toast.error(t('txForm.projectCbsRequired'));
      } else if (form.itbis && form.amount && !form.itbis_override_reason && parseFloat(form.itbis) > parseFloat(form.amount) * 0.18) {
        toast.error(t('txForm.itbisExceeds'));
      } else {
        toast.error(t('txForm.requiredFields'));
      }
      return;
    }

    const clashingTx = checkForDuplicate();
    if (clashingTx) {
      const txNum = clashingTx.legacy_id ? `#${clashingTx.legacy_id}` : '';
      const txName = clashingTx.description || '';
      const txDate = clashingTx.transaction_date || '';
      const txAmt = clashingTx.amount != null
        ? parseFloat(String(clashingTx.amount)).toLocaleString('es-DO', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
        : '';
      toast.error(`Duplicado: NCF ya usado en transacción ${txNum} — ${txName}, ${txDate}, ${txAmt}`);
      return;
    }

    setIsSubmitting(true);

    try {
      const isB11 = form.document?.toUpperCase().startsWith('B11');
      const isTransfer = form.transaction_direction === 'payment' || form.transaction_direction === 'investment';
      
      // For transfers, map the from/to accounts
      // transfer_from_account = bank_accounts.id → used as pay_method identifier
      // transfer_to_account = bank_accounts.id or coa:code → used as destination_acct_code
      let transferDestCode: string | undefined;
      if (isTransfer && form.transfer_to_account) {
        if (form.transfer_to_account.startsWith('coa:')) {
          transferDestCode = form.transfer_to_account.replace('coa:', '');
        } else {
          // It's a bank_accounts id — store it as destination
          transferDestCode = form.transfer_to_account;
        }
      }

      // Determine destination amount for cross-currency transfers
      let destinationAmount: number | undefined;
      if (isTransfer && form.transfer_dest_amount) {
        destinationAmount = parseFloat(form.transfer_dest_amount);
      }

      // Single atomic RPC: inserts the transaction and, when applicable, the AP/AR
      // document and junction row in one DB transaction. Replaces the old two-step
      // pattern that left orphaned transactions if the AP/AR insert failed.
      const { data: rpcResult, error: rpcError } = await supabase.rpc(
        'create_transaction_with_ap_ar' as any,
        {
          p_transaction_date:          formatDateLocal(form.transaction_date!),
          p_master_acct_code:          form.master_acct_code,
          p_description:               form.description,
          p_currency:                  form.currency,
          p_amount:                    parseFloat(form.amount),
          p_project_code:              form.project_code || null,
          p_cbs_code:                  form.cbs_code || null,
          p_purchase_date:             form.purchase_date ? formatDateLocal(form.purchase_date) : null,
          p_itbis:                     form.itbis ? parseFloat(form.itbis) : 0,
          p_itbis_retenido:            isB11 && form.itbis_retenido ? parseFloat(form.itbis_retenido) : 0,
          p_isr_retenido:              isB11 && form.isr_retenido ? parseFloat(form.isr_retenido) : 0,
          p_pay_method:                isTransfer ? form.transfer_from_account : (form.pay_method || null),
          p_document:                  form.document || null,
          p_name:                      form.name || null,
          p_rnc:                       form.rnc || null,
          p_comments:                  form.comments || null,
          p_exchange_rate:             form.exchange_rate ? parseFloat(form.exchange_rate) : null,
          p_is_internal:               isTransfer || form.master_acct_code === '0000',
          p_cost_center:               form.cost_center,
          p_transaction_direction:     form.transaction_direction,
          p_destination_acct_code:     isTransfer ? (transferDestCode ?? null) : null,
          p_dgii_tipo_ingreso:         form.transaction_direction === 'sale' ? (form.dgii_tipo_ingreso || null) : null,
          p_dgii_tipo_bienes_servicios: form.transaction_direction === 'purchase' ? (form.dgii_tipo_bienes_servicios || null) : null,
          p_due_date:                  form.due_date || null,
          p_destination_amount:        destinationAmount ?? null,
          p_itbis_override_reason:     form.itbis_override_reason || null,
          p_entity_id:                 selectedEntityId || null,
        }
      );

      if (rpcError) throw new Error(rpcError.message);

      const result = rpcResult as { id: string; legacy_id: number | null };

      // Save all attachments to local database
      if (result.id) {
        const attachmentCategories: AttachmentCategory[] = ['ncf', 'payment_receipt', 'quote'];
        for (const category of attachmentCategories) {
          if (form.attachments[category]) {
            await saveAttachment(result.id, form.attachments[category]!, category);
          }
        }
        queryClient.invalidateQueries({ queryKey: ['transactionAttachments'] });
        queryClient.invalidateQueries({ queryKey: ['reportAttachments'] });
        queryClient.invalidateQueries({ queryKey: ['ap-ar-documents'] });

        // Posting rules: persist credit-account override and audit log.
        // Only fires if at least one rule matched the current input.
        if (matchedPostingRulesRef.current.length > 0) {
          if (pendingCreditCodeRef.current) {
            try {
              await supabase
                .from('transactions')
                .update({ manual_credit_account_code: pendingCreditCodeRef.current } as any)
                .eq('id', result.id);
            } catch (e) {
              console.warn('[postingRules] failed to persist credit override:', e);
            }
          }
          await logRuleApplications({
            transactionId: result.id,
            rules: matchedPostingRulesRef.current,
            appliedFields: ruleAppliedFieldsRef.current,
            context: 'transaction_entry',
          });
        }
      }

      toast.success(t('txForm.success'));
      setForm(getInitialFormState());
      setFormKey(k => k + 1);
      // Clear posting-rule refs for the next entry
      matchedPostingRulesRef.current = [];
      pendingCreditCodeRef.current = null;
      ruleAppliedFieldsRef.current = {};
      setRuleConflicts([]);
      onSuccess();
    } catch (error) {
      const msg = error instanceof Error ? error.message : '';
      toast.error(msg || t('txForm.error'));
      console.error(error);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Posting-rules trigger fields. Changes to these fields re-evaluate rules.
  const RULE_TRIGGER_FIELDS = new Set<keyof typeof form>([
    'name', 'description', 'document', 'amount', 'currency', 'transaction_direction',
  ]);

  /**
   * Evaluate posting rules against the given form snapshot and silently
   * apply matching actions to empty fields. Stores matched rules and any
   * credit-account override on refs for use at submit time.
   */
  const runPostingRules = async (snapshot: typeof form) => {
    try {
      const rules = await evaluatePostingRules(selectedEntityId || null, {
        vendor: snapshot.name || null,
        description: snapshot.description || null,
        document: snapshot.document || null,
        amount: snapshot.amount ? parseFloat(snapshot.amount) : null,
        currency: snapshot.currency || null,
        transaction_type: snapshot.transaction_direction || null,
        context: 'transaction_entry',
      });
      if (!rules.length) return;
      const merged = mergeRuleActions(rules);
      const applied: Record<string, unknown> = {};

      // Apply only to empty fields. Manual user edits always win.
      setForm(prev => {
        const upd = { ...prev };
        if (merged.master_account_code && !prev.master_acct_code) {
          upd.master_acct_code = merged.master_account_code;
          applied.master_acct_code = merged.master_account_code;
        }
        if (merged.project_code && !prev.project_code) {
          upd.project_code = merged.project_code;
          applied.project_code = merged.project_code;
        }
        if (merged.cbs_code && !prev.cbs_code) {
          upd.cbs_code = merged.cbs_code;
          applied.cbs_code = merged.cbs_code;
        }
        if (merged.cost_center && prev.cost_center === 'general') {
          // Only overwrite the default; user-changed cost centers are respected.
          upd.cost_center = merged.cost_center;
          applied.cost_center = merged.cost_center;
        }
        if (merged.append_note) {
          // Only append if note isn't already present, to avoid duplicates on re-eval.
          if (!prev.comments?.includes(merged.append_note)) {
            upd.comments = (prev.comments ? prev.comments + ' · ' : '') + merged.append_note;
            applied.append_note = merged.append_note;
          }
        }
        return upd;
      });

      // Credit-account override: stored on a ref, persisted post-insert.
      if (merged.credit_account_code) {
        pendingCreditCodeRef.current = merged.credit_account_code;
        applied.manual_credit_account_code = merged.credit_account_code;
      }

      matchedPostingRulesRef.current = rules;
      ruleAppliedFieldsRef.current = applied;
      setRuleConflicts(detectRuleConflicts(rules));
    } catch (e) {
      console.warn('[postingRules] eval failed (non-blocking):', e);
    }
  };

  const updateField = <K extends keyof typeof form>(field: K, value: typeof form[K]) => {
    let nextSnapshot: typeof form | null = null;
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

        // Auto-fill from legacy vendor rules
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

      nextSnapshot = updated;
      return updated;
    });

    // Re-evaluate posting rules when a trigger field changed.
    if (RULE_TRIGGER_FIELDS.has(field) && nextSnapshot) {
      void runPostingRules(nextSnapshot);
    }
  };

  const handleOcrResult = async (result: OcrResult) => {
    let postOcrSnapshot: typeof form | null = null;
    setForm(prev => {
      const updated = { ...prev };
      // Only fill empty fields
      if (result.vendor_name && !prev.name) updated.name = result.vendor_name;
      if (result.rnc && !prev.rnc) updated.rnc = result.rnc;
      if (result.date && !prev.purchase_date) {
        updated.purchase_date = new Date(result.date + 'T12:00:00');
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

      postOcrSnapshot = updated;
      return updated;
    });

    // Posting rules: re-evaluate against the OCR-enriched snapshot.
    if (postOcrSnapshot) {
      void runPostingRules(postOcrSnapshot);
    }

    // CRM lookup after OCR
    if (result.rnc) {
      const { data: existing } = await supabase
        .from('contacts')
        .select('id')
        .eq('rnc', result.rnc)
        .maybeSingle();
      if (!existing) {
        setPendingCrmContact({ name: result.vendor_name || '', rnc: result.rnc });
        setShowCrmPrompt(true);
      }
    }
  };

  const handleAddToCrm = async () => {
    if (!pendingCrmContact) return;
    const { error } = await supabase.from('contacts').insert({
      name: pendingCrmContact.name,
      rnc: pendingCrmContact.rnc,
      contact_type: 'supplier',
    });
    if (!error) {
      toast.success(t('contacts.added'));
      queryClient.invalidateQueries({ queryKey: ['contacts'] });
      queryClient.invalidateQueries({ queryKey: ['contactsAutocomplete'] });
    }
    setShowCrmPrompt(false);
    setPendingCrmContact(null);
  };
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0">
        <CardTitle>{t('txForm.title')}</CardTitle>
        <ScanReceiptButton onResult={handleOcrResult} disabled={isSubmitting} />
      </CardHeader>
      <CardContent key={formKey}>
        {isOffice && (
          <div className="mb-4 flex items-start gap-3 rounded-lg border border-amber-300/40 bg-amber-50 dark:bg-amber-950/20 p-3 text-sm">
            <AlertTriangle className="h-4 w-4 mt-0.5 text-amber-600 dark:text-amber-400 shrink-0" />
            <span>{t('txForm.officeApprovalNotice')}</span>
          </div>
        )}
        {ruleConflicts.length > 0 && (
          <div className="mb-4 rounded-lg border border-amber-400/50 bg-amber-50 dark:bg-amber-950/20 p-3 text-sm">
            <div className="flex items-start gap-3">
              <AlertTriangle className="h-4 w-4 mt-0.5 text-amber-600 dark:text-amber-400 shrink-0" />
              <div className="flex-1 space-y-2">
                <div className="font-medium">{t('txForm.ruleConflictTitle')}</div>
                {ruleConflicts.map((c) => (
                  <div key={c.field} className="text-xs">
                    <span className="font-medium">{c.field}:</span>{' '}
                    {c.values.map((v, i) => (
                      <span key={v.value}>
                        {i > 0 && ' · '}
                        <code className="px-1 rounded bg-amber-100 dark:bg-amber-900/40">{v.value}</code>{' '}
                        <span className="text-muted-foreground">({v.ruleName})</span>
                      </span>
                    ))}
                  </div>
                ))}
                <div className="text-xs text-muted-foreground">
                  {t('txForm.ruleConflictHint')}
                </div>
              </div>
            </div>
          </div>
        )}
        {showCrmPrompt && pendingCrmContact && (
          <div className="mb-4 flex items-center gap-3 rounded-lg border border-primary/30 bg-primary/5 p-3">
            <span className="text-sm flex-1">{t('contacts.addToCrm')} <strong>{pendingCrmContact.name}</strong> ({pendingCrmContact.rnc})</span>
            <Button size="sm" onClick={handleAddToCrm}>{t('common.add')}</Button>
            <Button size="sm" variant="ghost" onClick={() => { setShowCrmPrompt(false); setPendingCrmContact(null); }}>{t('common.cancel')}</Button>
          </div>
        )}
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
                onValueChange={(value: 'purchase' | 'sale' | 'payment' | 'investment') => {
                  updateField('transaction_direction', value);
                  if (value === 'payment' || value === 'investment') {
                    updateField('master_acct_code', '0000');
                  }
                  if (value !== 'payment' && value !== 'investment') {
                    updateField('transfer_from_account', '');
                    updateField('transfer_to_account', '');
                    updateField('transfer_dest_amount', '');
                  }
                }}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-popover">
                  <SelectItem value="purchase">{t('txForm.purchase')}</SelectItem>
                  <SelectItem value="sale">{t('txForm.sale')}</SelectItem>
                  <SelectItem value="payment">{t('txForm.payment')}</SelectItem>
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
                value={form.master_acct_code || undefined}
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
                value={form.project_code || undefined}
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
                value={form.cbs_code || undefined}
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


          {/* Transfer From/To - only for transfer (payment) transactions */}
          {(form.transaction_direction === 'payment' || form.transaction_direction === 'investment') && (() => {
            const fromAccount = bankAccounts.find(a => a.id === form.transfer_from_account);
            const toAccount = bankAccounts.find(a => a.id === form.transfer_to_account);
            const fromCurrency = fromAccount?.currency || 'DOP';
            const toCurrency = toAccount?.currency || 'DOP';
            const isCrossCurrency = fromCurrency !== toCurrency;

            return (
              <div className="space-y-4">
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label>{t('txForm.transferFrom')} *</Label>
                    <Select
                      value={form.transfer_from_account || undefined}
                      onValueChange={(value) => {
                        updateField('transfer_from_account', value);
                        const acct = bankAccounts.find(a => a.id === value);
                        if (acct?.currency) {
                          updateField('currency', acct.currency as 'DOP' | 'USD' | 'EUR');
                        }
                      }}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder={t('txForm.selectFromAccount')} />
                      </SelectTrigger>
                      <SelectContent className="bg-popover max-h-[300px]">
                        <SelectGroup>
                          <SelectLabel className="text-xs font-semibold text-muted-foreground">Bancos</SelectLabel>
                          {bankAccounts.filter(a => a.account_type === 'bank').map(a => (
                            <SelectItem key={a.id} value={a.id}>{a.account_name} ({a.currency || 'DOP'})</SelectItem>
                          ))}
                        </SelectGroup>
                        <SelectSeparator />
                        <SelectGroup>
                          <SelectLabel className="text-xs font-semibold text-muted-foreground">Caja Chica</SelectLabel>
                          {bankAccounts.filter(a => a.account_type === 'petty_cash').map(a => (
                            <SelectItem key={a.id} value={a.id}>{a.account_name} ({a.currency || 'DOP'})</SelectItem>
                          ))}
                        </SelectGroup>
                        {headOfficeAccounts.length > 0 && (
                          <>
                            <SelectSeparator />
                            <SelectGroup>
                              <SelectLabel className="text-xs font-semibold text-muted-foreground">Casa Matriz</SelectLabel>
                              {headOfficeAccounts.map(a => (
                                <SelectItem key={a.id} value={`coa:${a.account_code}`}>{a.account_code} - {a.account_name}</SelectItem>
                              ))}
                            </SelectGroup>
                          </>
                        )}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>{t('txForm.transferTo')} *</Label>
                    <Select
                      value={form.transfer_to_account || undefined}
                      onValueChange={(value) => updateField('transfer_to_account', value)}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder={t('txForm.selectToAccount')} />
                      </SelectTrigger>
                      <SelectContent className="bg-popover max-h-[300px]">
                        <SelectGroup>
                          <SelectLabel className="text-xs font-semibold text-muted-foreground">Bancos</SelectLabel>
                          {bankAccounts.filter(a => a.account_type === 'bank').map(a => (
                            <SelectItem key={a.id} value={a.id}>{a.account_name} ({a.currency || 'DOP'})</SelectItem>
                          ))}
                        </SelectGroup>
                        <SelectSeparator />
                        <SelectGroup>
                          <SelectLabel className="text-xs font-semibold text-muted-foreground">Tarjetas de Crédito</SelectLabel>
                          {bankAccounts.filter(a => a.account_type === 'credit_card').map(a => (
                            <SelectItem key={a.id} value={a.id}>{a.account_name} ({a.currency || 'DOP'})</SelectItem>
                          ))}
                        </SelectGroup>
                        <SelectSeparator />
                        <SelectGroup>
                          <SelectLabel className="text-xs font-semibold text-muted-foreground">Caja Chica</SelectLabel>
                          {bankAccounts.filter(a => a.account_type === 'petty_cash').map(a => (
                            <SelectItem key={a.id} value={a.id}>{a.account_name} ({a.currency || 'DOP'})</SelectItem>
                          ))}
                        </SelectGroup>
                        {headOfficeAccounts.length > 0 && (
                          <>
                            <SelectSeparator />
                            <SelectGroup>
                              <SelectLabel className="text-xs font-semibold text-muted-foreground">Casa Matriz</SelectLabel>
                              {headOfficeAccounts.map(a => (
                                <SelectItem key={a.id} value={`coa:${a.account_code}`}>{a.account_code} - {a.account_name}</SelectItem>
                              ))}
                            </SelectGroup>
                          </>
                        )}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                {/* Cross-currency destination amount */}
                {isCrossCurrency && (
                  <div className="grid gap-4 md:grid-cols-3 p-3 rounded-md border border-dashed border-muted-foreground/30 bg-muted/30">
                    <div className="space-y-2">
                      <Label>Monto Origen ({fromCurrency})</Label>
                      <p className="text-sm font-mono font-medium">{form.amount || '0.00'}</p>
                    </div>
                    <div className="space-y-2">
                      <Label>Monto Destino ({toCurrency}) *</Label>
                      <Input
                        type="number"
                        step="0.01"
                        value={form.transfer_dest_amount}
                        onChange={(e) => updateField('transfer_dest_amount', e.target.value)}
                        placeholder="0.00"
                        className="font-mono"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Tasa Implícita</Label>
                      <p className="text-sm font-mono text-muted-foreground">
                        {form.amount && form.transfer_dest_amount && parseFloat(form.amount) > 0
                          ? (parseFloat(form.transfer_dest_amount) / parseFloat(form.amount)).toFixed(4)
                          : '—'}
                      </p>
                    </div>
                  </div>
                )}
              </div>
            );
          })()}

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
                value={form.dgii_tipo_ingreso || undefined}
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

          {/* Tipo de Bienes/Servicios - only for purchases */}
          {form.transaction_direction === 'purchase' && (
            <div className="space-y-2 max-w-xs">
              <Label>Tipo Bienes/Servicios</Label>
              <Select
                value={form.dgii_tipo_bienes_servicios || undefined}
                onValueChange={(value) => updateField('dgii_tipo_bienes_servicios', value)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Seleccionar tipo" />
                </SelectTrigger>
                <SelectContent className="bg-popover">
                  {Object.entries(TIPO_BIENES_SERVICIOS).map(([code, desc]) => (
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
                onValueChange={(value: 'DOP' | 'USD' | 'EUR') => updateField('currency', value)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-popover">
                  <SelectItem value="DOP">DOP</SelectItem>
                  <SelectItem value="USD">USD</SelectItem>
                  <SelectItem value="EUR">EUR</SelectItem>
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
              {/* ITBIS exceeds 18% warning + override */}
              {form.itbis && form.amount && parseFloat(form.itbis) > parseFloat(form.amount) * 0.18 && (
                <div className="mt-1 space-y-1">
                  <p className="text-xs text-destructive">ITBIS excede 18%. ¿Acumula ITBIS de pagos previos?</p>
                  <Input
                    value={form.itbis_override_reason}
                    onChange={(e) => updateField('itbis_override_reason', e.target.value)}
                    placeholder="Ej: ITBIS acumulado de pagos sin NCF"
                    className="h-7 text-xs"
                  />
                </div>
              )}
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
                value={form.pay_method || undefined}
                onValueChange={(value) => updateField('pay_method', value)}
              >
                <SelectTrigger>
                  <SelectValue placeholder={t('txForm.selectMethod')} />
                </SelectTrigger>
                <SelectContent className="bg-popover">
                  {(() => {
                    const banks = bankAccounts.filter(a => a.account_type === 'bank' && !siblingSharedAccounts.some(s => s.id === a.id));
                    const cards = bankAccounts.filter(a => a.account_type === 'credit_card');
                    const petty = bankAccounts.filter(a => a.account_type === 'petty_cash');
                    return (
                      <>
                        {banks.length > 0 && (
                          <SelectGroup>
                            <SelectLabel>Bancos</SelectLabel>
                            {banks.map(a => (
                              <SelectItem key={a.id} value={a.id}>{a.account_name} ({a.currency})</SelectItem>
                            ))}
                          </SelectGroup>
                        )}
                        {siblingSharedAccounts.length > 0 && (
                          <>
                            <SelectSeparator />
                            <SelectGroup>
                              <SelectLabel>Bancos Compartidos (Grupo)</SelectLabel>
                              {siblingSharedAccounts.map(a => {
                                const ownerEntity = siblingEntities.find(e => e.id === a.entity_id);
                                const label = ownerEntity ? `${a.account_name} — ${ownerEntity.code}` : a.account_name;
                                return (
                                  <SelectItem key={a.id} value={a.id}>{label} ({a.currency})</SelectItem>
                                );
                              })}
                            </SelectGroup>
                          </>
                        )}
                        {cards.length > 0 && (
                          <SelectGroup>
                            <SelectLabel>Tarjetas de Crédito</SelectLabel>
                            {cards.map(a => (
                              <SelectItem key={a.id} value={a.id}>{a.account_name} ({a.currency})</SelectItem>
                            ))}
                          </SelectGroup>
                        )}
                        {petty.length > 0 && (
                          <SelectGroup>
                            <SelectLabel>Caja Chica</SelectLabel>
                            {petty.map(a => (
                              <SelectItem key={a.id} value={a.id}>{a.account_name} ({a.currency})</SelectItem>
                            ))}
                          </SelectGroup>
                        )}
                        <SelectSeparator />
                        <SelectItem value="credit">{t('txForm.credit')}</SelectItem>
                      </>
                    );
                  })()}
                </SelectContent>
              </Select>
              {form.pay_method && isIntercompanyPayment(form.pay_method) && (
                <Alert className="mt-2 border-primary/30 bg-primary/5">
                  <AlertDescription className="text-xs text-primary">
                    {t('intercompany.banner')}
                  </AlertDescription>
                </Alert>
              )}
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
                onContactSelect={(contact) => {
                  if (contact.rnc && !form.rnc) {
                    updateField('rnc', contact.rnc);
                  }
                }}
              />
            </div>

            {creditNotes.length > 0 && (
              <div className="md:col-span-3">
                <Alert className="border-yellow-500/50 bg-yellow-50 dark:bg-yellow-900/20">
                  <AlertTriangle className="h-4 w-4 text-yellow-600 dark:text-yellow-400" />
                  <AlertDescription className="text-yellow-800 dark:text-yellow-200">
                    Este proveedor tiene {creditNotes.length} nota(s) de crédito pendiente(s) por{' '}
                    <strong>
                      {creditNotes.reduce((sum, cn) => sum + (cn.balance_remaining || 0), 0).toLocaleString('es-DO', { minimumFractionDigits: 2 })}
                    </strong>
                    . Considere aplicarla(s) antes de registrar un nuevo pago.
                  </AlertDescription>
                </Alert>
              </div>
            )}

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
            <Button type="button" variant="outline" onClick={() => { setForm(getInitialFormState()); setFormKey(k => k + 1); }} disabled={isSubmitting}>
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
