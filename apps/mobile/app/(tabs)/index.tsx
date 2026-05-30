import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Platform, ActivityIndicator, RefreshControl } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useAuthStore } from '../../stores/authStore';
import { useRouter } from 'expo-router';
import { useThemeColors, Typography, Palette, Colors as StaticColors } from '../../constants/theme';
import { financialService, fiscalService } from '../../services/api';
import { BalanceCard } from '../../components/dashboard/BalanceCard';
import { QuickActions } from '../../components/dashboard/QuickActions';
import { FiscalCard } from '../../components/dashboard/FiscalCard';
import Animated, { FadeInUp, useSharedValue, useAnimatedStyle, withSpring } from 'react-native-reanimated';

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
              <LinearGradient colors={[Colors.primary, Palette.gold[600]]} style={[styles.profileBadge, { shadowColor: Colors.primary }]}>
                <Ionicons name="person" size={20} color={Palette.black} />
              </LinearGradient>
            </TouchableOpacity>
          </View>
        </Animated.View>

        <Animated.View entering={FadeInUp.delay(200).springify().damping(14)}>
          <BalanceCard balance={balance} growth={growth} loading={loading} onRefresh={loadData} />
        </Animated.View>

        <Animated.View entering={FadeInUp.delay(300).springify().damping(14)}>
          <QuickActions
            actions={[
              { icon: 'add', label: 'Receita', color: Colors.primary },
              { icon: 'remove', label: 'Despesa', color: '#FCA5A5' },
              { icon: 'document-text-outline', label: 'NFS-e', color: '#7DD3FC', onPress: () => router.push('/fiscal') },
              { icon: 'qr-code-outline', label: 'Guia DAS', color: '#FCD34D', onPress: () => router.push('/fiscal') },
            ]}
          />
        </Animated.View>

        <Animated.View entering={FadeInUp.delay(400).springify().damping(14)} style={styles.section}>
          <View style={styles.sectionHeaderRow}>
            <Text style={[styles.sectionTitle, { color: Colors.text }]}>Gestão Inteligente</Text>
            <TouchableOpacity style={[styles.alertBadge, { borderColor: Colors.border }]}>
              <View style={[styles.liveDot, { backgroundColor: Colors.primary }]} />
              <Text style={[styles.liveText, { color: Colors.text }]}>Notícias Legais</Text>
            </TouchableOpacity>
          </View>
          <View style={styles.smartRow}>
            <SmartButton
              icon="cash-outline"
              title="Cobrar Cliente"
              subtitle="PIX ou Cartão"
              color={Colors.primary}
              onPress={() => router.push('/billing/charge')}
            />
            <SmartButton
              icon="calendar-outline"
              title="Agenda"
              subtitle="Compromissos"
              color="#818CF8"
              onPress={() => router.push('/schedule')}
            />
          </View>
          <View style={[styles.smartRow, { marginTop: 12 }]}>
            <SmartButton
              icon="pricetags-outline"
              title="Meu Catálogo"
              subtitle="Serviços e Produtos"
              color={Palette.warning}
              onPress={() => router.push('/catalog')}
            />
            <SmartButton
              icon="cart-outline"
              title="Frente de Caixa"
              subtitle="PDV e Vendas"
              color="#10B981"
              onPress={() => router.push('/pos')}
            />
          </View>
          <View style={[styles.smartRow, { marginTop: 12 }]}>
            <SmartButton
              icon="settings-outline"
              title="Ajustes"
              subtitle="Conta e App"
              color={Colors.textMuted}
              onPress={() => router.push('/settings')}
            />
            <View style={{ flex: 1 }} />
          </View>
        </Animated.View>

        <Animated.View entering={FadeInUp.delay(500).springify().damping(14)}>
          <FiscalCard nextDas={nextDas} onPress={() => router.push('/fiscal')} />
        </Animated.View>
      </Animated.ScrollView>
    </View>
  );
}

function SmartButton({ icon, title, subtitle, color, onPress }: any) {
  const scale = useSharedValue(1);
  const Colors = useThemeColors();

  const animatedStyle = useAnimatedStyle(() => {
    return { transform: [{ scale: scale.value }] };
  });

  return (
    <Animated.View style={[styles.smartBtnWrapper, animatedStyle]}>
      <TouchableOpacity 
        style={[styles.smartBtn, { borderColor: Colors.borderStrong, backgroundColor: Colors.bgCard }]} 
        onPress={onPress}
        activeOpacity={1}
        onPressIn={() => { scale.value = withSpring(0.95, { damping: 12 }); }}
        onPressOut={() => { scale.value = withSpring(1, { damping: 12 }); }}
      >
        <View style={[styles.smartIcon, { backgroundColor: color + '15' }]}>
          <Ionicons name={icon as any} size={20} color={color} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={[styles.smartTitle, { color: Colors.text }]} numberOfLines={2}>{title}</Text>
          <Text style={[styles.smartSubtitle, { color: Colors.textMuted }]}>{subtitle}</Text>
        </View>
      </TouchableOpacity>
    </Animated.View>
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
  companyName: { fontSize: 32, fontFamily: Typography.fonts.display, marginTop: 4, letterSpacing: -1 },
  profileBtnRight: { marginBottom: 4 },
  profileBadge: { 
    width: 44, 
    height: 44, 
    borderRadius: 14, 
    justifyContent: 'center', 
    alignItems: 'center',
    shadowColor: StaticColors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 5
  },
  section: { paddingHorizontal: 24, marginTop: 25 },
  sectionHeaderRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 15 },
  sectionTitle: { fontSize: 18, fontFamily: Typography.fonts.display, letterSpacing: -0.5 },
  alertBadge: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: 'transparent', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12, borderWidth: 0.5 },
  liveDot: { width: 6, height: 6, borderRadius: 3 },
  liveText: { fontSize: 10, fontFamily: Typography.fonts.medium, letterSpacing: 0.2 },
  smartRow: { flexDirection: 'row', gap: 12 },
  smartBtnWrapper: { flex: 1 },
  smartBtn: { 
    borderRadius: 20, 
    padding: 14, 
    flexDirection: 'row', 
    alignItems: 'center', 
    gap: 12, 
    borderWidth: 0.5, 
  },
  smartIcon: { width: 36, height: 36, borderRadius: 10, justifyContent: 'center', alignItems: 'center' },
  smartTitle: { fontSize: 13, fontFamily: Typography.fonts.display },
  smartSubtitle: { fontSize: 10, fontFamily: Typography.fonts.medium },
});
