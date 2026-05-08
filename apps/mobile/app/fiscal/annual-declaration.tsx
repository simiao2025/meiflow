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

export default function AnnualDeclaration() {
  const [selectedYear, setSelectedYear] = useState(2025);
  
  // Mock de consolidação automática
  const revenueServices = 42500.00;
  const revenueCommerce = 12400.00;
  const totalRevenue = revenueServices + revenueCommerce;

  const handleTransmit = () => {
    Alert.alert(
      'Transmitir DASN-SIMEI',
      'Deseja enviar agora sua declaração de 2025 para o Gov.br?',
      [
        { text: 'Cancelar', style: 'cancel' },
        { text: 'Sim, Transmitir', onPress: () => Alert.alert('Sucesso', 'Declaração transmitida com sucesso! Recibo disponível em Documentos.') }
      ]
    );
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
            <Text style={styles.limitTitle}>Limite do MEI (81k)</Text>
            <Text style={styles.limitPercent}>{((totalRevenue / 81000) * 100).toFixed(1)}%</Text>
          </View>
          <View style={styles.progressBar}>
            <View style={[styles.progressFill, { width: `${(totalRevenue / 81000) * 100}%` }]} />
          </View>
          <Text style={styles.limitInfo}>
            Você ainda pode faturar R$ {(81000 - totalRevenue).toLocaleString('pt-BR')} este ano.
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
  }
});
