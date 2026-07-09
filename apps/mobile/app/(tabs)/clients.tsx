import React, { useState, useEffect, useRef } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
  TextInput, ActivityIndicator, Animated, Linking, Modal, Alert, ScrollView, KeyboardAvoidingView, Platform
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
import { Ionicons } from '@expo/vector-icons';
import * as Location from 'expo-location';
import { useAuthStore } from '../../stores/authStore';
import { supabase } from '../../services/supabase';
import { Typography, Palette, useThemeColors } from '../../constants/theme';

export default function ClientsScreen() {
  const Colors = useThemeColors();
  const styles = getStyles(Colors);
  const { user } = useAuthStore();
  const [clients, setClients] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [modalVisible, setModalVisible] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [newClientName, setNewClientName] = useState('');
  const [newClientPhone, setNewClientPhone] = useState('');
  const [newClientDocument, setNewClientDocument] = useState('');
  const [personType, setPersonType] = useState<'pf' | 'pj'>('pf');
  const [newClientEmail, setNewClientEmail] = useState('');
  const [newClientCep, setNewClientCep] = useState('');
  const [newClientStreet, setNewClientStreet] = useState('');
  const [newClientNumber, setNewClientNumber] = useState('');
  const [newClientNeighborhood, setNewClientNeighborhood] = useState('');
  const [newClientCity, setNewClientCity] = useState('');
  const [newClientState, setNewClientState] = useState('');
  const [editingClientId, setEditingClientId] = useState<string | null>(null);
  const [isFetchingCep, setIsFetchingCep] = useState(false);

  const fadeAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    loadClients();
    Animated.timing(fadeAnim, { toValue: 1, duration: 800, useNativeDriver: true }).start();
  }, []);

  const loadClients = async () => {
    if (!user) return;
    setLoading(true);
    const { data } = await supabase.from('clients').select('*').eq('user_id', user.id).order('name', { ascending: true });
    if (data) setClients(data);
    setLoading(false);
  };

  const filtered = clients.filter(c => c.name.toLowerCase().includes(search.toLowerCase()));

  const maskCpf = (value: string) => {
    const digits = value.replace(/\D/g, '').slice(0, 11);
    return digits
      .replace(/(\d{3})(\d)/, '$1.$2')
      .replace(/(\d{3})(\d)/, '$1.$2')
      .replace(/(\d{3})(\d{1,2})$/, '$1-$2');
  };

  const maskCnpj = (value: string) => {
    const digits = value.replace(/\D/g, '').slice(0, 14);
    return digits
      .replace(/(\d{2})(\d)/, '$1.$2')
      .replace(/(\d{3})(\d)/, '$1.$2')
      .replace(/(\d{3})(\d)/, '$1/$2')
      .replace(/(\d{4})(\d{1,2})$/, '$1-$2');
  };

  const handleDocumentChange = (text: string) => {
    const masked = personType === 'pf' ? maskCpf(text) : maskCnpj(text);
    setNewClientDocument(masked);
  };

  const handlePersonTypeChange = (type: 'pf' | 'pj') => {
    setPersonType(type);
    setNewClientDocument('');
  };

  const fetchAddressByCep = async (cepText: string) => {
    const cleanCep = cepText.replace(/\D/g, '');
    setNewClientCep(cepText);
    
    if (cleanCep.length === 8) {
      setIsFetchingCep(true);
      try {
        const response = await fetch(`https://viacep.com.br/ws/${cleanCep}/json/`);
        const data = await response.json();
        
        if (!data.erro) {
          setNewClientStreet(data.logradouro || '');
          setNewClientNeighborhood(data.bairro || '');
          setNewClientCity(data.localidade || '');
          setNewClientState(data.uf || '');
        } else {
          Alert.alert('CEP não encontrado', 'Verifique se o CEP digitado está correto.');
        }
      } catch (e) {
        console.error('Erro ao buscar CEP', e);
      } finally {
        setIsFetchingCep(false);
      }
    }
  };

  const handleSaveClient = async () => {
    if (!user) return;
    if (!newClientName.trim() || !newClientDocument.trim() || !newClientPhone.trim() || !newClientEmail.trim() || !newClientCep.trim() || !newClientStreet.trim() || !newClientNumber.trim()) {
      Alert.alert('Atenção', 'Nome, CPF/CNPJ, WhatsApp, E-mail e Endereço completo são obrigatórios.');
      return;
    }
    
    setIsSaving(true);
    
    const formattedAddress = `${newClientStreet}, ${newClientNumber} - ${newClientNeighborhood}, ${newClientCity} - ${newClientState}, ${newClientCep}`;
    
    let clientLat: number | null = null;
    let clientLng: number | null = null;
    try {
      let geocoded = await Location.geocodeAsync(formattedAddress);
      if (!geocoded || geocoded.length === 0) {
        geocoded = await Location.geocodeAsync(`${newClientCity} - ${newClientState}`);
      }
      if (geocoded && geocoded.length > 0) {
        clientLat = geocoded[0].latitude;
        clientLng = geocoded[0].longitude;
      }
    } catch (geoError) {
      console.warn('Expo Geocoding falhou, tentando fallback:', geoError);
    }

    // Fallback absoluto: OpenStreetMap (Nominatim) se o Google Play Services falhar
    if (!clientLat || !clientLng) {
      try {
        console.log('Tentando geocodificação via OpenStreetMap...');
        const query = encodeURIComponent(`${newClientStreet}, ${newClientNumber}, ${newClientCity}, ${newClientState}`);
        const response = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${query}&limit=1`, {
          headers: { 'User-Agent': 'MEIFlowApp/1.0' }
        });
        const data = await response.json();
        
        if (data && data.length > 0) {
          clientLat = parseFloat(data[0].lat);
          clientLng = parseFloat(data[0].lon);
        } else {
          // Fallback apenas para a cidade
          const cityQuery = encodeURIComponent(`${newClientCity}, ${newClientState}, Brasil`);
          const cityRes = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${cityQuery}&limit=1`, {
            headers: { 'User-Agent': 'MEIFlowApp/1.0' }
          });
          const cityData = await cityRes.json();
          if (cityData && cityData.length > 0) {
            clientLat = parseFloat(cityData[0].lat);
            clientLng = parseFloat(cityData[0].lon);
          }
        }
      } catch (osmError) {
        console.warn('OSM Geocoding também falhou:', osmError);
      }
    }
    
    let error;
    if (editingClientId) {
      const { error: updateError } = await supabase.from('clients').update({
        name: newClientName,
        document: newClientDocument,
        email: newClientEmail,
        phone: newClientPhone,
        whatsapp_number: newClientPhone,
        person_type: personType,
        formatted_address: formattedAddress,
        lat: clientLat,
        lng: clientLng,
      }).eq('id', editingClientId);
      error = updateError;
    } else {
      const { error: insertError } = await supabase.from('clients').insert({
        user_id: user.id,
        name: newClientName,
        document: newClientDocument,
        email: newClientEmail,
        phone: newClientPhone,
        whatsapp_number: newClientPhone,
        person_type: personType,
        formatted_address: formattedAddress,
        lat: clientLat,
        lng: clientLng,
      });
      error = insertError;
    }

    if (error) {
      console.error(error);
      Alert.alert('Erro', 'Não foi possível salvar o cliente.');
    } else {
      setModalVisible(false);
      setNewClientName('');
      setNewClientPhone('');
      setNewClientDocument('');
      setNewClientEmail('');
      setNewClientCep('');
      setNewClientStreet('');
      setNewClientNumber('');
      setNewClientNeighborhood('');
      setNewClientCity('');
      setNewClientState('');
      setNewClientDocument('');
      setPersonType('pf');
      setEditingClientId(null);
      loadClients();
    }
    setIsSaving(false);
  };

  const openEditModal = (client: any) => {
    setEditingClientId(client.id);
    setNewClientName(client.name || '');
    setNewClientPhone(client.phone || '');
    setNewClientDocument(client.document || '');
    setNewClientEmail(client.email || '');
    setPersonType(client.person_type || 'pf');
    
    setNewClientStreet('');
    setNewClientNumber('');
    setNewClientNeighborhood('');
    setNewClientCity('');
    setNewClientState('');
    setNewClientCep('');

    if (client.formatted_address) {
      const parts = client.formatted_address.split(',').map((s: string) => s.trim());
      if (parts.length >= 4) {
        const streetNumber = parts[0].split('-').map((s: string) => s.trim());
        setNewClientStreet(streetNumber[0] || '');
        setNewClientNumber(streetNumber[1] || '');
        setNewClientNeighborhood(parts[1] || '');
        setNewClientCity(parts[2] || '');
        if (parts.length >= 5) {
          const stateZip = parts[parts.length - 2].split('-').map((s: string) => s.trim());
          setNewClientState(stateZip[0] || '');
          setNewClientCep(parts[parts.length - 1] || '');
        }
      }
    }
    setModalVisible(true);
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
          />
        )}

        <TouchableOpacity style={styles.fab} onPress={() => setModalVisible(true)}>
           <LinearGradient colors={[Colors.primary, Colors.primaryLight]} style={styles.fabGrad}>
              <Ionicons name="person-add" size={24} color="#FFF" />
           </LinearGradient>
        </TouchableOpacity>
      </Animated.View>

      {/* Modal de Cadastro de Cliente */}
      <Modal visible={modalVisible} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <BlurView intensity={20} tint="dark" style={StyleSheet.absoluteFill} />
          <KeyboardAvoidingView
            style={{ flex: 1, justifyContent: 'flex-end' }}
            behavior='padding' keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : -300}
          >
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>{editingClientId ? 'Editar Cliente' : 'Novo Cliente'}</Text>
              <TouchableOpacity onPress={() => {
                setModalVisible(false);
                setEditingClientId(null);
              }} style={styles.closeBtn}>
                <Ionicons name="close" size={24} color={Colors.textMuted} />
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 24 }} keyboardShouldPersistTaps="handled">
              <Text style={styles.sectionHeading}>Dados Pessoais</Text>

              <View style={styles.typeSelector}>
                <TouchableOpacity 
                  style={[styles.typeBtn, personType === 'pf' && styles.typeBtnActive]}
                  onPress={() => handlePersonTypeChange('pf')}
                >
                  <Ionicons name="person-outline" size={16} color={personType === 'pf' ? Colors.text : Colors.textMuted} />
                  <Text style={[styles.typeBtnText, personType === 'pf' && {color: Colors.text}]}>Pessoa Física</Text>
                </TouchableOpacity>
                <TouchableOpacity 
                  style={[styles.typeBtn, personType === 'pj' && styles.typeBtnActive]}
                  onPress={() => handlePersonTypeChange('pj')}
                >
                  <Ionicons name="business-outline" size={16} color={personType === 'pj' ? Colors.text : Colors.textMuted} />
                  <Text style={[styles.typeBtnText, personType === 'pj' && {color: Colors.text}]}>Pessoa Jurídica</Text>
                </TouchableOpacity>
              </View>

              <Text style={styles.inputLabel}>{personType === 'pf' ? 'Nome Completo *' : 'Razão Social *'}</Text>
              <TextInput style={styles.input} placeholder={personType === 'pf' ? 'Ex: João da Silva' : 'Ex: Silva Consultoria LTDA'} placeholderTextColor="#475569" value={newClientName} onChangeText={setNewClientName} />

              <Text style={styles.inputLabel}>{personType === 'pf' ? 'CPF *' : 'CNPJ *'}</Text>
              <TextInput style={styles.input} placeholder={personType === 'pf' ? '000.000.000-00' : '00.000.000/0000-00'} placeholderTextColor="#475569" keyboardType="number-pad" value={newClientDocument} onChangeText={handleDocumentChange} maxLength={personType === 'pf' ? 14 : 18} />

              <Text style={styles.inputLabel}>WhatsApp *</Text>
              <TextInput style={styles.input} placeholder="(11) 99999-9999" placeholderTextColor="#475569" keyboardType="phone-pad" value={newClientPhone} onChangeText={setNewClientPhone} />

              <Text style={styles.inputLabel}>E-mail *</Text>
              <TextInput style={styles.input} placeholder="email@exemplo.com" placeholderTextColor="#475569" keyboardType="email-address" autoCapitalize="none" value={newClientEmail} onChangeText={setNewClientEmail} />

              <Text style={styles.sectionHeading}>Endereço Completo</Text>
              
              <View style={{flexDirection: 'row', gap: 12}}>
                <View style={{flex: 1}}>
                  <Text style={styles.inputLabel}>CEP *</Text>
                  <View style={{flexDirection: 'row', alignItems: 'center'}}>
                    <TextInput style={[styles.input, {flex: 1}]} placeholder="00000-000" placeholderTextColor="#475569" keyboardType="number-pad" value={newClientCep} onChangeText={fetchAddressByCep} maxLength={9} />
                    {isFetchingCep && <ActivityIndicator color={Colors.primary} style={{position: 'absolute', right: 12, top: 18}} />}
                  </View>
                </View>
                <View style={{flex: 1}}>
                  <Text style={styles.inputLabel}>Bairro</Text>
                  <TextInput style={styles.input} placeholder="Bairro" placeholderTextColor="#475569" value={newClientNeighborhood} onChangeText={setNewClientNeighborhood} />
                </View>
              </View>

              <Text style={styles.inputLabel}>Rua / Logradouro *</Text>
              <TextInput style={styles.input} placeholder="Nome da rua" placeholderTextColor="#475569" value={newClientStreet} onChangeText={setNewClientStreet} />

              <Text style={styles.inputLabel}>Número *</Text>
              <TextInput style={styles.input} placeholder="123" placeholderTextColor="#475569" keyboardType="number-pad" value={newClientNumber} onChangeText={setNewClientNumber} />

              <View style={{flexDirection: 'row', gap: 12}}>
                <View style={{flex: 2}}>
                  <Text style={styles.inputLabel}>Cidade</Text>
                  <TextInput style={styles.input} placeholder="Cidade" placeholderTextColor="#475569" value={newClientCity} onChangeText={setNewClientCity} />
                </View>
                <View style={{flex: 1}}>
                  <Text style={styles.inputLabel}>Estado (UF)</Text>
                  <TextInput style={styles.input} placeholder="SP" placeholderTextColor="#475569" autoCapitalize="characters" maxLength={2} value={newClientState} onChangeText={setNewClientState} />
                </View>
              </View>

              <TouchableOpacity style={[styles.saveBtn, isSaving && {opacity: 0.7}, {marginTop: 12}]} onPress={handleSaveClient} disabled={isSaving}>
                <LinearGradient colors={[Colors.primary, Colors.primaryLight]} style={styles.saveBtnGrad}>
                  {isSaving ? <ActivityIndicator color="#FFF" /> : <Text style={styles.saveBtnText}>Salvar Cliente Completo</Text>}
                </LinearGradient>
              </TouchableOpacity>
            </ScrollView>
          </View>
          </KeyboardAvoidingView>
        </View>
      </Modal>
    </View>
  );
}

import { useRouter } from 'expo-router';

function ClientCard({ item, index, onEdit }: any) {
  const Colors = useThemeColors();
  const styles = getStyles(Colors);
  const itemAnim = useRef(new Animated.Value(0)).current;
  const router = useRouter();

  useEffect(() => {
    Animated.timing(itemAnim, { toValue: 1, duration: 600, delay: index * 50, useNativeDriver: true }).start();
  }, []);

  const openWhatsApp = (phone: string) => {
    const cleanPhone = phone.replace(/\D/g, '');
    Linking.openURL(`whatsapp://send?phone=55${cleanPhone}`);
  };

  const openMap = () => {
    if (!item.lat || !item.lng) {
      Alert.alert('GPS indisponível', 'Este cliente não possui coordenadas GPS. Edite o cadastro para atualizar o endereço.');
      return;
    }
    router.push(`/map?clientId=${item.id}&clientName=${encodeURIComponent(item.name)}&clientAddress=${encodeURIComponent(item.formatted_address || 'Endereço não informado')}&lat=${item.lat}&lng=${item.lng}`);
  };

  return (
    <Animated.View style={[styles.bezelOuter, { marginBottom: 16, opacity: itemAnim, transform: [{ translateY: itemAnim.interpolate({ inputRange: [0, 1], outputRange: [20, 0] }) }] }]}>
      <TouchableOpacity 
        activeOpacity={0.8} 
        onPress={() => router.push(`/client-details?id=${item.id}`)}
        style={styles.bezelInner}
      >
         <View style={styles.cardTop}>
            <View style={styles.avatar}>
               <Text style={styles.avatarText}>{item.name.charAt(0).toUpperCase()}</Text>
            </View>
            <View style={{ flex: 1, marginLeft: 16 }}>
               <Text style={styles.clientName}>{item.name}</Text>
               <Text style={styles.clientSub}>{item.whatsapp_number || 'Sem contato'}</Text>
            </View>
            <TouchableOpacity style={[styles.actionButton, { marginRight: 8 }]} onPress={() => onEdit(item)}>
               <Ionicons name="create-outline" size={18} color="#FBBF24" />
            </TouchableOpacity>
            <TouchableOpacity style={[styles.actionButton, { marginRight: 8 }]} onPress={openMap}>
               <Ionicons name="map" size={18} color="#7DD3FC" />
            </TouchableOpacity>
            <TouchableOpacity style={styles.actionButton} onPress={() => item.whatsapp_number && openWhatsApp(item.whatsapp_number)}>
               <Ionicons name="logo-whatsapp" size={18} color={Colors.primary} />
            </TouchableOpacity>
         </View>
         
         <View style={styles.cardFooter}>
            <View style={styles.stat}>
               <Text style={styles.statLabel}>RECEITA</Text>
               <Text style={styles.statVal}>R$ {item.total_revenue?.toFixed(2).replace('.', ',') || '0,00'}</Text>
            </View>
            <View style={styles.detailsBtn}>
               <Text style={styles.detailsText}>HISTÓRICO</Text>
               <Ionicons name="arrow-forward" size={12} color={Colors.primary} />
            </View>
         </View>
      </TouchableOpacity>
    </Animated.View>
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
  bezelOuter: { backgroundColor: 'rgba(255,255,255,0.03)', borderRadius: 24, padding: 1.5, borderWidth: 0.5, borderColor: 'rgba(255,255,255,0.08)' },
  bezelInner: { backgroundColor: '#0F172A', borderRadius: 22.5, padding: 20 },
  cardTop: { flexDirection: 'row', alignItems: 'center' },
  avatar: { width: 44, height: 44, borderRadius: 14, backgroundColor: Colors.primaryMuted, justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: Colors.primary + '30' },
  avatarText: { color: Colors.primary, fontFamily: Typography.fonts.display, fontSize: 18 },
  clientName: { color: Colors.text, fontSize: 16, fontFamily: Typography.fonts.display },
  clientSub: { color: Colors.textMuted, fontSize: 12, fontFamily: Typography.fonts.medium, marginTop: 2 },
  actionButton: { width: 36, height: 36, borderRadius: 10, backgroundColor: 'rgba(255,255,255,0.03)', justifyContent: 'center', alignItems: 'center', borderWidth: 0.5, borderColor: 'rgba(255,255,255,0.1)' },
  cardFooter: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 16, paddingTop: 16, borderTopWidth: 0.5, borderTopColor: 'rgba(255,255,255,0.1)' },
  stat: { flex: 1 },
  statLabel: { color: Colors.textMuted, fontSize: 8, fontFamily: Typography.fonts.medium, letterSpacing: 1 },
  statVal: { color: Colors.primary, fontSize: 16, fontFamily: Typography.fonts.display, marginTop: 2 },
  detailsBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: 'rgba(16, 185, 129, 0.1)', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8 },
  detailsText: { color: Colors.primary, fontSize: 10, fontFamily: Typography.fonts.display },
  empty: { alignItems: 'center', marginTop: 60 },
  emptyText: { color: Colors.textMuted, fontSize: 14, fontFamily: Typography.fonts.medium, marginTop: 12 },
  fab: { position: 'absolute', right: 24, bottom: 110, zIndex: 10 },
  fabGrad: { width: 56, height: 56, borderRadius: 28, justifyContent: 'center', alignItems: 'center', shadowColor: Colors.primary, shadowOpacity: 0.3, shadowRadius: 10, elevation: 5 },
  
  modalOverlay: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.5)' },
  modalContent: { backgroundColor: '#0F172A', borderTopLeftRadius: 32, borderTopRightRadius: 32, padding: 24, paddingBottom: 24, borderWidth: 1, borderColor: 'rgba(255,255,255,0.05)', maxHeight: '85%' },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  modalTitle: { color: Colors.text, fontSize: 18, fontFamily: Typography.fonts.display },
  closeBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: 'rgba(255,255,255,0.05)', justifyContent: 'center', alignItems: 'center' },
  typeSelector: { flexDirection: 'row', backgroundColor: 'rgba(255,255,255,0.03)', borderRadius: 12, padding: 4, marginBottom: 16 },
  typeBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 10, borderRadius: 8, gap: 6 },
  typeBtnActive: { backgroundColor: '#1E293B', shadowColor: '#000', shadowOpacity: 0.2, shadowRadius: 4, elevation: 2 },
  typeBtnText: { color: Colors.textMuted, fontSize: 12, fontFamily: Typography.fonts.medium },
  sectionHeading: { color: Colors.primary, fontSize: 13, fontFamily: Typography.fonts.display, marginTop: 16, marginBottom: 12, borderBottomWidth: 0.5, borderBottomColor: 'rgba(212,175,55,0.2)', paddingBottom: 6 },
  inputLabel: { color: Colors.textMuted, fontSize: 12, fontFamily: Typography.fonts.medium, marginBottom: 8, marginLeft: 4 },
  input: { backgroundColor: '#1E293B', borderRadius: 12, padding: 14, color: Colors.text, fontFamily: Typography.fonts.medium, fontSize: 14, marginBottom: 12, borderWidth: 1, borderColor: '#334155' },
  saveBtn: { marginTop: 8, borderRadius: 12, overflow: 'hidden' },
  saveBtnGrad: { paddingVertical: 18, alignItems: 'center' },
  saveBtnText: { color: '#FFF', fontSize: 14, fontFamily: Typography.fonts.display },
});
