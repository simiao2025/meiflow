import React, { useState, useEffect } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  ScrollView, 
  TouchableOpacity, 
  ActivityIndicator,
  Alert,
  Linking
} from 'react-native';
import { useLocalSearchParams, useRouter, Stack } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '../services/supabase';
import { LinearGradient } from 'expo-linear-gradient';

type TabType = 'info' | 'agenda' | 'historico';

export default function ClientDetailsScreen() {
  const { id } = useLocalSearchParams();
  const [client, setClient] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<TabType>('info');
  const router = useRouter();

  useEffect(() => {
    fetchClient();
  }, [id]);

  const fetchClient = async () => {
    try {
      const { data, error } = await supabase
        .from('clients')
        .select('*')
        .eq('id', id)
        .single();

      if (error) throw error;
      setClient(data);
    } catch (error) {
      console.error('Erro ao buscar detalhes do cliente:', error);
      Alert.alert('Erro', 'Não foi possível carregar os dados do cliente.');
    } finally {
      setLoading(false);
    }
  };

  const toggleAiAgent = async () => {
    try {
      const { error } = await supabase
        .from('clients')
        .update({ ai_agent_enabled: !client.ai_agent_enabled })
        .eq('id', id);

      if (error) throw error;
      setClient({ ...client, ai_agent_enabled: !client.ai_agent_enabled });
    } catch (error) {
      Alert.alert('Erro', 'Não foi possível alterar o status do agente.');
    }
  };

  if (loading) {
    return (
      <View style={[styles.container, styles.center]}>
        <ActivityIndicator size="large" color="#38BDF8" />
      </View>
    );
  }

  if (!client) return null;

  return (
    <View style={styles.container}>
      <Stack.Screen 
        options={{ 
          title: 'Detalhes do Cliente',
          headerShown: true,
          headerTintColor: '#FFF',
          headerStyle: { backgroundColor: '#0F172A' },
          headerRight: () => (
            <TouchableOpacity onPress={() => {}} style={{ marginRight: 10 }}>
              <Ionicons name="create-outline" size={24} color="#38BDF8" />
            </TouchableOpacity>
          )
        }} 
      />

      {/* Header com Resumo */}
      <LinearGradient colors={['#0F172A', '#1E293B']} style={styles.header}>
        <View style={styles.avatarLarge}>
          <Text style={styles.avatarTextLarge}>{client.name.charAt(0).toUpperCase()}</Text>
        </View>
        <Text style={styles.headerName}>{client.name}</Text>
        <View style={styles.headerActions}>
          <TouchableOpacity 
            style={styles.actionCircle}
            onPress={() => Linking.openURL(`tel:${client.whatsapp_number}`)}
          >
            <Ionicons name="call" size={20} color="#FFFFFF" />
          </TouchableOpacity>
          <TouchableOpacity 
            style={[styles.actionCircle, { backgroundColor: '#25D366' }]}
            onPress={() => Linking.openURL(`whatsapp://send?phone=${client.whatsapp_number}`)}
          >
            <Ionicons name="logo-whatsapp" size={20} color="#FFFFFF" />
          </TouchableOpacity>
          <TouchableOpacity style={styles.actionCircle}>
            <Ionicons name="mail" size={20} color="#FFFFFF" />
          </TouchableOpacity>
        </View>
      </LinearGradient>

      {/* Tabs Customizadas */}
      <View style={styles.tabBar}>
        <TabButton 
          label="Info" 
          active={activeTab === 'info'} 
          onPress={() => setActiveTab('info')} 
        />
        <TabButton 
          label="Agenda" 
          active={activeTab === 'agenda'} 
          onPress={() => setActiveTab('agenda')} 
        />
        <TabButton 
          label="Histórico" 
          active={activeTab === 'historico'} 
          onPress={() => setActiveTab('historico')} 
        />
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        {activeTab === 'info' && (
          <View>
            <Section title="Dados Gerais">
              <InfoRow icon="card-outline" label="Documento" value={client.document || 'Não informado'} />
              <InfoRow icon="mail-outline" label="Email" value={client.email || 'Não informado'} />
              <InfoRow icon="logo-whatsapp" label="WhatsApp" value={client.whatsapp_number || 'Não informado'} />
            </Section>

            <Section title="Automação">
              <View style={styles.aiToggleCard}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.aiToggleTitle}>Agente IA de Atendimento</Text>
                  <Text style={styles.aiToggleDesc}>
                    {client.ai_agent_enabled 
                      ? 'O robô está respondendo este cliente no WhatsApp.' 
                      : 'O robô está desativado para este cliente.'}
                  </Text>
                </View>
                <TouchableOpacity 
                  style={[styles.toggleBtn, client.ai_agent_enabled && styles.toggleBtnActive]}
                  onPress={toggleAiAgent}
                >
                  <Text style={styles.toggleBtnText}>
                    {client.ai_agent_enabled ? 'ATIVO' : 'DESATIVADO'}
                  </Text>
                </TouchableOpacity>
              </View>
            </Section>

            <Section title="Localização">
              <InfoRow icon="location-outline" label="Endereço" value={client.formatted_address || 'Endereço não cadastrado'} />
              {client.lat && client.lng ? (
                <TouchableOpacity 
                  style={styles.mapButton}
                  onPress={() => router.push(`/map?clientId=${client.id}&clientName=${encodeURIComponent(client.name)}&clientAddress=${encodeURIComponent(client.formatted_address || '')}&lat=${client.lat}&lng=${client.lng}`)}
                >
                  <Ionicons name="navigate-outline" size={18} color="#FFFFFF" />
                  <Text style={styles.mapButtonText}>Ver no Mapa / Navegar</Text>
                </TouchableOpacity>
              ) : (
                <Text style={styles.noGpsText}>GPS não disponível para este cliente</Text>
              )}
            </Section>
          </View>
        )}

        {activeTab === 'agenda' && (
          <View style={styles.emptyContainer}>
            <Ionicons name="calendar-outline" size={48} color="#334155" />
            <Text style={styles.emptyText}>Nenhum agendamento futuro.</Text>
            <TouchableOpacity style={styles.secondaryButton}>
              <Text style={styles.secondaryButtonText}>Novo Agendamento</Text>
            </TouchableOpacity>
          </View>
        )}

        {activeTab === 'historico' && (
          <View style={styles.emptyContainer}>
            <Ionicons name="chatbubbles-outline" size={48} color="#334155" />
            <Text style={styles.emptyText}>Nenhum histórico de atendimento.</Text>
          </View>
        )}
      </ScrollView>
    </View>
  );
}

function TabButton({ label, active, onPress }: any) {
  return (
    <TouchableOpacity 
      style={[styles.tab, active && styles.activeTab]} 
      onPress={onPress}
    >
      <Text style={[styles.tabText, active && styles.activeTabText]}>{label}</Text>
    </TouchableOpacity>
  );
}

function Section({ title, children }: any) {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>{title}</Text>
      <View style={styles.card}>{children}</View>
    </View>
  );
}

function InfoRow({ icon, label, value }: any) {
  return (
    <View style={styles.infoRow}>
      <Ionicons name={icon} size={20} color="#94A3B8" style={{ marginRight: 12 }} />
      <View>
        <Text style={styles.infoLabel}>{label}</Text>
        <Text style={styles.infoValue}>{value}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0F172A',
  },
  center: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  header: {
    alignItems: 'center',
    paddingVertical: 32,
    borderBottomLeftRadius: 32,
    borderBottomRightRadius: 32,
  },
  avatarLarge: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: 'rgba(56, 189, 248, 0.1)',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: 'rgba(56, 189, 248, 0.3)',
    marginBottom: 16,
  },
  avatarTextLarge: {
    color: '#38BDF8',
    fontSize: 32,
    fontWeight: '800',
  },
  headerName: {
    fontSize: 24,
    fontWeight: '800',
    color: '#F8FAFC',
    marginBottom: 20,
  },
  headerActions: {
    flexDirection: 'row',
  },
  actionCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#38BDF8',
    justifyContent: 'center',
    alignItems: 'center',
    marginHorizontal: 8,
  },
  tabBar: {
    flexDirection: 'row',
    backgroundColor: '#1E293B',
    marginHorizontal: 20,
    marginTop: -22,
    borderRadius: 16,
    padding: 6,
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
  },
  tab: {
    flex: 1,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 12,
  },
  activeTab: {
    backgroundColor: '#38BDF8',
  },
  tabText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#94A3B8',
  },
  activeTabText: {
    color: '#FFFFFF',
  },
  content: {
    padding: 20,
    paddingTop: 32,
  },
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#64748B',
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: 12,
    marginLeft: 4,
  },
  card: {
    backgroundColor: '#1E293B',
    borderRadius: 20,
    padding: 16,
    borderWidth: 1,
    borderColor: 'rgba(51, 65, 85, 0.5)',
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  infoLabel: {
    fontSize: 12,
    color: '#64748B',
  },
  infoValue: {
    fontSize: 15,
    color: '#F1F5F9',
    fontWeight: '500',
    marginTop: 2,
  },
  aiToggleCard: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  aiToggleTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#F1F5F9',
  },
  aiToggleDesc: {
    fontSize: 13,
    color: '#94A3B8',
    marginTop: 4,
  },
  toggleBtn: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: '#334155',
  },
  toggleBtnActive: {
    backgroundColor: '#38BDF8',
  },
  toggleBtnText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '800',
  },
  emptyContainer: {
    alignItems: 'center',
    paddingVertical: 40,
  },
  emptyText: {
    color: '#64748B',
    marginTop: 12,
    fontSize: 15,
  },
  secondaryButton: {
    marginTop: 20,
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#38BDF8',
  },
  secondaryButtonText: {
    color: '#38BDF8',
    fontWeight: '600',
  },
  mapButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#D4AF37',
    borderRadius: 12,
    paddingVertical: 14,
    marginTop: 12,
    gap: 8,
  },
  mapButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
  },
  noGpsText: {
    color: '#64748B',
    fontSize: 12,
    textAlign: 'center',
    marginTop: 8,
    fontStyle: 'italic',
  },
});
