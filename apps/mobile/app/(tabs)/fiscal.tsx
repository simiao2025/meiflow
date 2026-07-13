import React, { useState, useEffect, useRef } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  ActivityIndicator, Animated,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useAuthStore } from '../../stores/authStore';
import { supabase } from '../../services/supabase';
import { Colors, Typography, Palette } from '../../constants/theme';
import { useRouter } from 'expo-router';
import { generateAndSharePDF, getExportHtmlTemplate } from '../../utils/pdfGenerator';

export default function FiscalScreen() {
  const { user } = useAuthStore();
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [dasRecords, setDasRecords] = useState<any[]>([]);
  const fadeAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    load();
    Animated.timing(fadeAnim, { toValue: 1, duration: 800, useNativeDriver: true }).start();
  }, []);

  const load = async () => {
    if (!user) return;
    setLoading(true);
    const { data } = await supabase.from('das_records').select('*').eq('user_id', user.id).order('due_date', { ascending: false });
    if (data) setDasRecords(data);
    setLoading(false);
  };

  return (
    <View style={styles.container}>
      <LinearGradient colors={[Colors.bg, '#0B1121']} style={StyleSheet.absoluteFill} />
      <Animated.View style={{ flex: 1, opacity: fadeAnim }}>
        <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
          <View style={styles.header}>
             <Text style={styles.eyebrow}>CONFORMIDADE TRIBUTÁRIA</Text>
             <Text style={styles.h1}>Fiscal</Text>
          </View>

          {/* Bento Stats Row */}
          <View style={styles.bentoRow}>
             <View style={[styles.bezelOuter, { flex: 1.5 }]}>
                <View style={styles.bezelInner}>
                   <Text style={styles.statLabel}>PRÓXIMO DAS</Text>
                   <Text style={styles.statValLarge}>
                     {dasRecords.length > 0
                       ? new Date(dasRecords[0].due_date).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' }).toUpperCase()
                       : '---'}
                   </Text>
                   <Text style={styles.statSub}>
                     {dasRecords.length > 0
                       ? `Vence em ${Math.ceil((new Date(dasRecords[0].due_date).getTime() - Date.now()) / (1000 * 60 * 60 * 24))} dias`
                       : 'Nenhuma guia'}
                   </Text>
                </View>
             </View>
             <View style={[styles.bezelOuter, { flex: 1 }]}>
                <View style={styles.bezelInner}>
                   <Text style={styles.statLabel}>STATUS</Text>
                   <View style={styles.statusBadge}>
                      <Ionicons name="checkmark-circle" size={14} color={Colors.primary} />
                      <Text style={styles.statusText}>REGULAR</Text>
                   </View>
                </View>
             </View>
          </View>

          {/* Action Grid */}
          <View style={styles.grid}>
             <ActionCard 
                icon="calendar-outline" 
                label="Declaração Anual" 
                color={Palette.secondary} 
                onPress={() => router.push('/fiscal/annual-declaration')} 
             />
             <ActionCard 
                icon="document-text-outline" 
                label="Emitir NFS-e" 
                color={Colors.primary} 
                onPress={() => router.push('/fiscal/emit')} 
             />
             <ActionCard 
                icon="briefcase-outline" 
                label="Malote Contábil" 
                color={Palette.warning} 
                onPress={() => router.push('/fiscal/export')} 
             />
             <ActionCard 
                icon="list-outline" 
                label="Minhas Notas" 
                color={Colors.success || '#10B981'} 
                onPress={() => router.push('/fiscal/invoices')} 
             />
          </View>

          <Text style={styles.sectionTitle}>HISTÓRICO DE GUIAS DAS</Text>
          {loading ? <ActivityIndicator color={Colors.primary} style={{ marginTop: 20 }} /> : (
            dasRecords.map((das, index) => <DasCard key={das.id} das={das} index={index} />)
          )}

          <Text style={styles.disclaimer}>
            Aviso: O MEIFlow não substitui a orientação de um contador habilitado.
            Valores, prazos e documentos devem ser verificados antes do pagamento ou transmissão.
          </Text>
        </ScrollView>
      </Animated.View>
    </View>
  );
}

function ActionCard({ icon, label, color, onPress }: any) {
  return (
    <TouchableOpacity style={[styles.bezelOuter, { width: '48%', marginBottom: 8 }]} activeOpacity={0.8} onPress={onPress}>
       <View style={[styles.bezelInner, { padding: 16, alignItems: 'center' }]}>
          <View style={[styles.iconCircle, { backgroundColor: color + '15' }]}>
             <Ionicons name={icon} size={22} color={color} />
          </View>
          <Text style={styles.actionLabel}>{label}</Text>
       </View>
    </TouchableOpacity>
  );
}

function DasCard({ das }: any) {
  const downloadPdf = async () => {
    // Generate a simple mock PDF for the DAS ticket
    const html = `
      <html>
        <body style="font-family: Helvetica, sans-serif; padding: 40px; color: #333;">
          <h1 style="color: #D4AF37;">Documento de Arrecadação - DAS MEI</h1>
          <hr/>
          <p>Mês de Referência: <b>${das.reference_month.toUpperCase()}</b></p>
          <p>Vencimento: <b>${das.due_date}</b></p>
          <p>Valor Devido: <b>R$ ${das.amount.toFixed(2).replace('.', ',')}</b></p>
          <p>Status: <b>${das.status.toUpperCase()}</b></p>
          <br/><br/>
          <p style="font-size: 12px; color: #666;">*Este é um documento de simulação.*</p>
        </body>
      </html>
    `;
    await generateAndSharePDF(`DAS_${das.reference_month}`, html);
  };

  return (
    <View style={[styles.bezelOuter, styles.dasCard]}>
       <View style={[styles.bezelInner, { flexDirection: 'row', alignItems: 'center' }]}>
          <View style={[styles.statusIcon, { backgroundColor: das.status === 'pago' ? Colors.primaryMuted : Palette.warning + '15' }]}>
             <Ionicons name={das.status === 'pago' ? 'checkmark' : 'time-outline'} size={18} color={das.status === 'pago' ? Colors.primary : Palette.warning} />
          </View>
          <View style={{ flex: 1, marginLeft: 16 }}>
             <Text style={styles.dasMonth}>{das.reference_month.toUpperCase()}</Text>
             <Text style={styles.dasDue}>Vencimento: {das.due_date}</Text>
             <Text style={[styles.dasStatus, { color: das.status === 'pago' ? Colors.primary : Palette.warning }]}>{das.status.toUpperCase()}</Text>
          </View>
          <View style={{ alignItems: 'flex-end', justifyContent: 'space-between', height: '100%' }}>
             <Text style={styles.dasAmount}>R$ {das.amount.toFixed(2).replace('.', ',')}</Text>
             <TouchableOpacity style={styles.pdfBtn} onPress={downloadPdf}>
               <Ionicons name="download-outline" size={16} color={Colors.primary} />
               <Text style={styles.pdfBtnText}>PDF</Text>
             </TouchableOpacity>
          </View>
       </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.bg },
  scroll: { paddingBottom: 140 },
  header: { padding: 24, paddingTop: 60 },
  eyebrow: { color: Colors.primary, fontFamily: Typography.fonts.medium, fontSize: 10, letterSpacing: 2, marginBottom: 8 },
  h1: { color: Colors.text, fontFamily: Typography.fonts.display, fontSize: 32 },
  bentoRow: { flexDirection: 'row', paddingHorizontal: 24, gap: 12, marginBottom: 24 },
  bezelOuter: { backgroundColor: 'rgba(255,255,255,0.03)', borderRadius: 24, padding: 1.5, borderWidth: 0.5, borderColor: 'rgba(255,255,255,0.08)' },
  bezelInner: { backgroundColor: Colors.bgInner, borderRadius: 22.5, padding: 20 },
  statLabel: { color: Colors.textMuted, fontSize: 9, fontFamily: Typography.fonts.display, letterSpacing: 1.5 },
  statValLarge: { color: Colors.text, fontSize: 26, fontFamily: Typography.fonts.display, marginTop: 8 },
  statSub: { color: Colors.primary, fontSize: 11, fontFamily: Typography.fonts.medium, marginTop: 4 },
  statusBadge: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 12, backgroundColor: Colors.primaryMuted, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 100 },
  statusText: { color: Colors.primary, fontSize: 10, fontFamily: Typography.fonts.display },
  grid: { flexDirection: 'row', flexWrap: 'wrap', paddingHorizontal: 24, gap: 10, marginBottom: 32 },
  iconCircle: { width: 44, height: 44, borderRadius: 14, justifyContent: 'center', alignItems: 'center', marginBottom: 12 },
  actionLabel: { color: Colors.text, fontSize: 10, fontFamily: Typography.fonts.display, textAlign: 'center' },
  sectionTitle: { color: Colors.textMuted, fontSize: 10, fontFamily: Typography.fonts.display, letterSpacing: 2, marginLeft: 24, marginBottom: 16 },
  dasCard: { marginHorizontal: 24, marginBottom: 12 },
  statusIcon: { width: 40, height: 40, borderRadius: 12, justifyContent: 'center', alignItems: 'center' },
  dasMonth: { color: Colors.text, fontSize: 14, fontFamily: Typography.fonts.display },
  dasDue: { color: Colors.textMuted, fontSize: 11, fontFamily: Typography.fonts.medium, marginTop: 2 },
  dasAmount: { color: Colors.text, fontSize: 16, fontFamily: Typography.fonts.display, marginBottom: 6 },
  dasStatus: { fontSize: 9, fontFamily: Typography.fonts.display, marginTop: 4, letterSpacing: 1 },
  pdfBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: 'rgba(212,175,55,0.1)', paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8 },
  pdfBtnText: { color: Colors.primary, fontSize: 10, fontFamily: Typography.fonts.display },
  disclaimer: { color: Colors.textMuted, fontSize: 11, fontFamily: Typography.fonts.medium, textAlign: 'center', marginTop: 24, paddingHorizontal: 24, lineHeight: 16, fontStyle: 'italic' },
});
