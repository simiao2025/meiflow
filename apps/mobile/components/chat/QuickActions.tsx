import React from 'react';
import { View, Text, TouchableOpacity, ScrollView, StyleSheet } from 'react-native';
import { useThemeColors, Typography } from '../../constants/theme';

const QUICK_ACTIONS = [
  { label: '💰 Ver meu saldo', message: 'Qual é meu saldo atual?' },
  { label: '📄 Emitir cobrança', message: 'Quero emitir uma cobrança para um cliente' },
  { label: '📊 Resumo do mês', message: 'Me dê um resumo financeiro deste mês' },
  { label: '📅 Próximos prazos', message: 'Quais são meus próximos prazos fiscais?' },
];

interface QuickActionsProps {
  onAction: (message: string) => void;
}

export function QuickActions({ onAction }: QuickActionsProps) {
  const Colors = useThemeColors();
  const styles = getStyles(Colors);

  return (
    <View style={{ marginBottom: 8 }}>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.quickRow} contentContainerStyle={{ paddingRight: 48 }}>
        {QUICK_ACTIONS.map((action, i) => (
          <TouchableOpacity key={i} style={styles.quickChip} onPress={() => onAction(action.message)}>
            <Text style={styles.quickChipText}>{action.label}</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>
    </View>
  );
}

const getStyles = (C: any) => StyleSheet.create({
  quickRow: { paddingLeft: 24, paddingVertical: 8, flexGrow: 0, flexShrink: 0 },
  quickChip: { paddingHorizontal: 16, paddingVertical: 10, borderRadius: 20, backgroundColor: 'rgba(255,255,255,0.03)', borderWidth: 1, borderColor: '#334155', marginRight: 8 },
  quickChipText: { color: C.text, fontSize: 13, fontFamily: Typography.fonts.medium },
});