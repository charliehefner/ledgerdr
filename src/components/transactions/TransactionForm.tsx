import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { CalendarIcon } from 'lucide-react';
import { useLanguage } from '@/contexts/LanguageContext';
import {
  fetchAccounts,
  fetchProjects,
  fetchCbsCodes,
  createTransaction,
  Account,
  Project,
  CbsCode,
} from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
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
import { LanguageToggle } from './LanguageToggle';

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
  comments: '',
  exchange_rate: '',
  is_internal: false,
};

export function TransactionForm({ onSuccess }: TransactionFormProps) {
  const { getDescription } = useLanguage();
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

  const requires1180Fields = form.master_acct_code === '1180';

  const isValid = () => {
    if (!form.transaction_date || !form.master_acct_code || !form.description || !form.amount) {
      return false;
    }
    if (requires1180Fields && (!form.project_code || !form.cbs_code)) {
      return false;
    }
    return true;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!isValid()) {
      if (requires1180Fields && (!form.project_code || !form.cbs_code)) {
        toast.error('Project and CBS codes are required for account 1180');
      } else {
        toast.error('Please fill in all required fields');
      }
      return;
    }

    setIsSubmitting(true);

    try {
      await createTransaction({
        transaction_date: form.transaction_date!.toISOString().split('T')[0],
        master_acct_code: form.master_acct_code,
        project_code: form.project_code || undefined,
        cbs_code: form.cbs_code || undefined,
        purchase_date: form.purchase_date?.toISOString().split('T')[0],
        description: form.description,
        currency: form.currency,
        amount: parseFloat(form.amount),
        itbis: form.itbis ? parseFloat(form.itbis) : undefined,
        pay_method: form.pay_method || undefined,
        document: form.document || undefined,
        name: form.name || undefined,
        comments: form.comments || undefined,
        exchange_rate: form.exchange_rate ? parseFloat(form.exchange_rate) : undefined,
        is_internal: form.is_internal,
      });

      toast.success('Transaction saved successfully');
      setForm(initialFormState);
      onSuccess();
    } catch (error) {
      toast.error('Failed to save transaction');
      console.error(error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const updateField = <K extends keyof typeof form>(field: K, value: typeof form[K]) => {
    setForm(prev => ({ ...prev, [field]: value }));
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle>New Transaction</CardTitle>
        <LanguageToggle />
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Dates Row */}
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label>Transaction Date *</Label>
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
                    {form.transaction_date ? format(form.transaction_date, 'PPP') : 'Select date'}
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
              <Label>Purchase Date</Label>
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
                    {form.purchase_date ? format(form.purchase_date, 'PPP') : 'Select date'}
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
              <Label>Master Account *</Label>
              <Select
                value={form.master_acct_code}
                onValueChange={(value) => updateField('master_acct_code', value)}
              >
                <SelectTrigger>
                  <SelectValue placeholder={loadingAccounts ? 'Loading...' : 'Select account'} />
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
                Project {requires1180Fields && '*'}
              </Label>
              <Select
                value={form.project_code}
                onValueChange={(value) => updateField('project_code', value)}
              >
                <SelectTrigger className={cn(requires1180Fields && !form.project_code && 'border-destructive')}>
                  <SelectValue placeholder={loadingProjects ? 'Loading...' : 'Select project'} />
                </SelectTrigger>
                <SelectContent className="bg-popover max-h-[300px]">
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
                CBS Code {requires1180Fields && '*'}
              </Label>
              <Select
                value={form.cbs_code}
                onValueChange={(value) => updateField('cbs_code', value)}
              >
                <SelectTrigger className={cn(requires1180Fields && !form.cbs_code && 'border-destructive')}>
                  <SelectValue placeholder={loadingCbsCodes ? 'Loading...' : 'Select CBS code'} />
                </SelectTrigger>
                <SelectContent className="bg-popover max-h-[300px]">
                  {cbsCodes.map((cbs: CbsCode) => (
                    <SelectItem key={cbs.code} value={cbs.code}>
                      {cbs.code} - {getDescription(cbs)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Description */}
          <div className="space-y-2">
            <Label>Description *</Label>
            <Input
              value={form.description}
              onChange={(e) => updateField('description', e.target.value)}
              placeholder="Transaction description"
            />
          </div>

          {/* Amount Fields */}
          <div className="grid gap-4 md:grid-cols-4">
            <div className="space-y-2">
              <Label>Currency</Label>
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
              <Label>Amount *</Label>
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
              <Label>Exchange Rate</Label>
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
          <div className="grid gap-4 md:grid-cols-3">
            <div className="space-y-2">
              <Label>Payment Method</Label>
              <Input
                value={form.pay_method}
                onChange={(e) => updateField('pay_method', e.target.value)}
                placeholder="e.g., Cash, Transfer, Check"
              />
            </div>

            <div className="space-y-2">
              <Label>Document</Label>
              <Input
                value={form.document}
                onChange={(e) => updateField('document', e.target.value)}
                placeholder="Document reference"
              />
            </div>

            <div className="space-y-2">
              <Label>Name</Label>
              <Input
                value={form.name}
                onChange={(e) => updateField('name', e.target.value)}
                placeholder="Vendor/Payee name"
              />
            </div>
          </div>

          {/* Comments */}
          <div className="space-y-2">
            <Label>Comments</Label>
            <Textarea
              value={form.comments}
              onChange={(e) => updateField('comments', e.target.value)}
              placeholder="Additional notes..."
              rows={3}
            />
          </div>

          {/* Internal Toggle & Submit */}
          <div className="flex items-center justify-between pt-4 border-t">
            <div className="flex items-center space-x-2">
              <Switch
                id="is_internal"
                checked={form.is_internal}
                onCheckedChange={(checked) => updateField('is_internal', checked)}
              />
              <Label htmlFor="is_internal">Internal Transaction</Label>
            </div>

            <Button type="submit" disabled={isSubmitting || !isValid()}>
              {isSubmitting ? 'Saving...' : 'Save Transaction'}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
