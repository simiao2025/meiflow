import { create } from 'zustand';
import { supabase } from '../services/supabase';

export interface DAS {
  id: string;
  month: string;
  due_date: string;
  amount: number;
  status: 'pendente' | 'pago' | 'vencido';
}

export interface Invoice {
  id: string;
  direction: 'inbound' | 'outbound';
  type: 'nfe' | 'nfse' | 'cte';
  issuer_name: string;
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
      // Busca DAS (tabela fiscal.das_guides do initial_schema)
      const { data: dasData } = await supabase
        .from('das_guides')
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
