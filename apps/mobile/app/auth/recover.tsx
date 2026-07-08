import React, { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet, KeyboardAvoidingView,
  Platform, ActivityIndicator, Alert, ImageBackground,
} from 'react-native';
import { useRouter } from 'expo-router';
import { supabase } from '../../services/supabase';
import { LinearGradient } from 'expo-linear-gradient';
import { Colors } from '../../constants/theme';

export default function RecoverPasswordScreen() {
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [email, setEmail] = useState('');
  const [otp, setOtp] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const handleSendEmail = async () => {
    if (!email.trim()) {
      Alert.alert('Erro', 'Informe seu e-mail.');
      return;
    }
    setLoading(true);
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email.trim());
      if (error) throw error;
      setStep(2);
      Alert.alert('E-mail enviado!', 'Verifique sua caixa de entrada e digite o código numérico recebido.');
    } catch (err: any) {
      Alert.alert('Erro', err?.message || 'Não foi possível enviar o e-mail. Tente novamente mais tarde.');
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyOtp = async () => {
    if (!otp.trim() || otp.trim().length < 6) {
      Alert.alert('Erro', 'Informe o código numérico válido recebido por e-mail.');
      return;
    }
    setLoading(true);
    try {
      const { error } = await supabase.auth.verifyOtp({
        email: email.trim(),
        token: otp.trim(),
        type: 'recovery',
      });
      if (error) throw error;
      setStep(3);
    } catch (err: any) {
      Alert.alert('Erro', 'Código inválido ou expirado. Tente solicitar novamente.');
    } finally {
      setLoading(false);
    }
  };

  const handleResetPassword = async () => {
    if (!password || !confirmPassword) {
      Alert.alert('Erro', 'Preencha todos os campos da nova senha.');
      return;
    }
    if (password !== confirmPassword) {
      Alert.alert('Erro', 'As senhas não coincidem.');
      return;
    }
    if (password.length < 6) {
      Alert.alert('Erro', 'A senha deve ter no mínimo 6 caracteres.');
      return;
    }

    setLoading(true);
    try {
      const { error } = await supabase.auth.updateUser({ password });
      if (error) throw error;

      Alert.alert('Sucesso', 'Sua senha foi redefinida com sucesso! Faça login.');
      await supabase.auth.signOut();
      router.replace('/auth/login');
    } catch (err: any) {
      Alert.alert('Erro', err?.message || 'Não foi possível redefinir a senha.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <ImageBackground source={require('../../assets/images/login_bg.jpg')} style={StyleSheet.absoluteFillObject} resizeMode="cover" />
      <LinearGradient colors={['rgba(15, 23, 42, 0.6)', 'rgba(15, 23, 42, 0.95)']} style={StyleSheet.absoluteFillObject} />

      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.content}>
        <View style={styles.cardContainer}>
          <View style={styles.glassCard}>
            <View style={styles.header}>
              <View style={styles.logoBadge}>
                <Text style={styles.logoEmoji}>🔑</Text>
              </View>
              <Text style={styles.title}>
                {step === 1 && 'Recuperar Senha'}
                {step === 2 && 'Validar Código'}
                {step === 3 && 'Nova Senha'}
              </Text>
              <Text style={styles.subtitle}>
                {step === 1 && 'Informe seu e-mail para receber um código'}
                {step === 2 && 'Digite o código numérico recebido'}
                {step === 3 && 'Crie e confirme sua nova senha'}
              </Text>
            </View>

            <View style={styles.form}>
              {step === 1 && (
                <View style={styles.inputContainer}>
                  <TextInput
                    style={styles.input as any}
                    placeholder="Seu e-mail"
                    placeholderTextColor="#64748B"
                    value={email}
                    onChangeText={setEmail}
                    autoCapitalize="none"
                    keyboardType="email-address"
                  />
                </View>
              )}

              {step === 2 && (
                <View style={styles.inputContainer}>
                  <TextInput
                    style={[styles.input as any, { textAlign: 'center', letterSpacing: 12, fontSize: 24, fontWeight: 'bold' }]}
                    placeholder="00000000"
                    placeholderTextColor="#64748B"
                    value={otp}
                    onChangeText={setOtp}
                    autoCapitalize="none"
                    keyboardType="number-pad"
                    maxLength={8}
                  />
                </View>
              )}

              {step === 3 && (
                <>
                  <View style={styles.inputContainer}>
                    <TextInput
                      style={styles.input as any}
                      placeholder="Nova senha"
                      placeholderTextColor="#64748B"
                      value={password}
                      onChangeText={setPassword}
                      secureTextEntry
                    />
                  </View>
                  <View style={styles.inputContainer}>
                    <TextInput
                      style={styles.input as any}
                      placeholder="Confirmar senha"
                      placeholderTextColor="#64748B"
                      value={confirmPassword}
                      onChangeText={setConfirmPassword}
                      secureTextEntry
                    />
                  </View>
                </>
              )}

              <TouchableOpacity
                style={styles.actionButton}
                onPress={step === 1 ? handleSendEmail : step === 2 ? handleVerifyOtp : handleResetPassword}
                disabled={loading}
              >
                {loading ? (
                  <ActivityIndicator color="#FFFFFF" />
                ) : (
                  <Text style={styles.actionButtonText}>
                    {step === 1 && 'Enviar Código'}
                    {step === 2 && 'Validar Código'}
                    {step === 3 && 'Redefinir Senha'}
                  </Text>
                )}
              </TouchableOpacity>

              <TouchableOpacity 
                style={styles.backButton} 
                onPress={() => step > 1 ? setStep((prev) => (prev - 1) as 1|2|3) : router.back()}
              >
                <Text style={styles.backButtonText}>{step > 1 ? 'Voltar' : 'Voltar para Login'}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0F172A' },
  content: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24 },
  cardContainer: { width: '100%', maxWidth: 400 },
  glassCard: {
    padding: 32, backgroundColor: 'rgba(30, 41, 59, 0.7)', borderRadius: 24,
    borderWidth: 1, borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  header: { alignItems: 'center', marginBottom: 32 },
  logoBadge: {
    width: 64, height: 64, borderRadius: 20,
    backgroundColor: Colors.primaryMuted, justifyContent: 'center', alignItems: 'center',
    marginBottom: 16, borderWidth: 1, borderColor: Colors.primaryLight,
  },
  logoEmoji: { fontSize: 28 },
  title: { fontSize: 28, fontWeight: '800', color: '#F8FAFC', letterSpacing: -1 },
  subtitle: { fontSize: 14, color: '#94A3B8', marginTop: 8, textAlign: 'center' },
  form: { width: '100%' },
  inputContainer: {
    backgroundColor: 'rgba(15, 23, 42, 0.6)', borderRadius: 16,
    marginBottom: 16, paddingHorizontal: 16, height: 56, justifyContent: 'center',
    borderWidth: 1, borderColor: 'rgba(51, 65, 85, 0.4)',
  },
  input: { flex: 1, color: '#F1F5F9', fontSize: 16 },
  actionButton: {
    backgroundColor: Colors.primary, height: 56, borderRadius: 16,
    justifyContent: 'center', alignItems: 'center', marginTop: 8,
  },
  actionButtonText: { color: '#FFFFFF', fontSize: 17, fontWeight: '700' },
  backButton: { alignSelf: 'center', marginTop: 20 },
  backButtonText: { color: '#94A3B8', fontSize: 14 },
});
