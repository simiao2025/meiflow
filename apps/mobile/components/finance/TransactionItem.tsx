import React from 'react';
import { TouchableOpacity, View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Typography } from '../../constants/theme';

interface TransactionItemProps {
  item: any;
  onPress: () => void;
}

export function TransactionItem({ item, onPress }: TransactionItemProps) {
  return (
    <TouchableOpacity style={styles.transactionItem} activeOpacity={0.8} onPress={onPress}>
      <View style={[styles.typeIndicator, { backgroundColor: item.type === 'receita' ? '#10B98120' : '#EF444420' }]}>
        <Ionicons 
          name={item.type === 'receita' ? 'arrow-up' : 'arrow-down'} 
          size={20} 
          color={item.type === 'receita' ? '#10B981' : '#EF4444'} 
        />
      </View>
      <View style={styles.transactionInfo}>
        <Text style={styles.transactionTitle}>{item.description || item.category || "Transação"}</Text>
        <Text style={styles.transactionCategory}>{item.category || 'Sem categoria'} • {new Date(item.created_at).toLocaleDateString()}</Text>
      </View>
      <Text style={[styles.transactionAmount, { color: item.type === 'receita' ? '#10B981' : '#EF4444' }]}>
        {item.type === 'receita' ? '+' : '-'} R$ {Math.abs(Number(item.amount || 0)).toFixed(2).replace('.', ',')}
      </Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  transactionItem: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#0F172A', padding: 16, borderRadius: 20, marginBottom: 12, borderWidth: 1, borderColor: '#1E293B' },
  typeIndicator: { width: 44, height: 44, borderRadius: 12, justifyContent: 'center', alignItems: 'center', marginRight: 16 },
  transactionInfo: { flex: 1 },
  transactionTitle: { fontSize: 16, fontFamily: Typography.fonts.display, color: '#F1F5F9' },
  transactionCategory: { fontSize: 13, color: '#64748B', fontFamily: Typography.fonts.medium, marginTop: 2 },
  transactionAmount: { fontSize: 16, fontFamily: Typography.fonts.display },
});
