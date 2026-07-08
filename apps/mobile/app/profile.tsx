import { Colors } from '../constants/theme';
import React, { useState, useEffect } from 'react';
import { 
  View, 
  Text, 
  TextInput, 
  TouchableOpacity, 
  StyleSheet, 
  ScrollView,
  KeyboardAvoidingView, 
  Platform,
  ActivityIndicator,
  Alert
} from 'react-native';
import { useRouter, Stack } from 'expo-router';
import { supabase } from '../services/supabase';
import { useAuthStore } from '../stores/authStore';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';

export default function ProfileScreen() {
  const { user, profile, refreshProfile, signOut } = useAuthStore();
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  // Estados dos campos
  const [fullName, setFullName] = useState(profile?.full_name || '');
  const [cpf, setCpf] = useState(profile?.cpf || '');
  const [cnpj, setCnpj] = useState(profile?.cnpj || '');
  const [razaoSocial, setRazaoSocial] = useState(profile?.razao_social || '');
  const [fantasyName, setFantasyName] = useState(profile?.nome_fantasia || '');
  const [activity, setActivity] = useState(profile?.atividade_cnae || '');
  
  const [cep, setCep] = useState(profile?.endereco?.cep || '');
  const [street, setStreet] = useState(profile?.endereco?.logradouro || '');
  const [city, setCity] = useState(profile?.endereco?.cidade || '');
  const [uf, setUf] = useState(profile?.endereco?.uf || '');

  const handleUpdateProfile = async () => {
    setLoading(true);
    const { error } = await supabase
      .from('profiles')
      .update({
        full_name: fullName,
        cpf,
        cnpj,
        razao_social: razaoSocial,
        nome_fantasia: fantasyName,
        atividade_cnae: activity,
        endereco: {
          cep,
          logradouro: street,
          cidade: city,
          uf: uf.toUpperCase()
        },
        updated_at: new Date().toISOString(),
      })
      .eq('id', user?.id);

    if (error) {
      Alert.alert('Erro ao atualizar', error.message);
      setLoading(false);
    } else {
      await refreshProfile();
      Alert.alert('Sucesso', 'Perfil atualizado com sucesso!');
      setLoading(false);
    }
  };

  const handleLogout = async () => {
    Alert.alert(
      'Sair',
      'Tem certeza que deseja sair da sua conta?',
      [
        { text: 'Cancelar', style: 'cancel' },
        { 
          text: 'Sair', 
          style: 'destructive',
          onPress: async () => {
            await signOut();
            router.replace('/auth/login');
          }
        },
      ]
    );
  };

  const SectionTitle = ({ icon, title }: { icon: any, title: string }) => (
    <View style={styles.sectionHeader}>
      <Ionicons name={icon} size={20} color={Colors.primary} style={{ marginRight: 8 }} />
      <Text style={styles.sectionTitle}>{title}</Text>
    </View>
  );

  return (
    <LinearGradient colors={[Colors.bg, '#1E293B']} style={styles.container}>
      <Stack.Screen options={{ title: 'Meu Perfil', headerShown: true, headerTintColor: '#FFF', headerStyle: { backgroundColor: Colors.bg } }} />
      
      <KeyboardAvoidingView 
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={{ flex: 1 }}
      >
        <ScrollView contentContainerStyle={styles.scrollContent}>
          <View style={styles.profileHeader}>
            <View style={styles.avatarLarge}>
              <Ionicons name="person" size={40} color={Colors.primary} />
            </View>
            <Text style={styles.profileEmail}>{user?.email}</Text>
          </View>

          <View style={styles.form}>
            <SectionTitle icon="person" title="Dados Pessoais" />
            <InputField label="Nome Completo" icon="person-outline" value={fullName} onChange={setFullName} placeholder="Seu nome" />
            <InputField label="CPF" icon="card-outline" value={cpf} onChange={setCpf} placeholder="000.000.000-00" keyboard="number-pad" />

            <SectionTitle icon="business" title="Dados da Empresa" />
            <InputField label="CNPJ" icon="business-outline" value={cnpj} onChange={setCnpj} placeholder="00.000.000/0000-00" keyboard="number-pad" />
            <InputField label="Razão Social" icon="document-text-outline" value={razaoSocial} onChange={setRazaoSocial} placeholder="Sua empresa MEI" />
            <InputField label="Nome Fantasia" icon="star-outline" value={fantasyName} onChange={setFantasyName} placeholder="Nome comercial" />
            <InputField label="Atividade" icon="briefcase-outline" value={activity} onChange={setActivity} placeholder="Ex: Serviços de TI" />

            <SectionTitle icon="location" title="Endereço" />
            <View style={styles.row}>
              <View style={{ flex: 1, marginRight: 8 }}>
                <InputField label="CEP" icon="map-outline" value={cep} onChange={setCep} placeholder="00000-000" keyboard="number-pad" />
              </View>
              <View style={{ width: 80 }}>
                <InputField label="UF" icon="navigate-outline" value={uf} onChange={setUf} placeholder="SP" autoCap="characters" />
              </View>
            </View>
            <InputField label="Cidade" icon="trail-sign-outline" value={city} onChange={setCity} placeholder="Sua cidade" />
            <InputField label="Logradouro" icon="home-outline" value={street} onChange={setStreet} placeholder="Rua, Número, Bairro" />

            <SectionTitle icon="settings-outline" title="Configurações do App" />
            <TouchableOpacity 
              style={styles.settingsButton}
              onPress={() => router.push('/settings')}
            >
              <Ionicons name="options-outline" size={20} color={Colors.primary} style={{ marginRight: 12 }} />
              <Text style={styles.settingsButtonText}>Ajustes de Tema e Preferências</Text>
              <Ionicons name="chevron-forward" size={20} color="#475569" />
            </TouchableOpacity>

            <TouchableOpacity 
              style={styles.saveButton} 
              onPress={handleUpdateProfile}
              disabled={loading}
            >
              {loading ? (
                <ActivityIndicator color="#FFFFFF" />
              ) : (
                <Text style={styles.buttonText}>Salvar Alterações</Text>
              )}
            </TouchableOpacity>

            <TouchableOpacity 
              style={styles.logoutButton} 
              onPress={handleLogout}
            >
              <Ionicons name="log-out-outline" size={20} color="#EF4444" style={{ marginRight: 8 }} />
              <Text style={styles.logoutButtonText}>Sair da Conta</Text>
            </TouchableOpacity>
            
            <View style={{ height: 40 }} />
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </LinearGradient>
  );
}

function InputField({ label, icon, value, onChange, placeholder, keyboard, autoCap }: any) {
  return (
    <View style={{ marginBottom: 20 }}>
      <Text style={styles.label}>{label}</Text>
      <View style={styles.inputContainer}>
        <Ionicons name={icon} size={20} color="#94A3B8" style={styles.inputIcon} />
        <TextInput
          style={styles.input}
          placeholder={placeholder}
          placeholderTextColor="#64748B"
          value={value}
          onChangeText={onChange}
          keyboardType={keyboard || 'default'}
          autoCapitalize={autoCap || 'none'}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollContent: {
    padding: 24,
  },
  profileHeader: {
    alignItems: 'flex-start',
    marginBottom: 32,
    marginTop: 10,
  },
  avatarLarge: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: 'rgba(56, 189, 248, 0.1)',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: Colors.borderStrong,
    marginBottom: 12,
  },
  profileEmail: {
    fontSize: 16,
    color: '#94A3B8',
    fontWeight: '500',
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 16,
    marginBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(56, 189, 248, 0.2)',
    paddingBottom: 8,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: Colors.primary,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  form: {
    width: '100%',
  },
  label: {
    color: '#F1F5F9',
    fontSize: 13,
    fontWeight: '600',
    marginBottom: 8,
    marginLeft: 4,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1E293B',
    borderRadius: 16,
    paddingHorizontal: 16,
    height: 56,
    borderWidth: 1,
    borderColor: '#334155',
  },
  inputIcon: {
    marginRight: 12,
  },
  input: {
    flex: 1,
    color: '#F1F5F9',
    fontSize: 16,
    textAlign: 'left',
  },
  row: {
    flexDirection: 'row',
  },
  settingsButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1E293B',
    padding: 16,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#334155',
    marginBottom: 24,
  },
  settingsButtonText: {
    flex: 1,
    color: '#F1F5F9',
    fontSize: 15,
    fontWeight: '600',
  },
  saveButton: {
    backgroundColor: Colors.primary,
    height: 56,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 32,
    shadowColor: Colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 8,
  },
  buttonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
  },
  logoutButton: {
    flexDirection: 'row',
    height: 56,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 16,
    borderWidth: 1,
    borderColor: 'rgba(239, 68, 68, 0.3)',
    backgroundColor: 'rgba(239, 68, 68, 0.05)',
  },
  logoutButtonText: {
    color: '#EF4444',
    fontSize: 16,
    fontWeight: '700',
  },
});
