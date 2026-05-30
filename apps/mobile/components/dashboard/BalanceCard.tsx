import React, { useState, useRef, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator, Animated, Easing } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Typography, Palette } from '../../constants/theme';

interface BalanceCardProps {
  balance: number | null;
  growth?: string;
  loading: boolean;
  onRefresh: () => void;
}

export function BalanceCard({ balance, growth, loading, onRefresh }: BalanceCardProps) {
  const [isBalanceVisible, setIsBalanceVisible] = useState(true);
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(30)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, { toValue: 1, duration: 800, useNativeDriver: true }),
      Animated.timing(slideAnim, {
        toValue: 0,
        duration: 1000,
        easing: Easing.bezier(0.32, 0.72, 0, 1),
        useNativeDriver: true,
      }),
    ]).start();
  }, []);

  return (
    <Animated.View style={[styles.container, { opacity: fadeAnim, transform: [{ translateY: slideAnim }] }]}>
      <LinearGradient
        colors={[Palette.navyDeep, Palette.black]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.card}
      >
        <View style={styles.innerBezel}>
          <View style={styles.header}>
            <View style={styles.labelRow}>
              <Ionicons name="wallet-outline" size={14} color={Colors.primary} />
              <Text style={styles.label}>Saldo Consolidado</Text>
            </View>
            <TouchableOpacity onPress={() => setIsBalanceVisible(!isBalanceVisible)}>
              <Ionicons
                name={isBalanceVisible ? 'eye-outline' : 'eye-off-outline'}
                size={18}
                color={Colors.textSecondary}
              />
            </TouchableOpacity>
          </View>

          <View style={styles.valueContainer}>
            {loading && !balance ? (
              <ActivityIndicator color={Colors.primary} size="small" />
            ) : (
              <Text style={styles.value}>
                {isBalanceVisible
                  ? `R$ ${balance?.toLocaleString('pt-BR', { minimumFractionDigits: 2 }) || '0,00'}`
                  : '••••••••'}
              </Text>
            )}
          </View>

          <View style={styles.footer}>
            <View style={styles.statItem}>
              <Text style={styles.statLabel}>Mês Atual</Text>
              <Text style={[styles.statValue, { color: Number(growth) >= 0 ? Colors.primary : Palette.destructive }]}>
                {Number(growth) > 0 ? '+' : ''}{growth}%
              </Text>
            </View>
            <TouchableOpacity style={styles.detailsBtn}>
              <Text style={styles.detailsText}>Ver Extrato</Text>
              <Ionicons name="chevron-forward" size={12} color={Colors.primary} />
            </TouchableOpacity>
          </View>
        </View>
      </LinearGradient>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: { paddingHorizontal: 20, marginTop: 10 },
  card: {
    borderRadius: 24,
    padding: 2,
    borderWidth: 1,
    borderColor: Palette.borderStrong,
    shadowColor: Colors.primary,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.15,
    shadowRadius: 16,
  },
  innerBezel: {
    backgroundColor: 'rgba(255,255,255,0.02)',
    borderRadius: 22,
    padding: 20,
    borderWidth: 0.5,
    borderColor: 'rgba(255,255,255,0.05)',
  },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  labelRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  label: { color: Colors.textSecondary, fontSize: 12, fontFamily: Typography.fonts.medium },
  valueContainer: { minHeight: 48, justifyContent: 'center', marginVertical: 4 },
  value: { 
    color: Colors.text, 
    fontSize: 32, 
    fontFamily: Typography.fonts.display, 
    letterSpacing: -1,
    includeFontPadding: false 
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 0.5,
    borderTopColor: Palette.border,
  },
  statItem: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  statLabel: { color: Colors.textMuted, fontSize: 10, fontFamily: Typography.fonts.medium },
  statValue: { color: Colors.primary, fontSize: 11, fontFamily: Typography.fonts.display },
  detailsBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: Palette.glass, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12 },
  detailsText: { color: Colors.primary, fontSize: 10, fontFamily: Typography.fonts.medium },
});
