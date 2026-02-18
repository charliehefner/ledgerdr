import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { toast } from "@/hooks/use-toast";
import { Plus, Trash2 } from "lucide-react";
import { useState } from "react";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function PaymentMethodMappingDialog({ open, onOpenChange }: Props) {
  const queryClient = useQueryClient();
  const [newMethod, setNewMethod] = useState("");
  const [newAccountId, setNewAccountId] = useState("");

  const { data: mappings = [], isLoading } = useQuery({
    queryKey: ["payment_method_accounts"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("payment_method_accounts")
        .select("id, pay_method, account_id, chart_of_accounts:account_id(account_code, account_name)")
        .order("pay_method");
      if (error) throw error;
      return data as {
        id: string;
        pay_method: string;
        account_id: string;
        chart_of_accounts: { account_code: string; account_name: string } | null;
      }[];
    },
    enabled: open,
  });

  const { data: accounts = [] } = useQuery({
    queryKey: ["chart_of_accounts_posting"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("chart_of_accounts")
        .select("id, account_code, account_name")
        .eq("allow_posting", true)
        .is("deleted_at", null)
        .order("account_code");
      if (error) throw error;
      return data;
    },
    enabled: open,
  });

  const handleUpdate = async (id: string, accountId: string) => {
    const { error } = await supabase
      .from("payment_method_accounts")
      .update({ account_id: accountId })
      .eq("id", id);
    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } else {
      queryClient.invalidateQueries({ queryKey: ["payment_method_accounts"] });
      toast({ title: "Actualizado" });
    }
  };

  const handleAdd = async () => {
    if (!newMethod.trim() || !newAccountId) return;
    const { error } = await supabase
      .from("payment_method_accounts")
      .insert({ pay_method: newMethod.trim(), account_id: newAccountId });
    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } else {
      queryClient.invalidateQueries({ queryKey: ["payment_method_accounts"] });
      setNewMethod("");
      setNewAccountId("");
      toast({ title: "Agregado" });
    }
  };

  const handleDelete = async (id: string) => {
    const { error } = await supabase.from("payment_method_accounts").delete().eq("id", id);
    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } else {
      queryClient.invalidateQueries({ queryKey: ["payment_method_accounts"] });
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Mapeo Método de Pago → Cuenta</DialogTitle>
          <DialogDescription>
            Configura qué cuenta contable se acredita para cada método de pago al generar asientos.
          </DialogDescription>
        </DialogHeader>

        <div className="border rounded-lg overflow-auto max-h-[400px]">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Método de Pago</TableHead>
                <TableHead>Cuenta Contable</TableHead>
                <TableHead className="w-[50px]" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={3} className="text-center text-muted-foreground">
                    Cargando...
                  </TableCell>
                </TableRow>
              ) : (
                mappings.map((m) => (
                  <TableRow key={m.id}>
                    <TableCell className="font-mono text-sm">{m.pay_method}</TableCell>
                    <TableCell>
                      <Select
                        value={m.account_id}
                        onValueChange={(v) => handleUpdate(m.id, v)}
                      >
                        <SelectTrigger className="h-8 text-xs">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {accounts.map((a) => (
                            <SelectItem key={a.id} value={a.id}>
                              {a.account_code} — {a.account_name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </TableCell>
                    <TableCell>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7"
                        onClick={() => handleDelete(m.id)}
                      >
                        <Trash2 className="h-3.5 w-3.5 text-destructive" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>

        {/* Add new mapping */}
        <div className="flex items-end gap-2">
          <div className="flex-1 space-y-1">
            <label className="text-xs font-medium">Nuevo método</label>
            <Input
              value={newMethod}
              onChange={(e) => setNewMethod(e.target.value)}
              placeholder="ej: transfer_bdi"
              className="h-8 text-sm"
            />
          </div>
          <div className="flex-1 space-y-1">
            <label className="text-xs font-medium">Cuenta</label>
            <Select value={newAccountId} onValueChange={setNewAccountId}>
              <SelectTrigger className="h-8 text-xs">
                <SelectValue placeholder="Seleccionar" />
              </SelectTrigger>
              <SelectContent>
                {accounts.map((a) => (
                  <SelectItem key={a.id} value={a.id}>
                    {a.account_code} — {a.account_name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <Button size="sm" onClick={handleAdd} disabled={!newMethod.trim() || !newAccountId}>
            <Plus className="h-4 w-4 mr-1" /> Agregar
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
