import { useState, useEffect } from 'react';
import { supabase } from '../services/supabase';
import { financialService } from '../services/api';

export function useFinancialData() {
  const [transactions, setTransactions] = useState<any[]>([]);
  const [balance, setBalance] = useState(0);
  const [loading, setLoading] = useState(true);
  const [userId, setUserId] = useState<string | null>(null);

  const fetchData = async () => {
    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        setUserId(user.id);
        const trans = await financialService.getTransactions(user.id);
        const { balance: bal } = await financialService.getBalance(user.id);
        setTransactions(trans);
        setBalance(bal);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  return { transactions, balance, loading, userId, fetchData };
}
