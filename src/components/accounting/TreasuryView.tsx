import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { BankReconciliationView } from "./BankReconciliationView";
import { BankAccountsList } from "./BankAccountsList";
import { CreditCardsList } from "./CreditCardsList";
import { PettyCashView } from "./PettyCashView";

export function TreasuryView() {
  return (
    <Tabs defaultValue="reconciliation" className="space-y-4">
      <TabsList>
        <TabsTrigger value="reconciliation">Conciliación</TabsTrigger>
        <TabsTrigger value="bank-accounts">Cuentas Bancarias</TabsTrigger>
        <TabsTrigger value="credit-cards">Tarjetas de Crédito</TabsTrigger>
        <TabsTrigger value="petty-cash">Caja Chica</TabsTrigger>
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
