import { useState, useMemo, useRef } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { CalendarIcon } from 'lucide-react';
import { getDescription } from '@/lib/getDescription';
import { formatDateLocal } from '@/lib/dateUtils';
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
import { saveAttachment, AttachmentCategory } from '@/lib/attachments';
import { MultiAttachmentUpload, CategoryAttachments } from './MultiAttachmentUpload';
import { NameAutocomplete } from './NameAutocomplete';
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
  pay_method: '',
  document: '',
  name: '',
  rnc: '',
  comments: '',
  exchange_rate: '',
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

  const { data: accounts = [], isLoading: loadingAccounts } = useQuery({
    queryKey: ['accounts'],
    queryFn: fetchAccounts,
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
        toast.error('Proyecto y código CBS son requeridos para la cuenta 1180');
      } else if (form.itbis && form.amount && parseFloat(form.itbis) > parseFloat(form.amount) * 0.18) {
        toast.error('ITBIS no puede exceder el 18% del monto');
      } else {
        toast.error('Por favor complete todos los campos requeridos');
      }
      return;
    }

    if (checkForDuplicate()) {
      toast.error('Transacción duplicada detectada. Ya existe una transacción con la misma fecha, cuenta, monto y nombre.');
      return;
    }

    setIsSubmitting(true);

    try {
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
        pay_method: form.pay_method || undefined,
        document: form.document || undefined,
        name: form.name || undefined,
        rnc: form.rnc || undefined,
        comments: form.comments || undefined,
        exchange_rate: form.exchange_rate ? parseFloat(form.exchange_rate) : undefined,
        is_internal: form.master_acct_code === '0000',
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

      toast.success('Transacción guardada exitosamente');
      setForm(initialFormState);
      onSuccess();
    } catch (error) {
      toast.error('Error al guardar la transacción');
      console.error(error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const updateField = <K extends keyof typeof form>(field: K, value: typeof form[K]) => {
    setForm(prev => {
      const updated = { ...prev, [field]: value };
      
      // Auto-fill RNC when name changes and matches a previous transaction
      if (field === 'name' && typeof value === 'string' && value.trim()) {
        const normalizedName = value.trim().toLowerCase();
        const matchingTx = existingTransactions.find(
          tx => tx.name?.trim().toLowerCase() === normalizedName && tx.rnc
        );
        if (matchingTx?.rnc && !prev.rnc) {
          updated.rnc = matchingTx.rnc;
        }
      }
      
      return updated;
    });
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Nueva Transacción</CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Dates Row */}
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label>Fecha de Transacción *</Label>
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
                    {form.transaction_date ? format(form.transaction_date, 'PPP') : 'Seleccionar fecha'}
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
              <Label>Fecha de Compra</Label>
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
                    {form.purchase_date ? format(form.purchase_date, 'PPP') : 'Seleccionar fecha'}
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

          {/* Account Dropdowns */}
          <div className="grid gap-4 md:grid-cols-3">
            <div className="space-y-2">
              <Label>Cuenta Principal *</Label>
              <Select
                value={form.master_acct_code}
                onValueChange={(value) => updateField('master_acct_code', value)}
              >
                <SelectTrigger>
                  <SelectValue placeholder={loadingAccounts ? 'Cargando...' : 'Seleccionar cuenta'} />
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
                Proyecto {requires1180Fields && '*'}
              </Label>
              <Select
                value={form.project_code}
                onValueChange={(value) => updateField('project_code', value)}
              >
                <SelectTrigger className={cn(requires1180Fields && !form.project_code && 'border-destructive')}>
                  <SelectValue placeholder={loadingProjects ? 'Cargando...' : 'Seleccionar proyecto'}>
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
                Código CBS {requires1180Fields && '*'}
              </Label>
              <Select
                value={form.cbs_code}
                onValueChange={(value) => updateField('cbs_code', value)}
              >
                <SelectTrigger className={cn(requires1180Fields && !form.cbs_code && 'border-destructive')}>
                  <SelectValue placeholder={loadingCbsCodes ? 'Cargando...' : 'Seleccionar código CBS'}>
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

          {/* Description */}
          <div className="space-y-2">
            <Label>Descripción *</Label>
            <Input
              value={form.description}
              onChange={(e) => updateField('description', e.target.value)}
              placeholder="Descripción de la transacción"
            />
          </div>

          {/* Amount Fields */}
          <div className="grid gap-4 md:grid-cols-4">
            <div className="space-y-2">
              <Label>Moneda</Label>
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
              <Label>Monto *</Label>
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
                onChange={(e) => updateField('itbis', e.target.value)}
                placeholder="0.00"
                className="font-mono"
              />
            </div>

            <div className="space-y-2">
              <Label>Tasa de Cambio</Label>
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

          {/* Additional Fields */}
          <div className="grid gap-4 md:grid-cols-4">
            <div className="space-y-2">
              <Label>Método de Pago</Label>
              <Select
                value={form.pay_method}
                onValueChange={(value) => updateField('pay_method', value)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Seleccionar método" />
                </SelectTrigger>
                <SelectContent className="bg-popover">
                  <SelectItem value="transfer_bdi">Transferencia BDI</SelectItem>
                  <SelectItem value="transfer_bhd">Transferencia BHD</SelectItem>
                  <SelectItem value="cash">Efectivo</SelectItem>
                  <SelectItem value="cc_management">Tarjeta Crédito Management</SelectItem>
                  <SelectItem value="cc_agri">Tarjeta Crédito Agri</SelectItem>
                  <SelectItem value="cc_industry">Tarjeta Crédito Industry</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Documento</Label>
              <Input
                value={form.document}
                onChange={(e) => updateField('document', e.target.value)}
                placeholder="NCF / Referencia"
              />
            </div>

            <div className="space-y-2 relative">
              <Label>Nombre</Label>
              <NameAutocomplete
                value={form.name}
                onChange={(value) => updateField('name', value)}
                suggestions={uniqueNames}
              />
            </div>

            <div className="space-y-2">
              <Label>RNC</Label>
              <Input
                value={form.rnc}
                onChange={(e) => updateField('rnc', e.target.value)}
                placeholder="Registro Nacional"
              />
            </div>
          </div>

          {/* Comments and Attachment */}
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label>Comentarios</Label>
              <Textarea
                value={form.comments}
                onChange={(e) => updateField('comments', e.target.value)}
                placeholder="Notas adicionales..."
                rows={3}
              />
            </div>

            <div className="space-y-2">
              <Label>Adjuntos (NCF, Comprobante, Cotización)</Label>
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
                Subir recibo o factura (JPG, PNG, PDF, máx 5MB)
              </p>
            </div>
          </div>

          {/* Submit */}
          <div className="flex justify-end pt-4 border-t">
            <Button type="submit" disabled={isSubmitting || !isValid()}>
              {isSubmitting ? 'Guardando...' : 'Guardar Transacción'}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
