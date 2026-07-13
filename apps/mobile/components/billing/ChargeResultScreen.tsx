import React, { useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  Share,
  Clipboard,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { supabase } from '../../services/supabase';
import { useAuthStore } from '../../stores/authStore';

interface ChargeResult {
  id: string;
  amount: number;
  payment_method: string;
  status: string;
  description: string;
  client_id: string;
  qr_code_payload?: string;
  payment_link?: string;
}

interface Props {
  chargeResult: ChargeResult;
  onReset: () => void;
}

export default function ChargeResultScreen({ chargeResult, onReset }: Props) {
  const router = useRouter();
  const { user } = useAuthStore();

  useEffect(() => {
    return () => {
      Clipboard.setString('');
    };
  }, []);

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
      const { error: updateError } = await supabase.from('charges').update({ status: 'paid' }).eq('id', chargeResult.id);
      if (updateError) throw updateError;

      const { error: txError } = await supabase.from('transactions').insert({
        user_id: user.id,
        type: 'receita',
        amount: chargeResult.amount,
        category: `Recebimento via ${chargeResult.payment_method}`,
        description: chargeResult.description,
        payment_method: chargeResult.payment_method,
        client_id: chargeResult.client_id,
      });

      if (txError) {
        await supabase.from('charges').update({ status: 'pending' }).eq('id', chargeResult.id);
        throw txError;
      }

      onReset();
      Alert.alert('Sucesso (Dev)', 'Webhook de pagamento simulado. O dinheiro entrou no fluxo de caixa!');
    } catch (e: any) {
      Alert.alert('Erro', e.message);
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={onReset}>
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
          <Text style={styles.resultValue}>R$ {parseFloat(String(chargeResult.amount)).toFixed(2).replace('.', ',')}</Text>
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

        {chargeResult.status !== 'paid' && __DEV__ && (
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

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0F172A' },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 24, paddingTop: 60, paddingBottom: 20,
    backgroundColor: '#1E293B', borderBottomWidth: 1, borderBottomColor: '#334155',
  },
  backButton: { width: 40, height: 40, borderRadius: 20, backgroundColor: '#334155', justifyContent: 'center', alignItems: 'center' },
  title: { fontSize: 18, fontWeight: '700', color: '#F8FAFC' },
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
  qrPlaceholder: { width: 200, height: 200, borderRadius: 20, backgroundColor: '#1E293B', justifyContent: 'center', alignItems: 'center', borderWidth: 2, borderColor: '#38BDF830', marginBottom: 24 },
  qrHint: { color: '#64748B', fontSize: 12, marginTop: 8 },
  pixLabel: { color: '#94A3B8', fontSize: 13, fontWeight: '600', alignSelf: 'flex-start', marginBottom: 8 },
  pixCodeBox: { width: '100%', flexDirection: 'row', alignItems: 'center', backgroundColor: '#1E293B', borderRadius: 12, padding: 16, borderWidth: 1, borderColor: '#334155' },
  pixCodeText: { flex: 1, color: '#F1F5F9', fontSize: 13, marginRight: 12 },
  actionsRow: { flexDirection: 'row', width: '100%', marginTop: 24 },
  actionBtn: { borderRadius: 14, overflow: 'hidden' },
  actionGradient: { flexDirection: 'row', height: 48, justifyContent: 'center', alignItems: 'center' },
  actionText: { color: '#FFF', fontSize: 14, fontWeight: '700' },
  doneButton: { marginTop: 24, padding: 16 },
  doneText: { color: '#64748B', fontSize: 15, fontWeight: '600', textAlign: 'center' },
});
