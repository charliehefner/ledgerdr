import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Plus, FileText } from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";
import { ContractDialog } from "./contracts/ContractDialog";
import { ContractsList } from "./contracts/ContractsList";
import { DailyEntryDialog } from "./contracts/DailyEntryDialog";
import { DailyEntriesList } from "./contracts/DailyEntriesList";
import { ContractReport } from "./contracts/ContractReport";
import { toast } from "sonner";

export interface ServiceContract {
  id: string;
  contract_name: string;
  owner_name: string;
  owner_cedula_rnc: string | null;
  bank: string | null;
  bank_account: string | null;
  operation_type: string;
  operation_type_other: string | null;
  unit_type: string;
  price_per_unit: number;
  farm_id: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  farm?: { name: string } | null;
}

export interface ContractEntry {
  id: string;
  contract_id: string;
  entry_date: string;
  description: string;
  comments: string | null;
  units_charged: number;
  calculated_cost: number;
  cost_override: number | null;
  created_at: string;
  updated_at: string;
  contract?: ServiceContract;
  line_items?: ContractLineItem[];
}

export interface ContractLineItem {
  id: string;
  entry_id: string;
  description: string;
  amount: number;
  created_at: string;
}

export function ContractedServicesView() {
  const { t } = useLanguage();
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState("contracts");
  const [contractDialogOpen, setContractDialogOpen] = useState(false);
  const [entryDialogOpen, setEntryDialogOpen] = useState(false);
  const [editingContract, setEditingContract] = useState<ServiceContract | null>(null);
  const [editingEntry, setEditingEntry] = useState<ContractEntry | null>(null);
  const [selectedContractId, setSelectedContractId] = useState<string | null>(null);
  const [reportOpen, setReportOpen] = useState(false);

  // Fetch contracts
  const { data: contracts = [], isLoading: loadingContracts } = useQuery({
    queryKey: ["service-contracts"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("service_contracts")
        .select("*, farm:farms(name)")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as ServiceContract[];
    },
  });

  // Fetch entries
  const { data: entries = [], isLoading: loadingEntries } = useQuery({
    queryKey: ["service-contract-entries", selectedContractId],
    queryFn: async () => {
      let query = supabase
        .from("service_contract_entries")
        .select("*, contract:service_contracts(*)")
        .order("entry_date", { ascending: false });
      
      if (selectedContractId) {
        query = query.eq("contract_id", selectedContractId);
      }
      
      const { data, error } = await query;
      if (error) throw error;
      
      // Fetch line items for each entry
      const entriesWithLineItems = await Promise.all(
        (data || []).map(async (entry) => {
          const { data: lineItems } = await supabase
            .from("service_contract_line_items")
            .select("*")
            .eq("entry_id", entry.id);
          return { ...entry, line_items: lineItems || [] };
        })
      );
      
      return entriesWithLineItems as ContractEntry[];
    },
  });

  // Mutations
  const deleteContractMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("service_contracts")
        .delete()
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["service-contracts"] });
      toast.success(t("contracts.deleted"));
    },
    onError: () => {
      toast.error(t("contracts.deleteError"));
    },
  });

  const deleteEntryMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("service_contract_entries")
        .delete()
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["service-contract-entries"] });
      toast.success(t("contracts.entryDeleted"));
    },
    onError: () => {
      toast.error(t("contracts.entryDeleteError"));
    },
  });

  const handleEditContract = (contract: ServiceContract) => {
    setEditingContract(contract);
    setContractDialogOpen(true);
  };

  const handleEditEntry = (entry: ContractEntry) => {
    setEditingEntry(entry);
    setEntryDialogOpen(true);
  };

  const handleNewEntry = () => {
    setEditingEntry(null);
    setEntryDialogOpen(true);
  };

  const handleNewContract = () => {
    setEditingContract(null);
    setContractDialogOpen(true);
  };

  const activeContracts = contracts.filter((c) => c.is_active);

  return (
    <div className="space-y-6">
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <TabsList>
            <TabsTrigger value="contracts">{t("contracts.contracts")}</TabsTrigger>
            <TabsTrigger value="entries">{t("contracts.dailyEntries")}</TabsTrigger>
          </TabsList>
          
          <div className="flex gap-2">
            {activeTab === "contracts" && (
              <Button onClick={handleNewContract}>
                <Plus className="h-4 w-4 mr-2" />
                {t("contracts.addContract")}
              </Button>
            )}
            {activeTab === "entries" && (
              <>
                <Button variant="outline" onClick={() => setReportOpen(true)}>
                  <FileText className="h-4 w-4 mr-2" />
                  {t("contracts.viewReport")}
                </Button>
                <Button onClick={handleNewEntry} disabled={activeContracts.length === 0}>
                  <Plus className="h-4 w-4 mr-2" />
                  {t("contracts.addEntry")}
                </Button>
              </>
            )}
          </div>
        </div>

        <TabsContent value="contracts" className="mt-6">
          <Card>
            <CardHeader>
              <CardTitle>{t("contracts.activeContracts")}</CardTitle>
            </CardHeader>
            <CardContent>
              <ContractsList
                contracts={contracts}
                isLoading={loadingContracts}
                onEdit={handleEditContract}
                onDelete={(id) => deleteContractMutation.mutate(id)}
              />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="entries" className="mt-6">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle>{t("contracts.dailyOperations")}</CardTitle>
              <div className="flex items-center gap-2">
                <label className="text-sm text-muted-foreground">
                  {t("contracts.filterByContract")}:
                </label>
                <select
                  className="border rounded px-2 py-1 text-sm bg-background"
                  value={selectedContractId || ""}
                  onChange={(e) => setSelectedContractId(e.target.value || null)}
                >
                  <option value="">{t("contracts.allContracts")}</option>
                  {activeContracts.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.contract_name}
                    </option>
                  ))}
                </select>
              </div>
            </CardHeader>
            <CardContent>
              <DailyEntriesList
                entries={entries}
                isLoading={loadingEntries}
                onEdit={handleEditEntry}
                onDelete={(id) => deleteEntryMutation.mutate(id)}
              />
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <ContractDialog
        open={contractDialogOpen}
        onOpenChange={setContractDialogOpen}
        contract={editingContract}
      />

      <DailyEntryDialog
        open={entryDialogOpen}
        onOpenChange={setEntryDialogOpen}
        entry={editingEntry}
        contracts={activeContracts}
      />

      <ContractReport
        open={reportOpen}
        onOpenChange={setReportOpen}
        contracts={contracts}
        entries={entries}
      />
    </div>
  );
}
