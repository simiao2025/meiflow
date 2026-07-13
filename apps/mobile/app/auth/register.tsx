import React, { useState } from 'react';
import { 
  View, 
  Text, 
  TextInput, 
  TouchableOpacity, 
  StyleSheet, 
  KeyboardAvoidingView, 
  Platform,
  ActivityIndicator,
  Alert,
  ScrollView
} from 'react-native';
import { useRouter, Link } from 'expo-router';
import { supabase } from '../../services/supabase';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Palette } from '../../constants/theme';

import * as Linking from 'expo-linking';

const PRIVACY_POLICY_URL = 'https://meiflow.com.br/privacidade';
const TERMS_OF_USE_URL = 'https://meiflow.com.br/termos';

export default function RegisterScreen() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [acceptedTerms, setAcceptedTerms] = useState(false);
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const handleRegister = async () => {
    if (!email || !password || !confirmPassword) {
      Alert.alert('Erro', 'Por favor, preencha todos os campos.');
      return;
    }

    if (!acceptedTerms) {
      Alert.alert('Consentimento Necessário', 'Você precisa aceitar os Termos de Uso e a Política de Privacidade para criar sua conta.');
      return;
    }

    if (password !== confirmPassword) {
      Alert.alert('Erro', 'As senhas não coincidem.');
      return;
    }

    setLoading(true);
    try {
      const { error, data } = await supabase.auth.signUp({
        email,
        password,
        options: {
          emailRedirectTo: 'https://superlative-frangollo-9bc749.netlify.app',
        },
      });

      if (error) {
        Alert.alert('Erro no Cadastro', error.message);
      } else {
        // Se a sessão já veio logada, não alerta ir pro login.
        if (data?.session) {
          router.replace('/onboarding');
        } else {
          Alert.alert(
            'Sucesso!', 
            'Verifique seu e-mail para confirmar a conta.',
            [{ text: 'OK', onPress: () => router.replace('/auth/login') }]
          );
        }
      }
    } catch (err: any) {
      Alert.alert('Erro', err.message || 'Falha ao conectar com o servidor.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <LinearGradient colors={[Colors.bg, Colors.bgInner]} style={styles.container}>
      <KeyboardAvoidingView 
        behavior='padding' keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : -300}
        style={styles.content}
      >
        <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={24} color="#F8FAFC" />
        </TouchableOpacity>

        <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
          <View style={styles.header}>
            <Text style={styles.title}>Criar Conta</Text>
            <Text style={styles.subtitle}>Inicie sua jornada MEI de sucesso hoje</Text>
          </View>

          <View style={styles.form}>
            <View style={styles.inputContainer}>
              <Ionicons name="mail-outline" size={20} color="#94A3B8" style={styles.inputIcon} />
              <TextInput
                style={styles.input}
                placeholder="E-mail profissional"
                placeholderTextColor="#64748B"
                value={email}
                onChangeText={setEmail}
                autoCapitalize="none"
                keyboardType="email-address"
              />
            </View>

            <View style={styles.inputContainer}>
              <Ionicons name="lock-closed-outline" size={20} color="#94A3B8" style={styles.inputIcon} />
              <TextInput
                style={styles.input}
                placeholder="Escolha uma senha forte"
                placeholderTextColor="#64748B"
                value={password}
                onChangeText={setPassword}
                secureTextEntry
              />
            </View>

            <View style={styles.inputContainer}>
              <Ionicons name="shield-checkmark-outline" size={20} color="#94A3B8" style={styles.inputIcon} />
              <TextInput
                style={styles.input}
                placeholder="Confirme sua senha"
                placeholderTextColor="#64748B"
                value={confirmPassword}
                onChangeText={setConfirmPassword}
                secureTextEntry
              />
            </View>

            <View style={styles.consentContainer}>
              <TouchableOpacity 
                style={styles.checkbox}
                onPress={() => setAcceptedTerms(!acceptedTerms)}
                accessibilityLabel={acceptedTerms ? 'Aceitar termos marcado' : 'Aceitar termos desmarcado'}
                accessibilityRole="checkbox"
                accessibilityState={{ checked: acceptedTerms }}
              >
                {acceptedTerms ? (
                  <Ionicons name="checkbox" size={22} color={Colors.primary} />
                ) : (
                  <Ionicons name="square-outline" size={22} color="#64748B" />
                )}
              </TouchableOpacity>
              <Text style={styles.consentText}>
                Li e aceito os{' '}
                <Text style={styles.consentLink} onPress={() => Linking.openURL(TERMS_OF_USE_URL)}>Termos de Uso</Text>
                {' '}e a{' '}
                <Text style={styles.consentLink} onPress={() => Linking.openURL(PRIVACY_POLICY_URL)}>Política de Privacidade</Text>.
                {'\n'}Autorizo o tratamento dos meus dados pessoais conforme a LGPD.
              </Text>
            </View>

            <TouchableOpacity 
              style={[styles.registerButton, !acceptedTerms && { opacity: 0.5 }]} 
              onPress={handleRegister}
              disabled={loading}
            >
              {loading ? (
                <ActivityIndicator color="#FFFFFF" />
              ) : (
                <Text style={styles.registerButtonText}>Começar Agora</Text>
              )}
            </TouchableOpacity>

            <View style={styles.footer}>
              <Text style={styles.footerText}>Já possui uma conta? </Text>
              <Link href="/auth/login" asChild>
                <TouchableOpacity>
                  <Text style={styles.footerLink}>Entrar</Text>
                </TouchableOpacity>
              </Link>
            </View>
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
  content: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
    padding: 24,
    paddingTop: 80, // Espaço para o backButton
  },
  backButton: {
    position: 'absolute',
    top: Platform.OS === 'ios' ? 60 : 40,
    left: 24,
    zIndex: 10,
  },
  header: {
    marginBottom: 40,
  },
  title: {
    fontSize: 32,
    fontWeight: '800',
    color: '#F8FAFC',
    letterSpacing: -1,
  },
  subtitle: {
    fontSize: 16,
    color: '#94A3B8',
    marginTop: 8,
  },
  form: {
    width: '100%',
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(30, 41, 59, 0.5)',
    borderRadius: 16,
    marginBottom: 16,
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
  registerButton: {
    backgroundColor: Colors.primary,
    height: 60,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 16,
    shadowColor: Colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 8,
  },
  registerButtonText: {
    color: Palette.black,
    fontSize: 18,
    fontWeight: '700',
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginTop: 32,
  },
  footerText: {
    color: Colors.textSecondary,
    fontSize: 15,
  },
  footerLink: {
    color: Colors.primary,
    fontSize: 15,
    fontWeight: '700',
  },
  consentContainer: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginTop: 20,
    paddingHorizontal: 4,
  },
  checkbox: {
    marginRight: 12,
    marginTop: 2,
  },
  consentText: {
    flex: 1,
    color: '#94A3B8',
    fontSize: 13,
    lineHeight: 20,
  },
  consentLink: {
    color: Colors.primary,
    fontWeight: '600',
    textDecorationLine: 'underline',
  },
});
