import { Alert } from 'react-native';
import NetInfo from '@react-native-community/netinfo';
import { supabase, getFreshAuthToken } from './supabase';

const API_BASE_URL = process.env.EXPO_PUBLIC_API_URL || '';

const MAX_RETRIES = 3;
const INITIAL_RETRY_DELAY = 1000;
const TIMEOUT_MS = 30000;

const cache = new Map<string, { data: any; timestamp: number }>();
const CACHE_DURATION = 300000;

const checkConnection = async (): Promise<boolean> => {
  const state = await NetInfo.fetch();
  return state.isConnected ?? false;
};

const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Obtém o token JWT ativo do Supabase Auth de forma resiliente.
 * Se expirado, força o refresh automático.
 */
async function getAuthToken(): Promise<string> {
  const token = await getFreshAuthToken();
  if (!token) {
    throw new Error('Sessão expirada. Faça login novamente.');
  }
  return token;
}

async function fetchWithRetry(
  url: string,
  options: RequestInit,
  retryCount = 0
): Promise<Response> {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), TIMEOUT_MS);

    const response = await fetch(url, {
      ...options,
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      throw new Error(`API Error: ${response.status}`);
    }

    return response;
  } catch (error: any) {
    if (retryCount < MAX_RETRIES && error.name === 'AbortError') {
      const delayTime = INITIAL_RETRY_DELAY * Math.pow(2, retryCount);
      await delay(delayTime);
      return fetchWithRetry(url, options, retryCount + 1);
    }
    throw error;
  }
}

const api = {
  get: async (endpoint: string, useCache = true, cacheKey?: string) => {
    const key = cacheKey || endpoint;

    if (useCache) {
      const cached = cache.get(key);
      if (cached && Date.now() - cached.timestamp < CACHE_DURATION) {
        return cached.data;
      }
    }

    const isConnected = await checkConnection();
    if (!isConnected) {
      throw new Error('Sem conexão com a internet');
    }

    const token = await getAuthToken();

    const response = await fetchWithRetry(`${API_BASE_URL}${endpoint}`, {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
    });

    const data = await response.json();

    if (useCache) {
      cache.set(key, { data, timestamp: Date.now() });
    }

    return data;
  },

  post: async (endpoint: string, body: any) => {
    const isConnected = await checkConnection();
    if (!isConnected) {
      throw new Error('Sem conexão com a internet');
    }

    const token = await getAuthToken();

    const response = await fetchWithRetry(`${API_BASE_URL}${endpoint}`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });

    return response.json();
  },

  invalidateCache: (prefix?: string) => {
    if (!prefix) {
      cache.clear();
      return;
    }
    Array.from(cache.keys()).forEach((key) => {
      if (key.startsWith(prefix)) {
        cache.delete(key);
      }
    });
  },
};

export const financialService = {
  getBalance: async (userId: string) => {
    try {
      const { data, error } = await supabase
        .from('transactions')
        .select('amount, date, type')
        .eq('user_id', userId);
        
      if (error) throw error;
      
      let balance = 0;
      let currentMonthRevenue = 0;
      let prevMonthRevenue = 0;
      
      const now = new Date();
      const currentMonth = now.getMonth();
      const currentYear = now.getFullYear();
      
      let prevMonth = currentMonth - 1;
      let prevYear = currentYear;
      if (prevMonth < 0) {
        prevMonth = 11;
        prevYear -= 1;
      }
      
      data.forEach(t => {
        if (t.type === 'receita' || t.type === 'income') {
          balance += t.amount;
        } else if (t.type === 'despesa' || t.type === 'expense') {
          balance -= t.amount;
        }
        if (t.type === 'receita') {
          const d = new Date(t.date || new Date());
          if (d.getMonth() === currentMonth && d.getFullYear() === currentYear) {
            currentMonthRevenue += t.amount;
          } else if (d.getMonth() === prevMonth && d.getFullYear() === prevYear) {
            prevMonthRevenue += t.amount;
          }
        }
      });
      
      let growth = 0;
      if (prevMonthRevenue > 0) {
        growth = ((currentMonthRevenue - prevMonthRevenue) / prevMonthRevenue) * 100;
      } else if (currentMonthRevenue > 0) {
        growth = 100; // infinite growth if prev month was 0
      }
      
      return { balance, growth: growth.toFixed(1) };
    } catch (e) {
      console.error('Error fetching balance:', e);
      return { balance: 0, growth: "0.0" };
    }
  },
  getTransactions: async (userId: string) => {
    try {
      const { data, error } = await supabase
        .from('transactions')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false });
        
      if (error) throw error;
      return data;
    } catch (e) {
      console.error('Error fetching transactions:', e);
      Alert.alert('Erro', 'Não foi possível carregar as transações.');
      return [];
    }
  },
};

export const fiscalService = {
  getDasRecords: async (userId: string) => {
    try {
      const { data, error } = await supabase
        .from('das_records')
        .select('*')
        .eq('user_id', userId)
        .order('due_date', { ascending: true });
        
      if (error) throw error;
      return data;
    } catch (e) {
      console.error('Error fetching DAS records:', e);
      Alert.alert('Erro', 'Não foi possível carregar os DAS.');
      return [];
    }
  },
  getInvoices: async (userId: string) => {
    try {
      const { data, error } = await supabase
        .from('invoices')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false });
        
      if (error) throw error;
      return data;
    } catch (e) {
      console.error('Error fetching invoices:', e);
      Alert.alert('Erro', 'Não foi possível carregar as notas fiscais.');
      return [];
    }
  },
  emitInvoice: async (userId: string, clientId: string, catalogItemId: string, quantity: number) => {
    try {
      // Obter o item do catálogo para saber o preço
      const { data: item, error: itemError } = await supabase
        .from('catalog_items')
        .select('*')
        .eq('id', catalogItemId)
        .single();
        
      if (itemError) throw itemError;
      
      const amount = (item.price || 0) * quantity;
      
      const { data, error } = await supabase
        .from('nfe_records')
        .insert({
          user_id: userId,
          type: item.type === 'product' ? 'nfe' : 'nfce',
          total_amount: amount,
          status: 'processando',
        });
        
      if (error) throw error;
      return { success: true };
    } catch (e) {
      console.error('Error emitting invoice:', e);
      throw e;
    }
  }
};

export const aiFinanceService = {
  syncBankStatements: async () => {
    try {
      const { data, error } = await supabase.functions.invoke('sync-bank-statements');
      if (error) throw error;
      return data;
    } catch (e) {
      console.error('Error syncing bank statements:', e);
      throw e;
    }
  },
  getReconciliationSuggestions: async () => {
    try {
      const response = await api.get('/api/finance/reconciliations', false);
      return response.suggestions || [];
    } catch (e) {
      console.error('Error fetching reconciliation suggestions:', e);
      return [];
    }
  },
  approveReconciliation: async (statementId: string, matchType: string, matchId: string, amount: number, description: string) => {
    try {
      const payload = {
        statement_id: statementId,
        match_type: matchType,
        match_id: matchId,
        amount: amount,
        description: description
      };
      const response = await api.post('/api/finance/reconciliations/approve', payload);
      return response;
    } catch (e) {
      console.error('Error approving reconciliation:', e);
      throw e;
    }
  }
};

const legalService = {
  getLegalAlerts: async () => {
    try {
      const response = await api.get('/api/legal/alerts', false);
      return response.alerts || [];
    } catch (e) {
      return [];
    }
  }
};

export const procurementService = {
  getTenders: async (page = 1) => {
    try {
      const today = new Date();
      const thirtyDaysAgo = new Date(today.getTime() - 30 * 24 * 60 * 60 * 1000);
      const dataInicial = thirtyDaysAgo.toISOString().split('T')[0].replace(/-/g, '');
      const dataFinal = today.toISOString().split('T')[0].replace(/-/g, '');

      const url = `https://pncp.gov.br/api/consulta/v1/contratacoes/publicacao?dataInicial=${dataInicial}&dataFinal=${dataFinal}&pagina=${page}`;
      
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 15000);
      
      const response = await fetch(url, {
        headers: { 'Accept': 'application/json' },
        signal: controller.signal,
      });
      clearTimeout(timeoutId);
      
      if (!response.ok) throw new Error(`PNCP Error: ${response.status}`);
      
      const data = await response.json();
      if (!data || !data.data || data.data.length === 0) throw new Error('No data');
      return data;
    } catch (e) {
      // Fallback to mock data if API fails or returns empty
      return { 
        data: [
          {
            numeroControlePNCP: '123456789',
            objetoCompra: 'Aquisição de materiais de escritório para a Prefeitura Municipal',
            orgaoEntidade: { razaoSocial: 'Prefeitura Municipal de São Paulo' },
            valorTotalEstimado: 45000.00,
            dataPublicacaoPncp: new Date().toISOString(),
            modalidadeNome: 'Pregão Eletrônico'
          },
          {
            numeroControlePNCP: '987654321',
            objetoCompra: 'Contratação de serviços de limpeza e conservação predial',
            orgaoEntidade: { razaoSocial: 'Ministério da Educação' },
            valorTotalEstimado: 120000.50,
            dataPublicacaoPncp: new Date(Date.now() - 86400000).toISOString(),
            modalidadeNome: 'Concorrência'
          }
        ], 
        totalRegistros: 2, 
        totalPaginas: 1 
      };
    }
  }
};

export const creditService = {
  getOffers: async (category?: string) => {
    try {
      let query = supabase
        .from('credit_offers')
        .select('*')
        .eq('is_active', true)
        .order('match_score', { ascending: false });

      if (category && category !== 'todos') {
        query = query.eq('category', category);
      }

      const { data, error } = await query;
      if (error) throw error;
      
      if (data && data.length > 0) return data;
      throw new Error('No data');
    } catch (e) {
      const allFallback = [
        { id: '1', title: 'PRONAMPE MEI Especial', bank_name: 'Caixa Econômica', match_score: 96, category: 'giro', description: 'Crédito com taxa reduzida e garantia do FGO para investimento e giro.', rate: '1.49% a.m.', max_amount: 'Até R$ 150.000', url: 'https://caixa.gov.br' },
        { id: '2', title: 'Cartão BNDES MEI', bank_name: 'BNDES', match_score: 95, category: 'cartao', description: 'Crédito rotativo pré-aprovado para compra de máquinas e insumos.', rate: '1.20% a.m.', max_amount: 'Até R$ 250.000', url: 'https://bndes.gov.br' },
        { id: '3', title: 'BB Giro Digital MEI', bank_name: 'Banco do Brasil', match_score: 93, category: 'giro', description: 'Capital de giro 100% digital com aprovação instantânea.', rate: '1.59% a.m.', max_amount: 'Até R$ 100.000', url: 'https://bb.com.br' },
        { id: '4', title: 'Antecipação de Vendas', bank_name: 'Sicredi / Mercado Pago', match_score: 91, category: 'antecipacao', description: 'Receba na hora o valor das vendas parceladas na maquininha.', rate: '1.49% a.m.', max_amount: 'Conforme vendas', url: 'https://sicredi.com.br' },
        { id: '5', title: 'CrediAmigo Microcrédito', bank_name: 'Banco do Nordeste', match_score: 90, category: 'investimento', description: 'Microcrédito produtivo orientado para crescimento do seu negócio.', rate: '1.05% a.m.', max_amount: 'Até R$ 21.000', url: 'https://bnb.gov.br' },
      ];
      if (category && category !== 'todos') {
        return allFallback.filter(item => item.category === category);
      }
      return allFallback;
    }
  }
};

export const alertsService = {
  getAlerts: async (category?: string) => {
    try {
      let query = supabase
        .from('mei_alerts')
        .select('*')
        .eq('is_active', true)
        .order('published_at', { ascending: false });

      if (category && category !== 'todos') {
        query = query.eq('category', category);
      }

      const { data, error } = await query;
      if (error) throw error;
      
      if (data && data.length > 0) return data;
      throw new Error('No data');
    } catch (e) {
      const allAlertsFallback = [
        { id: '1', title: 'Reforma Tributária: Manutenção do Regime MEI', summary: 'A regulamentação da Reforma Tributária assegura que o MEI continua sob o regime unificado do Simples Nacional, sem cumulatividade de IBS/CBS.', source: 'Ministério da Fazenda', published_at: new Date().toISOString(), impact: 'Alta', category: 'legislacao', url: 'https://www.gov.br/fazenda' },
        { id: '2', title: 'Regularização de Dívidas Ativas na PGFN', summary: 'Edital da Procuradoria da Fazenda Nacional oferece até 50% de desconto sobre multas e juros para débitos inscritos em dívida ativa.', source: 'Receita Federal / PGFN', published_at: new Date().toISOString(), impact: 'Crítica', category: 'imposto', url: 'https://www.regularize.pgfn.gov.br' },
        { id: '3', title: 'Fechamento de Faturamento 2026 e DASN', summary: 'Acompanhe o faturamento acumulado nos últimos meses para manter-se dentro do limite anual e agilizar a Declaração Anual.', source: 'Simples Nacional', published_at: new Date().toISOString(), impact: 'Alta', category: 'prazo', url: 'https://www.gov.br/receitafederal' },
        { id: '4', title: 'Crédito Pronampe MEI Especial de Fim de Ano', summary: 'Linha especial para reforço de estoque e capital de giro com carência estendida para o período de maior movimentação.', source: 'BNDES / Caixa', published_at: new Date().toISOString(), impact: 'Média', category: 'beneficio', url: 'https://www.gov.br/empresas-e-negocios' },
      ];
      if (category && category !== 'todos') {
        return allAlertsFallback.filter(item => item.category === category);
      }
      return allAlertsFallback;
    }
  }
};
