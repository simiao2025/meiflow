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
  Image,
  ScrollView,
  useWindowDimensions
} from 'react-native';
import { useRouter, Link } from 'expo-router';
import { supabase } from '../../services/supabase';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useThemeColors } from '../../constants/theme';
import { SafeAreaView } from 'react-native-safe-area-context';

export default function LoginScreen() {
  const Colors = useThemeColors();
  const styles = getStyles(Colors);
  const { width } = useWindowDimensions();
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
    try {
      const { data: authData, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) {
        Alert.alert('Erro na Autenticação', error.message);
        setLoading(false);
        return;
      }

      const userId = authData?.user?.id;
      if (!userId) {
        setLoading(false);
        return;
      }

      const { error: profileError } = await supabase
        .from('profiles')
        .select('cnpj')
        .eq('id', userId)
        .single();
        
      if (profileError) {
        Alert.alert('Erro', 'Erro ao carregar perfil. Tente novamente.');
        setLoading(false);
        return;
      }

      setLoading(false);
      router.replace('/'); // Redireciona para home após sucesso
    } catch (e: any) {
      Alert.alert('Erro', e?.message || 'Ocorreu um erro ao fazer login.');
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      {/* Ethereal Glass Background */}
      <LinearGradient
        colors={['#050505', '#0a0a0a']}
        style={StyleSheet.absoluteFillObject}
      />
      
      {/* Subtle Glowing Orb */}
      <View style={styles.glowOrb} />

      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.content}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 20}
      >
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
          style={{ width: '100%' }}
        >
          {/* Outer Shell (Double-Bezel Architecture) */}
          <View style={[styles.outerShell, width > 768 ? styles.outerShellWeb : null]}>
            {/* Inner Core */}
            <View style={styles.innerCore}>
              <View style={styles.header}>
                <View style={styles.logoBadgeOuter}>
                  <View style={styles.logoBadgeInner}>
                    <Image source={require('../../assets/images/icon.png')} style={{width: 40, height: 40, borderRadius: 10}} />
                  </View>
                </View>
                
                <View style={styles.eyebrowContainer}>
                  <Text style={styles.eyebrowText}>ACESSO SEGURO</Text>
                </View>
                <Text style={styles.title}>MEIFlow</Text>
                <Text style={styles.subtitle}>Gestão de elite para o seu negócio</Text>
              </View>

              <View style={styles.form}>
                {/* Nested Input 1 */}
                <View style={styles.inputOuter}>
                  <View style={styles.inputContainer}>
                    <Ionicons name="mail-outline" size={20} color="#64748B" style={styles.inputIcon} />
                    <TextInput
                      style={styles.input as any}
                      placeholder="E-mail profissional"
                      placeholderTextColor="#475569"
                      value={email}
                      onChangeText={setEmail}
                      autoCapitalize="none"
                      keyboardType="email-address"
                    />
                  </View>
                </View>

                {/* Nested Input 2 */}
                <View style={styles.inputOuter}>
                  <View style={styles.inputContainer}>
                    <Ionicons name="lock-closed-outline" size={20} color="#64748B" style={styles.inputIcon} />
                    <TextInput
                      style={styles.input as any}
                      placeholder="Sua senha secreta"
                      placeholderTextColor="#475569"
                      value={password}
                      onChangeText={setPassword}
                      secureTextEntry
                    />
                  </View>
                </View>

                <TouchableOpacity style={styles.forgotPassword} onPress={() => router.push('/auth/recover')}>
                  <Text style={styles.forgotPasswordText}>Esqueceu a senha?</Text>
                </TouchableOpacity>

                {/* Primary CTA (Button-in-Button Trailing Icon) */}
                <TouchableOpacity 
                  style={styles.loginButton} 
                  onPress={handleLogin}
                  disabled={loading}
                  activeOpacity={0.9}
                >
                  {loading ? (
                    <View style={styles.loaderContainer}>
                      <ActivityIndicator color="#000000" />
                    </View>
                  ) : (
                    <>
                      <Text style={styles.loginButtonText}>Acessar Painel</Text>
                      <View style={styles.buttonIconWrapper}>
                        <Ionicons name="arrow-forward" size={18} color="#000000" />
                      </View>
                    </>
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
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const getStyles = (Colors: any) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#050505',
  },
  glowOrb: {
    position: 'absolute',
    top: '-10%',
    right: '-10%',
    width: 400,
    height: 400,
    backgroundColor: 'rgba(56, 189, 248, 0.08)',
    borderRadius: 200,
    ...Platform.select({
      web: {
        filter: 'blur(100px)',
      },
    }),
  },
  content: {
    flex: 1,
    width: '100%',
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
    alignItems: 'center',
    // Moving paddingHorizontal here fixes the "cut off on right side" bug 
    // by ensuring ScrollView constrains its children naturally.
    paddingHorizontal: 24,
    paddingVertical: 40,
  },
  outerShell: {
    width: '100%',
    maxWidth: 420,
    backgroundColor: 'rgba(255, 255, 255, 0.03)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.05)',
    padding: 8,
    borderRadius: 36,
    ...Platform.select({
      android: {
        elevation: 8,
      },
    }),
  },
  outerShellWeb: {
    boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)',
  },
  innerCore: {
    backgroundColor: 'rgba(10, 10, 10, 0.8)',
    borderRadius: 28,
    padding: 32,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    ...Platform.select({
      web: {
        backdropFilter: 'blur(24px)',
      },
    }),
  },
  header: {
    alignItems: 'center',
    marginBottom: 40,
  },
  logoBadgeOuter: {
    padding: 4,
    backgroundColor: 'rgba(255, 255, 255, 0.03)',
    borderRadius: 24,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.05)',
    marginBottom: 24,
  },
  logoBadgeInner: {
    width: 56,
    height: 56,
    borderRadius: 20,
    backgroundColor: 'rgba(25, 25, 25, 1)',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  eyebrowContainer: {
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
    marginBottom: 16,
  },
  eyebrowText: {
    fontSize: 10,
    color: '#94A3B8',
    fontWeight: '700',
    letterSpacing: 2,
  },
  title: {
    fontSize: 36,
    fontWeight: '800',
    color: '#FFFFFF',
    letterSpacing: -1.5,
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 15,
    color: '#64748B',
    textAlign: 'center',
    fontWeight: '500',
    lineHeight: 22,
  },
  form: {
    width: '100%',
  },
  inputOuter: {
    marginBottom: 16,
    backgroundColor: 'rgba(255, 255, 255, 0.02)',
    padding: 4,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.03)',
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(15, 15, 15, 0.6)',
    borderRadius: 16,
    paddingHorizontal: 16,
    height: 56,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.06)',
  },
  inputIcon: {
    marginRight: 12,
  },
  input: {
    flex: 1,
    color: '#F8FAFC',
    fontSize: 16,
    ...Platform.select({
      web: {
        outlineStyle: 'none',
      },
    }),
  },
  forgotPassword: {
    alignSelf: 'flex-end',
    marginBottom: 32,
    marginTop: 4,
  },
  forgotPasswordText: {
    color: '#94A3B8',
    fontSize: 13,
    fontWeight: '500',
  },
  loginButton: {
    flexDirection: 'row',
    backgroundColor: '#FFFFFF',
    height: 60,
    borderRadius: 30,
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingLeft: 24,
    paddingRight: 8,
  },
  loaderContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  loginButtonText: {
    color: '#000000',
    fontSize: 16,
    fontWeight: '700',
    letterSpacing: -0.5,
  },
  buttonIconWrapper: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(0, 0, 0, 0.05)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginTop: 32,
  },
  footerText: {
    color: '#64748B',
    fontSize: 14,
  },
  footerLink: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
  },
});
