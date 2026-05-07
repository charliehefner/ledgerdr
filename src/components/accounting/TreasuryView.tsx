import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { BankReconciliationView } from "./BankReconciliationView";
import { BankAccountsList } from "./BankAccountsList";
import { CreditCardsList } from "./CreditCardsList";
import { PettyCashView } from "./PettyCashView";
import { InternalTransfersView } from "./InternalTransfersView";
import { useLanguage } from "@/contexts/LanguageContext";
import { useAuth } from "@/contexts/AuthContext";

export function TreasuryView() {
  const { t } = useLanguage();
  const { user } = useAuth();
  const isOffice = user?.role === "office";
  // Office only has write access to petty cash; default that tab to focus their work.
  const defaultTab = isOffice ? "petty-cash" : "reconciliation";
  return (
    <Tabs defaultValue={defaultTab} className="space-y-4">
      <TabsList>
        {!isOffice && <TabsTrigger value="reconciliation">{t("treasury.reconciliation")}</TabsTrigger>}
        {!isOffice && <TabsTrigger value="bank-accounts">{t("treasury.bankAccounts")}</TabsTrigger>}
        {!isOffice && <TabsTrigger value="credit-cards">{t("treasury.creditCards")}</TabsTrigger>}
        <TabsTrigger value="petty-cash">{t("treasury.pettyCash")}</TabsTrigger>
        {!isOffice && <TabsTrigger value="internal-transfers">Transferencias Internas</TabsTrigger>}
      </TabsList>
      {!isOffice && (
        <>
          <TabsContent value="reconciliation">
            <BankReconciliationView />
          </TabsContent>
          <TabsContent value="bank-accounts">
            <BankAccountsList />
          </TabsContent>
          <TabsContent value="credit-cards">
            <CreditCardsList />
          </TabsContent>
          <TabsContent value="internal-transfers">
            <InternalTransfersView />
          </TabsContent>
        </>
      )}
      <TabsContent value="petty-cash">
        <PettyCashView />
      </TabsContent>
    </Tabs>
  );
}
