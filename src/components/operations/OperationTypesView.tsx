import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Plus, Pencil, Tractor, Users } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface OperationType {
  id: string;
  name: string;
  is_mechanical: boolean;
  is_active: boolean;
}

export function OperationTypesView() {
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingType, setEditingType] = useState<OperationType | null>(null);
  const [form, setForm] = useState({
    name: "",
    is_mechanical: true,
  });

  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: operationTypes, isLoading } = useQuery({
    queryKey: ["operationTypes"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("operation_types")
        .select("*")
        .order("name");
      if (error) throw error;
      return data as OperationType[];
    },
  });

  const mutation = useMutation({
    mutationFn: async (data: typeof form) => {
      if (editingType) {
        const { error } = await supabase
          .from("operation_types")
          .update({ name: data.name, is_mechanical: data.is_mechanical })
          .eq("id", editingType.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("operation_types").insert({
          name: data.name,
          is_mechanical: data.is_mechanical,
        });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["operationTypes"] });
      toast({
        title: editingType ? "Operation type updated" : "Operation type added",
        description: `${form.name} has been saved.`,
      });
      handleCloseDialog();
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const handleEdit = (type: OperationType) => {
    setEditingType(type);
    setForm({
      name: type.name,
      is_mechanical: type.is_mechanical,
    });
    setIsDialogOpen(true);
  };

  const handleCloseDialog = () => {
    setIsDialogOpen(false);
    setEditingType(null);
    setForm({ name: "", is_mechanical: true });
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name) {
      toast({
        title: "Validation Error",
        description: "Please enter an operation name.",
        variant: "destructive",
      });
      return;
    }
    mutation.mutate(form);
  };

  if (isLoading) {
    return <div className="text-center py-8">Loading...</div>;
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <div>
          <p className="text-sm text-muted-foreground">
            Define operation types and whether they use machinery or manual labor.
          </p>
        </div>
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button size="sm">
              <Plus className="h-4 w-4 mr-2" />
              Add Operation Type
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>
                {editingType ? "Edit Operation Type" : "Add Operation Type"}
              </DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <Label>Operation Name *</Label>
                <Input
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  placeholder="e.g., Disking, Spraying, Mowing"
                />
              </div>

              <div className="flex items-center justify-between rounded-lg border p-4">
                <div className="space-y-0.5">
                  <Label>Mechanical Operation</Label>
                  <p className="text-sm text-muted-foreground">
                    {form.is_mechanical
                      ? "Requires tractor + implement"
                      : "Requires worker count"}
                  </p>
                </div>
                <Switch
                  checked={form.is_mechanical}
                  onCheckedChange={(checked) =>
                    setForm({ ...form, is_mechanical: checked })
                  }
                />
              </div>

              <div className="flex justify-end gap-2">
                <Button type="button" variant="outline" onClick={handleCloseDialog}>
                  Cancel
                </Button>
                <Button type="submit" disabled={mutation.isPending}>
                  {mutation.isPending ? "Saving..." : editingType ? "Update" : "Add Type"}
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {!operationTypes || operationTypes.length === 0 ? (
        <div className="text-center py-8 text-muted-foreground">
          No operation types defined yet. Click "Add Operation Type" to get started.
        </div>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Operation Name</TableHead>
              <TableHead>Type</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="w-[80px]">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {operationTypes.map((type) => (
              <TableRow key={type.id}>
                <TableCell className="font-medium">{type.name}</TableCell>
                <TableCell>
                  <Badge
                    variant={type.is_mechanical ? "default" : "secondary"}
                    className="gap-1"
                  >
                    {type.is_mechanical ? (
                      <>
                        <Tractor className="h-3 w-3" />
                        Mechanical
                      </>
                    ) : (
                      <>
                        <Users className="h-3 w-3" />
                        Manual
                      </>
                    )}
                  </Badge>
                </TableCell>
                <TableCell>
                  <Badge variant={type.is_active ? "outline" : "secondary"}>
                    {type.is_active ? "Active" : "Inactive"}
                  </Badge>
                </TableCell>
                <TableCell>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => handleEdit(type)}
                  >
                    <Pencil className="h-4 w-4" />
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </div>
  );
}
