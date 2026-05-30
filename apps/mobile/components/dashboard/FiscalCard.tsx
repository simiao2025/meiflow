import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { BlurView } from 'expo-blur';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Typography, Palette } from '../../constants/theme';

interface DAS {
  id: string;
  month: string;
  due_date: string;
  amount: number;
  status: 'pendente' | 'pago' | 'vencido';
}

interface FiscalCardProps {
  nextDas?: DAS | null;
  onPress?: () => void;
}

export function FiscalCard({ nextDas, onPress }: FiscalCardProps) {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>Obrigações Fiscais</Text>
      <TouchableOpacity style={styles.cardOuter} activeOpacity={0.8} onPress={onPress}>
        <BlurView intensity={5} tint="light" style={styles.cardInner}>
          <View style={styles.iconContainer}>
            <Ionicons name="shield-checkmark" size={22} color={Palette.warning} />
          </View>
          <View style={styles.content}>
            <Text style={styles.titleText}>
              {nextDas ? `DAS ${nextDas.month}` : 'Verificar Impostos'}
            </Text>
            <Text
              style={[
                styles.statusText,
                nextDas?.status === 'pago' && { color: Colors.primary },
              ]}
            >
              {nextDas
                ? nextDas.status === 'pago'
                  ? 'Em dia'
                  : 'Vencimento próximo'
                : 'Tudo regular'}
            </Text>
          </View>
          <Ionicons name="chevron-forward" size={18} color={Colors.textMuted} />
        </BlurView>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { paddingHorizontal: 24, marginTop: 35 },
  title: {
    color: Colors.text,
    fontSize: 18,
    fontFamily: Typography.fonts.display,
    marginBottom: 15,
    letterSpacing: -0.5,
  },
  cardOuter: {
    borderRadius: 24,
    overflow: 'hidden',
    borderWidth: 0.5,
    borderColor: Palette.border,
    backgroundColor: 'rgba(255,255,255,0.02)',
  },
  cardInner: {
    padding: 18,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },
  iconContainer: {
    width: 48,
    height: 48,
    borderRadius: 16,
    backgroundColor: 'rgba(245, 158, 11, 0.1)',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 0.5,
    borderColor: 'rgba(245, 158, 11, 0.2)',
  },
  content: { flex: 1 },
  titleText: { color: Colors.text, fontSize: 16, fontFamily: Typography.fonts.display },
  statusText: {
    color: Palette.warning,
    fontSize: 11,
    fontFamily: Typography.fonts.medium,
    marginTop: 2,
  },
});
