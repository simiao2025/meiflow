import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Platform, ActivityIndicator, RefreshControl } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useAuthStore } from '../../stores/authStore';
import { useRouter } from 'expo-router';
import { useThemeColors, Typography, Palette } from '../../constants/theme';
import { financialService, fiscalService } from '../../services/api';
import { BalanceCard } from '../../components/dashboard/BalanceCard';
import { FiscalCard } from '../../components/dashboard/FiscalCard';
import Animated, { FadeInUp } from 'react-native-reanimated';

export default function DashboardScreen() {
  const { user, profile } = useAuthStore();
  const router = useRouter();
  const [refreshing, setRefreshing] = useState(false);
  const [balance, setBalance] = useState<number | null>(null);
  const [growth, setGrowth] = useState<string>("0.0");
  const [nextDas, setNextDas] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const Colors = useThemeColors();

  const loadData = async () => {
    if (!user) return;
    try {
      setLoading(true);
      const [balanceData, dasData] = await Promise.all([
        financialService.getBalance(user.id),
        fiscalService.getDasRecords(user.id),
      ]);
      setBalance(balanceData.balance);
      setGrowth(balanceData.growth || "0.0");
      if (dasData && dasData.length > 0) {
        setNextDas(dasData[0]);
      }
    } catch (e) {
      console.error('Erro ao carregar dados do Dashboard', e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [user]);

  const onRefresh = () => {
    setRefreshing(true);
    loadData();
  };

  return (
    <View style={[styles.container, { backgroundColor: Colors.bg }]}>
      <LinearGradient colors={[Colors.bgCard, Colors.bg]} style={StyleSheet.absoluteFill} />

      <Animated.ScrollView
        contentContainerStyle={{ paddingBottom: 140 }}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.primary} />}
      >
        <Animated.View entering={FadeInUp.delay(100).springify().damping(14)} style={styles.header}>
          <View style={styles.headerRow}>
            <View>
              <Text style={[styles.greetingText, { color: Colors.textSecondary }]}>Olá, {profile?.full_name?.split(' ')[0] || 'MEI'}</Text>
              <Text style={[styles.companyName, { color: Colors.text }]}>{profile?.nome_fantasia || profile?.razao_social || 'Sua Empresa'}</Text>
            </View>
            <TouchableOpacity style={styles.profileBtnRight} onPress={() => router.push('/profile')}>
              <LinearGradient colors={[Colors.primary, Palette.gold[600]]} style={[styles.profileBadge]}>
                <Ionicons name="person" size={20} color={Palette.black} />
              </LinearGradient>
            </TouchableOpacity>
          </View>
        </Animated.View>

        <Animated.View entering={FadeInUp.delay(200).springify().damping(14)}>
          <BalanceCard balance={balance} growth={growth} loading={loading} onRefresh={loadData} />
        </Animated.View>

        {/* Ações Rápidas - 4 fluxos principais do MEI */}
        <Animated.View entering={FadeInUp.delay(300).springify().damping(14)} style={styles.section}>
          <Text style={[styles.sectionTitle, { color: Colors.text }]}>Ações Rápidas</Text>
          <View style={styles.actionsGrid}>
            <ActionButton
              icon="add-circle-outline"
              title="Registrar Receita"
              color="#22C55E"
              onPress={() => router.push('/(tabs)/two')}
            />
            <ActionButton
              icon="remove-circle-outline"
              title="Registrar Despesa"
              color="#EF4444"
              onPress={() => router.push('/(tabs)/two')}
            />
            <ActionButton
              icon="document-text-outline"
              title="Emitir NFS-e"
              color="#3B82F6"
              onPress={() => router.push('/fiscal/emit')}
            />
            <ActionButton
              icon="cash-outline"
              title="Cobrar Cliente"
              color="#F59E0B"
              onPress={() => router.push('/billing/charge')}
            />
          </View>
        </Animated.View>

        {/* Status Fiscal */}
        <Animated.View entering={FadeInUp.delay(400).springify().damping(14)}>
          <FiscalCard nextDas={nextDas} onPress={() => router.push('/fiscal')} />
        </Animated.View>

        {/* Acessos Rápidos */}
        <Animated.View entering={FadeInUp.delay(500).springify().damping(14)} style={styles.section}>
          <Text style={[styles.sectionTitle, { color: Colors.text }]}>Mais Acessos</Text>
          <View style={styles.shortcutsRow}>
            <ShortcutButton
              icon="people-outline"
              title="Clientes"
              onPress={() => router.push('/(tabs)/clients')}
            />
            <ShortcutButton
              icon="sparkles-outline"
              title="Assistente IA"
              onPress={() => router.push('/(tabs)/assistant')}
            />
            <ShortcutButton
              icon="calendar-outline"
              title="Agenda"
              onPress={() => router.push('/schedule')}
            />
            <ShortcutButton
              icon="settings-outline"
              title="Ajustes"
              onPress={() => router.push('/settings')}
            />
          </View>
        </Animated.View>
      </Animated.ScrollView>
    </View>
  );
}

function ActionButton({ icon, title, color, onPress }: { icon: any; title: string; color: string; onPress: () => void }) {
  const Colors = useThemeColors();
  return (
    <TouchableOpacity style={[styles.actionBtn, { borderColor: Colors.borderStrong, backgroundColor: Colors.bgCard }]} onPress={onPress} activeOpacity={0.7}>
      <View style={[styles.actionIcon, { backgroundColor: color + '18' }]}>
        <Ionicons name={icon} size={28} color={color} />
      </View>
      <Text style={[styles.actionTitle, { color: Colors.text }]} numberOfLines={2}>{title}</Text>
    </TouchableOpacity>
  );
}

function ShortcutButton({ icon, title, onPress }: { icon: any; title: string; onPress: () => void }) {
  const Colors = useThemeColors();
  return (
    <TouchableOpacity style={[styles.shortcutBtn, { backgroundColor: Colors.bgCard, borderColor: Colors.border }]} onPress={onPress} activeOpacity={0.7}>
      <Ionicons name={icon} size={22} color={Colors.primary} />
      <Text style={[styles.shortcutTitle, { color: Colors.textSecondary }]} numberOfLines={1}>{title}</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    paddingHorizontal: 24,
    paddingTop: Platform.OS === 'ios' ? 60 : 40,
    marginBottom: 10
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end'
  },
  greetingText: { fontSize: 16, fontFamily: Typography.fonts.medium },
  companyName: { fontSize: 28, fontFamily: Typography.fonts.display, marginTop: 4, letterSpacing: -1 },
  profileBtnRight: { marginBottom: 4 },
  profileBadge: {
    width: 44,
    height: 44,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
  },
  section: { paddingHorizontal: 24, marginTop: 28 },
  sectionTitle: { fontSize: 18, fontFamily: Typography.fonts.display, letterSpacing: -0.5, marginBottom: 16 },

  // Grid de ações principais (2x2)
  actionsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  actionBtn: {
    width: '47%',
    borderRadius: 16,
    padding: 16,
    alignItems: 'center',
    borderWidth: 0.5,
    minHeight: 100,
    justifyContent: 'center',
  },
  actionIcon: {
    width: 56,
    height: 56,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 10,
  },
  actionTitle: {
    fontSize: 13,
    fontFamily: Typography.fonts.display,
    textAlign: 'center',
  },

  // Atalhos secundários (4 itens horizontais)
  shortcutsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 8,
  },
  shortcutBtn: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 8,
    borderRadius: 12,
    borderWidth: 0.5,
    gap: 6,
  },
  shortcutTitle: {
    fontSize: 11,
    fontFamily: Typography.fonts.medium,
    textAlign: 'center',
  },
});
