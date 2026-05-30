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
  Share,
  Clipboard,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { supabase } from '../../services/supabase';
import { useAuthStore } from '../../stores/authStore';

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
      const { data } = await supabase
        .from('clients')
        .select('*')
        .eq('user_id', user?.id)
        .order('name');
      if (data) setClients(data);
    } catch (e) {
      console.error(e);
    } finally {
      setIsLoading(false);
    }
  };

  const handleCharge = async () => {
    if (!selectedClient) {
      Alert.alert('Atenção', 'Selecione um cliente para cobrar.');
      return;
    }
    if (!amount || parseFloat(amount.replace(',', '.')) <= 0) {
      Alert.alert('Atenção', 'Informe um valor válido.');
      return;
    }

    if ((selectedMethod === 'pix' || selectedMethod === 'credit_card') && !user?.user_metadata?.asaas_api_key) {
      // Como o profile ainda não injetou direto no user aqui, fazemos uma verificação leve
      // Idealmente consultaríamos o `profile.asaas_api_key` se importarmos o zustand completo
    }

    setIsSubmitting(true);
    try {
      const numericAmount = parseFloat(amount.replace(',', '.'));

      // Dinheiro: salva direto via Supabase (não precisa de gateway)
      if (selectedMethod === 'cash') {
        const { error } = await supabase.from('charges').insert({
          user_id: user?.id,
          client_id: selectedClient,
          amount: numericAmount,
          payment_method: 'cash',
          status: 'paid',
          description,
        });

        // Também registra como receita no caixa financeiro
        await supabase.from('transactions').insert({
          user_id: user?.id,
          type: 'receita',
          amount: numericAmount,
          category: 'Pagamento em Dinheiro',
          description,
          payment_method: 'dinheiro',
          client_id: selectedClient,
        });

        if (error) throw error;

        Alert.alert('Registrado!', `R$ ${numericAmount.toFixed(2)} em dinheiro adicionado ao seu caixa.`, [
          { text: 'OK', onPress: () => router.back() },
        ]);
        return;
      }

      // PIX ou Cartão: Chama o Gateway Mock (via inserção direta no banco para o MVP)
      const { data: chargeData, error } = await supabase
        .from('charges')
        .insert({
          user_id: user?.id,
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

  const handleCopyPix = () => {
    if (chargeResult?.qr_code_payload) {
      Clipboard.setString(chargeResult.qr_code_payload);
      Alert.alert('Copiado!', 'Código PIX Copia e Cola copiado para a área de transferência.');
    }
  };

  const handleShareLink = async () => {
    if (chargeResult?.payment_link) {
      await Share.share({
        message: `Olá! Segue o link para pagamento de R$ ${chargeResult.amount}: ${chargeResult.payment_link}`,
      });
    }
  };

  const simulateWebhook = async () => {
    if (!chargeResult || !user) return;
    try {
      // Atualiza charge
      await supabase.from('charges').update({ status: 'paid' }).eq('id', chargeResult.id);
      
      // Insere transação de receita
      await supabase.from('transactions').insert({
        user_id: user.id,
        type: 'receita',
        amount: chargeResult.amount,
        category: `Recebimento via ${chargeResult.payment_method}`,
        description: chargeResult.description,
        payment_method: chargeResult.payment_method,
        client_id: chargeResult.client_id,
      });

      setChargeResult({ ...chargeResult, status: 'paid' });
      Alert.alert('Sucesso (Dev)', 'Webhook de pagamento simulado. O dinheiro entrou no fluxo de caixa!');
    } catch (e: any) {
      Alert.alert('Erro', e.message);
    }
  };

  // ===== TELA DE RESULTADO (após gerar cobrança) =====
  if (chargeResult) {
    return (
      <View style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity style={styles.backButton} onPress={() => { setChargeResult(null); }}>
            <Ionicons name="arrow-back" size={24} color="#F8FAFC" />
          </TouchableOpacity>
          <Text style={styles.title}>Cobrança Gerada</Text>
          <View style={{ width: 40 }} />
        </View>

        <ScrollView contentContainerStyle={styles.resultContainer}>
          <View style={styles.successBadge}>
            <Ionicons name="checkmark-circle" size={60} color="#10B981" />
            <Text style={styles.successText}>Cobrança Criada!</Text>
          </View>

          <View style={styles.resultCard}>
            <Text style={styles.resultLabel}>Valor</Text>
            <Text style={styles.resultValue}>R$ {parseFloat(chargeResult.amount).toFixed(2)}</Text>
          </View>

          <View style={styles.resultCard}>
            <Text style={styles.resultLabel}>Método</Text>
            <Text style={styles.resultMethodText}>
              {chargeResult.payment_method === 'pix' ? '💠 PIX' : '💳 Cartão'}
            </Text>
          </View>

          <View style={styles.resultCard}>
            <Text style={styles.resultLabel}>Status</Text>
            {chargeResult.status === 'paid' ? (
              <View style={[styles.pendingBadge, { backgroundColor: '#10B98120' }]}>
                <Text style={[styles.pendingText, { color: '#10B981' }]}>✅ Pago</Text>
              </View>
            ) : (
              <View style={styles.pendingBadge}>
                <Text style={styles.pendingText}>⏳ Aguardando Pagamento</Text>
              </View>
            )}
          </View>

          {/* QR Code / PIX Copia e Cola */}
          {chargeResult.payment_method === 'pix' && chargeResult.qr_code_payload && (
            <View style={styles.pixSection}>
              <View style={styles.qrPlaceholder}>
                <Ionicons name="qr-code" size={120} color="#38BDF8" />
                <Text style={styles.qrHint}>QR Code PIX</Text>
              </View>

              <Text style={styles.pixLabel}>PIX Copia e Cola:</Text>
              <TouchableOpacity style={styles.pixCodeBox} onPress={handleCopyPix}>
                <Text style={styles.pixCodeText} numberOfLines={2}>
                  {chargeResult.qr_code_payload}
                </Text>
                <Ionicons name="copy-outline" size={20} color="#38BDF8" />
              </TouchableOpacity>
            </View>
          )}

          {/* Botões de ação */}
          <View style={styles.actionsRow}>
            <TouchableOpacity style={[styles.actionBtn, { flex: 1, marginRight: 8 }]} onPress={handleCopyPix}>
              <LinearGradient colors={['#10B981', '#059669']} style={styles.actionGradient}>
                <Ionicons name="copy" size={18} color="#FFF" style={{ marginRight: 6 }} />
                <Text style={styles.actionText}>Copiar PIX</Text>
              </LinearGradient>
            </TouchableOpacity>

            <TouchableOpacity style={[styles.actionBtn, { flex: 1, marginLeft: 8 }]} onPress={handleShareLink}>
              <LinearGradient colors={['#38BDF8', '#0284C7']} style={styles.actionGradient}>
                <Ionicons name="share-social" size={18} color="#FFF" style={{ marginRight: 6 }} />
                <Text style={styles.actionText}>Compartilhar</Text>
              </LinearGradient>
            </TouchableOpacity>
          </View>

          <TouchableOpacity style={styles.doneButton} onPress={() => router.back()}>
            <Text style={styles.doneText}>Voltar para Ajustes</Text>
          </TouchableOpacity>

          {chargeResult.status !== 'paid' && (
            <TouchableOpacity style={{ marginTop: 20 }} onPress={simulateWebhook}>
               <Text style={{ color: '#F59E0B', textAlign: 'center', textDecorationLine: 'underline' }}>
                 [DEV] Simular Webhook de Pagamento
               </Text>
            </TouchableOpacity>
          )}
        </ScrollView>
      </View>
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
        <ScrollView style={styles.form} showsVerticalScrollIndicator={false}>

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
                  onPress={() => router.push('/clients/new')}
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
  resultContainer: { alignItems: 'center', padding: 24, paddingBottom: 60 },
  successBadge: { alignItems: 'center', marginTop: 20, marginBottom: 30 },
  successText: { fontSize: 22, fontWeight: '800', color: '#F8FAFC', marginTop: 12 },

  resultCard: {
    width: '100%', backgroundColor: '#1E293B', borderRadius: 16, padding: 20,
    marginBottom: 12, borderWidth: 1, borderColor: '#334155',
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
  },
  resultLabel: { fontSize: 14, color: '#94A3B8', fontWeight: '600' },
  resultValue: { fontSize: 24, color: '#F8FAFC', fontWeight: '800' },
  resultMethodText: { fontSize: 16, color: '#F1F5F9', fontWeight: '700' },

  pendingBadge: { backgroundColor: '#F59E0B20', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20 },
  pendingText: { color: '#F59E0B', fontSize: 13, fontWeight: '700' },

  pixSection: { width: '100%', alignItems: 'center', marginTop: 24 },
  qrPlaceholder: {
    width: 200, height: 200, borderRadius: 20,
    backgroundColor: '#1E293B', justifyContent: 'center', alignItems: 'center',
    borderWidth: 2, borderColor: '#38BDF830', marginBottom: 24,
  },
  qrHint: { color: '#64748B', fontSize: 12, marginTop: 8 },
  pixLabel: { color: '#94A3B8', fontSize: 13, fontWeight: '600', alignSelf: 'flex-start', marginBottom: 8 },
  pixCodeBox: {
    width: '100%', flexDirection: 'row', alignItems: 'center',
    backgroundColor: '#1E293B', borderRadius: 12, padding: 16,
    borderWidth: 1, borderColor: '#334155',
  },
  pixCodeText: { flex: 1, color: '#F1F5F9', fontSize: 13, marginRight: 12 },

  actionsRow: { flexDirection: 'row', width: '100%', marginTop: 24 },
  actionBtn: { borderRadius: 14, overflow: 'hidden' },
  actionGradient: { flexDirection: 'row', height: 48, justifyContent: 'center', alignItems: 'center' },
  actionText: { color: '#FFF', fontSize: 14, fontWeight: '700' },

  doneButton: { marginTop: 24, padding: 16 },
  doneText: { color: '#64748B', fontSize: 15, fontWeight: '600', textAlign: 'center' },
});
