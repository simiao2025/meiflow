import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, ActivityIndicator } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { Palette, Typography, useThemeColors } from '../../constants/theme';
import { useAuthStore } from '../../stores/authStore';
import { supabase } from '../../services/supabase';
import { generateAndSharePDF, getExportHtmlTemplate } from '../../utils/pdfGenerator';

export default function ExportScreen() {
  const Colors = useThemeColors();
  const styles = getStyles(Colors);
  const router = useRouter();
  const { user } = useAuthStore();
  const [loading, setLoading] = useState(false);
  
  // Mock options for MVP
  const [selectedMonth, setSelectedMonth] = useState('MAIO/2026');
  const [options, setOptions] = useState({
    revenue: true,
    invoices: true,
    das: true,
  });

  const toggleOption = (key: keyof typeof options) => {
  const Colors = useThemeColors();
  const styles = getStyles(Colors);
    setOptions(prev => ({ ...prev, [key]: !prev[key] }));
  };

  const handleExport = async () => {
    if (!user) return;
    setLoading(true);
    
    // In a real app we'd fetch data for the selected month. We use mocked aggregation here:
    const mockRevenue = 5430.00;
    const mockExpenses = 1200.00;
    const mockDasStatus = "Pago em 20/05/2026";
    
    const html = getExportHtmlTemplate(
      user.name || 'Empreendedor MEI',
      selectedMonth,
      mockRevenue,
      mockExpenses,
      mockDasStatus
    );

    await generateAndSharePDF(`Malote_Contabil_${selectedMonth.replace('/', '_')}`, html);
    setLoading(false);
  };

  return (
    <View style={styles.container}>
      <LinearGradient colors={[Colors.bg, '#0B1121']} style={StyleSheet.absoluteFill} />
      
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={24} color={Colors.text} />
        </TouchableOpacity>
        <View>
          <Text style={styles.eyebrow}>FISCAL</Text>
          <Text style={styles.h1}>Malote Contábil</Text>
        </View>
      </View>

      <ScrollView contentContainerStyle={styles.scroll}>
        <Text style={styles.description}>
          Gere um relatório consolidado com tudo o que o seu escritório de contabilidade precisa para fechar o mês.
        </Text>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Período</Text>
          <View style={styles.monthSelector}>
            <Ionicons name="calendar-outline" size={20} color={Colors.primary} />
            <Text style={styles.monthText}>{selectedMonth}</Text>
            <Ionicons name="chevron-down" size={20} color={Colors.textMuted} />
          </View>
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>O que incluir no PDF?</Text>
          
          <TouchableOpacity style={styles.checkRow} onPress={() => toggleOption('revenue')} activeOpacity={0.7}>
            <View style={[styles.checkbox, options.revenue && styles.checkboxActive]}>
              {options.revenue && <Ionicons name="checkmark" size={16} color={Palette.black} />}
            </View>
            <View>
              <Text style={styles.checkLabel}>Relatório de Faturamento</Text>
              <Text style={styles.checkSub}>Resumo de receitas e despesas</Text>
            </View>
          </TouchableOpacity>
          
          <TouchableOpacity style={styles.checkRow} onPress={() => toggleOption('invoices')} activeOpacity={0.7}>
            <View style={[styles.checkbox, options.invoices && styles.checkboxActive]}>
              {options.invoices && <Ionicons name="checkmark" size={16} color={Palette.black} />}
            </View>
            <View>
              <Text style={styles.checkLabel}>Relação de Notas Emitidas</Text>
              <Text style={styles.checkSub}>Lista das NFS-e do período</Text>
            </View>
          </TouchableOpacity>
          
          <TouchableOpacity style={styles.checkRow} onPress={() => toggleOption('das')} activeOpacity={0.7}>
            <View style={[styles.checkbox, options.das && styles.checkboxActive]}>
              {options.das && <Ionicons name="checkmark" size={16} color={Palette.black} />}
            </View>
            <View>
              <Text style={styles.checkLabel}>Comprovante de DAS</Text>
              <Text style={styles.checkSub}>Recibo de pagamento do imposto</Text>
            </View>
          </TouchableOpacity>
        </View>
      </ScrollView>

      <View style={styles.footer}>
        <TouchableOpacity 
          style={[styles.exportBtn, loading && { opacity: 0.7 }]} 
          onPress={handleExport}
          disabled={loading}
        >
          {loading ? (
            <ActivityIndicator color={Palette.black} />
          ) : (
            <>
              <Ionicons name="share-outline" size={20} color={Palette.black} />
              <Text style={styles.exportBtnText}>Gerar PDF e Compartilhar</Text>
            </>
          )}
        </TouchableOpacity>
      </View>
    </View>
  );
}

const getStyles = (Colors: any) => StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.bg },
  header: { padding: 24, paddingTop: 60, flexDirection: 'row', alignItems: 'center', gap: 16 },
  backBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: 'rgba(255,255,255,0.05)', justifyContent: 'center', alignItems: 'center' },
  eyebrow: { color: Colors.primary, fontFamily: Typography.fonts.medium, fontSize: 10, letterSpacing: 2, marginBottom: 4 },
  h1: { color: Colors.text, fontFamily: Typography.fonts.display, fontSize: 28 },
  scroll: { padding: 24, paddingBottom: 100 },
  description: { color: Colors.textMuted, fontSize: 14, fontFamily: Typography.fonts.body, lineHeight: 22, marginBottom: 24 },
  card: { backgroundColor: '#0F172A', borderRadius: 20, padding: 20, marginBottom: 16, borderWidth: 1, borderColor: 'rgba(255,255,255,0.05)' },
  cardTitle: { color: Colors.text, fontSize: 14, fontFamily: Typography.fonts.display, marginBottom: 16 },
  monthSelector: { flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.05)', padding: 16, borderRadius: 12 },
  monthText: { flex: 1, color: Colors.text, fontFamily: Typography.fonts.medium, fontSize: 16, marginLeft: 12 },
  checkRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 20 },
  checkbox: { width: 24, height: 24, borderRadius: 6, borderWidth: 2, borderColor: Colors.textMuted, marginRight: 16, justifyContent: 'center', alignItems: 'center' },
  checkboxActive: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  checkLabel: { color: Colors.text, fontSize: 15, fontFamily: Typography.fonts.medium },
  checkSub: { color: Colors.textMuted, fontSize: 12, fontFamily: Typography.fonts.regular, marginTop: 2 },
  footer: { position: 'absolute', bottom: 0, left: 0, right: 0, padding: 24, backgroundColor: Colors.bg, borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.05)' },
  exportBtn: { backgroundColor: Colors.primary, borderRadius: 16, padding: 18, flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 8 },
  exportBtnText: { color: Palette.black, fontSize: 16, fontFamily: Typography.fonts.bold },
});
