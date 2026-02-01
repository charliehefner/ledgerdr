import { useState } from 'react';
import { MainLayout } from '@/components/layout/MainLayout';
import { TransactionForm } from '@/components/transactions/TransactionForm';
import { RecentTransactions } from '@/components/transactions/RecentTransactions';
import { useLanguage } from '@/contexts/LanguageContext';

export default function Transactions() {
  const [refreshKey, setRefreshKey] = useState(0);
  const { t } = useLanguage();

  const handleTransactionSuccess = () => {
    setRefreshKey(prev => prev + 1);
  };

  return (
    <MainLayout title={t("page.transactions.title")}>
      <div className="space-y-6">
        <TransactionForm onSuccess={handleTransactionSuccess} />
        <RecentTransactions refreshKey={refreshKey} />
      </div>
    </MainLayout>
  );
}
