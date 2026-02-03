import { useState } from "react";
import { MainLayout } from "@/components/layout/MainLayout";
import { InventoryList } from "@/components/inventory/InventoryList";
import { InventoryItemDialog } from "@/components/inventory/InventoryItemDialog";
import { PurchaseDialog } from "@/components/inventory/PurchaseDialog";
import { Button } from "@/components/ui/button";
import { Plus, ShoppingCart } from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";

export default function Inventory() {
  const [isItemDialogOpen, setIsItemDialogOpen] = useState(false);
  const [isPurchaseDialogOpen, setIsPurchaseDialogOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<string | null>(null);
  const { t } = useLanguage();

  const handleEditItem = (itemId: string) => {
    setEditingItem(itemId);
    setIsItemDialogOpen(true);
  };

  const handleCloseItemDialog = () => {
    setIsItemDialogOpen(false);
    setEditingItem(null);
  };

  return (
    <MainLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-foreground">{t("page.inventory.title")}</h1>
            <p className="text-muted-foreground">
              {t("page.inventory.subtitle")}
            </p>
          </div>
          <div className="flex gap-2">
            <Button
              variant="secondary"
              onClick={() => setIsPurchaseDialogOpen(true)}
            >
              <ShoppingCart className="mr-2 h-4 w-4" />
              {t("inventory.recordPurchase")}
            </Button>
            <Button onClick={() => setIsItemDialogOpen(true)}>
              <Plus className="mr-2 h-4 w-4" />
              {t("inventory.addItem")}
            </Button>
          </div>
        </div>

        <InventoryList onEditItem={handleEditItem} />

        <InventoryItemDialog
          open={isItemDialogOpen}
          onOpenChange={handleCloseItemDialog}
          editingItemId={editingItem}
        />

        <PurchaseDialog
          open={isPurchaseDialogOpen}
          onOpenChange={setIsPurchaseDialogOpen}
        />
      </div>
    </MainLayout>
  );
}
