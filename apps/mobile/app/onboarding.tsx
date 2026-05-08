import React, { useState } from 'react';
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
import { useRouter } from 'expo-router';
import { supabase } from '../services/supabase';
import { useAuthStore } from '../stores/authStore';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';

export default function OnboardingScreen() {
  const [fullName, setFullName] = useState('');
  const [cnpj, setCnpj] = useState('');
  const [razaoSocial, setRazaoSocial] = useState('');
  const [loading, setLoading] = useState(false);
  const { user, refreshProfile } = useAuthStore();
  const router = useRouter();

  const handleCompleteOnboarding = async () => {
    if (!fullName || !cnpj || !razaoSocial) {
      Alert.alert('Quase lá!', 'Por favor, preencha os dados básicos da sua empresa.');
      return;
    }

    setLoading(true);
    const { error } = await supabase
      .from('profiles')
      .update({
        full_name: fullName,
        cnpj,
        razao_social: razaoSocial,
        updated_at: new Date().toISOString(),
      })
      .eq('id', user?.id);

    if (error) {
      Alert.alert('Erro ao salvar', error.message);
      setLoading(false);
    } else {
      await refreshProfile();
      router.replace('/(tabs)');
    }
  };

  return (
    <LinearGradient colors={['#0F172A', '#1E293B']} style={styles.container}>
      <KeyboardAvoidingView 
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={{ flex: 1 }}
      >
        <ScrollView contentContainerStyle={styles.scrollContent}>
          <View style={styles.header}>
            <Text style={styles.title}>Configure seu Perfil MEI</Text>
            <Text style={styles.subtitle}>Precisamos desses dados para automatizar seus impostos e guias.</Text>
          </View>

          <View style={styles.form}>
            <Text style={styles.label}>Nome Completo</Text>
            <View style={styles.inputContainer}>
              <Ionicons name="person-outline" size={20} color="#94A3B8" style={styles.inputIcon} />
              <TextInput
                style={styles.input}
                placeholder="Seu nome"
                placeholderTextColor="#64748B"
                value={fullName}
                onChangeText={setFullName}
              />
            </View>

            <Text style={styles.label}>CNPJ da Empresa</Text>
            <View style={styles.inputContainer}>
              <Ionicons name="business-outline" size={20} color="#94A3B8" style={styles.inputIcon} />
              <TextInput
                style={styles.input}
                placeholder="00.000.000/0000-00"
                placeholderTextColor="#64748B"
                value={cnpj}
                onChangeText={setCnpj}
                keyboardType="numeric"
              />
            </View>

            <Text style={styles.label}>Razão Social</Text>
            <View style={styles.inputContainer}>
              <Ionicons name="document-text-outline" size={20} color="#94A3B8" style={styles.inputIcon} />
              <TextInput
                style={styles.input}
                placeholder="Nome da sua empresa MEI"
                placeholderTextColor="#64748B"
                value={razaoSocial}
                onChangeText={setRazaoSocial}
              />
            </View>

            <TouchableOpacity 
              style={styles.button} 
              onPress={handleCompleteOnboarding}
              disabled={loading}
            >
              {loading ? (
                <ActivityIndicator color="#FFFFFF" />
              ) : (
                <Text style={styles.buttonText}>Finalizar Configuração</Text>
              )}
            </TouchableOpacity>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollContent: {
    padding: 24,
    paddingTop: 80,
  },
  header: {
    marginBottom: 40,
  },
  title: {
    fontSize: 28,
    fontWeight: '800',
    color: '#F8FAFC',
  },
  subtitle: {
    fontSize: 16,
    color: '#94A3B8',
    marginTop: 8,
    lineHeight: 24,
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
    backgroundColor: 'rgba(30, 41, 59, 0.5)',
    borderRadius: 16,
    marginBottom: 24,
    paddingHorizontal: 16,
    height: 60,
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
  button: {
    backgroundColor: '#38BDF8',
    height: 60,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 16,
    shadowColor: '#38BDF8',
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
