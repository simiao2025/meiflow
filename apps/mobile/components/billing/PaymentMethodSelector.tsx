import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

const METHODS = [
  { key: 'pix', label: 'PIX', icon: 'qr-code', color: '#10B981' },
  { key: 'credit_card', label: 'Cartão', icon: 'card', color: '#8B5CF6' },
  { key: 'cash', label: 'Dinheiro', icon: 'cash', color: '#F59E0B' },
];

interface PaymentMethodSelectorProps {
  selected: string;
  onSelect: (method: string) => void;
}

export function PaymentMethodSelector({ selected, onSelect }: PaymentMethodSelectorProps) {
  return (
    <View style={styles.methodRow}>
      {METHODS.map((m) => (
        <TouchableOpacity
          key={m.key}
          style={[
            styles.methodCard,
            selected === m.key && { borderColor: m.color, backgroundColor: `${m.color}15` },
          ]}
          onPress={() => onSelect(m.key)}
        >
          <Ionicons
            name={m.icon as any}
            size={28}
            color={selected === m.key ? m.color : '#64748B'}
          />
          <Text
            style={[
              styles.methodLabel,
              selected === m.key && { color: m.color },
            ]}
          >
            {m.label}
          </Text>
        </TouchableOpacity>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  methodRow: { flexDirection: 'row', justifyContent: 'space-between' },
  methodCard: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 18,
    marginHorizontal: 4,
    borderRadius: 16,
    backgroundColor: '#1E293B',
    borderWidth: 2,
    borderColor: '#334155',
  },
  methodLabel: { fontSize: 13, fontWeight: '700', color: '#94A3B8', marginTop: 6 },
});