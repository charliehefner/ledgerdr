import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { useToast } from "@/hooks/use-toast";
import { Plus, Search, ChevronRight, ChevronDown, BookOpen } from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";
import { cn } from "@/lib/utils";

type Account = {
  id: string;
  account_code: string;
  account_name: string;
  account_type: string;
  parent_id: string | null;
  allow_posting: boolean | null;
  currency: string | null;
  deleted_at: string | null;
};

const ACCOUNT_TYPES = ["ASSET", "LIABILITY", "EQUITY", "INCOME", "EXPENSE"];

const accountTypeColors: Record<string, string> = {
  ASSET: "bg-blue-100 text-blue-800",
  LIABILITY: "bg-red-100 text-red-800",
  EQUITY: "bg-purple-100 text-purple-800",
  INCOME: "bg-green-100 text-green-800",
  EXPENSE: "bg-orange-100 text-orange-800",
};

type TreeNode = Account & { children: TreeNode[]; depth: number };

function buildTree(accounts: Account[]): TreeNode[] {
  const map = new Map<string, TreeNode>();
  const roots: TreeNode[] = [];

  accounts.forEach(a => map.set(a.id, { ...a, children: [], depth: 0 }));

  accounts.forEach(a => {
    const node = map.get(a.id)!;
    if (a.parent_id && map.has(a.parent_id)) {
      const parent = map.get(a.parent_id)!;
      node.depth = parent.depth + 1;
      parent.children.push(node);
    } else {
      roots.push(node);
    }
  });

  const result: TreeNode[] = [];
  function walk(nodes: TreeNode[]) {
    nodes.sort((a, b) => a.account_code.localeCompare(b.account_code));
    for (const n of nodes) {
      result.push(n);
      walk(n.children);
    }
  }
  walk(roots);
  return result;
}

export function ChartOfAccountsView() {
  const { t } = useLanguage();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState("all");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Account | null>(null);
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());

  const [form, setForm] = useState({
    account_code: "",
    account_name: "",
    account_type: "ASSET",
    parent_id: "",
    allow_posting: true,
    currency: "DOP",
  });

  const { data: accounts = [], isLoading } = useQuery({
    queryKey: ["chart-of-accounts"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("chart_of_accounts")
        .select("*")
        .is("deleted_at", null)
        .order("account_code");
      if (error) throw error;
      return data as Account[];
    },
  });

  const saveMutation = useMutation({
    mutationFn: async (values: typeof form) => {
      const payload = {
        account_code: values.account_code,
        account_name: values.account_name,
        account_type: values.account_type,
        parent_id: values.parent_id || null,
        allow_posting: values.allow_posting,
        currency: values.currency,
      };
      if (editing) {
        const { error } = await supabase.from("chart_of_accounts").update(payload).eq("id", editing.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("chart_of_accounts").insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["chart-of-accounts"] });
      toast({ title: editing ? "Cuenta actualizada" : "Cuenta creada" });
      setDialogOpen(false);
      setEditing(null);
    },
    onError: (e: Error) => {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    },
  });

  const openAdd = () => {
    setEditing(null);
    setForm({ account_code: "", account_name: "", account_type: "ASSET", parent_id: "", allow_posting: true, currency: "DOP" });
    setDialogOpen(true);
  };

  const openEdit = (a: Account) => {
    setEditing(a);
    setForm({
      account_code: a.account_code,
      account_name: a.account_name,
      account_type: a.account_type,
      parent_id: a.parent_id || "",
      allow_posting: a.allow_posting ?? true,
      currency: a.currency || "DOP",
    });
    setDialogOpen(true);
  };

  const toggleCollapse = (id: string) => {
    setCollapsed(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const tree = buildTree(accounts);

  // Filter by collapsed parents
  const isHidden = (node: typeof tree[0]) => {
    // Walk up parent chain
    let pid = node.parent_id;
    while (pid) {
      if (collapsed.has(pid)) return true;
      const parent = accounts.find(a => a.id === pid);
      pid = parent?.parent_id || null;
    }
    return false;
  };

  const filtered = tree.filter(node => {
    if (isHidden(node)) return false;
    if (typeFilter !== "all" && node.account_type !== typeFilter) return false;
    if (search) {
      const s = search.toLowerCase();
      return node.account_code.toLowerCase().includes(s) || node.account_name.toLowerCase().includes(s);
    }
    return true;
  });

  const hasChildren = (id: string) => accounts.some(a => a.parent_id === id);

  if (isLoading) return <div className="p-8 text-center text-muted-foreground">{t("common.loading")}</div>;

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center justify-between">
        <div className="flex gap-2 items-center flex-1">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar por código o nombre..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="pl-9"
            />
          </div>
          <Select value={typeFilter} onValueChange={setTypeFilter}>
            <SelectTrigger className="w-40">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t("common.all")}</SelectItem>
              {ACCOUNT_TYPES.map(t => (
                <SelectItem key={t} value={t}>{t}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <Button onClick={openAdd} size="sm">
          <Plus className="h-4 w-4 mr-1" />
          Agregar Cuenta
        </Button>
      </div>

      {accounts.length === 0 ? (
        <EmptyState
          icon={BookOpen}
          title="No hay cuentas"
          description="Importe su plan de cuentas o agregue cuentas manualmente."
          action={<Button onClick={openAdd} size="sm"><Plus className="h-4 w-4 mr-1" />Agregar Cuenta</Button>}
        />
      ) : (
        <div className="border rounded-lg overflow-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[200px]">Código</TableHead>
                <TableHead>Nombre</TableHead>
                <TableHead className="w-[120px]">Tipo</TableHead>
                <TableHead className="w-[80px]">Moneda</TableHead>
                <TableHead className="w-[100px]">Posteable</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map(node => (
                <TableRow
                  key={node.id}
                  className="cursor-pointer hover:bg-muted/50"
                  onClick={() => openEdit(node)}
                >
                  <TableCell>
                    <div className="flex items-center" style={{ paddingLeft: `${node.depth * 20}px` }}>
                      {hasChildren(node.id) ? (
                        <button
                          onClick={e => { e.stopPropagation(); toggleCollapse(node.id); }}
                          className="mr-1 p-0.5 rounded hover:bg-muted"
                        >
                          {collapsed.has(node.id) ? <ChevronRight className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                        </button>
                      ) : (
                        <span className="w-5" />
                      )}
                      <span className="font-mono text-sm">{node.account_code}</span>
                    </div>
                  </TableCell>
                  <TableCell className={cn(!node.allow_posting && "font-semibold")}>{node.account_name}</TableCell>
                  <TableCell>
                    <Badge variant="outline" className={cn("text-xs", accountTypeColors[node.account_type])}>
                      {node.account_type}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-sm">{node.currency || "DOP"}</TableCell>
                  <TableCell>{node.allow_posting ? "Sí" : "No"}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      {/* Add/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editing ? "Editar Cuenta" : "Nueva Cuenta"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Código</Label>
                <Input value={form.account_code} onChange={e => setForm(f => ({ ...f, account_code: e.target.value }))} placeholder="1100" />
              </div>
              <div>
                <Label>Tipo</Label>
                <Select value={form.account_type} onValueChange={v => setForm(f => ({ ...f, account_type: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {ACCOUNT_TYPES.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div>
              <Label>Nombre</Label>
              <Input value={form.account_name} onChange={e => setForm(f => ({ ...f, account_name: e.target.value }))} placeholder="Efectivo en Caja" />
            </div>
            <div>
              <Label>Cuenta Padre</Label>
              <Select value={form.parent_id || "none"} onValueChange={v => setForm(f => ({ ...f, parent_id: v === "none" ? "" : v }))}>
                <SelectTrigger><SelectValue placeholder="Sin padre" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Sin padre</SelectItem>
                  {accounts.filter(a => a.id !== editing?.id).map(a => (
                    <SelectItem key={a.id} value={a.id}>{a.account_code} - {a.account_name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Moneda</Label>
                <Select value={form.currency} onValueChange={v => setForm(f => ({ ...f, currency: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="DOP">DOP</SelectItem>
                    <SelectItem value="USD">USD</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="flex items-end gap-2 pb-1">
                <Checkbox
                  id="allow-posting"
                  checked={form.allow_posting}
                  onCheckedChange={v => setForm(f => ({ ...f, allow_posting: !!v }))}
                />
                <Label htmlFor="allow-posting">Permite asientos</Label>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>{t("common.cancel")}</Button>
            <Button onClick={() => saveMutation.mutate(form)} disabled={saveMutation.isPending || !form.account_code || !form.account_name}>
              {saveMutation.isPending ? t("common.loading") : t("common.save")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
