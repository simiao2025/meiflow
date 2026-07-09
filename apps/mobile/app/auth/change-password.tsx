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
  ImageBackground,
  ScrollView
} from 'react-native';
import { useRouter } from 'expo-router';
import { supabase } from '../../services/supabase';
import { useAuthStore } from '../../stores/authStore';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../../constants/theme';

export default function ChangePasswordScreen() {
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  
  const { user, refreshProfile } = useAuthStore();
  const router = useRouter();

  const handleChangePassword = async () => {
    if (!password || !confirmPassword) {
      Alert.alert('Erro', 'Por favor, preencha todos os campos.');
      return;
    }

    if (password.length < 6) {
      Alert.alert('Erro', 'A senha deve ter pelo menos 6 caracteres.');
      return;
    }

    if (password !== confirmPassword) {
      Alert.alert('Erro', 'As senhas não coincidem.');
      return;
    }

    setLoading(true);

    try {
      // 1. Atualiza a senha no Supabase Auth
      const { error: authError } = await supabase.auth.updateUser({
        password: password
      });

      if (authError) throw authError;

      // 2. Atualiza o flag no profile
      const { error: profileError } = await supabase
        .from('profiles')
        .update({ 
          must_change_password: false,
          is_temporary_password: false,
          updated_at: new Date().toISOString()
        })
        .eq('id', user?.id);

      if (profileError) throw profileError;

      Alert.alert('Sucesso', 'Sua senha foi atualizada com sucesso!');
      
      await refreshProfile();
      // O layout vai redirecionar automaticamente para o onboarding ou tabs
    } catch (error: any) {
      Alert.alert('Erro ao atualizar', error.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <LinearGradient 
        colors={['#0F172A', '#1E293B']} 
        style={styles.gradient}
      >
        <KeyboardAvoidingView 
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.content}
        >
          <ScrollView 
            contentContainerStyle={{ flexGrow: 1, justifyContent: 'center' }}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
          <View style={styles.header}>
            <View style={styles.iconContainer}>
              <Ionicons name="lock-closed" size={32} color={Colors.primary} />
            </View>
            <Text style={styles.title}>Definir Nova Senha</Text>
            <Text style={styles.subtitle}>
              Por segurança, você deve criar uma nova senha pessoal para seu primeiro acesso.
            </Text>
          </View>

          <View style={styles.form}>
            <View style={styles.inputWrapper}>
              <Text style={styles.label}>Nova Senha</Text>
              <View style={styles.inputContainer}>
                <Ionicons name="key-outline" size={20} color="#94A3B8" style={styles.inputIcon} />
                <TextInput
                  style={styles.input}
                  placeholder="Mínimo 6 caracteres"
                  placeholderTextColor="#64748B"
                  secureTextEntry={!showPassword}
                  value={password}
                  onChangeText={setPassword}
                />
                <TouchableOpacity onPress={() => setShowPassword(!showPassword)}>
                  <Ionicons 
                    name={showPassword ? "eye-off-outline" : "eye-outline"} 
                    size={20} 
                    color="#94A3B8" 
                  />
                </TouchableOpacity>
              </View>
            </View>

            <View style={styles.inputWrapper}>
              <Text style={styles.label}>Confirmar Senha</Text>
              <View style={styles.inputContainer}>
                <Ionicons name="checkmark-circle-outline" size={20} color="#94A3B8" style={styles.inputIcon} />
                <TextInput
                  style={styles.input}
                  placeholder="Repita a nova senha"
                  placeholderTextColor="#64748B"
                  secureTextEntry={!showPassword}
                  value={confirmPassword}
                  onChangeText={setConfirmPassword}
                />
              </View>
            </View>

            <TouchableOpacity 
              style={styles.button} 
              onPress={handleChangePassword}
              disabled={loading}
            >
              {loading ? (
                <ActivityIndicator color="#FFFFFF" />
              ) : (
                <>
                  <Text style={styles.buttonText}>Salvar e Continuar</Text>
                  <Ionicons name="arrow-forward" size={20} color="#FFF" style={{ marginLeft: 8 }} />
                </>
              )}
            </TouchableOpacity>
          </View>
          </ScrollView>
        </KeyboardAvoidingView>
      </LinearGradient>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  gradient: {
    flex: 1,
  },
  content: {
    flex: 1,
    padding: 24,
    justifyContent: 'center',
  },
  header: {
    alignItems: 'center',
    marginBottom: 48,
  },
  iconContainer: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: Colors.primaryMuted,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 24,
    borderWidth: 1,
    borderColor: Colors.primaryLight,
  },
  title: {
    fontSize: 28,
    fontWeight: '800',
    color: '#F8FAFC',
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 16,
    color: '#94A3B8',
    textAlign: 'center',
    marginTop: 12,
    lineHeight: 24,
    paddingHorizontal: 20,
  },
  form: {
    width: '100%',
  },
  inputWrapper: {
    marginBottom: 24,
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
  button: {
    backgroundColor: Colors.primary,
    height: 60,
    borderRadius: 16,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 16,
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
