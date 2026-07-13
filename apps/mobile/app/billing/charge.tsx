import React, { useState } from 'react';
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
import { useRouter } from 'expo-router';
import { useAuthStore } from '../../stores/authStore';
import { useCharge } from '../../hooks/useCharge';
import ChargeResultScreen from '../../components/billing/ChargeResultScreen';
import { PaymentMethodSelector } from '../../components/billing/PaymentMethodSelector';
import { ClientSelector } from '../../components/billing/ClientSelector';

export default function ChargeScreen() {
  const router = useRouter();
  const { user } = useAuthStore();
  const { clients, isLoading, isSubmitting, createCharge } = useCharge();

  const [selectedClient, setSelectedClient] = useState('');
  const [selectedMethod, setSelectedMethod] = useState('pix');
  const [amount, setAmount] = useState('');
  const [description, setDescription] = useState('');
  const [chargeResult, setChargeResult] = useState<any>(null);

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

    try {
      const result = await createCharge(selectedClient, numericAmount, selectedMethod, description);

      if (selectedMethod === 'cash') {
        Alert.alert('Registrado!', `R$ ${numericAmount.toFixed(2).replace('.', ',')} em dinheiro adicionado ao seu caixa.`, [
          { text: 'OK', onPress: () => router.back() },
        ]);
      } else if (result) {
        setChargeResult(result);
      }
    } catch (error: any) {
      Alert.alert('Erro', error.message || 'Falha ao gerar cobrança.');
    }
  };

  if (chargeResult) {
    return (
      <ChargeResultScreen
        chargeResult={chargeResult}
        onReset={() => setChargeResult(null)}
      />
    );
  }

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
          behavior='padding' keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : -300}
        >
        <ScrollView style={styles.form} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">

          <Text style={styles.label}>Forma de Pagamento</Text>
          <PaymentMethodSelector selected={selectedMethod} onSelect={setSelectedMethod} />

          <Text style={styles.label}>Cliente</Text>
          <ClientSelector clients={clients} selected={selectedClient} onSelect={setSelectedClient} />

          <Text style={styles.label}>Valor (R$)</Text>
          <TextInput
            style={styles.input}
            keyboardType="numeric"
            placeholder="0,00"
            placeholderTextColor="#475569"
            value={amount}
            onChangeText={setAmount}
          />

          <Text style={styles.label}>Descrição (opcional)</Text>
          <TextInput
            style={[styles.input, { height: 80, textAlignVertical: 'top' }]}
            placeholder="Ex: Serviço de pintura - Sala"
            placeholderTextColor="#475569"
            multiline
            value={description}
            onChangeText={setDescription}
          />

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
