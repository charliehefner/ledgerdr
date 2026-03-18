import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { BankReconciliationView } from "./BankReconciliationView";
import { BankAccountsList } from "./BankAccountsList";
import { CreditCardsList } from "./CreditCardsList";
import { PettyCashView } from "./PettyCashView";
import { useLanguage } from "@/contexts/LanguageContext";

export function TreasuryView() {
  const { t } = useLanguage();
  return (
    <Tabs defaultValue="reconciliation" className="space-y-4">
      <TabsList>
        <TabsTrigger value="reconciliation">{t("treasury.reconciliation")}</TabsTrigger>
        <TabsTrigger value="bank-accounts">{t("treasury.bankAccounts")}</TabsTrigger>
        <TabsTrigger value="credit-cards">{t("treasury.creditCards")}</TabsTrigger>
        <TabsTrigger value="petty-cash">{t("treasury.pettyCash")}</TabsTrigger>
      </TabsList>
      <TabsContent value="reconciliation">
        <BankReconciliationView />
      </TabsContent>
      <TabsContent value="bank-accounts">
        <BankAccountsList />
      </TabsContent>
      <TabsContent value="credit-cards">
        <CreditCardsList />
      </TabsContent>
      <TabsContent value="petty-cash">
        <PettyCashView />
      </TabsContent>
    </Tabs>
  );
}
