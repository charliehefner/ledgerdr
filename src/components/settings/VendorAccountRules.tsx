import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Plus, Pencil, Trash2, Wand2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { fetchAccounts, fetchProjects, fetchCbsCodes, fetchRecentTransactions } from '@/lib/api';
import { getDescription } from '@/lib/getDescription';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';

interface VendorRule {
  id: string;
  vendor_name: string;
  master_acct_code: string;
  project_code: string | null;
  cbs_code: string | null;
  description_template: string | null;
}

export function VendorAccountRules() {
  const queryClient = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingRule, setEditingRule] = useState<VendorRule | null>(null);
  const [form, setForm] = useState({
    vendor_name: '',
    master_acct_code: '',
    project_code: '',
    cbs_code: '',
    description_template: '',
  });

  const { data: rules = [], isLoading } = useQuery({
    queryKey: ['vendorRules'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('vendor_account_rules')
        .select('*')
        .order('vendor_name');
      if (error) throw error;
      return data as VendorRule[];
    },
  });

  const { data: accounts = [] } = useQuery({ queryKey: ['accounts'], queryFn: fetchAccounts });
  const { data: projects = [] } = useQuery({ queryKey: ['projects'], queryFn: fetchProjects });
  const { data: cbsCodes = [] } = useQuery({ queryKey: ['cbsCodes'], queryFn: fetchCbsCodes });

  const openCreate = () => {
    setEditingRule(null);
    setForm({ vendor_name: '', master_acct_code: '', project_code: '', cbs_code: '', description_template: '' });
    setDialogOpen(true);
  };

  const openEdit = (rule: VendorRule) => {
    setEditingRule(rule);
    setForm({
      vendor_name: rule.vendor_name,
      master_acct_code: rule.master_acct_code,
      project_code: rule.project_code || '',
      cbs_code: rule.cbs_code || '',
      description_template: rule.description_template || '',
    });
    setDialogOpen(true);
  };

  const handleSave = async () => {
    if (!form.vendor_name.trim() || !form.master_acct_code) {
      toast.error('Nombre de proveedor y cuenta son requeridos');
      return;
    }

    try {
      const payload = {
        vendor_name: form.vendor_name.trim().toUpperCase(),
        master_acct_code: form.master_acct_code,
        project_code: form.project_code || null,
        cbs_code: form.cbs_code || null,
        description_template: form.description_template || null,
      };

      if (editingRule) {
        const { error } = await supabase
          .from('vendor_account_rules')
          .update(payload)
          .eq('id', editingRule.id);
        if (error) throw error;
        toast.success('Regla actualizada');
      } else {
        const { error } = await supabase
          .from('vendor_account_rules')
          .insert(payload);
        if (error) throw error;
        toast.success('Regla creada');
      }

      queryClient.invalidateQueries({ queryKey: ['vendorRules'] });
      setDialogOpen(false);
    } catch (err: any) {
      if (err?.message?.includes('duplicate')) {
        toast.error('Ya existe una regla para este proveedor');
      } else {
        toast.error('Error al guardar la regla');
      }
    }
  };

  const handleDelete = async (id: string) => {
    try {
      const { error } = await supabase
        .from('vendor_account_rules')
        .delete()
        .eq('id', id);
      if (error) throw error;
      toast.success('Regla eliminada');
      queryClient.invalidateQueries({ queryKey: ['vendorRules'] });
    } catch {
      toast.error('Error al eliminar la regla');
    }
  };

  const handleAutoDetect = async () => {
    try {
      const transactions = await fetchRecentTransactions(500);
      // Group by vendor name, find consistent account usage
      const vendorAccounts: Record<string, Record<string, number>> = {};
      transactions.forEach(tx => {
        if (!tx.name?.trim() || !tx.master_acct_code) return;
        const name = tx.name.trim().toUpperCase();
        if (!vendorAccounts[name]) vendorAccounts[name] = {};
        vendorAccounts[name][tx.master_acct_code] = 
          (vendorAccounts[name][tx.master_acct_code] || 0) + 1;
      });

      const existingNames = new Set(rules.map(r => r.vendor_name));
      let suggested = 0;

      for (const [name, acctCounts] of Object.entries(vendorAccounts)) {
        if (existingNames.has(name)) continue;
        const entries = Object.entries(acctCounts);
        const total = entries.reduce((s, [, c]) => s + c, 0);
        if (total < 3) continue; // Need at least 3 transactions
        
        // Find dominant account (>80% usage)
        const [topAcct, topCount] = entries.sort((a, b) => b[1] - a[1])[0];
        if (topCount / total >= 0.8) {
          const { error } = await supabase
            .from('vendor_account_rules')
            .insert({
              vendor_name: name,
              master_acct_code: topAcct,
            });
          if (!error) suggested++;
        }
      }

      if (suggested > 0) {
        toast.success(`${suggested} regla(s) creada(s) automáticamente`);
        queryClient.invalidateQueries({ queryKey: ['vendorRules'] });
      } else {
        toast.info('No se encontraron patrones suficientes para crear reglas nuevas');
      }
    } catch {
      toast.error('Error al auto-detectar reglas');
    }
  };

  const getAccountLabel = (code: string) => {
    const acct = accounts.find(a => a.code === code);
    return acct ? `${code} - ${getDescription(acct)}` : code;
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold">Reglas de Proveedor</h3>
          <p className="text-sm text-muted-foreground">
            Asignar cuentas automáticamente cuando se identifica un proveedor
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={handleAutoDetect}>
            <Wand2 className="h-4 w-4 mr-2" />
            Auto-detectar
          </Button>
          <Button size="sm" onClick={openCreate}>
            <Plus className="h-4 w-4 mr-2" />
            Nueva Regla
          </Button>
        </div>
      </div>

      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Proveedor</TableHead>
              <TableHead>Cuenta</TableHead>
              <TableHead>Proyecto</TableHead>
              <TableHead>CBS</TableHead>
              <TableHead className="w-[100px]">Acciones</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                  Cargando...
                </TableCell>
              </TableRow>
            ) : rules.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                  No hay reglas configuradas. Use "Auto-detectar" o cree una manualmente.
                </TableCell>
              </TableRow>
            ) : (
              rules.map(rule => (
                <TableRow key={rule.id}>
                  <TableCell className="font-medium">{rule.vendor_name}</TableCell>
                  <TableCell>{getAccountLabel(rule.master_acct_code)}</TableCell>
                  <TableCell>{rule.project_code || '—'}</TableCell>
                  <TableCell>{rule.cbs_code || '—'}</TableCell>
                  <TableCell>
                    <div className="flex gap-1">
                      <Button variant="ghost" size="icon" onClick={() => openEdit(rule)}>
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="icon" onClick={() => handleDelete(rule.id)}>
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingRule ? 'Editar Regla' : 'Nueva Regla de Proveedor'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Nombre del Proveedor *</Label>
              <Input
                value={form.vendor_name}
                onChange={e => setForm(f => ({ ...f, vendor_name: e.target.value }))}
                placeholder="Ej: SHELL, FERRETERIA CENTRAL"
              />
            </div>
            <div className="space-y-2">
              <Label>Cuenta Principal *</Label>
              <Select value={form.master_acct_code} onValueChange={v => setForm(f => ({ ...f, master_acct_code: v }))}>
                <SelectTrigger>
                  <SelectValue placeholder="Seleccionar cuenta" />
                </SelectTrigger>
                <SelectContent className="bg-popover max-h-[300px]">
                  {accounts.map(a => (
                    <SelectItem key={a.code} value={a.code}>
                      {a.code} - {getDescription(a)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-4 grid-cols-2">
              <div className="space-y-2">
                <Label>Proyecto</Label>
                <Select value={form.project_code} onValueChange={v => setForm(f => ({ ...f, project_code: v }))}>
                  <SelectTrigger>
                    <SelectValue placeholder="Opcional" />
                  </SelectTrigger>
                  <SelectContent className="bg-popover max-h-[300px]">
                    {projects.map(p => (
                      <SelectItem key={p.code} value={p.code}>
                        {p.code} - {getDescription(p)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>CBS</Label>
                <Select value={form.cbs_code} onValueChange={v => setForm(f => ({ ...f, cbs_code: v }))}>
                  <SelectTrigger>
                    <SelectValue placeholder="Opcional" />
                  </SelectTrigger>
                  <SelectContent className="bg-popover max-h-[300px]">
                    {cbsCodes.map(c => (
                      <SelectItem key={c.code} value={String(c.code)}>
                        {c.code} - {getDescription(c)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-2">
              <Label>Descripción Plantilla</Label>
              <Input
                value={form.description_template}
                onChange={e => setForm(f => ({ ...f, description_template: e.target.value }))}
                placeholder="Ej: Compra de combustible"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancelar</Button>
            <Button onClick={handleSave}>Guardar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
