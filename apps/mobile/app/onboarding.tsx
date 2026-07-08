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
  Alert,
  ImageBackground
} from 'react-native';
import { useRouter } from 'expo-router';
import { supabase } from '../services/supabase';
import { useAuthStore } from '../stores/authStore';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { validateCPF, validateCNPJ, maskCPF, maskCNPJ, maskCEP } from '../utils/validation';
import { Colors, Palette } from '../constants/theme';

export default function OnboardingScreen() {
  const [fullName, setFullName] = useState('');
  const [cpf, setCpf] = useState('');
  const [cnpj, setCnpj] = useState('');
  const [razaoSocial, setRazaoSocial] = useState('');
  const [fantasyName, setFantasyName] = useState('');
  const [activity, setActivity] = useState('');
  
  // Endereço
  const [cep, setCep] = useState('');
  const [street, setStreet] = useState('');
  const [city, setCity] = useState('');
  const [uf, setUf] = useState('');

  const [loading, setLoading] = useState(false);
  const { user, profile, refreshProfile } = useAuthStore();
  const router = useRouter();

  // Pre-preenchimento vindo do perfil (criado via Webhook)
  useEffect(() => {
    if (profile) {
      if (profile.full_name && !fullName) setFullName(profile.full_name);
      if (profile.cpf && !cpf) setCpf(maskCPF(profile.cpf));
    }
  }, [profile]);

  const handleCompleteOnboarding = async () => {
    if (!fullName || !cnpj || !razaoSocial || !cpf || !cep) {
      Alert.alert('Quase lá!', 'Por favor, preencha os campos obrigatórios para continuar.');
      return;
    }

    if (!validateCPF(cpf)) {
      Alert.alert('CPF Inválido', 'O CPF informado não é válido. Verifique os números.');
      return;
    }

    if (!validateCNPJ(cnpj)) {
      Alert.alert('CNPJ Inválido', 'O CNPJ informado não é válido. Verifique os números.');
      return;
    }

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
      Alert.alert('Erro ao salvar', error.message);
      setLoading(false);
    } else {
      try {
        // Dispara a criação da instância no Evolution Go via Backend
        const apiUrl = process.env.EXPO_PUBLIC_API_URL || 'http://192.168.1.203';
        const internalKey = process.env.EXPO_PUBLIC_INTERNAL_KEY || 'meiflow_secret_2026_internal';
        
        // Note: Roteamento passa pelo NGINX (API Gateway)
        await fetch(`${apiUrl}/api/v1/crm/evolution/instance/create`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-Internal-Key': internalKey
          },
          body: JSON.stringify({
            user_id: user?.id,
            cnpj: cnpj
          })
        });
      } catch (err) {
        console.warn('Evolution API trigger error:', err);
        // Não travamos o usuário se a API de zap falhar
      }

      await refreshProfile();
      router.replace('/(tabs)');
    }
  };

  const SectionTitle = ({ icon, title }: { icon: any, title: string }) => (
    <View style={styles.sectionHeader}>
      <Ionicons name={icon} size={20} color={Colors.primary} style={{ marginRight: 8 }} />
      <Text style={styles.sectionTitle}>{title}</Text>
    </View>
  );

  return (
    <LinearGradient 
      colors={[Colors.bg, Colors.bgInner]}
      style={styles.container}
    >
      <KeyboardAvoidingView 
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={{ flex: 1 }}
      >
        <ScrollView contentContainerStyle={styles.scrollContent}>
          <View style={styles.header}>
            <Text style={styles.title}>Bem-vindo ao MEIFlow</Text>
            <Text style={styles.subtitle}>Complete seu perfil para que possamos cuidar da sua burocracia.</Text>
          </View>

            <View style={styles.form}>
              {/* Seção 1: Dados Pessoais */}
              <SectionTitle icon="person" title="Dados Pessoais" />
              <InputField label="Nome Completo" icon="person-outline" value={fullName} onChange={setFullName} placeholder="Seu nome" />
              <InputField label="CPF" icon="card-outline" value={cpf} onChange={(val: string) => setCpf(maskCPF(val))} placeholder="000.000.000-00" keyboard="number-pad" />

              {/* Seção 2: Dados da Empresa */}
              <SectionTitle icon="business" title="Dados da Empresa" />
              <InputField label="CNPJ" icon="business-outline" value={cnpj} onChange={(val: string) => setCnpj(maskCNPJ(val))} placeholder="00.000.000/0000-00" keyboard="number-pad" />
              <InputField label="Razão Social" icon="document-text-outline" value={razaoSocial} onChange={setRazaoSocial} placeholder="Sua empresa MEI" />
              <InputField label="Nome Fantasia" icon="star-outline" value={fantasyName} onChange={setFantasyName} placeholder="Nome comercial (opcional)" />
              <InputField label="Ramo de Atividade / CNAE" icon="briefcase-outline" value={activity} onChange={setActivity} placeholder="Ex: Serviços de TI" />

              {/* Seção 3: Endereço */}
              <SectionTitle icon="location" title="Endereço da Empresa" />
              <View style={styles.row}>
                <View style={{ flex: 1, marginRight: 8 }}>
                  <InputField label="CEP" icon="map-outline" value={cep} onChange={(val: string) => setCep(maskCEP(val))} placeholder="00000-000" keyboard="number-pad" />
                </View>
                <View style={{ width: 80 }}>
                  <InputField label="UF" icon="navigate-outline" value={uf} onChange={setUf} placeholder="SP" autoCap="characters" />
                </View>
              </View>
              <InputField label="Cidade" icon="trail-sign-outline" value={city} onChange={setCity} placeholder="Sua cidade" />
              <InputField label="Logradouro" icon="home-outline" value={street} onChange={setStreet} placeholder="Rua, Número, Bairro" />

              <TouchableOpacity 
                style={styles.button} 
                onPress={handleCompleteOnboarding}
                disabled={loading}
              >
                {loading ? (
                  <ActivityIndicator color="#FFFFFF" />
                ) : (
                  <Text style={styles.buttonText}>Finalizar Cadastro</Text>
                )}
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
          autoCapitalize={autoCap || 'sentences'}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  overlay: {
    flex: 1,
  },
  scrollContent: {
    padding: 24,
    paddingTop: 60,
  },
  header: {
    marginBottom: 32,
  },
  title: {
    fontSize: 28,
    fontWeight: '800',
    color: '#F8FAFC',
  },
  subtitle: {
    fontSize: 16,
    color: '#CBD5E1',
    marginTop: 8,
    lineHeight: 24,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 16,
    marginBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(56, 189, 248, 0.4)',
    paddingBottom: 8,
  },
  sectionTitle: {
    fontSize: 16,
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
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 8,
    marginLeft: 4,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(30, 41, 59, 0.8)',
    borderRadius: 16,
    paddingHorizontal: 16,
    height: 56,
    borderWidth: 1,
    borderColor: 'rgba(51, 65, 85, 0.5)',
  },
  inputIcon: {
    marginRight: 12,
  },
  input: {
    flex: 1,
    color: '#F1F5F9',
    fontSize: 16,
  },
  row: {
    flexDirection: 'row',
  },
  button: {
    backgroundColor: Colors.primary,
    height: 60,
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
    fontSize: 18,
    fontWeight: '700',
  },
});
