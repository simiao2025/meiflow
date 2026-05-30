import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, ActivityIndicator, FlatList } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { Colors, Palette, Typography } from '../../constants/theme';
import { useAuthStore } from '../../stores/authStore';
import { supabase } from '../../services/supabase';
import { generateAndSharePDF } from '../../utils/pdfGenerator';

export default function InvoicesScreen() {
  const router = useRouter();
  const { user } = useAuthStore();
  const [loading, setLoading] = useState(true);
  const [invoices, setInvoices] = useState<any[]>([]);

  useEffect(() => {
    loadInvoices();
  }, []);

  const loadInvoices = async () => {
    if (!user) return;
    setLoading(true);
    // Buscamos transações que são do tipo 'receita' simulando notas emitidas
    const { data } = await supabase
      .from('transactions')
      .select('*')
      .eq('user_id', user.id)
      .eq('type', 'receita')
      .order('date', { ascending: false });
      
    if (data) setInvoices(data);
    setLoading(false);
  };

  const handleViewPDF = (item: any) => {
    const html = `
      <html>
        <body style="font-family: Helvetica, sans-serif; padding: 40px; color: #333;">
          <h1 style="color: #0284C7;">Nota Fiscal de Serviços Eletrônica (NFS-e)</h1>
          <hr/>
          <p>Data de Emissão: <b>${item.date.split('-').reverse().join('/')}</b></p>
          <p>Status: <b style="color: #10B981;">AUTORIZADA</b></p>
          <br/>
          <h3>Prestador de Serviços</h3>
          <p><b>Razão Social:</b> ${user?.user_metadata?.full_name || 'MEI'}</p>
          <br/>
          <h3>Serviço Prestado</h3>
          <p><b>Descrição:</b> ${item.description || 'Serviços prestados'}</p>
          <br/>
          <table style="width: 100%; border-collapse: collapse; margin-top: 20px;">
            <tr>
              <td style="padding: 12px; border-bottom: 2px solid #333; font-weight: bold; font-size: 18px;">Valor Total da Nota:</td>
              <td style="padding: 12px; border-bottom: 2px solid #333; text-align: right; font-weight: bold; font-size: 18px; color: #0284C7;">
                R$ ${item.amount.toFixed(2).replace('.', ',')}
              </td>
            </tr>
          </table>
          <br/><br/>
          <p style="font-size: 12px; color: #666; text-align: center;">Documento auxiliar emitido via ecossistema MEIFlow.</p>
        </body>
      </html>
    `;
    generateAndSharePDF(`NFSe_${item.id.substring(0, 8)}`, html);
  };

  return (
    <View style={styles.container}>
      <LinearGradient colors={[Colors.bg, '#0B1121']} style={StyleSheet.absoluteFill} />
      
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={24} color={Colors.text} />
        </TouchableOpacity>
        <View>
          <Text style={styles.eyebrow}>FISCAL</Text>
          <Text style={styles.h1}>Notas Fiscais</Text>
        </View>
      </View>

      {loading ? (
        <ActivityIndicator color={Colors.primary} style={{ marginTop: 40 }} />
      ) : (
        <FlatList
          data={invoices}
          keyExtractor={item => item.id}
          contentContainerStyle={styles.list}
          renderItem={({ item }) => (
            <View style={styles.card}>
              <View style={styles.cardHeader}>
                <View style={styles.statusBadge}>
                  <Ionicons name="checkmark-circle" size={14} color={Colors.primary} />
                  <Text style={styles.statusText}>AUTORIZADA</Text>
                </View>
                <Text style={styles.date}>{item.date.split('-').reverse().join('/')}</Text>
              </View>
              
              <Text style={styles.description}>{item.description}</Text>
              
              <View style={styles.cardFooter}>
                <View>
                  <Text style={styles.label}>NFS-e Nº</Text>
                  <Text style={styles.value}>{Math.floor(Math.random() * 10000).toString().padStart(4, '0')}</Text>
                </View>
                <View style={{ alignItems: 'flex-end' }}>
                  <Text style={styles.label}>VALOR DA NOTA</Text>
                  <Text style={styles.amount}>R$ {item.amount.toFixed(2).replace('.', ',')}</Text>
                </View>
              </View>

              <TouchableOpacity style={styles.pdfButton} onPress={() => handleViewPDF(item)}>
                <Ionicons name="document-text" size={16} color={Colors.primary} />
                <Text style={styles.pdfButtonText}>Visualizar e Compartilhar PDF</Text>
              </TouchableOpacity>
            </View>
          )}
          ListEmptyComponent={
            <View style={styles.emptyState}>
              <Ionicons name="document-text-outline" size={48} color={Colors.textMuted} />
              <Text style={styles.emptyText}>Nenhuma nota fiscal emitida ainda.</Text>
            </View>
          }
        />
      )}
      
      <TouchableOpacity style={styles.fab} onPress={() => router.push('/fiscal/emit')}>
        <Ionicons name="add" size={24} color={Palette.black} />
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.bg },
  header: { padding: 24, paddingTop: 60, flexDirection: 'row', alignItems: 'center', gap: 16 },
  backBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: 'rgba(255,255,255,0.05)', justifyContent: 'center', alignItems: 'center' },
  eyebrow: { color: Colors.primary, fontFamily: Typography.fonts.medium, fontSize: 10, letterSpacing: 2, marginBottom: 4 },
  h1: { color: Colors.text, fontFamily: Typography.fonts.display, fontSize: 28 },
  list: { padding: 24, paddingBottom: 100 },
  card: { backgroundColor: '#0F172A', borderRadius: 16, padding: 20, marginBottom: 16, borderWidth: 1, borderColor: 'rgba(255,255,255,0.05)' },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  statusBadge: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: Colors.primaryMuted, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6 },
  statusText: { color: Colors.primary, fontSize: 10, fontFamily: Typography.fonts.display },
  date: { color: Colors.textMuted, fontSize: 12, fontFamily: Typography.fonts.medium },
  description: { color: Colors.text, fontSize: 16, fontFamily: Typography.fonts.medium, marginBottom: 16 },
  cardFooter: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end', borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.05)', paddingTop: 16 },
  label: { color: Colors.textMuted, fontSize: 10, fontFamily: Typography.fonts.display, letterSpacing: 1, marginBottom: 4 },
  value: { color: Colors.text, fontSize: 14, fontFamily: Typography.fonts.medium },
  amount: { color: Colors.primary, fontSize: 18, fontFamily: Typography.fonts.display },
  emptyState: { alignItems: 'center', marginTop: 60 },
  emptyText: { color: Colors.textMuted, fontSize: 14, fontFamily: Typography.fonts.medium, marginTop: 12 },
  fab: { position: 'absolute', bottom: 30, right: 30, width: 60, height: 60, borderRadius: 30, backgroundColor: Colors.primary, justifyContent: 'center', alignItems: 'center', shadowColor: Colors.primary, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 8, elevation: 8 },
  pdfButton: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: 'rgba(56, 189, 248, 0.1)', paddingVertical: 12, borderRadius: 8, marginTop: 16 },
  pdfButtonText: { color: Colors.primary, fontSize: 14, fontFamily: Typography.fonts.medium }
});
