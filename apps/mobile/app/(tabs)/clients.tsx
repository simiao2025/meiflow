import React, { useState, useEffect, useRef } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
  TextInput, ActivityIndicator, Animated
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { Typography, useThemeColors } from '../../constants/theme';
import { useClients } from '../../hooks/useClients';
import { ClientCard } from '../../components/crm/ClientCard';
import { ClientFormModal } from '../../components/crm/ClientFormModal';

export default function ClientsScreen() {
  const Colors = useThemeColors();
  const styles = getStyles(Colors);
  const { clients, loading, loadClients } = useClients();
  const [search, setSearch] = useState('');
  const [modalVisible, setModalVisible] = useState(false);
  const [editingClient, setEditingClient] = useState<any | null>(null);
  const fadeAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(fadeAnim, { toValue: 1, duration: 800, useNativeDriver: true }).start();
  }, []);

  const filtered = clients.filter(c => c.name.toLowerCase().includes(search.toLowerCase()));

  const openNewModal = () => {
    setEditingClient(null);
    setModalVisible(true);
  };

  const openEditModal = (client: any) => {
    setEditingClient(client);
    setModalVisible(true);
  };

  const handleModalClose = () => {
    setModalVisible(false);
    setEditingClient(null);
  };

  return (
    <View style={styles.container}>
      <LinearGradient colors={[Colors.bg, '#0B1121']} style={StyleSheet.absoluteFill} />
      <Animated.View style={{ flex: 1, opacity: fadeAnim }}>
        <View style={styles.header}>
           <Text style={styles.eyebrow}>GESTÃO DE RELACIONAMENTO</Text>
           <Text style={styles.h1}>Clientes</Text>
        </View>

        <View style={styles.searchSection}>
           <View style={styles.bezelOuter}>
              <View style={[styles.bezelInner, { padding: 4, flexDirection: 'row', alignItems: 'center' }]}>
                 <Ionicons name="search-outline" size={20} color={Colors.textMuted} style={{ marginLeft: 12 }} />
                 <TextInput 
                    style={styles.searchInput} 
                    placeholder="Pesquisar por nome ou contato..." 
                    placeholderTextColor={Colors.textMuted} 
                    value={search}
                    onChangeText={setSearch}
                 />
              </View>
           </View>
        </View>

        {loading ? <ActivityIndicator color={Colors.primary} size="large" style={{ marginTop: 40 }} /> : (
          <FlatList 
            data={filtered} 
            keyExtractor={item => item.id} 
            contentContainerStyle={styles.list}
            renderItem={({ item, index }) => <ClientCard item={item} index={index} onEdit={openEditModal} />}
            ListEmptyComponent={
              <View style={styles.empty}>
                <Ionicons name="people-outline" size={48} color={Colors.textMuted} />
                <Text style={styles.emptyText}>Nenhum cliente na base</Text>
              </View>
            }
            refreshing={loading}
            onRefresh={loadClients}
          />
        )}

        <TouchableOpacity style={styles.fab} onPress={openNewModal}>
           <LinearGradient colors={[Colors.primary, Colors.primaryLight]} style={styles.fabGrad}>
              <Ionicons name="person-add" size={24} color="#FFF" />
           </LinearGradient>
        </TouchableOpacity>
      </Animated.View>

      <ClientFormModal 
        visible={modalVisible} 
        onClose={handleModalClose} 
        editingClient={editingClient}
      />
    </View>
  );
}

const getStyles = (Colors: any) => StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.bg },
  header: { padding: 24, paddingTop: 60 },
  eyebrow: { color: Colors.primary, fontFamily: Typography.fonts.medium, fontSize: 10, letterSpacing: 2, marginBottom: 8 },
  h1: { color: Colors.text, fontFamily: Typography.fonts.display, fontSize: 32 },
  searchSection: { paddingHorizontal: 24, marginBottom: 24 },
  searchInput: { flex: 1, color: Colors.text, fontFamily: Typography.fonts.body, fontSize: 15, padding: 12 },
  list: { paddingHorizontal: 24, paddingBottom: 140 },
  empty: { alignItems: 'center', marginTop: 60 },
  emptyText: { color: Colors.textMuted, fontSize: 14, fontFamily: Typography.fonts.medium, marginTop: 12 },
  bezelOuter: { backgroundColor: 'rgba(255,255,255,0.03)', borderRadius: 24, padding: 1.5, borderWidth: 0.5, borderColor: 'rgba(255,255,255,0.08)' },
  bezelInner: { backgroundColor: '#0F172A', borderRadius: 22.5, padding: 20 },
  fab: { position: 'absolute', right: 24, bottom: 110, zIndex: 10 },
  fabGrad: { width: 56, height: 56, borderRadius: 28, justifyContent: 'center', alignItems: 'center', shadowColor: Colors.primary, shadowOpacity: 0.3, shadowRadius: 10, elevation: 5 },
});