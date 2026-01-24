import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
import { Plus, Pencil, Wrench } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface Implement {
  id: string;
  name: string;
  implement_type: string;
  is_active: boolean;
}

const implementTypes = [
  "Disk Harrow",
  "Plow",
  "Cultivator",
  "Sprayer",
  "Mower",
  "Planter",
  "Seeder",
  "Fertilizer Spreader",
  "Loader",
  "Trailer",
  "Other",
];

export function ImplementsView() {
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingImplement, setEditingImplement] = useState<Implement | null>(null);
  const [form, setForm] = useState({
    name: "",
    implement_type: "",
  });

  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: implements_, isLoading } = useQuery({
    queryKey: ["implements"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("implements")
        .select("*")
        .order("name");
      if (error) throw error;
      return data as Implement[];
    },
  });

  const mutation = useMutation({
    mutationFn: async (data: typeof form) => {
      const record = {
        name: data.name,
        implement_type: data.implement_type,
      };

      if (editingImplement) {
        const { error } = await supabase
          .from("implements")
          .update(record)
          .eq("id", editingImplement.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("implements").insert(record);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["implements"] });
      toast({
        title: editingImplement ? "Implement updated" : "Implement added",
        description: `${form.name} has been ${editingImplement ? "updated" : "added"} successfully.`,
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

  const handleEdit = (implement: Implement) => {
    setEditingImplement(implement);
    setForm({
      name: implement.name,
      implement_type: implement.implement_type,
    });
    setIsDialogOpen(true);
  };

  const handleCloseDialog = () => {
    setIsDialogOpen(false);
    setEditingImplement(null);
    setForm({ name: "", implement_type: "" });
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name || !form.implement_type) {
      toast({
        title: "Validation Error",
        description: "Please fill in all required fields.",
        variant: "destructive",
      });
      return;
    }
    mutation.mutate(form);
  };

  if (isLoading) {
    return <div className="text-center py-8">Loading implements...</div>;
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <div className="flex items-center gap-2">
          <Wrench className="h-5 w-5 text-primary" />
          <h3 className="text-lg font-semibold">Implements</h3>
        </div>
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button size="sm">
              <Plus className="h-4 w-4 mr-2" />
              Add Implement
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>
                {editingImplement ? "Edit Implement" : "Add New Implement"}
              </DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <Label>Implement Name *</Label>
                <Input
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  placeholder="e.g., 20ft Disk Harrow"
                />
              </div>

              <div>
                <Label>Type *</Label>
                <Select
                  value={form.implement_type}
                  onValueChange={(value) => setForm({ ...form, implement_type: value })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select type" />
                  </SelectTrigger>
                  <SelectContent>
                    {implementTypes.map((type) => (
                      <SelectItem key={type} value={type}>
                        {type}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="flex justify-end gap-2">
                <Button type="button" variant="outline" onClick={handleCloseDialog}>
                  Cancel
                </Button>
                <Button type="submit" disabled={mutation.isPending}>
                  {mutation.isPending ? "Saving..." : editingImplement ? "Update" : "Add Implement"}
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {!implements_ || implements_.length === 0 ? (
        <div className="text-center py-8 text-muted-foreground">
          No implements added yet. Click "Add Implement" to get started.
        </div>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Type</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="w-[80px]">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {implements_.map((implement) => (
              <TableRow key={implement.id}>
                <TableCell className="font-medium">{implement.name}</TableCell>
                <TableCell>
                  <Badge variant="outline">{implement.implement_type}</Badge>
                </TableCell>
                <TableCell>
                  <Badge variant={implement.is_active ? "default" : "secondary"}>
                    {implement.is_active ? "Active" : "Inactive"}
                  </Badge>
                </TableCell>
                <TableCell>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => handleEdit(implement)}
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
