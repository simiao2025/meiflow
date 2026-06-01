import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Modal, TextInput, ActivityIndicator, Alert } from 'react-native';
import { useThemeColors, Typography, Palette } from '../../constants/theme';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '../../services/supabase';
import { useAuthStore } from '../../stores/authStore';
import { useRouter } from 'expo-router';

export default function BankAccountsScreen() {
  const Colors = useThemeColors();
  const { user } = useAuthStore();
  const router = useRouter();
  
  const [accounts, setAccounts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  
  const [isModalVisible, setModalVisible] = useState(false);
  const [provider, setProvider] = useState<'Asaas' | 'Inter' | 'Cora' | null>(null);
  const [clientId, setClientId] = useState('');
  const [clientSecret, setClientSecret] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    loadAccounts();
  }, [user]);

  const loadAccounts = async () => {
    if (!user) return;
    setLoading(true);
    const { data, error } = await supabase
      .from('bank_accounts')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false });
      
    if (!error && data) {
      setAccounts(data);
    }
    setLoading(false);
  };

  const handleSaveAccount = async () => {
    if (!provider || !clientId || !clientSecret) {
      Alert.alert('Atenção', 'Preencha todos os campos obrigatórios.');
      return;
    }
    
    setSaving(true);
    const { error } = await supabase.from('bank_accounts').insert({
      user_id: user?.id,
      provider,
      client_id: clientId,
      client_secret: clientSecret,
      status: 'connected'
    });
    
    if (error) {
      Alert.alert('Erro', 'Não foi possível conectar o banco.');
    } else {
      Alert.alert('Sucesso', 'Banco conectado com sucesso!');
      setModalVisible(false);
      setProvider(null);
      setClientId('');
      setClientSecret('');
      loadAccounts();
    }
    setSaving(false);
  };

  const handleDelete = async (id: string) => {
    Alert.alert('Desconectar Banco', 'Tem certeza que deseja remover esta conexão?', [
      { text: 'Cancelar', style: 'cancel' },
      { text: 'Desconectar', style: 'destructive', onPress: async () => {
        const { error } = await supabase.from('bank_accounts').delete().eq('id', id);
        if (!error) loadAccounts();
      }}
    ]);
  };

  return (
    <View style={[styles.container, { backgroundColor: Colors.bg }]}>
      <View style={[styles.header, { borderBottomColor: Colors.border }]}>
        <TouchableOpacity style={[styles.backBtn, { backgroundColor: Colors.bgCard, borderColor: Colors.borderStrong }]} onPress={() => router.back()}>
          <Ionicons name="chevron-back" size={24} color={Colors.text} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: Colors.text }]}>Contas Bancárias</Text>
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        {loading ? (
          <ActivityIndicator color={Colors.primary} style={{ marginTop: 40 }} />
        ) : accounts.length === 0 ? (
          <View style={styles.emptyState}>
            <View style={[styles.iconContainer, { backgroundColor: Colors.primaryMuted }]}>
              <Ionicons name="wallet-outline" size={48} color={Colors.primary} />
            </View>
            <Text style={[styles.title, { color: Colors.text }]}>Nenhuma Conta</Text>
            <Text style={[styles.subtitle, { color: Colors.textSecondary }]}>
              Conecte sua conta bancária digital para sincronizar os extratos com a inteligência artificial.
            </Text>
          </View>
        ) : (
          accounts.map(acc => (
            <View key={acc.id} style={[styles.card, { backgroundColor: Colors.bgCard, borderColor: Colors.border }]}>
              <View style={styles.cardHeader}>
                <Ionicons name="business" size={24} color={Colors.primary} />
                <View style={{ flex: 1, marginLeft: 12 }}>
                  <Text style={[styles.bankName, { color: Colors.text }]}>{acc.provider}</Text>
                  <Text style={[styles.bankStatus, { color: acc.status === 'connected' ? '#10B981' : '#EF4444' }]}>
                    {acc.status === 'connected' ? 'Sincronizado' : 'Desconectado'}
                  </Text>
                </View>
                <TouchableOpacity onPress={() => handleDelete(acc.id)}>
                  <Ionicons name="trash-outline" size={20} color="#EF4444" />
                </TouchableOpacity>
              </View>
            </View>
          ))
        )}

        <TouchableOpacity style={[styles.addBtn, { backgroundColor: Colors.primary }]} onPress={() => setModalVisible(true)}>
          <Ionicons name="add" size={20} color={Palette.black} />
          <Text style={styles.addBtnText}>Nova Conexão</Text>
        </TouchableOpacity>
      </ScrollView>

      {/* Modal Nova Conexão */}
      <Modal visible={isModalVisible} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: Colors.bg }]}>
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, { color: Colors.text }]}>Conectar Banco</Text>
              <TouchableOpacity onPress={() => setModalVisible(false)}>
                <Ionicons name="close" size={24} color={Colors.textMuted} />
              </TouchableOpacity>
            </View>

            <Text style={[styles.label, { color: Colors.textSecondary }]}>Selecione a Instituição</Text>
            <View style={styles.providerRow}>
              {['Asaas', 'Inter', 'Cora'].map(p => (
                <TouchableOpacity 
                  key={p} 
                  style={[
                    styles.providerBtn, 
                    { backgroundColor: provider === p ? Colors.primary : Colors.bgCard, borderColor: provider === p ? Colors.primary : Colors.borderStrong }
                  ]}
                  onPress={() => setProvider(p as any)}
                >
                  <Text style={[styles.providerText, { color: provider === p ? Palette.black : Colors.text }]}>{p}</Text>
                </TouchableOpacity>
              ))}
            </View>

            {provider && (
              <>
                <Text style={[styles.label, { color: Colors.textSecondary }]}>Client ID / API Key</Text>
                <TextInput
                  style={[styles.input, { backgroundColor: Colors.bgCard, color: Colors.text, borderColor: Colors.borderStrong }]}
                  placeholder="Cole sua chave aqui"
                  placeholderTextColor={Colors.textMuted}
                  value={clientId}
                  onChangeText={setClientId}
                />

                <Text style={[styles.label, { color: Colors.textSecondary }]}>Client Secret</Text>
                <TextInput
                  style={[styles.input, { backgroundColor: Colors.bgCard, color: Colors.text, borderColor: Colors.borderStrong }]}
                  placeholder="Cole seu segredo (secret) aqui"
                  placeholderTextColor={Colors.textMuted}
                  value={clientSecret}
                  onChangeText={setClientSecret}
                  secureTextEntry
                />

                <TouchableOpacity 
                  style={[styles.saveBtn, { backgroundColor: Colors.primary }]} 
                  onPress={handleSaveAccount}
                  disabled={saving}
                >
                  {saving ? <ActivityIndicator color={Palette.black} /> : <Text style={styles.saveBtnText}>Conectar</Text>}
                </TouchableOpacity>
              </>
            )}
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'center', paddingTop: 60, paddingHorizontal: 24, paddingBottom: 20, borderBottomWidth: 1 },
  backBtn: { width: 40, height: 40, borderRadius: 20, justifyContent: 'center', alignItems: 'center', borderWidth: 1 },
  headerTitle: { flex: 1, textAlign: 'center', fontSize: 18, fontFamily: Typography.fonts.medium, marginRight: 40 },
  content: { padding: 24 },
  emptyState: { alignItems: 'center', marginTop: 40 },
  iconContainer: { width: 80, height: 80, borderRadius: 40, justifyContent: 'center', alignItems: 'center', marginBottom: 24 },
  title: { fontSize: 20, fontFamily: Typography.fonts.display, marginBottom: 12 },
  subtitle: { fontSize: 14, fontFamily: Typography.fonts.body, textAlign: 'center', lineHeight: 22 },
  card: { padding: 20, borderRadius: 16, borderWidth: 1, marginBottom: 16 },
  cardHeader: { flexDirection: 'row', alignItems: 'center' },
  bankName: { fontSize: 16, fontFamily: Typography.fonts.medium },
  bankStatus: { fontSize: 12, fontFamily: Typography.fonts.body, marginTop: 4 },
  addBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', height: 56, borderRadius: 16, marginTop: 24 },
  addBtnText: { color: Palette.black, fontSize: 16, fontFamily: Typography.fonts.medium, fontWeight: '700', marginLeft: 8 },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'flex-end' },
  modalContent: { padding: 24, borderTopLeftRadius: 32, borderTopRightRadius: 32, minHeight: 400 },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 },
  modalTitle: { fontSize: 20, fontFamily: Typography.fonts.display },
  label: { fontSize: 14, fontFamily: Typography.fonts.medium, marginBottom: 8, marginTop: 16 },
  providerRow: { flexDirection: 'row', gap: 12, marginBottom: 12 },
  providerBtn: { flex: 1, paddingVertical: 12, alignItems: 'center', borderRadius: 12, borderWidth: 1 },
  providerText: { fontSize: 14, fontFamily: Typography.fonts.medium },
  input: { height: 56, borderRadius: 16, borderWidth: 1, paddingHorizontal: 16, fontFamily: Typography.fonts.body },
  saveBtn: { height: 56, borderRadius: 16, justifyContent: 'center', alignItems: 'center', marginTop: 32 },
  saveBtnText: { color: Palette.black, fontSize: 16, fontFamily: Typography.fonts.medium, fontWeight: '700' }
});
