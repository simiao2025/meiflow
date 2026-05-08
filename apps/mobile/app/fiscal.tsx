import React, { useState, useEffect } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  ScrollView, 
  TouchableOpacity, 
  Dimensions,
  RefreshControl
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useAuthStore } from '../stores/authStore';
import { useFiscalStore } from '../stores/fiscalStore';

const { width } = Dimensions.get('window');

export default function FiscalScreen() {
  const [activeTab, setActiveTab] = useState<'das' | 'invoices'>('das');
  const { user } = useAuthStore();
  const { dasList, invoices, isLoading, fetchFiscalData } = useFiscalStore();

  useEffect(() => {
    if (user) fetchFiscalData(user.id);
  }, [user]);

  const onRefresh = () => {
    if (user) fetchFiscalData(user.id);
  };

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.title}>Centro Fiscal</Text>
        <TouchableOpacity style={styles.helpButton}>
          <Ionicons name="help-circle-outline" size={24} color="#38BDF8" />
        </TouchableOpacity>
      </View>

      {/* Tabs */}
      <View style={styles.tabContainer}>
        <TouchableOpacity 
          style={[styles.tab, activeTab === 'das' && styles.tabActive]} 
          onPress={() => setActiveTab('das')}
        >
          <Text style={[styles.tabLabel, activeTab === 'das' && styles.tabLabelActive]}>Guia DAS</Text>
        </TouchableOpacity>
        <TouchableOpacity 
          style={[styles.tab, activeTab === 'invoices' && styles.tabActive]} 
          onPress={() => setActiveTab('invoices')}
        >
          <Text style={[styles.tabLabel, activeTab === 'invoices' && styles.tabLabelActive]}>Notas Fiscais</Text>
        </TouchableOpacity>
      </View>

      <ScrollView 
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={isLoading} onRefresh={onRefresh} tintColor="#38BDF8" />}
      >
        {activeTab === 'das' ? (
          <View>
            <Text style={styles.sectionTitle}>Próximos Vencimentos</Text>
            {dasList.length === 0 ? (
              <Text style={styles.emptyText}>Nenhuma guia DAS encontrada.</Text>
            ) : dasList.map(item => (
              <View key={item.id} style={styles.dasCard}>
                <View style={styles.dasInfo}>
                  <Text style={styles.dasMonth}>{item.month}</Text>
                  <Text style={styles.dasDue}>Vence em {new Date(item.due_date).toLocaleDateString()}</Text>
                </View>
                <View style={styles.dasActions}>
                  <Text style={styles.dasAmount}>R$ {item.amount.toFixed(2)}</Text>
                  <View style={[styles.statusBadge, { backgroundColor: item.status === 'pago' ? '#10B98120' : '#F59E0B20' }]}>
                    <Text style={[styles.statusText, { color: item.status === 'pago' ? '#10B981' : '#F59E0B' }]}>
                      {item.status.toUpperCase()}
                    </Text>
                  </View>
                </View>
              </View>
            ))}
            
            <TouchableOpacity style={styles.generateButton}>
              <LinearGradient colors={['#38BDF8', '#0284C7']} style={styles.gradientButton}>
                <Ionicons name="qr-code" size={20} color="#FFF" style={{marginRight: 8}} />
                <Text style={styles.generateButtonText}>Gerar Guia deste Mês</Text>
              </LinearGradient>
            </TouchableOpacity>
          </View>
        ) : (
          <View>
            <View style={styles.monitoringBadge}>
              <Ionicons name="shield-checkmark" size={18} color="#10B981" />
              <Text style={styles.monitoringText}>Monitoramento Automático Ativo</Text>
            </View>
            
            <Text style={styles.sectionTitle}>Notas Capturadas Recentemente</Text>
            {invoices.length === 0 ? (
              <Text style={styles.emptyText}>Nenhuma nota fiscal capturada ainda.</Text>
            ) : invoices.map(item => (
              <TouchableOpacity key={item.id} style={styles.invoiceItem}>
                <View style={styles.invoiceIcon}>
                  <Ionicons 
                    name={item.direction === 'inbound' ? 'cart-outline' : 'cash-outline'} 
                    size={22} 
                    color="#94A3B8" 
                  />
                </View>
                <View style={styles.invoiceDetails}>
                  <Text style={styles.invoiceIssuer}>{item.issuer_name}</Text>
                  <Text style={styles.invoiceMeta}>{item.direction === 'inbound' ? 'Compra' : 'Venda'} • {new Date(item.issue_date).toLocaleDateString()}</Text>
                </View>
                <View style={styles.invoiceValue}>
                  <Text style={styles.invoiceAmount}>R$ {item.total_amount.toFixed(2)}</Text>
                  <Text style={styles.invoiceStatus}>{item.status}</Text>
                </View>
              </TouchableOpacity>
            ))}
            
            <Text style={styles.helperText}>
              O MEIFlow busca automaticamente notas emitidas contra o seu CNPJ em todo o Brasil.
            </Text>
          </View>
        )}
      </ScrollView>
    </View>
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
    marginBottom: 32,
  },
  title: {
    fontSize: 24,
    fontWeight: '800',
    color: '#F8FAFC',
  },
  helpButton: {
    padding: 4,
  },
  tabContainer: {
    flexDirection: 'row',
    marginHorizontal: 24,
    backgroundColor: '#1E293B',
    borderRadius: 14,
    padding: 4,
    marginBottom: 32,
  },
  tab: {
    flex: 1,
    paddingVertical: 12,
    alignItems: 'center',
    borderRadius: 10,
  },
  tabActive: {
    backgroundColor: '#334155',
  },
  tabLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#94A3B8',
  },
  tabLabelActive: {
    color: '#38BDF8',
  },
  content: {
    paddingHorizontal: 24,
    paddingBottom: 100,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#F8FAFC',
    marginBottom: 20,
  },
  dasCard: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#1E293B',
    padding: 20,
    borderRadius: 20,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#334155',
  },
  dasInfo: {
    flex: 1,
  },
  dasMonth: {
    fontSize: 18,
    fontWeight: '700',
    color: '#F1F5F9',
  },
  dasDue: {
    fontSize: 14,
    color: '#94A3B8',
    marginTop: 4,
  },
  dasActions: {
    alignItems: 'flex-end',
  },
  dasAmount: {
    fontSize: 18,
    fontWeight: '800',
    color: '#F8FAFC',
    marginBottom: 8,
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  statusText: {
    fontSize: 10,
    fontWeight: '800',
  },
  generateButton: {
    marginTop: 24,
    borderRadius: 16,
    overflow: 'hidden',
  },
  gradientButton: {
    flexDirection: 'row',
    height: 60,
    justifyContent: 'center',
    alignItems: 'center',
  },
  generateButtonText: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: '700',
  },
  monitoringBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(16, 185, 129, 0.1)',
    alignSelf: 'flex-start',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    marginBottom: 24,
  },
  monitoringText: {
    color: '#10B981',
    fontSize: 12,
    fontWeight: '700',
    marginLeft: 6,
  },
  invoiceItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#1E293B',
  },
  invoiceIcon: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: '#1E293B',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  invoiceDetails: {
    flex: 1,
  },
  invoiceIssuer: {
    fontSize: 16,
    fontWeight: '700',
    color: '#F1F5F9',
  },
  invoiceMeta: {
    fontSize: 13,
    color: '#64748B',
    marginTop: 2,
  },
  invoiceValue: {
    alignItems: 'flex-end',
  },
  invoiceAmount: {
    fontSize: 15,
    fontWeight: '700',
    color: '#F8FAFC',
  },
  invoiceStatus: {
    fontSize: 11,
    color: '#10B981',
    marginTop: 4,
    fontWeight: '600',
  },
  helperText: {
    fontSize: 13,
    color: '#64748B',
    marginTop: 40,
    textAlign: 'center',
    lineHeight: 20,
  },
  emptyText: {
    color: '#94A3B8',
    textAlign: 'center',
    marginTop: 40,
    fontSize: 15,
  }
});
