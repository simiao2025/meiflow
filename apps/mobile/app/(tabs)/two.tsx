import React, { useState } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  FlatList, 
  TouchableOpacity, 
  Dimensions 
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';

const { width } = Dimensions.get('window');

// Mock de dados para visualização premium imediata
const TRANSACTIONS = [
  { id: '1', title: 'Venda de Serviço #102', amount: 450.00, type: 'receita', category: 'Serviços', date: 'Hoje' },
  { id: '2', title: 'Pagamento Internet', amount: 120.00, type: 'despesa', category: 'Infraestrutura', date: 'Hoje' },
  { id: '3', title: 'Consultoria TI', amount: 1200.00, type: 'receita', category: 'Serviços', date: 'Ontem' },
  { id: '4', title: 'Assinatura Software', amount: 89.90, type: 'despesa', category: 'Ferramentas', date: '05 Mai' },
  { id: '5', title: 'Material de Escritório', amount: 45.00, type: 'despesa', category: 'Suprimentos', date: '04 Mai' },
];

export default function FinancialHub() {
  const [filter, setFilter] = useState<'tudo' | 'receita' | 'despesa'>('tudo');

  const filteredTransactions = TRANSACTIONS.filter(t => 
    filter === 'tudo' ? true : t.type === filter
  );

  return (
    <View style={styles.container}>
      {/* Header Fixo */}
      <View style={styles.header}>
        <Text style={styles.title}>Fluxo de Caixa</Text>
        <TouchableOpacity style={styles.searchButton}>
          <Ionicons name="search" size={24} color="#F8FAFC" />
        </TouchableOpacity>
      </View>

      {/* Mini Gráfico / Resumo do Filtro */}
      <View style={styles.filterSection}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filterTabs}>
          <FilterTab label="Tudo" active={filter === 'tudo'} onPress={() => setFilter('tudo')} />
          <FilterTab label="Receitas" active={filter === 'receita'} onPress={() => setFilter('receita')} />
          <FilterTab label="Despesas" active={filter === 'despesa'} onPress={() => setFilter('despesa')} />
          <FilterTab label="Agendados" active={false} onPress={() => {}} />
        </ScrollView>
      </View>

      {/* Lista de Transações */}
      <FlatList
        data={filteredTransactions}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.listContent}
        renderItem={({ item }) => (
          <View style={styles.transactionItem}>
            <View style={[styles.typeIndicator, { backgroundColor: item.type === 'receita' ? '#10B98120' : '#EF444420' }]}>
              <Ionicons 
                name={item.type === 'receita' ? 'arrow-up' : 'arrow-down'} 
                size={20} 
                color={item.type === 'receita' ? '#10B981' : '#EF4444'} 
              />
            </View>
            <View style={styles.transactionInfo}>
              <Text style={styles.transactionTitle}>{item.title}</Text>
              <Text style={styles.transactionCategory}>{item.category} • {item.date}</Text>
            </View>
            <Text style={[styles.transactionAmount, { color: item.type === 'receita' ? '#10B981' : '#F8FAFC' }]}>
              {item.type === 'receita' ? '+' : '-'} R$ {item.amount.toFixed(2)}
            </Text>
          </View>
        )}
        ListHeaderComponent={() => (
          <View style={styles.summaryBox}>
            <Text style={styles.summaryLabel}>Total no Período</Text>
            <Text style={styles.summaryValue}>R$ 1.445,10</Text>
          </View>
        )}
      />

      {/* Botão Flutuante para Nova Transação */}
      <TouchableOpacity style={styles.fab}>
        <LinearGradient colors={['#38BDF8', '#0284C7']} style={styles.fabGradient}>
          <Ionicons name="add" size={32} color="#FFFFFF" />
        </LinearGradient>
      </TouchableOpacity>
    </View>
  );
}

function FilterTab({ label, active, onPress }: { label: string, active: boolean, onPress: () => void }) {
  return (
    <TouchableOpacity 
      style={[styles.filterTab, active && styles.filterTabActive]} 
      onPress={onPress}
    >
      <Text style={[styles.filterLabel, active && styles.filterLabelActive]}>{label}</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0F172A',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingTop: 60,
    marginBottom: 24,
  },
  title: {
    fontSize: 24,
    fontWeight: '800',
    color: '#F8FAFC',
  },
  searchButton: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: '#1E293B',
    justifyContent: 'center',
    alignItems: 'center',
  },
  filterSection: {
    marginBottom: 16,
  },
  filterTabs: {
    paddingLeft: 24,
  },
  filterTab: {
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 12,
    marginRight: 8,
    backgroundColor: '#1E293B',
    borderWidth: 1,
    borderColor: '#334155',
  },
  filterTabActive: {
    backgroundColor: '#38BDF8',
    borderColor: '#38BDF8',
  },
  filterLabel: {
    color: '#94A3B8',
    fontSize: 14,
    fontWeight: '600',
  },
  filterLabelActive: {
    color: '#FFFFFF',
  },
  listContent: {
    paddingHorizontal: 24,
    paddingBottom: 120,
  },
  summaryBox: {
    paddingVertical: 32,
    alignItems: 'center',
  },
  summaryLabel: {
    color: '#94A3B8',
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 8,
  },
  summaryValue: {
    color: '#F8FAFC',
    fontSize: 32,
    fontWeight: '800',
  },
  transactionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1E293B',
    padding: 16,
    borderRadius: 20,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: 'rgba(51, 65, 85, 0.5)',
  },
  typeIndicator: {
    width: 44,
    height: 44,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  transactionInfo: {
    flex: 1,
  },
  transactionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#F1F5F9',
  },
  transactionCategory: {
    fontSize: 13,
    color: '#64748B',
    marginTop: 2,
  },
  transactionAmount: {
    fontSize: 16,
    fontWeight: '800',
  },
  fab: {
    position: 'absolute',
    bottom: 32,
    right: 24,
    borderRadius: 24,
    shadowColor: '#38BDF8',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.4,
    shadowRadius: 12,
    elevation: 8,
  },
  fabGradient: {
    width: 64,
    height: 64,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
  },
});
