import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Alert,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useRouter, Href } from 'expo-router';
import { supabase } from '../../services/supabase';
import { useAuthStore } from '../../stores/authStore';
import ChargeResultScreen from '../../components/billing/ChargeResultScreen';

const METHODS = [
  { key: 'pix', label: 'PIX', icon: 'qr-code', color: '#10B981' },
  { key: 'credit_card', label: 'Cartão', icon: 'card', color: '#8B5CF6' },
  { key: 'cash', label: 'Dinheiro', icon: 'cash', color: '#F59E0B' },
];

export default function ChargeScreen() {
  const router = useRouter();
  const { user } = useAuthStore();

  const [clients, setClients] = useState<any[]>([]);
  const [selectedClient, setSelectedClient] = useState('');
  const [selectedMethod, setSelectedMethod] = useState('pix');
  const [amount, setAmount] = useState('');
  const [description, setDescription] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Resultado da cobrança
  const [chargeResult, setChargeResult] = useState<any>(null);

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

  const handleCharge = async () => {
    if (!selectedClient) {
      Alert.alert('Atenção', 'Selecione um cliente para cobrar.');
      return;
    }
    const numericAmount = parseFloat(amount.replace(',', '.'));
    if (!amount || isNaN(numericAmount) || numericAmount <= 0) {
      Alert.alert('Atenção', 'Informe um valor válido.');
      return;
    }

    if ((selectedMethod === 'pix' || selectedMethod === 'credit_card') && !user?.user_metadata?.asaas_api_key) {
      // Como o profile ainda não injetou direto no user aqui, fazemos uma verificação leve
      // Idealmente consultaríamos o `profile.asaas_api_key` se importarmos o zustand completo
    }

    setIsSubmitting(true);
    try {
      if (!user?.id) {
        Alert.alert('Erro', 'Usuário não autenticado.');
        return;
      }

      // Dinheiro: salva direto via Supabase (não precisa de gateway)
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

        // Também registra como receita no caixa financeiro
        const { error: txError } = await supabase.from('transactions').insert({
          user_id: user.id,
          type: 'receita',
          amount: numericAmount,
          category: 'Pagamento em Dinheiro',
          description,
          payment_method: 'dinheiro',
          client_id: selectedClient,
        });

        if (txError) {
          await supabase.from('charges').delete().eq('id', chargeError as any);
          throw txError;
        }

        Alert.alert('Registrado!', `R$ ${numericAmount.toFixed(2)} em dinheiro adicionado ao seu caixa.`, [
          { text: 'OK', onPress: () => router.back() },
        ]);
        return;
      }

      // PIX ou Cartão: Chama o Gateway Mock (via inserção direta no banco para o MVP)
      const { data: chargeData, error } = await supabase
        .from('charges')
        .insert({
user_id: user!.id,
           client_id: selectedClient,
           amount: numericAmount,
           payment_method: selectedMethod,
           status: 'pending',
           description,
          // Em produção real, esses campos viriam da resposta da API do Asaas
          external_reference: `pay_${Date.now()}`,
          payment_link: `https://sandbox.asaas.com/c/pay_${Date.now()}`,
          qr_code_payload: selectedMethod === 'pix'
            ? `00020126330014BR.GOV.BCB.PIX0111${Date.now()}5204000053039865802BR5913MEIFlow6014BRASIL62070503***6304ABCD`
            : null,
        })
        .select()
        .single();

      if (error) throw error;

      setChargeResult(chargeData);
    } catch (error: any) {
      Alert.alert('Erro', error.message || 'Falha ao gerar cobrança.');
    } finally {
      setIsSubmitting(false);
    }
  };



  // ===== TELA DE RESULTADO (após gerar cobrança) =====
  if (chargeResult) {
    return (
      <ChargeResultScreen
        chargeResult={chargeResult}
        onReset={() => setChargeResult(null)}
      />
    );
  }

  // ===== TELA PRINCIPAL (formulário) =====
  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={24} color="#F8FAFC" />
        </TouchableOpacity>
        <Text style={styles.title}>Cobrar Cliente</Text>
        <View style={{ width: 40 }} />
      </View>

      {isLoading ? (
        <ActivityIndicator size="large" color="#38BDF8" style={{ marginTop: 50 }} />
      ) : (
        <KeyboardAvoidingView
          style={{ flex: 1 }}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
        <ScrollView style={styles.form} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">

          {/* Método de Pagamento */}
          <Text style={styles.label}>Forma de Pagamento</Text>
          <View style={styles.methodRow}>
            {METHODS.map((m) => (
              <TouchableOpacity
                key={m.key}
                style={[
                  styles.methodCard,
                  selectedMethod === m.key && { borderColor: m.color, backgroundColor: `${m.color}15` },
                ]}
                onPress={() => setSelectedMethod(m.key)}
              >
                <Ionicons
                  name={m.icon as any}
                  size={28}
                  color={selectedMethod === m.key ? m.color : '#64748B'}
                />
                <Text
                  style={[
                    styles.methodLabel,
                    selectedMethod === m.key && { color: m.color },
                  ]}
                >
                  {m.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* Cliente */}
          <Text style={styles.label}>Cliente</Text>
          <View style={styles.dropdownContainer}>
            {clients.length === 0 ? (
              <View style={styles.emptyStateContainer}>
                <Text style={styles.emptyText}>Nenhum cliente cadastrado.</Text>
                <TouchableOpacity 
                  style={styles.addClientShortcut}
                  onPress={() => router.push('/(tabs)/clients')}
                >
                  <Ionicons name="person-add-outline" size={16} color="#38BDF8" />
                  <Text style={styles.addClientText}>Cadastrar Cliente Rápido</Text>
                </TouchableOpacity>
              </View>
            ) : (
              clients.map((c) => (
                <TouchableOpacity
                  key={c.id}
                  style={[styles.dropdownItem, selectedClient === c.id && styles.dropdownItemActive]}
                  onPress={() => setSelectedClient(c.id)}
                >
                  <Text style={styles.dropdownText}>{c.name}</Text>
                </TouchableOpacity>
              ))
            )}
          </View>

          {/* Valor */}
          <Text style={styles.label}>Valor (R$)</Text>
          <TextInput
            style={styles.input}
            keyboardType="numeric"
            placeholder="0,00"
            placeholderTextColor="#475569"
            value={amount}
            onChangeText={setAmount}
          />

          {/* Descrição */}
          <Text style={styles.label}>Descrição (opcional)</Text>
          <TextInput
            style={[styles.input, { height: 80, textAlignVertical: 'top' }]}
            placeholder="Ex: Serviço de pintura - Sala"
            placeholderTextColor="#475569"
            multiline
            value={description}
            onChangeText={setDescription}
          />

          {/* Botão de Ação */}
          <TouchableOpacity
            style={[styles.submitButton, isSubmitting && { opacity: 0.6 }]}
            onPress={handleCharge}
            disabled={isSubmitting}
          >
            <LinearGradient
              colors={
                selectedMethod === 'pix'
                  ? ['#10B981', '#059669']
                  : selectedMethod === 'credit_card'
                  ? ['#8B5CF6', '#7C3AED']
                  : ['#F59E0B', '#D97706']
              }
              style={styles.gradientButton}
            >
              {isSubmitting ? (
                <ActivityIndicator color="#FFF" />
              ) : (
                <>
                  <Ionicons
                    name={
                      selectedMethod === 'pix'
                        ? 'qr-code'
                        : selectedMethod === 'credit_card'
                        ? 'link'
                        : 'checkmark-circle'
                    }
                    size={20}
                    color="#FFF"
                    style={{ marginRight: 8 }}
                  />
                  <Text style={styles.submitText}>
                    {selectedMethod === 'pix'
                      ? 'Gerar QR Code PIX'
                      : selectedMethod === 'credit_card'
                      ? 'Gerar Link de Pagamento'
                      : 'Registrar Pagamento em Dinheiro'}
                  </Text>
                </>
              )}
            </LinearGradient>
          </TouchableOpacity>
        </ScrollView>
        </KeyboardAvoidingView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0F172A' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 24,
    paddingTop: 60,
    paddingBottom: 20,
    backgroundColor: '#1E293B',
    borderBottomWidth: 1,
    borderBottomColor: '#334155',
  },
  backButton: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: '#334155', justifyContent: 'center', alignItems: 'center',
  },
  title: { fontSize: 18, fontWeight: '700', color: '#F8FAFC' },
  form: { padding: 24 },
  label: { fontSize: 14, fontWeight: '600', color: '#94A3B8', marginBottom: 10, marginTop: 20 },

  // Método de pagamento cards
  methodRow: { flexDirection: 'row', justifyContent: 'space-between' },
  methodCard: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 18,
    marginHorizontal: 4,
    borderRadius: 16,
    backgroundColor: '#1E293B',
    borderWidth: 2,
    borderColor: '#334155',
  },
  methodLabel: { fontSize: 13, fontWeight: '700', color: '#94A3B8', marginTop: 6 },

  // Dropdown de clientes
  dropdownContainer: {
    backgroundColor: '#1E293B', borderRadius: 12, borderWidth: 1, borderColor: '#334155', overflow: 'hidden', maxHeight: 200,
  },
  dropdownItem: { padding: 16, borderBottomWidth: 1, borderBottomColor: '#334155' },
  dropdownItemActive: { backgroundColor: '#38BDF820' },
  dropdownText: { fontSize: 16, color: '#F1F5F9', fontWeight: '600' },
  emptyStateContainer: { padding: 16, alignItems: 'center' },
  emptyText: { color: '#64748B', textAlign: 'center', marginBottom: 12 },
  addClientShortcut: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    backgroundColor: 'rgba(56, 189, 248, 0.1)',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(56, 189, 248, 0.3)'
  },
  addClientText: { color: '#38BDF8', fontWeight: '600', marginLeft: 8 },

  input: {
    backgroundColor: '#1E293B', borderRadius: 12, borderWidth: 1, borderColor: '#334155',
    color: '#F8FAFC', fontSize: 18, padding: 16, fontWeight: '700',
  },

  submitButton: { borderRadius: 16, overflow: 'hidden', marginTop: 32, marginBottom: 40 },
  gradientButton: { flexDirection: 'row', height: 60, justifyContent: 'center', alignItems: 'center' },
  submitText: { color: '#FFF', fontSize: 16, fontWeight: '700' },

  // ===== Tela de resultado =====

});
