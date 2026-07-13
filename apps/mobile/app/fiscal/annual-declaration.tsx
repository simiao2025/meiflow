import React, { useState } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  ScrollView, 
  TouchableOpacity, 
  Alert 
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '../../services/supabase';
import { useAuthStore } from '../../stores/authStore';

export default function AnnualDeclaration() {
  const { user } = useAuthStore();
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear() - 1);
  
  // Mock de consolidação automática
  const revenueServices = 42500.00;
  const revenueCommerce = 12400.00;
  const totalRevenue = revenueServices + revenueCommerce;

  const [isTransmitting, setIsTransmitting] = useState(false);

  const MEI_ANNUAL_LIMIT = 130000;

  const handleTransmit = async () => {
    Alert.alert(
      'Transmitir DASN-SIMEI',
      'Deseja enviar agora sua declaração para o Gov.br?',
      [
        { text: 'Cancelar', style: 'cancel' },
        { text: 'Sim, Transmitir', onPress: transmitDeclaration }
      ]
    );
  };

  const transmitDeclaration = async () => {
    setIsTransmitting(true);
    try {
      // 1. Inserir no Supabase
      const { error } = await supabase.from('annual_declarations').insert({
        user_id: user?.id,
        year: selectedYear,
        total_revenue_services: revenueServices,
        total_revenue_commerce: revenueCommerce,
        status: 'sent',
      });

      if (error) throw error;
      
      // 2. Avisar sucesso
      Alert.alert('Sucesso', 'A Declaração Anual (DASN-SIMEI) foi transmitida (simulação) com sucesso. Um recibo será gerado no módulo fiscal.');
    } catch (error) {
      console.error(error);
      Alert.alert('Erro', 'Ocorreu um erro ao transmitir a declaração.');
    } finally {
      setIsTransmitting(false);
    }
  };

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.title}>Declaração Anual</Text>
        <Text style={styles.subtitle}>Consolidação de faturamento DASN-SIMEI</Text>
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        {/* Seletor de Ano */}
        <View style={styles.yearPicker}>
          {[2024, 2025, 2026].map(year => (
            <TouchableOpacity 
              key={year} 
              style={[styles.yearItem, selectedYear === year && styles.yearItemActive]}
              onPress={() => setSelectedYear(year)}
            >
              <Text style={[styles.yearText, selectedYear === year && styles.yearTextActive]}>{year}</Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Card de Resumo Anual */}
        <LinearGradient colors={['#1E293B', '#0F172A']} style={styles.summaryCard}>
          <View style={styles.row}>
            <Text style={styles.label}>Faturamento Serviços</Text>
            <Text style={styles.value}>R$ {revenueServices.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</Text>
          </View>
          <View style={styles.row}>
            <Text style={styles.label}>Faturamento Comércio</Text>
            <Text style={styles.value}>R$ {revenueCommerce.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</Text>
          </View>
          <View style={styles.divider} />
          <View style={styles.row}>
            <Text style={styles.totalLabel}>Total Bruto</Text>
            <Text style={styles.totalValue}>R$ {totalRevenue.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</Text>
          </View>
        </LinearGradient>

        {/* Alerta de Limite MEI */}
        <View style={styles.limitContainer}>
          <View style={styles.limitHeader}>
            <Text style={styles.limitTitle}>Limite do MEI (R$ 130k)</Text>
            <Text style={styles.limitPercent}>{((totalRevenue / MEI_ANNUAL_LIMIT) * 100).toFixed(1)}%</Text>
          </View>
          <View style={styles.progressBar}>
            <View style={[styles.progressFill, { width: `${Math.min((totalRevenue / MEI_ANNUAL_LIMIT) * 100, 100)}%` }]} />
          </View>
          <Text style={styles.limitInfo}>
            Você ainda pode faturar R$ {Math.max(0, MEI_ANNUAL_LIMIT - totalRevenue).toLocaleString('pt-BR')} este ano.
          </Text>
        </View>

        {/* Botão de Transmissão */}
        <TouchableOpacity style={styles.transmitButton} onPress={handleTransmit}>
          <LinearGradient colors={['#38BDF8', '#0284C7']} style={styles.gradientButton}>
            <Ionicons name="cloud-upload" size={20} color="#FFF" style={{marginRight: 8}} />
            <Text style={styles.transmitButtonText}>Transmitir via Gov.br</Text>
          </LinearGradient>
        </TouchableOpacity>

        <Text style={styles.footerHelp}>
          O MEIFlow utiliza o login único do Gov.br para transmitir sua declaração com segurança e capturar o recibo original.
        </Text>

        <Text style={styles.disclaimer}>
          Aviso: Este não é um documento oficial. O MEIFlow não substitui a orientação de um contador habilitado.
          Valores e prazos devem ser verificados antes da transmissão.
        </Text>
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
    paddingHorizontal: 24,
    paddingTop: 60,
    marginBottom: 32,
  },
  title: {
    fontSize: 24,
    fontWeight: '800',
    color: '#F8FAFC',
  },
  subtitle: {
    fontSize: 14,
    color: '#94A3B8',
    marginTop: 8,
  },
  content: {
    paddingHorizontal: 24,
    paddingBottom: 40,
  },
  yearPicker: {
    flexDirection: 'row',
    backgroundColor: '#1E293B',
    borderRadius: 12,
    padding: 4,
    marginBottom: 32,
  },
  yearItem: {
    flex: 1,
    paddingVertical: 10,
    alignItems: 'center',
    borderRadius: 8,
  },
  yearItemActive: {
    backgroundColor: '#38BDF8',
  },
  yearText: {
    color: '#94A3B8',
    fontWeight: '700',
  },
  yearTextActive: {
    color: '#FFF',
  },
  summaryCard: {
    padding: 24,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: '#334155',
    marginBottom: 32,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  label: {
    color: '#94A3B8',
    fontSize: 14,
  },
  value: {
    color: '#F1F5F9',
    fontSize: 16,
    fontWeight: '600',
  },
  divider: {
    height: 1,
    backgroundColor: '#334155',
    marginVertical: 16,
  },
  totalLabel: {
    color: '#F8FAFC',
    fontSize: 18,
    fontWeight: '800',
  },
  totalValue: {
    color: '#38BDF8',
    fontSize: 20,
    fontWeight: '800',
  },
  limitContainer: {
    marginBottom: 40,
  },
  limitHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  limitTitle: {
    color: '#F8FAFC',
    fontSize: 16,
    fontWeight: '700',
  },
  limitPercent: {
    color: '#F59E0B',
    fontWeight: '800',
  },
  progressBar: {
    height: 8,
    backgroundColor: '#334155',
    borderRadius: 4,
    overflow: 'hidden',
    marginBottom: 12,
  },
  progressFill: {
    height: '100%',
    backgroundColor: '#F59E0B',
    borderRadius: 4,
  },
  limitInfo: {
    color: '#64748B',
    fontSize: 13,
  },
  transmitButton: {
    borderRadius: 16,
    overflow: 'hidden',
  },
  gradientButton: {
    flexDirection: 'row',
    height: 60,
    justifyContent: 'center',
    alignItems: 'center',
  },
  transmitButtonText: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: '700',
  },
  footerHelp: {
    marginTop: 24,
    textAlign: 'center',
    color: '#64748B',
    fontSize: 12,
    lineHeight: 18,
  },
  disclaimer: {
    marginTop: 16,
    textAlign: 'center',
    color: '#71717A',
    fontSize: 11,
    lineHeight: 16,
    fontStyle: 'italic',
    paddingHorizontal: 16,
  }
});
