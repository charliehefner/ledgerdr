import { useState } from 'react';
import { MainLayout } from '@/components/layout/MainLayout';
import { TransactionForm } from '@/components/transactions/TransactionForm';
import { RecentTransactions } from '@/components/transactions/RecentTransactions';
import { useLanguage } from '@/contexts/LanguageContext';
import { Receipt } from 'lucide-react';

export default function Transactions() {
  const [refreshKey, setRefreshKey] = useState(0);
  const { t } = useLanguage();

  const handleTransactionSuccess = () => {
    setRefreshKey(prev => prev + 1);
  };

  return (
    <MainLayout>
      <div className="space-y-6">
        <header className="flex items-center gap-3 rounded-lg border-l-4 border-primary bg-gradient-to-r from-primary/5 to-transparent px-4 py-4">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
            <Receipt className="h-6 w-6 text-primary" />
          </div>
          <div>
            <h1 className="text-3xl font-bold text-foreground">{t("page.transactions.title")}</h1>
            <p className="text-muted-foreground">{t("page.transactions.subtitle") !== "page.transactions.subtitle" ? t("page.transactions.subtitle") : "Registrar y gestionar transacciones"}</p>
          </div>
        </header>
        <TransactionForm onSuccess={handleTransactionSuccess} />
        <RecentTransactions refreshKey={refreshKey} />
      </div>
    </MainLayout>
  );
}
