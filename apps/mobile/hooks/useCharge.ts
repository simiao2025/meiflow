import { useState, useEffect } from 'react';
import { supabase } from '../services/supabase';
import { useAuthStore } from '../stores/authStore';

interface ChargeData {
  id: string;
  amount: number;
  payment_method: string;
  status: string;
  external_reference?: string;
  payment_link?: string;
  qr_code_payload?: string;
}

export function useCharge() {
  const { user } = useAuthStore();
  const [clients, setClients] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (user) loadClients();
  }, [user]);

  const loadClients = async () => {
    try {
      if (!user?.id) return;
      const { data } = await supabase
        .from('clients')
        .select('*')
        .eq('user_id', user.id)
        .order('name');
      if (data) setClients(data);
    } catch (e) {
      console.error('Erro ao carregar clientes:', e);
    } finally {
      setIsLoading(false);
    }
  };

  const createCharge = async (
    selectedClient: string,
    numericAmount: number,
    selectedMethod: string,
    description: string
  ): Promise<ChargeData | null> => {
    if (!user?.id) return null;

    setIsSubmitting(true);
    try {
      if (selectedMethod === 'cash') {
        const { error: chargeError } = await supabase.from('charges').insert({
          user_id: user.id,
          client_id: selectedClient,
          amount: numericAmount,
          payment_method: 'cash',
          status: 'paid',
          description,
        });

        if (chargeError) throw chargeError;

        const { error: txError } = await supabase.from('transactions').insert({
          user_id: user.id,
          type: 'receita',
          amount: numericAmount,
          category: 'Pagamento em Dinheiro',
          description,
          payment_method: 'dinheiro',
          client_id: selectedClient,
        });

        if (txError) throw txError;

        return { id: 'cash', amount: numericAmount, payment_method: 'cash', status: 'paid' };
      }

      const { data: chargeData, error } = await supabase
        .from('charges')
        .insert({
          user_id: user.id,
          client_id: selectedClient,
          amount: numericAmount,
          payment_method: selectedMethod,
          status: 'pending',
          description,
          external_reference: `pay_${Date.now()}`,
          payment_link: `https://sandbox.asaas.com/c/pay_${Date.now()}`,
          qr_code_payload: selectedMethod === 'pix'
            ? `00020126330014BR.GOV.BCB.PIX0111${Date.now()}5204000053039865802BR5913MEIFlow6014BRASIL62070503***6304ABCD`
            : null,
        })
        .select()
        .single();

      if (error) throw error;
      return chargeData;
    } catch (error) {
      throw error;
    } finally {
      setIsSubmitting(false);
    }
  };

  return { clients, isLoading, isSubmitting, createCharge };
}