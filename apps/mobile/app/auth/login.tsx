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
  Dimensions
} from 'react-native';
import { useRouter, Link } from 'expo-router';
import { supabase } from '../../services/supabase';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { BlurView } from 'expo-blur';
import { Colors } from '../../constants/theme';

const { width, height } = Dimensions.get('window');

export default function LoginScreen() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const handleLogin = async () => {
    if (!email || !password) {
      Alert.alert('Erro', 'Por favor, preencha todos os campos.');
      return;
    }

    setLoading(true);
    const { data: authData, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      Alert.alert('Erro na Autenticação', error.message);
      setLoading(false);
    } else {
      // Verifica se o perfil tem CNPJ usando o ID fresco retornado pela autenticação
      const userId = authData?.user?.id;
      
      if (!userId) {
        setLoading(false);
        return;
      }

      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('cnpj')
        .eq('id', userId)
        .single();
        
      if (profileError) {
        console.warn('Erro ao buscar perfil no login:', profileError);
      }
        
      if (!profile?.cnpj) {
        // Redireciona para o Onboarding obrigatório
        router.replace('/onboarding');
      } else {
        router.replace('/(tabs)');
      }
    }
  };

  return (
    <View style={styles.container}>
      {/* Imagem de Fundo (Bento Grid) */}
      <ImageBackground 
        source={require('../../assets/images/login_bg.png')} 
        style={StyleSheet.absoluteFillObject}
        resizeMode="cover"
      />

      {/* Camada de Gradiente Premium */}
      <LinearGradient 
        colors={['rgba(15, 23, 42, 0.6)', 'rgba(15, 23, 42, 0.95)']} 
        style={StyleSheet.absoluteFillObject}
      />

      <KeyboardAvoidingView 
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.content}
      >
        <View style={styles.cardContainer}>
          {/* Efeito de Vidro (Glassmorphism) para Web e iOS */}
          <View style={styles.glassCard}>
            <View style={styles.header}>
              <View style={styles.logoBadge}>
                <Ionicons name="rocket" size={32} color="#38BDF8" />
              </View>
              <Text style={styles.title}>MEIFlow</Text>
              <Text style={styles.subtitle}>Gestão inteligente para o seu negócio</Text>
            </View>

            <View style={styles.form}>
              <View style={styles.inputContainer}>
                <Ionicons name="mail-outline" size={20} color="#94A3B8" style={styles.inputIcon} />
                 <TextInput
                   style={styles.input as any}
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
                   style={styles.input as any}
                   placeholder="Sua senha secreta"
                   placeholderTextColor="#64748B"
                   value={password}
                   onChangeText={setPassword}
                   secureTextEntry
                 />
              </View>

               <TouchableOpacity style={styles.forgotPassword} onPress={() => router.push('/auth/recover')}>
                 <Text style={styles.forgotPasswordText}>Esqueceu a senha?</Text>
               </TouchableOpacity>

              <TouchableOpacity 
                style={styles.loginButton} 
                onPress={handleLogin}
                disabled={loading}
              >
                {loading ? (
                  <ActivityIndicator color="#FFFFFF" />
                ) : (
                  <Text style={styles.loginButtonText}>Acessar Painel</Text>
                )}
              </TouchableOpacity>

              <View style={styles.footer}>
                <Text style={styles.footerText}>Novo por aqui? </Text>
                <Link href="/auth/register" asChild>
                  <TouchableOpacity>
                    <Text style={styles.footerLink}>Criar conta MEI</Text>
                  </TouchableOpacity>
                </Link>
              </View>
            </View>
          </View>
        </View>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0F172A',
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  cardContainer: {
    width: '100%',
    maxWidth: 400,
    borderRadius: 24,
    overflow: 'hidden',
    ...Platform.select({
      web: {
        boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)',
      },
      android: {
        elevation: 10,
      },
    }),
  },
  glassCard: {
    padding: 32,
    backgroundColor: 'rgba(30, 41, 59, 0.7)',
    borderRadius: 24,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  header: {
    alignItems: 'center',
    marginBottom: 40,
  },
  logoBadge: {
    width: 64,
    height: 64,
    borderRadius: 20,
    backgroundColor: 'rgba(56, 189, 248, 0.15)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
    borderWidth: 1,
    borderColor: 'rgba(56, 189, 248, 0.3)',
  },
  title: {
    fontSize: 32,
    fontWeight: '800',
    color: '#F8FAFC',
    letterSpacing: -1,
  },
  subtitle: {
    fontSize: 15,
    color: '#94A3B8',
    marginTop: 8,
    textAlign: 'center',
    fontWeight: '500',
    lineHeight: 20,
  },
  form: {
    width: '100%',
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(15, 23, 42, 0.6)',
    borderRadius: 16,
    marginBottom: 16,
    paddingHorizontal: 16,
    height: 56,
    borderWidth: 1,
    borderColor: 'rgba(51, 65, 85, 0.4)',
  },
  inputIcon: {
    marginRight: 12,
  },
  input: {
    flex: 1,
    color: '#F1F5F9',
    fontSize: 16,
    ...Platform.select({
      web: {
        outlineStyle: 'none',
      },
    }),
  },
  forgotPassword: {
    alignSelf: 'flex-end',
    marginBottom: 24,
  },
  forgotPasswordText: {
    color: '#38BDF8',
    fontSize: 14,
    fontWeight: '600',
  },
  loginButton: {
    backgroundColor: '#38BDF8',
    height: 56,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    ...Platform.select({
      web: {
        transition: 'all 0.2s ease',
        ':hover': {
          backgroundColor: '#0EA5E9',
        }
      }
    })
  },
  loginButtonText: {
    color: '#FFFFFF',
    fontSize: 17,
    fontWeight: '700',
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginTop: 32,
  },
  footerText: {
    color: '#94A3B8',
    fontSize: 14,
  },
  footerLink: {
    color: '#38BDF8',
    fontSize: 14,
    fontWeight: '700',
  },
});
