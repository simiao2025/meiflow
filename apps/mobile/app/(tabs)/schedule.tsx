import React, { useState, useEffect, useRef } from 'react';
import {
  View, Text, StyleSheet, SectionList, TouchableOpacity,
  ActivityIndicator, Animated, Platform, Alert
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
import { Ionicons } from '@expo/vector-icons';
import { useAuthStore } from '../../stores/authStore';
import { supabase } from '../../services/supabase';
import { Typography, Spacing, Palette, useThemeColors } from '../../constants/theme';
import { scheduleLocalPush, requestNotificationPermissions } from '../../utils/notifications';
import { useRouter } from 'expo-router';

export default function ScheduleScreen() {
  const Colors = useThemeColors();
  const styles = getStyles(Colors);
  const { user } = useAuthStore();
  const router = useRouter();
  const [appointments, setAppointments] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const fadeAnim = useRef(new Animated.Value(0)).current;

  // Real stats
  const [stats, setStats] = useState({ hoje: 0, pendentes: 0, mes: 0 });

  useEffect(() => {
    requestNotificationPermissions();
    load();
    Animated.timing(fadeAnim, { toValue: 1, duration: 800, useNativeDriver: true }).start();
  }, []);

  const load = async () => {
    if (!user) return;
    setLoading(true);
    const { data } = await supabase
      .from('appointments')
      .select('*, client:clients(name)')
      .eq('user_id', user.id)
      .order('scheduled_at', { ascending: true });
      
    if (data) {
      setAppointments(data);
      const now = new Date();
      const hojeStr = now.toLocaleDateString();
      const mesAtual = now.getMonth();
      const anoAtual = now.getFullYear();
      
      let hoje = 0, pendentes = 0, mes = 0;
      data.forEach(a => {
        const d = new Date(a.scheduled_at);
        if (d.toLocaleDateString() === hojeStr) hoje++;
        if (a.status === 'pending') pendentes++;
        if (d.getMonth() === mesAtual && d.getFullYear() === anoAtual) mes++;
      });
      setStats({ hoje, pendentes, mes });
    } else {
      setAppointments([]);
    }
    setLoading(false);
  };

  const grouped = appointments.reduce((acc, a) => {
    const day = new Date(a.scheduled_at).toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' });
    const existing = acc.find((s: any) => s.title === day);
    if (existing) existing.data.push(a);
    else acc.push({ title: day, data: [a] });
    return acc;
  }, [] as any[]);

  return (
    <View style={styles.container}>
      <LinearGradient colors={[Colors.bg, '#0B1121']} style={StyleSheet.absoluteFill} />
      
      <Animated.View style={{ flex: 1, opacity: fadeAnim }}>
        <View style={styles.header}>
           <Text style={styles.eyebrow}>FLUXO DE TRABALHO</Text>
           <Text style={styles.h1}>Agenda</Text>
        </View>

        {/* Cinematic Stats Bar */}
        <View style={styles.statsBar}>
          <StatItem label="HOJE" val={stats.hoje.toString().padStart(2, '0')} color={Colors.primary} />
          <StatItem label="PENDENTES" val={stats.pendentes.toString().padStart(2, '0')} color={Palette.warning} />
          <StatItem label="MÊS" val={stats.mes.toString().padStart(2, '0')} color={Palette.secondary} />
        </View>

        {loading ? <ActivityIndicator color={Colors.primary} size="large" style={{ marginTop: 40 }} /> : (
          <SectionList
            sections={grouped}
            keyExtractor={item => item.id}
            contentContainerStyle={styles.list}
            stickySectionHeadersEnabled={false}
            renderSectionHeader={({ section }) => (
              <Text style={styles.sectionTitle}>{section.title.toUpperCase()}</Text>
            )}
            renderItem={({ item, index }) => <AppointmentCard item={item} index={index} />}
            ListEmptyComponent={
              <View style={styles.empty}>
                <Ionicons name="calendar-outline" size={48} color={Colors.textMuted} />
                <Text style={styles.emptyText}>Nenhum agendamento para exibir</Text>
              </View>
            }
          />
        )}
        
        {/* Floating Action Button (FAB) para simular novo agendamento e testar notificações */}
        <TouchableOpacity 
          style={styles.fab}
          onPress={async () => {
            await scheduleLocalPush('Novo Agendamento! 📅', 'Você tem um novo compromisso com um cliente.');
            Alert.alert('Simulação', 'Um agendamento foi "criado". Você ouvirá a notificação em 2 segundos se o app estiver minimizado, ou verá o topo nativo.');
          }}
        >
          <Ionicons name="add" size={28} color="#FFF" />
        </TouchableOpacity>
      </Animated.View>
    </View>
  );
}

function StatItem({ label, val, color }: any) {
  const Colors = useThemeColors();
  const styles = getStyles(Colors);
  return (
    <View style={[styles.bezelOuter, { flex: 1, borderRadius: 16 }]}>
      <View style={[styles.bezelInner, { borderRadius: 14.5, padding: 12, alignItems: 'center' }]}>
        <Text style={[styles.statVal, { color }]}>{val}</Text>
        <Text style={styles.statLabel}>{label}</Text>
      </View>
    </View>
  );
}

function AppointmentCard({ item, index }: any) {
  const Colors = useThemeColors();
  const styles = getStyles(Colors);
  const time = new Date(item.scheduled_at).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
  
  return (
    <View style={styles.itemWrapper}>
      <View style={styles.timelineCol}>
        <Text style={styles.timeText}>{time}</Text>
        <View style={[styles.timeDot, { backgroundColor: item.status === 'completed' ? Colors.primary : Palette.warning }]} />
        <View style={styles.timelineConnector} />
      </View>
      
      <Animated.View style={[styles.bezelOuter, { flex: 1 }]}>
        <View style={styles.bezelInner}>
          <Text style={styles.itemTitle}>{item.description}</Text>
          <View style={styles.cardFooter}>
             <Ionicons name="person-outline" size={12} color={Colors.textMuted} />
             <Text style={styles.clientName}>{item.client?.name || 'Cliente Sem Nome'}</Text>
          </View>
        </View>
      </Animated.View>
    </View>
  );
}

const getStyles = (Colors: any) => StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.bg },
  header: { padding: 24, paddingTop: 60 },
  eyebrow: { color: Colors.primary, fontFamily: Typography.fonts.medium, fontSize: 10, letterSpacing: 2, marginBottom: 8 },
  h1: { color: Colors.text, fontFamily: Typography.fonts.display, fontSize: 32 },
  statsBar: { flexDirection: 'row', paddingHorizontal: 24, gap: 12, marginBottom: 32 },
  statVal: { fontSize: 20, fontFamily: Typography.fonts.display },
  statLabel: { fontSize: 8, color: Colors.textMuted, fontFamily: Typography.fonts.medium, letterSpacing: 1, marginTop: 4 },
  list: { paddingHorizontal: 24, paddingBottom: 140 },
  sectionTitle: { color: Colors.primary, fontSize: 10, fontFamily: Typography.fonts.display, letterSpacing: 2, marginTop: 24, marginBottom: 16, opacity: 0.6 },
  itemWrapper: { flexDirection: 'row', gap: 16, marginBottom: 2 },
  timelineCol: { alignItems: 'center', width: 40 },
  timeText: { color: Colors.text, fontSize: 12, fontFamily: Typography.fonts.display },
  timeDot: { width: 8, height: 8, borderRadius: 4, marginTop: 8, zIndex: 2, shadowOpacity: 0.5, shadowRadius: 5 },
  timelineConnector: { flex: 1, width: 1, backgroundColor: 'rgba(255,255,255,0.05)', marginTop: 4 },
  bezelOuter: { backgroundColor: 'rgba(255,255,255,0.03)', borderRadius: 20, padding: 1.5, borderWidth: 0.5, borderColor: 'rgba(255,255,255,0.08)', marginBottom: 12 },
  bezelInner: { backgroundColor: '#0F172A', borderRadius: 18.5, padding: 16 },
  itemTitle: { color: Colors.text, fontSize: 15, fontFamily: Typography.fonts.medium },
  cardFooter: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 8 },
  clientName: { color: Colors.textMuted, fontSize: 12, fontFamily: Typography.fonts.light },
  empty: { alignItems: 'center', marginTop: 60 },
  emptyText: { color: Colors.textMuted, fontSize: 14, fontFamily: Typography.fonts.medium, marginTop: 12 },
  fab: {
    position: 'absolute',
    bottom: 30,
    right: 24,
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: Colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: Colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 10,
    elevation: 8,
  }
});
