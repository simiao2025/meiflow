import React, { useState, useEffect } from 'react';
import { View, Text, TextInput, TouchableOpacity, ScrollView, StyleSheet, ActivityIndicator, Alert, Modal, KeyboardAvoidingView, Platform } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
import { Ionicons } from '@expo/vector-icons';
import { Typography, useThemeColors } from '../../constants/theme';
import { useClients } from '../../hooks/useClients';

interface ClientFormModalProps {
  visible: boolean;
  onClose: () => void;
  editingClient?: any | null;
}

export function ClientFormModal({ visible, onClose, editingClient }: ClientFormModalProps) {
  const Colors = useThemeColors();
  const styles = getStyles(Colors);
  const { saveClient } = useClients();

  const [personType, setPersonType] = useState<'pf' | 'pj'>('pf');
  const [name, setName] = useState('');
  const [document, setDocument] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [cep, setCep] = useState('');
  const [street, setStreet] = useState('');
  const [number, setNumber] = useState('');
  const [neighborhood, setNeighborhood] = useState('');
  const [city, setCity] = useState('');
  const [state, setState] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [isFetchingCep, setIsFetchingCep] = useState(false);

  useEffect(() => {
    if (editingClient) {
      setName(editingClient.name || '');
      setDocument(editingClient.document || '');
      setPhone(editingClient.phone || '');
      setEmail(editingClient.email || '');
      setPersonType(editingClient.person_type || 'pf');
      parseAddress(editingClient.formatted_address);
    } else {
      resetForm();
    }
  }, [editingClient, visible]);

  const parseAddress = (formattedAddress?: string) => {
    if (!formattedAddress) return;
    const parts = formattedAddress.split(',').map((s: string) => s.trim());
    if (parts.length >= 4) {
      const streetNumber = parts[0].split('-').map((s: string) => s.trim());
      setStreet(streetNumber[0] || '');
      setNumber(streetNumber[1] || '');
      setNeighborhood(parts[1] || '');
      setCity(parts[2] || '');
      if (parts.length >= 5) {
        const stateZip = parts[parts.length - 2].split('-').map((s: string) => s.trim());
        setState(stateZip[0] || '');
        setCep(parts[parts.length - 1] || '');
      }
    }
  };

  const resetForm = () => {
    setName('');
    setDocument('');
    setPhone('');
    setEmail('');
    setCep('');
    setStreet('');
    setNumber('');
    setNeighborhood('');
    setCity('');
    setState('');
    setPersonType('pf');
  };

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
    setDocument(masked);
  };

  const fetchAddressByCep = async (cepText: string) => {
    const cleanCep = cepText.replace(/\D/g, '');
    setCep(cepText);
    
    if (cleanCep.length === 8) {
      setIsFetchingCep(true);
      try {
        const response = await fetch(`https://viacep.com.br/ws/${cleanCep}/json/`);
        const data = await response.json();
        
        if (!data.erro) {
          setStreet(data.logradouro || '');
          setNeighborhood(data.bairro || '');
          setCity(data.localidade || '');
          setState(data.uf || '');
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

  const handleSave = async () => {
    if (!name.trim() || !document.trim() || !phone.trim() || !email.trim() || !cep.trim() || !street.trim() || !number.trim()) {
      Alert.alert('Atenção', 'Nome, CPF/CNPJ, WhatsApp, E-mail e Endereço completo são obrigatórios.');
      return;
    }

    setIsSaving(true);
    const formattedAddress = `${street}, ${number} - ${neighborhood}, ${city} - ${state}, ${cep}`;
    
    const success = await saveClient({
      name,
      document,
      email,
      phone,
      whatsapp_number: phone,
      person_type: personType,
      formatted_address: formattedAddress,
      city,
      state,
    }, editingClient?.id);

    if (success) {
      onClose();
      resetForm();
    } else {
      Alert.alert('Erro', 'Não foi possível salvar o cliente.');
    }
    setIsSaving(false);
  };

  const handleClose = () => {
    onClose();
    resetForm();
  };

  return (
    <Modal visible={visible} transparent animationType="slide">
      <View style={styles.modalOverlay}>
        <BlurView intensity={20} tint="dark" style={StyleSheet.absoluteFill} />
        <KeyboardAvoidingView
          style={{ flex: 1, justifyContent: 'flex-end' }}
          behavior='padding' keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : -300}
        >
        <View style={styles.modalContent}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>{editingClient ? 'Editar Cliente' : 'Novo Cliente'}</Text>
            <TouchableOpacity onPress={handleClose} style={styles.closeBtn}>
              <Ionicons name="close" size={24} color={Colors.textMuted} />
            </TouchableOpacity>
          </View>

          <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 24 }} keyboardShouldPersistTaps="handled">
            <Text style={styles.sectionHeading}>Dados Pessoais</Text>

            <View style={styles.typeSelector}>
              <TouchableOpacity 
                style={[styles.typeBtn, personType === 'pf' && styles.typeBtnActive]}
                onPress={() => setPersonType('pf')}
              >
                <Ionicons name="person-outline" size={16} color={personType === 'pf' ? Colors.text : Colors.textMuted} />
                <Text style={[styles.typeBtnText, personType === 'pf' && {color: Colors.text}]}>Pessoa Física</Text>
              </TouchableOpacity>
              <TouchableOpacity 
                style={[styles.typeBtn, personType === 'pj' && styles.typeBtnActive]}
                onPress={() => setPersonType('pj')}
              >
                <Ionicons name="business-outline" size={16} color={personType === 'pj' ? Colors.text : Colors.textMuted} />
                <Text style={[styles.typeBtnText, personType === 'pj' && {color: Colors.text}]}>Pessoa Jurídica</Text>
              </TouchableOpacity>
            </View>

            <Text style={styles.inputLabel}>{personType === 'pf' ? 'Nome Completo *' : 'Razão Social *'}</Text>
            <TextInput style={styles.input} placeholder={personType === 'pf' ? 'Ex: João da Silva' : 'Ex: Silva Consultoria LTDA'} placeholderTextColor="#475569" value={name} onChangeText={setName} />

            <Text style={styles.inputLabel}>{personType === 'pf' ? 'CPF *' : 'CNPJ *'}</Text>
            <TextInput style={styles.input} placeholder={personType === 'pf' ? '000.000.000-00' : '00.000.000/0000-00'} placeholderTextColor="#475569" keyboardType="number-pad" value={document} onChangeText={handleDocumentChange} maxLength={personType === 'pf' ? 14 : 18} />

            <Text style={styles.inputLabel}>WhatsApp *</Text>
            <TextInput style={styles.input} placeholder="(11) 99999-9999" placeholderTextColor="#475569" keyboardType="phone-pad" value={phone} onChangeText={setPhone} />

            <Text style={styles.inputLabel}>E-mail *</Text>
            <TextInput style={styles.input} placeholder="email@exemplo.com" placeholderTextColor="#475569" keyboardType="email-address" autoCapitalize="none" value={email} onChangeText={setEmail} />

            <Text style={styles.sectionHeading}>Endereço Completo</Text>
            
            <View style={{flexDirection: 'row', gap: 12}}>
              <View style={{flex: 1}}>
                <Text style={styles.inputLabel}>CEP *</Text>
                <View style={{flexDirection: 'row', alignItems: 'center'}}>
                  <TextInput style={[styles.input, {flex: 1}]} placeholder="00000-000" placeholderTextColor="#475569" keyboardType="number-pad" value={cep} onChangeText={fetchAddressByCep} maxLength={9} />
                  {isFetchingCep && <ActivityIndicator color={Colors.primary} style={{position: 'absolute', right: 12, top: 18}} />}
                </View>
              </View>
              <View style={{flex: 1}}>
                <Text style={styles.inputLabel}>Bairro</Text>
                <TextInput style={styles.input} placeholder="Bairro" placeholderTextColor="#475569" value={neighborhood} onChangeText={setNeighborhood} />
              </View>
            </View>

            <Text style={styles.inputLabel}>Rua / Logradouro *</Text>
            <TextInput style={styles.input} placeholder="Nome da rua" placeholderTextColor="#475569" value={street} onChangeText={setStreet} />

            <Text style={styles.inputLabel}>Número *</Text>
            <TextInput style={styles.input} placeholder="123" placeholderTextColor="#475569" keyboardType="number-pad" value={number} onChangeText={setNumber} />

            <View style={{flexDirection: 'row', gap: 12}}>
              <View style={{flex: 2}}>
                <Text style={styles.inputLabel}>Cidade</Text>
                <TextInput style={styles.input} placeholder="Cidade" placeholderTextColor="#475569" value={city} onChangeText={setCity} />
              </View>
              <View style={{flex: 1}}>
                <Text style={styles.inputLabel}>Estado (UF)</Text>
                <TextInput style={styles.input} placeholder="SP" placeholderTextColor="#475569" autoCapitalize="characters" maxLength={2} value={state} onChangeText={setState} />
              </View>
            </View>

            <TouchableOpacity style={[styles.saveBtn, isSaving && {opacity: 0.7}, {marginTop: 12}]} onPress={handleSave} disabled={isSaving}>
              <LinearGradient colors={[Colors.primary, Colors.primaryLight]} style={styles.saveBtnGrad}>
                {isSaving ? <ActivityIndicator color="#FFF" /> : <Text style={styles.saveBtnText}>Salvar Cliente Completo</Text>}
              </LinearGradient>
            </TouchableOpacity>
          </ScrollView>
        </View>
        </KeyboardAvoidingView>
      </View>
    </Modal>
  );
}

const getStyles = (C: any) => StyleSheet.create({
  modalOverlay: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.5)' },
  modalContent: { backgroundColor: '#0F172A', borderTopLeftRadius: 32, borderTopRightRadius: 32, padding: 24, paddingBottom: 24, borderWidth: 1, borderColor: 'rgba(255,255,255,0.05)', maxHeight: '85%' },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  modalTitle: { color: C.text, fontSize: 18, fontFamily: Typography.fonts.display },
  closeBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: 'rgba(255,255,255,0.05)', justifyContent: 'center', alignItems: 'center' },
  typeSelector: { flexDirection: 'row', backgroundColor: 'rgba(255,255,255,0.03)', borderRadius: 12, padding: 4, marginBottom: 16 },
  typeBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 10, borderRadius: 8, gap: 6 },
  typeBtnActive: { backgroundColor: '#1E293B', shadowColor: '#000', shadowOpacity: 0.2, shadowRadius: 4, elevation: 2 },
  typeBtnText: { color: C.textMuted, fontSize: 12, fontFamily: Typography.fonts.medium },
  sectionHeading: { color: C.primary, fontSize: 13, fontFamily: Typography.fonts.display, marginTop: 16, marginBottom: 12, borderBottomWidth: 0.5, borderBottomColor: 'rgba(212,175,55,0.2)', paddingBottom: 6 },
  inputLabel: { color: C.textMuted, fontSize: 12, fontFamily: Typography.fonts.medium, marginBottom: 8, marginLeft: 4 },
  input: { backgroundColor: '#1E293B', borderRadius: 12, padding: 14, color: C.text, fontFamily: Typography.fonts.medium, fontSize: 14, marginBottom: 12, borderWidth: 1, borderColor: '#334155' },
  saveBtn: { marginTop: 8, borderRadius: 12, overflow: 'hidden' },
  saveBtnGrad: { paddingVertical: 18, alignItems: 'center' },
  saveBtnText: { color: '#FFF', fontSize: 14, fontFamily: Typography.fonts.display },
});