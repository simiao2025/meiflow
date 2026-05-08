import React from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  ScrollView, 
  TouchableOpacity, 
  Dimensions 
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useAuthStore } from '../../stores/authStore';

const { width } = Dimensions.get('window');

export default function DashboardScreen() {
  const { profile } = useAuthStore();

  return (
    <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
      {/* Header com Saudação */}
      <View style={styles.header}>
        <View>
          <Text style={styles.greeting}>Olá, {profile?.full_name?.split(' ')[0] || 'Empreendedor'}</Text>
          <Text style={styles.companyName}>{profile?.nome_fantasia || profile?.razao_social || 'Sua Empresa MEI'}</Text>
        </View>
        <TouchableOpacity style={styles.profileButton}>
          <Ionicons name="person-circle-outline" size={40} color="#F8FAFC" />
        </TouchableOpacity>
      </View>

      {/* Card de Saldo Principal */}
      <LinearGradient colors={['#38BDF8', '#0284C7']} style={styles.balanceCard}>
        <View style={styles.balanceHeader}>
          <Text style={styles.balanceLabel}>Saldo Projetado (Mês)</Text>
          <Ionicons name="eye-outline" size={24} color="#F0F9FF" />
        </View>
        <Text style={styles.balanceValue}>R$ 4.580,00</Text>
        <View style={styles.balanceFooter}>
          <View style={styles.balanceStat}>
            <Ionicons name="arrow-up-circle" size={20} color="#BAE6FD" />
            <Text style={styles.statText}>R$ 6.200,00</Text>
          </View>
          <View style={styles.balanceStat}>
            <Ionicons name="arrow-down-circle" size={20} color="#FECACA" />
            <Text style={styles.statText}>R$ 1.620,00</Text>
          </View>
        </View>
      </LinearGradient>

      {/* Atalhos Rápidos */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Ações Rápidas</Text>
        <View style={styles.quickActions}>
          <QuickActionButton icon="add-circle" label="Receita" color="#10B981" />
          <QuickActionButton icon="remove-circle" label="Despesa" color="#EF4444" />
          <QuickActionButton icon="document-text" label="NFS-e" color="#38BDF8" />
          <QuickActionButton icon="qr-code" label="Guia DAS" color="#F59E0B" />
        </View>
      </View>

      {/* Status Fiscal */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Obrigações Fiscais</Text>
        <TouchableOpacity style={styles.fiscalCard}>
          <View style={[styles.fiscalIcon, { backgroundColor: 'rgba(245, 158, 11, 0.1)' }]}>
            <Ionicons name="calendar" size={24} color="#F59E0B" />
          </View>
          <View style={styles.fiscalInfo}>
            <Text style={styles.fiscalTitle}>DAS de Maio/2026</Text>
            <Text style={styles.fiscalStatus}>Vence em 20 de Maio</Text>
          </View>
          <Ionicons name="chevron-forward" size={20} color="#94A3B8" />
        </TouchableOpacity>
      </View>

      {/* Espaço para o Assistente IA (Teaser) */}
      <TouchableOpacity style={styles.aiTeaser}>
        <LinearGradient 
          colors={['rgba(56, 189, 248, 0.15)', 'rgba(139, 92, 246, 0.15)']} 
          start={{x: 0, y: 0}} 
          end={{x: 1, y: 1}}
          style={styles.aiTeaserGradient}
        >
          <Ionicons name="sparkles" size={24} color="#38BDF8" />
          <Text style={styles.aiTeaserText}>O Assistente IA tem 2 novas sugestões para você economizar impostos.</Text>
        </LinearGradient>
      </TouchableOpacity>
    </ScrollView>
  );
}

function QuickActionButton({ icon, label, color }: { icon: any, label: string, color: string }) {
  return (
    <TouchableOpacity style={styles.actionButton}>
      <View style={[styles.actionIcon, { backgroundColor: `${color}15` }]}>
        <Ionicons name={icon} size={28} color={color} />
      </View>
      <Text style={styles.actionLabel}>{label}</Text>
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
    marginBottom: 32,
  },
  greeting: {
    fontSize: 16,
    color: '#94A3B8',
  },
  companyName: {
    fontSize: 24,
    fontWeight: '800',
    color: '#F8FAFC',
    marginTop: 4,
  },
  profileButton: {
    padding: 4,
  },
  balanceCard: {
    marginHorizontal: 24,
    padding: 24,
    borderRadius: 32,
    marginBottom: 40,
    shadowColor: '#38BDF8',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.2,
    shadowRadius: 20,
    elevation: 10,
  },
  balanceHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  balanceLabel: {
    color: '#F0F9FF',
    fontSize: 14,
    fontWeight: '600',
    opacity: 0.9,
  },
  balanceValue: {
    color: '#FFFFFF',
    fontSize: 36,
    fontWeight: '800',
    marginBottom: 24,
  },
  balanceFooter: {
    flexDirection: 'row',
    borderTopWidth: 1,
    borderTopColor: 'rgba(248, 250, 252, 0.2)',
    paddingTop: 16,
  },
  balanceStat: {
    flexDirection: 'row',
    alignItems: 'center',
    marginRight: 24,
  },
  statText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
    marginLeft: 6,
  },
  section: {
    paddingHorizontal: 24,
    marginBottom: 32,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#F8FAFC',
    marginBottom: 16,
  },
  quickActions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  actionButton: {
    alignItems: 'center',
    width: (width - 48) / 4 - 8,
  },
  actionIcon: {
    width: 56,
    height: 56,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
  },
  actionLabel: {
    fontSize: 12,
    color: '#94A3B8',
    fontWeight: '600',
  },
  fiscalCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1E293B',
    padding: 16,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#334155',
  },
  fiscalIcon: {
    width: 48,
    height: 48,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  fiscalInfo: {
    flex: 1,
  },
  fiscalTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#F1F5F9',
  },
  fiscalStatus: {
    fontSize: 14,
    color: '#F59E0B',
    marginTop: 2,
    fontWeight: '600',
  },
  aiTeaser: {
    marginHorizontal: 24,
    marginBottom: 100,
    borderRadius: 20,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(56, 189, 248, 0.3)',
  },
  aiTeaserGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 20,
  },
  aiTeaserText: {
    flex: 1,
    color: '#BAE6FD',
    fontSize: 14,
    fontWeight: '600',
    marginLeft: 12,
    lineHeight: 20,
  },
});
