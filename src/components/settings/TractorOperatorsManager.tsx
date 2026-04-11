import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Switch } from "@/components/ui/switch";
import { Plus, Trash2, Users } from "lucide-react";
import { toast } from "sonner";
import { useLanguage } from "@/contexts/LanguageContext";

interface TractorOperator {
  id: string;
  name: string;
  is_active: boolean;
}

export function TractorOperatorsManager() {
  const { t } = useLanguage();
  const queryClient = useQueryClient();
  const [newName, setNewName] = useState("");

  const { data: operators = [], isLoading } = useQuery({
    queryKey: ["tractor-operators"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("tractor_operators")
        .select("*")
        .order("name");
      if (error) throw error;
      return data as TractorOperator[];
    },
  });

  const addMutation = useMutation({
    mutationFn: async (name: string) => {
      const { error } = await supabase
        .from("tractor_operators")
        .insert({ name });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["tractor-operators"] });
      setNewName("");
      toast.success(t("operators.added"));
    },
    onError: () => toast.error(t("operators.addError")),
  });

  const toggleMutation = useMutation({
    mutationFn: async ({ id, is_active }: { id: string; is_active: boolean }) => {
      const { error } = await supabase
        .from("tractor_operators")
        .update({ is_active })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["tractor-operators"] });
    },
    onError: () => toast.error(t("operators.updateError")),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("tractor_operators")
        .delete()
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["tractor-operators"] });
      toast.success(t("operators.deleted"));
    },
    onError: () => toast.error(t("operators.deleteError")),
  });

  const handleAdd = () => {
    const trimmed = newName.trim();
    if (!trimmed) return;
    addMutation.mutate(trimmed);
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Users className="h-5 w-5" />
          {t("operators.title")}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex gap-2">
          <Input
            placeholder={t("operators.namePlaceholder")}
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleAdd()}
          />
          <Button onClick={handleAdd} disabled={!newName.trim()}>
            <Plus className="h-4 w-4 mr-1" />
            {t("common.add")}
          </Button>
        </div>

        {isLoading ? (
          <p className="text-sm text-muted-foreground">{t("common.loading")}</p>
        ) : operators.length === 0 ? (
          <p className="text-sm text-muted-foreground">{t("operators.noOperators")}</p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t("common.name")}</TableHead>
                <TableHead className="w-24 text-center">{t("common.active")}</TableHead>
                <TableHead className="w-16" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {operators.map((op) => (
                <TableRow key={op.id}>
                  <TableCell>{op.name}</TableCell>
                  <TableCell className="text-center">
                    <Switch
                      checked={op.is_active}
                      onCheckedChange={(checked) =>
                        toggleMutation.mutate({ id: op.id, is_active: checked })
                      }
                    />
                  </TableCell>
                  <TableCell>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => deleteMutation.mutate(op.id)}
                    >
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}
