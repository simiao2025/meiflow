import { create } from 'zustand';
import { supabase } from '../services/supabase';

interface DAS {
  id: string;
  month: string;
  due_date: string;
  amount: number;
  status: 'pendente' | 'pago' | 'vencido';
}

interface Invoice {
  id: string;
  direction: 'inbound' | 'outbound';
  type: 'nfe' | 'nfse' | 'cte';
  issuer_name: string;
  receiver_name?: string;
  total_amount: number;
  issue_date: string;
  status: string;
}

interface FiscalState {
  dasList: DAS[];
  invoices: Invoice[];
  isLoading: boolean;
  fetchFiscalData: (userId: string) => Promise<void>;
}

export const useFiscalStore = create<FiscalState>((set) => ({
  dasList: [],
  invoices: [],
  isLoading: false,

  fetchFiscalData: async (userId: string) => {
    set({ isLoading: true });
    try {
      const { data: dasData } = await supabase
        .from('das_records')
        .select('*')
        .eq('user_id', userId)
        .order('due_date', { ascending: false });

      // Busca Notas Fiscais capturadas
      const { data: invoiceData } = await supabase
        .from('invoices')
        .select('*')
        .eq('user_id', userId)
        .order('issue_date', { ascending: false });

      set({ 
        dasList: (dasData as any) || [], 
        invoices: (invoiceData as any) || [], 
        isLoading: false 
      });
    } catch (error) {
      console.error('Erro ao buscar dados fiscais:', error);
      set({ isLoading: false });
    }
  },
}));
