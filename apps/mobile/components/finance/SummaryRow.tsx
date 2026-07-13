import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Typography } from '../../constants/theme';

interface SummaryRowProps {
  receitas: number;
  despesas: number;
}

export function SummaryRow({ receitas, despesas }: SummaryRowProps) {
  return (
    <View style={styles.summaryRow}>
      <View style={[styles.summaryCard, { borderColor: 'rgba(16,185,129,0.2)' }]}>  
        <Ionicons name="arrow-up" size={18} color="#10B981" />
        <Text style={styles.summaryCardLabel}>Receitas</Text>
        <Text style={[styles.summaryCardValue, { color: '#10B981' }]}>R$ {receitas.toFixed(2).replace('.', ',')}</Text>
      </View>
      <View style={[styles.summaryCard, { borderColor: 'rgba(239,68,68,0.2)' }]}>
        <Ionicons name="arrow-down" size={18} color="#EF4444" />
        <Text style={styles.summaryCardLabel}>Despesas</Text>
        <Text style={[styles.summaryCardValue, { color: '#EF4444' }]}>R$ {Math.abs(despesas).toFixed(2).replace('.', ',')}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  summaryRow: { flexDirection: 'row', paddingHorizontal: 24, gap: 12, marginBottom: 16 },
  summaryCard: { flex: 1, backgroundColor: 'rgba(255,255,255,0.03)', borderRadius: 16, padding: 14, alignItems: 'center', borderWidth: 1 },
  summaryCardLabel: { color: '#94A3B8', fontSize: 11, fontFamily: Typography.fonts.medium, marginTop: 6 },
  summaryCardValue: { fontSize: 16, fontFamily: Typography.fonts.display, marginTop: 4 },
});
