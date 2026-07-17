import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator, Alert } from 'react-native';
import { useThemeColors, Typography, Palette } from '../../../constants/theme';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '../../../services/supabase';
import { useAuthStore } from '../../../stores/authStore';
import { useRouter } from 'expo-router';

const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL || 'https://meiflow.supabase.co';
const EDGE_FUNCTION_URL = `${SUPABASE_URL}/functions/v1/sync-bank-statements`;

export default function BankAccountsScreen() {
  const Colors = useThemeColors();
  const { user } = useAuthStore();
  const router = useRouter();

  const [connectors, setConnectors] = useState<any[]>([]);
  const [availableBanks, setAvailableBanks] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showBankPicker, setShowBankPicker] = useState(false);
  const [connecting, setConnecting] = useState(false);
  const [selectedBank, setSelectedBank] = useState<any>(null);
  const [showStatusModal, setShowStatusModal] = useState(false);
  const [pollingConnector, setPollingConnector] = useState<string | null>(null);

  useEffect(() => {
    loadData();
  }, [user]);

  useEffect(() => {
    if (pollingConnector) {
      const intervalId = setInterval(() => pollConnectorStatus(pollingConnector), 3000);
      return () => clearInterval(intervalId);
    }
  }, [pollingConnector]);

  const loadData = async () => {
    if (!user) return;
    setLoading(true);
    try {
      await Promise.all([loadConnectors(), loadAvailableBanks()]);
    } finally {
      setLoading(false);
    }
  };

  const getAuthHeaders = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    return {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${session?.access_token || ''}`,
    };
  };

  const loadConnectors = async () => {
    try {
      const headers = await getAuthHeaders();
      const response = await fetch(`${EDGE_FUNCTION_URL}/connectors/list`, {
        method: 'POST',
        headers,
      });
      const data = await response.json();
      if (data.success) {
        setConnectors(data.connectors || []);
      }
    } catch (e) {
      console.error('Error loading connectors:', e);
    }
  };

  const loadAvailableBanks = async () => {
    try {
      const response = await fetch(`${EDGE_FUNCTION_URL}/connectors/available`, {
        headers: { 'Content-Type': 'application/json' },
      });
      const data = await response.json();
      if (data.success) {
        setAvailableBanks(data.connectors || []);
      } else {
        // Fallback: usa lista offline de bancos
        setAvailableBanks(getOfflineBanks());
      }
    } catch {
      setAvailableBanks(getOfflineBanks());
    }
  };

  const handleConnect = async () => {
    if (!selectedBank) return;
    setConnecting(true);

    try {
      const headers = await getAuthHeaders();
      const response = await fetch(`${EDGE_FUNCTION_URL}/connectors/create`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ connector_id: selectedBank.id }),
      });
      const data = await response.json();

      if (data.success) {
        // Se tem redirect_url (OAuth), abrir
        if (data.redirect_url) {
          Alert.alert(
            'Autenticação Necessária',
            `Você será redirecionado para autenticar no ${selectedBank.name}. Após autorizar, volte ao app.`,
            [
              { text: 'Abrir Banco', onPress: () => {
                // Em um app real, abriria WebBrowser.openAuthSessionAsync(data.redirect_url)
                // Para MVP, instruímos o usuário
                Alert.alert(
                  'Autenticação',
                  `Complete a autenticação no seu banco. Quando finalizar, volte ao MEIFlow para verificar o status.\n\nSe preferir, cole este link no navegador:\n${data.redirect_url}`
                );
              }},
              { text: 'Depois', style: 'cancel' },
            ]
          );
        }

        // Iniciar polling do status
        setPollingConnector(data.item_id);

        // Recarregar lista
        await loadConnectors();
        setShowBankPicker(false);
        setSelectedBank(null);
      } else {
        Alert.alert('Erro', data.error || 'Não foi possível conectar o banco.');
      }
    } catch (e: any) {
      Alert.alert('Erro', `Falha na conexão: ${e.message}`);
    } finally {
      setConnecting(false);
    }
  };

  const pollConnectorStatus = async (itemId: string) => {
    try {
      const headers = await getAuthHeaders();
      const response = await fetch(`${EDGE_FUNCTION_URL}/connectors/status`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ item_id: itemId }),
      });
      const data = await response.json();

      if (data.success) {
        const newStatus = data.status;
        // Atualizar na lista local
        setConnectors(prev =>
          prev.map(c =>
            c.item_id === itemId ? { ...c, status: newStatus } : c
          )
        );

        // Se concluído ou erro, parar polling
        if (newStatus === 'login_succeeded') {
          setPollingConnector(null);
          Alert.alert('Conectado!', `${data.message}`);
          await loadConnectors();
        } else if (newStatus === 'login_error') {
          setPollingConnector(null);
          Alert.alert('Falha na Autenticação', 'Não foi possível conectar ao banco. Tente novamente.');
        }
      }
    } catch (e) {
      console.error('Error polling status:', e);
    }
  };

  const handleDelete = async (itemId: string) => {
    Alert.alert(
      'Desconectar Banco',
      'Tem certeza que deseja remover esta conexão bancária? Os extratos já sincronizados serão mantidos.',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Desconectar',
          style: 'destructive',
          onPress: async () => {
            try {
              const headers = await getAuthHeaders();
              const response = await fetch(`${EDGE_FUNCTION_URL}/connectors/delete`, {
                method: 'POST',
                headers,
                body: JSON.stringify({ item_id: itemId }),
              });
              const data = await response.json();
              if (data.success) {
                loadConnectors();
              }
            } catch (e: any) {
              Alert.alert('Erro', e.message);
            }
          },
        },
      ]
    );
  };

  const getStatusColor = (status: string) => {
    const colors: Record<string, string> = {
      login_succeeded: '#10B981',
      updating: '#F59E0B',
      waiting_user_input: '#F59E0B',
      created: '#6B7280',
      login_error: '#EF4444',
    };
    return colors[status] || '#6B7280';
  };

  const getStatusLabel = (status: string) => {
    const labels: Record<string, string> = {
      login_succeeded: 'Conectado',
      updating: 'Sincronizando...',
      waiting_user_input: 'Aguardando autenticação',
      created: 'Criado',
      login_error: 'Falha na autenticação',
    };
    return labels[status] || status;
  };

  const getConnectorIcon = (connectorId: string): 'business' | 'card' | 'wallet' => {
    const icons: Record<string, 'business' | 'card' | 'wallet'> = {
      'banco-do-brasil': 'business',
      caixa: 'business',
      itau: 'business',
      bradesco: 'business',
      santander: 'business',
      nubank: 'card',
      inter: 'card',
      c6: 'card',
      picpay: 'wallet',
      mercadopago: 'wallet',
    };
    return icons[connectorId] || 'business';
  };

  return (
    <View style={[styles.container, { backgroundColor: Colors.bg }]}>
      <View style={[styles.header, { borderBottomColor: Colors.border }]}>
        <TouchableOpacity
          style={[styles.backBtn, { backgroundColor: Colors.bgCard, borderColor: Colors.borderStrong }]}
          onPress={() => router.back()}
        >
          <Ionicons name="chevron-back" size={24} color={Colors.text} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: Colors.text }]}>Bancos Conectados</Text>
      </View>

      {pollingConnector && (
        <View style={styles.pollingBanner}>
          <ActivityIndicator size="small" color={Palette.gold[500]} />
          <Text style={styles.pollingText}>Verificando autenticação bancária...</Text>
        </View>
      )}

      <ScrollView contentContainerStyle={styles.content}>
        {loading ? (
          <ActivityIndicator color={Colors.primary} style={{ marginTop: 40 }} />
        ) : connectors.length === 0 ? (
          <View style={styles.emptyState}>
            <View style={[styles.iconContainer, { backgroundColor: Colors.primaryMuted }]}>
              <Ionicons name="wallet-outline" size={48} color={Colors.primary} />
            </View>
            <Text style={[styles.title, { color: Colors.text }]}>Nenhum Banco Conectado</Text>
            <Text style={[styles.subtitle, { color: Colors.textSecondary }]}>
              Conecte sua conta bancária via Open Finance para sincronizar automaticamente seus extratos.
              Suas credenciais bancárias nunca são armazenadas — usamos o Pluggy como intermediário seguro.
            </Text>
          </View>
        ) : (
          <>
            <Text style={[styles.sectionTitle, { color: Colors.textSecondary }]}>
              {connectors.length} {connectors.length === 1 ? 'conexão ativa' : 'conexões ativas'}
            </Text>
            {connectors.map((conn) => (
              <View
                key={conn.id}
                style={[styles.card, { backgroundColor: Colors.bgCard, borderColor: Colors.border }]}
              >
                <View style={styles.cardHeader}>
                  <View style={[styles.iconCircle, { backgroundColor: Colors.primaryMuted }]}>
                    <Ionicons
                      name={getConnectorIcon(conn.connector_id)}
                      size={22}
                      color={Colors.primary}
                    />
                  </View>
                  <View style={{ flex: 1, marginLeft: 12 }}>
                    <Text style={[styles.bankName, { color: Colors.text }]}>
                      {conn.institution_name || conn.connector_name || conn.connector_id}
                    </Text>
                    <View style={styles.statusRow}>
                      <View style={[styles.statusDot, { backgroundColor: getStatusColor(conn.status) }]} />
                      <Text style={[styles.bankStatus, { color: getStatusColor(conn.status) }]}>
                        {getStatusLabel(conn.status)}
                      </Text>
                    </View>
                    {conn.last_sync_at && (
                      <Text style={[styles.lastSync, { color: Colors.textMuted }]}>
                        Última sincronização: {new Date(conn.last_sync_at).toLocaleDateString('pt-BR')}
                      </Text>
                    )}
                  </View>
                  <TouchableOpacity onPress={() => handleDelete(conn.item_id)}>
                    <Ionicons name="trash-outline" size={20} color="#EF4444" />
                  </TouchableOpacity>
                </View>
              </View>
            ))}
          </>
        )}

        <TouchableOpacity
          style={[styles.addBtn, { backgroundColor: Colors.primary }]}
          onPress={() => setShowBankPicker(true)}
        >
          <Ionicons name="add" size={20} color={Palette.black} />
          <Text style={styles.addBtnText}>Conectar Novo Banco</Text>
        </TouchableOpacity>

        <View style={styles.securityNote}>
          <Ionicons name="shield-checkmark" size={16} color={Colors.textMuted} />
          <Text style={[styles.securityNoteText, { color: Colors.textMuted }]}>
            Conexão via Open Finance. Suas credenciais bancárias nunca são armazenadas.
          </Text>
        </View>
      </ScrollView>

      {/* Bank Picker Modal */}
      {showBankPicker && (
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: Colors.bg }]}>
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, { color: Colors.text }]}>Conectar Banco</Text>
              <TouchableOpacity onPress={() => { setShowBankPicker(false); setSelectedBank(null); }}>
                <Ionicons name="close" size={24} color={Colors.textMuted} />
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.bankList}>
              {availableBanks
                .filter((b: any) => !connectors.some((c: any) => c.connector_id === b.id))
                .map((bank: any) => (
                <TouchableOpacity
                  key={bank.id}
                  style={[
                    styles.bankItem,
                    {
                      backgroundColor: selectedBank?.id === bank.id ? Colors.primary : Colors.bgCard,
                      borderColor: selectedBank?.id === bank.id ? Colors.primary : Colors.borderStrong,
                    },
                  ]}
                  onPress={() => setSelectedBank(bank)}
                >
                  <View style={styles.bankItemLeft}>
                    <Ionicons
                      name={getConnectorIcon(bank.id)}
                      size={24}
                      color={selectedBank?.id === bank.id ? Palette.black : Colors.text}
                    />
                    <View style={{ marginLeft: 12 }}>
                      <Text
                        style={[
                          styles.bankItemName,
                          { color: selectedBank?.id === bank.id ? Palette.black : Colors.text },
                        ]}
                      >
                        {bank.institutionName || bank.name}
                      </Text>
                      <Text
                        style={[
                          styles.bankItemSub,
                          { color: selectedBank?.id === bank.id ? 'rgba(0,0,0,0.6)' : Colors.textMuted },
                        ]}
                      >
                        {bank.type === 'PERSONAL_BANK' ? 'Banco' : 'Conta Digital'}
                      </Text>
                    </View>
                  </View>
                  {selectedBank?.id === bank.id && (
                    <Ionicons name="checkmark-circle" size={24} color={Palette.black} />
                  )}
                </TouchableOpacity>
              ))}
            </ScrollView>

            {selectedBank && (
              <TouchableOpacity
                style={[styles.connectBtn, { backgroundColor: Colors.primary }]}
                onPress={handleConnect}
                disabled={connecting}
              >
                {connecting ? (
                  <ActivityIndicator color={Palette.black} />
                ) : (
                  <Text style={styles.connectBtnText}>
                    Conectar {selectedBank.institutionName || selectedBank.name}
                  </Text>
                )}
              </TouchableOpacity>
            )}
          </View>
        </View>
      )}
    </View>
  );
}

function getOfflineBanks(): any[] {
  return [
    { id: 'banco-do-brasil', name: 'Banco do Brasil', institutionName: 'Banco do Brasil', type: 'PERSONAL_BANK' },
    { id: 'caixa', name: 'Caixa Econômica Federal', institutionName: 'Caixa Econômica Federal', type: 'PERSONAL_BANK' },
    { id: 'itau', name: 'Itaú Unibanco', institutionName: 'Itaú Unibanco', type: 'PERSONAL_BANK' },
    { id: 'bradesco', name: 'Bradesco', institutionName: 'Bradesco', type: 'PERSONAL_BANK' },
    { id: 'santander', name: 'Santander', institutionName: 'Santander', type: 'PERSONAL_BANK' },
    { id: 'nubank', name: 'Nubank', institutionName: 'Nubank', type: 'PERSONAL_BANK' },
    { id: 'inter', name: 'Banco Inter', institutionName: 'Banco Inter', type: 'PERSONAL_BANK' },
    { id: 'c6', name: 'C6 Bank', institutionName: 'C6 Bank', type: 'PERSONAL_BANK' },
    { id: 'picpay', name: 'PicPay', institutionName: 'PicPay', type: 'DIGITAL_ACCOUNT' },
    { id: 'mercadopago', name: 'Mercado Pago', institutionName: 'Mercado Pago', type: 'DIGITAL_ACCOUNT' },
    { id: 'pagseguro', name: 'PagSeguro', institutionName: 'PagSeguro', type: 'DIGITAL_ACCOUNT' },
  ];
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: 'row', alignItems: 'center', paddingTop: 60,
    paddingHorizontal: 24, paddingBottom: 20, borderBottomWidth: 1,
  },
  backBtn: { width: 40, height: 40, borderRadius: 20, justifyContent: 'center', alignItems: 'center', borderWidth: 1 },
  headerTitle: { flex: 1, textAlign: 'center', fontSize: 18, fontFamily: Typography.fonts.medium, marginRight: 40 },
  pollingBanner: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    paddingVertical: 10, backgroundColor: 'rgba(245, 158, 11, 0.1)',
    gap: 8,
  },
  pollingText: { color: '#F59E0B', fontSize: 13, fontFamily: Typography.fonts.medium },
  content: { padding: 24 },
  emptyState: { alignItems: 'center', marginTop: 40 },
  iconContainer: { width: 80, height: 80, borderRadius: 40, justifyContent: 'center', alignItems: 'center', marginBottom: 24 },
  title: { fontSize: 20, fontFamily: Typography.fonts.display, marginBottom: 12 },
  subtitle: { fontSize: 14, fontFamily: Typography.fonts.body, textAlign: 'center', lineHeight: 22 },
  sectionTitle: { fontSize: 12, fontFamily: Typography.fonts.medium, marginBottom: 12, textTransform: 'uppercase' },
  card: { padding: 16, borderRadius: 16, borderWidth: 1, marginBottom: 12 },
  cardHeader: { flexDirection: 'row', alignItems: 'center' },
  iconCircle: { width: 44, height: 44, borderRadius: 22, justifyContent: 'center', alignItems: 'center' },
  bankName: { fontSize: 15, fontFamily: Typography.fonts.medium },
  statusRow: { flexDirection: 'row', alignItems: 'center', marginTop: 4, gap: 6 },
  statusDot: { width: 8, height: 8, borderRadius: 4 },
  bankStatus: { fontSize: 12, fontFamily: Typography.fonts.body },
  lastSync: { fontSize: 11, marginTop: 2 },
  addBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    height: 56, borderRadius: 16, marginTop: 24,
  },
  addBtnText: { color: Palette.black, fontSize: 16, fontFamily: Typography.fonts.medium, fontWeight: '700', marginLeft: 8 },
  securityNote: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', marginTop: 16, gap: 6 },
  securityNoteText: { fontSize: 12, textAlign: 'center' },
  modalOverlay: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'flex-end', zIndex: 999 },
  modalContent: { padding: 24, borderTopLeftRadius: 32, borderTopRightRadius: 32, maxHeight: '80%' },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
  modalTitle: { fontSize: 20, fontFamily: Typography.fonts.display },
  bankList: { maxHeight: 400 },
  bankItem: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    padding: 16, borderRadius: 12, borderWidth: 1, marginBottom: 8,
  },
  bankItemLeft: { flexDirection: 'row', alignItems: 'center', flex: 1 },
  bankItemName: { fontSize: 15, fontFamily: Typography.fonts.medium },
  bankItemSub: { fontSize: 12, fontFamily: Typography.fonts.body, marginTop: 2 },
  connectBtn: {
    height: 56, borderRadius: 16, justifyContent: 'center', alignItems: 'center',
    marginTop: 20,
  },
  connectBtnText: { color: Palette.black, fontSize: 16, fontFamily: Typography.fonts.medium, fontWeight: '700' },
});
