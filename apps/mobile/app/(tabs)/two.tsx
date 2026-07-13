import { Typography, Palette, useThemeColors } from '../../constants/theme';
import React, { useState } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  FlatList, 
  TouchableOpacity, 
  ScrollView,
  Dimensions,
  ActivityIndicator,
  Modal,
  Alert,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { supabase } from '../../services/supabase';
import { useFinancialData } from '../../hooks/useFinancialData';
import { SummaryRow } from '../../components/finance/SummaryRow';
import { TransactionItem } from '../../components/finance/TransactionItem';
import { NewTransactionModal } from '../../components/finance/NewTransactionModal';

const { width } = Dimensions.get('window');

export default function FinancialHub() {
  const Colors = useThemeColors();
  const styles = getStyles(Colors);
  const router = useRouter();
  
  const { transactions, balance, loading, userId, fetchData } = useFinancialData();

  const [filter, setFilter] = useState<'tudo' | 'receita' | 'despesa' | 'agendados'>('tudo');
  const [modalVisible, setModalVisible] = useState(false);
  const [detailItem, setDetailItem] = useState<any>(null);

  const filteredTransactions = transactions.filter(t => {
    if (filter === 'tudo') return true;
    if (filter === 'agendados') {
      return t.date && new Date(t.date) > new Date();
    }
    return t.type === filter;
  });

  const totalReceitas = transactions.filter(t => t.type === 'receita').reduce((s, t) => s + Number(t.amount || 0), 0);
  const totalDespesas = transactions.filter(t => t.type === 'despesa').reduce((s, t) => s + Number(t.amount || 0), 0);

  const handleDeleteTransaction = async (id: string) => {
    Alert.alert('Excluir transação', 'Tem certeza que deseja excluir esta transação?', [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Excluir', style: 'destructive', onPress: async () => {
          const { error } = await supabase.from('transactions').delete().eq('id', id);
          if (!error) {
            setDetailItem(null);
            fetchData();
          } else {
            Alert.alert('Erro', 'Não foi possível excluir.');
          }
        }
      }
    ]);
  };

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.title}>Fluxo de Caixa</Text>
        <TouchableOpacity style={styles.searchButton} onPress={fetchData}>
          <Ionicons name="refresh" size={24} color="#F8FAFC" />
        </TouchableOpacity>
      </View>

      <SummaryRow receitas={totalReceitas} despesas={totalDespesas} />


      {/* Filtros */}
      <View style={styles.filterSection}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filterTabs}>
          <FilterTab label="Tudo" active={filter === 'tudo'} onPress={() => setFilter('tudo')} />
          <FilterTab label="Receitas" active={filter === 'receita'} onPress={() => setFilter('receita')} />
          <FilterTab label="Despesas" active={filter === 'despesa'} onPress={() => setFilter('despesa')} />
          <FilterTab label="Agendados" active={filter === 'agendados'} onPress={() => setFilter('agendados')} />
        </ScrollView>
      </View>

      {/* Ações */}
      <View style={styles.actionButtons}>
        <TouchableOpacity style={styles.actionBtn} onPress={() => router.push('/finance/sync')}>
          <Ionicons name="business" size={20} color={Colors.primary} />
          <Text style={styles.actionBtnText}>Conectar Banco</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.actionBtn} onPress={() => router.push('/finance/reconciliation')}>
          <Ionicons name="sparkles" size={20} color={Colors.primary} />
          <Text style={styles.actionBtnText}>Conciliar</Text>
        </TouchableOpacity>
      </View>

      {/* Lista */}
      {loading ? (
        <ActivityIndicator size="large" color={Colors.primary} style={{ marginTop: 40 }} />
      ) : (
        <FlatList
          data={filteredTransactions}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContent}
          renderItem={({ item }) => (
            <TransactionItem item={item} onPress={() => setDetailItem(item)} />
          )}
          ListHeaderComponent={() => (
            <View style={styles.summaryBox}>
              <Text style={styles.summaryLabel}>Saldo Atual</Text>
              <Text style={[styles.summaryValue, { color: balance >= 0 ? '#10B981' : '#EF4444' }]}>R$ {balance.toFixed(2).replace('.', ',')}</Text>
            </View>
          )}
          ListEmptyComponent={() => (
            <View style={{ alignItems: 'center', marginTop: 40 }}>
              <Ionicons name="wallet-outline" size={48} color={Colors.textMuted} />
              <Text style={{ color: Colors.textSecondary, marginTop: 12 }}>Nenhuma transação encontrada.</Text>
            </View>
          )}
        />
      )}

      <TouchableOpacity style={styles.fab} onPress={() => setModalVisible(true)}>
        <LinearGradient colors={[Colors.primary, Palette.gold[600]]} style={styles.fabGradient}>
          <Ionicons name="add" size={32} color="#FFFFFF" />
        </LinearGradient>
      </TouchableOpacity>

      <NewTransactionModal
        visible={modalVisible}
        onClose={() => setModalVisible(false)}
        onSave={() => { setModalVisible(false); fetchData(); }}
        userId={userId || ''}
      />

      {/* Modal Detalhe da Transação */}
      <Modal visible={!!detailItem} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <BlurView intensity={20} tint="dark" style={StyleSheet.absoluteFill} />
          <View style={[styles.modalContent, { maxHeight: '50%' }]}>
            {detailItem && (
              <>
                <View style={styles.modalHeader}>
                  <Text style={styles.modalTitle}>Detalhes</Text>
                  <TouchableOpacity onPress={() => setDetailItem(null)} style={styles.closeBtn}>
                    <Ionicons name="close" size={24} color={Colors.textMuted} />
                  </TouchableOpacity>
                </View>

                <View style={{ alignItems: 'center', marginBottom: 20 }}>
                  <View style={[styles.typeIndicator, { width: 56, height: 56, borderRadius: 16, backgroundColor: detailItem.type === 'receita' ? '#10B98120' : '#EF444420' }]}>
                    <Ionicons name={detailItem.type === 'receita' ? 'arrow-up' : 'arrow-down'} size={28} color={detailItem.type === 'receita' ? '#10B981' : '#EF4444'} />
                  </View>
                  <Text style={[styles.summaryValue, { fontSize: 28, marginTop: 12, color: detailItem.type === 'receita' ? '#10B981' : '#EF4444' }]}>
                    {detailItem.type === 'receita' ? '+' : '-'} R$ {Math.abs(Number(detailItem.amount || 0)).toFixed(2).replace('.', ',')}
                  </Text>
                </View>

                <View style={styles.detailRow}>
                  <Text style={styles.detailLabel}>Descrição</Text>
                  <Text style={styles.detailValue}>{detailItem.description || '—'}</Text>
                </View>
                <View style={styles.detailRow}>
                  <Text style={styles.detailLabel}>Categoria</Text>
                  <Text style={styles.detailValue}>{detailItem.category || '—'}</Text>
                </View>
                <View style={styles.detailRow}>
                  <Text style={styles.detailLabel}>Pagamento</Text>
                  <Text style={styles.detailValue}>{detailItem.payment_method || '—'}</Text>
                </View>
                <View style={styles.detailRow}>
                  <Text style={styles.detailLabel}>Data</Text>
                  <Text style={styles.detailValue}>{detailItem.date || new Date(detailItem.created_at).toLocaleDateString()}</Text>
                </View>

                <TouchableOpacity style={styles.deleteBtn} onPress={() => handleDeleteTransaction(detailItem.id)}>
                  <Ionicons name="trash-outline" size={18} color="#EF4444" />
                  <Text style={styles.deleteBtnText}>Excluir Transação</Text>
                </TouchableOpacity>
              </>
            )}
          </View>
        </View>
      </Modal>
    </View>
  );
}

function FilterTab({ label, active, onPress }: { label: string, active: boolean, onPress: () => void }) {
  const C = useThemeColors();
  const s = getStyles(C);
  return (
    <TouchableOpacity 
      style={[s.filterTab, active && s.filterTabActive]} 
      onPress={onPress}
    >
      <Text style={[s.filterLabel, active && s.filterLabelActive]}>{label}</Text>
    </TouchableOpacity>
  );
}

const getStyles = (C: any) => StyleSheet.create({
  container: { flex: 1, backgroundColor: Palette.black },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 24, paddingTop: 60, marginBottom: 16 },
  title: { fontSize: 24, fontFamily: Typography.fonts.display, color: C.text },
  searchButton: { width: 44, height: 44, borderRadius: 12, backgroundColor: Palette.navyDeep, justifyContent: 'center', alignItems: 'center' },

  summaryRow: { flexDirection: 'row', paddingHorizontal: 24, gap: 12, marginBottom: 16 },
  summaryCard: { flex: 1, backgroundColor: 'rgba(255,255,255,0.03)', borderRadius: 16, padding: 14, alignItems: 'center', borderWidth: 1 },
  summaryCardLabel: { color: C.textMuted, fontSize: 11, fontFamily: Typography.fonts.medium, marginTop: 6 },
  summaryCardValue: { fontSize: 16, fontFamily: Typography.fonts.display, marginTop: 4 },

  filterSection: { marginBottom: 12 },
  filterTabs: { paddingLeft: 24 },
  filterTab: { paddingHorizontal: 20, paddingVertical: 10, borderRadius: 12, marginRight: 8, backgroundColor: Palette.navyDeep, borderWidth: 1, borderColor: Palette.borderStrong },
  filterTabActive: { backgroundColor: C.primary, borderColor: C.primary },
  filterLabel: { color: C.textSecondary, fontSize: 14, fontFamily: Typography.fonts.medium },
  filterLabelActive: { color: '#FFFFFF' },

  actionButtons: { flexDirection: 'row', paddingHorizontal: 24, gap: 12, marginBottom: 16 },
  actionBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(234, 179, 8, 0.15)', paddingVertical: 12, borderRadius: 12, gap: 8, borderWidth: 1, borderColor: 'rgba(234, 179, 8, 0.3)' },
  actionBtnText: { color: C.primary, fontSize: 13, fontFamily: Typography.fonts.display },

  listContent: { paddingHorizontal: 24, paddingBottom: 150 },
  summaryBox: { paddingVertical: 24, alignItems: 'center' },
  summaryLabel: { color: C.textSecondary, fontSize: 14, fontFamily: Typography.fonts.medium, marginBottom: 8 },
  summaryValue: { color: C.text, fontSize: 32, fontFamily: Typography.fonts.display },

  transactionItem: { flexDirection: 'row', alignItems: 'center', backgroundColor: Palette.navyDeep, padding: 16, borderRadius: 20, marginBottom: 12, borderWidth: 1, borderColor: Palette.border },
  typeIndicator: { width: 44, height: 44, borderRadius: 12, justifyContent: 'center', alignItems: 'center', marginRight: 16 },
  transactionInfo: { flex: 1 },
  transactionTitle: { fontSize: 16, fontFamily: Typography.fonts.display, color: C.text },
  transactionCategory: { fontSize: 13, color: C.textMuted, fontFamily: Typography.fonts.medium, marginTop: 2 },
  transactionAmount: { fontSize: 16, fontFamily: Typography.fonts.display },

  fab: { position: 'absolute', bottom: 120, right: 24, borderRadius: 24, shadowColor: C.primary, shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.4, shadowRadius: 12, elevation: 8 },
  fabGradient: { width: 64, height: 64, borderRadius: 24, justifyContent: 'center', alignItems: 'center' },

  modalOverlay: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.5)' },
  modalContent: { backgroundColor: '#0F172A', borderTopLeftRadius: 32, borderTopRightRadius: 32, padding: 24, paddingBottom: 24, borderWidth: 1, borderColor: 'rgba(255,255,255,0.05)', maxHeight: '85%' },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
  modalTitle: { color: C.text, fontSize: 18, fontFamily: Typography.fonts.display },
  closeBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: 'rgba(255,255,255,0.05)', justifyContent: 'center', alignItems: 'center' },

  typeSelector: { flexDirection: 'row', backgroundColor: 'rgba(255,255,255,0.03)', borderRadius: 12, padding: 4, marginBottom: 20 },
  typeBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 12, borderRadius: 8, gap: 6 },
  typeBtnText: { color: C.textMuted, fontSize: 13, fontFamily: Typography.fonts.medium },

  inputLabel: { color: C.textMuted, fontSize: 12, fontFamily: Typography.fonts.medium, marginBottom: 8, marginLeft: 4 },
  input: { backgroundColor: '#1E293B', borderRadius: 12, padding: 14, color: C.text, fontFamily: Typography.fonts.medium, fontSize: 14, marginBottom: 16, borderWidth: 1, borderColor: '#334155' },

  catChip: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20, backgroundColor: 'rgba(255,255,255,0.03)', borderWidth: 1, borderColor: '#334155', marginRight: 8 },
  catChipActive: { backgroundColor: C.primaryMuted, borderColor: C.primary },
  catChipText: { color: C.textMuted, fontSize: 12, fontFamily: Typography.fonts.medium },
  catChipTextActive: { color: C.text },

  saveBtn: { marginTop: 8, borderRadius: 12, overflow: 'hidden' },
  saveBtnGrad: { paddingVertical: 18, alignItems: 'center' },
  saveBtnText: { color: '#FFF', fontSize: 14, fontFamily: Typography.fonts.display },

  detailRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 12, borderBottomWidth: 0.5, borderBottomColor: 'rgba(255,255,255,0.05)' },
  detailLabel: { color: C.textMuted, fontSize: 13, fontFamily: Typography.fonts.medium },
  detailValue: { color: C.text, fontSize: 13, fontFamily: Typography.fonts.display },
  deleteBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, marginTop: 20, paddingVertical: 14, borderRadius: 12, backgroundColor: 'rgba(239,68,68,0.1)', borderWidth: 1, borderColor: 'rgba(239,68,68,0.2)' },
  deleteBtnText: { color: '#EF4444', fontSize: 13, fontFamily: Typography.fonts.display },
});
