import React, { useState, useRef, useEffect } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  ScrollView, 
  TouchableOpacity, 
  Switch,
  Alert,
  Linking,
  Modal,
  TextInput,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';

import * as ImagePicker from 'expo-image-picker';
import { supabase } from '../../services/supabase';
import { useAuthStore } from '../../stores/authStore';
import { useThemeStore } from '../../stores/themeStore';
import { useThemeColors, Palette, Typography } from '../../constants/theme';

const PRIVACY_POLICY_URL = 'https://meiflow.com.br/privacidade';
const TERMS_OF_USE_URL = 'https://meiflow.com.br/termos';
const SUPPORT_WHATSAPP = 'https://wa.me/5511999999999?text=Ol%C3%A1%2C%20preciso%20de%20suporte%20no%20MEIFlow';

export default function SettingsScreen() {
  const router = useRouter();
  const { user, profile, refreshProfile } = useAuthStore();
  const { isDarkMode, toggleDarkMode } = useThemeStore();
  const Colors = useThemeColors();

  // WhatsApp Pairing State
  const [isPairingModalVisible, setPairingModalVisible] = useState(false);
  const [whatsappNumber, setWhatsappNumber] = useState('');
  const [pairingCode, setPairingCode] = useState('');
  const [pairingStatus, setPairingStatus] = useState<'idle' | 'loading' | 'polling' | 'connected'>('idle');
  const [loading, setLoading] = useState(false);
   const pollingInterval = useRef<number | null>(null);

  const apiUrl = process.env.EXPO_PUBLIC_API_URL || '';

  // Limpa o polling se o modal for fechado ou componente desmontado
  useEffect(() => {
    return () => {
      if (pollingInterval.current) clearInterval(pollingInterval.current);
    };
  }, []);


  const handlePasswordReset = async () => {
    if (!user?.email) return;
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(user.email);
      if (error) throw error;
      Alert.alert('E-mail enviado', `Enviamos um link para ${user.email} para você redefinir sua senha.`);
    } catch (e: any) {
      Alert.alert('Erro', e.message);
    }
  };

  const pickImage = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.5,
    });

    if (!result.canceled) {
      Alert.alert('Sucesso', 'Logotipo atualizado! (Upload em processamento)');
      // Lógica de upload para Storage viria aqui
    }
  };

  const handleRequestPairingCode = async () => {
    if (!whatsappNumber || whatsappNumber.length < 10) {
      Alert.alert('Erro', 'Digite um número de WhatsApp válido com DDD.');
      return;
    }
    setPairingStatus('loading');
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token || '';
      const response = await fetch(`${apiUrl}/api/v1/crm/evolution/instance/pairing-code`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ phone_number: whatsappNumber })
      });
      const textData = await response.text();
      let data: any = {};
      try {
        data = JSON.parse(textData);
      } catch (parseError) {
        throw new Error(`Parse Error: ${textData.substring(0, 50)}`);
      }
      
      if (!response.ok) throw new Error(data.detail || 'Falha ao buscar código.');
      
      if (data.status === 'already_connected') {
        setPairingStatus('connected');
        await refreshProfile();
        setTimeout(() => setPairingModalVisible(false), 2000);
        return;
      }
      
      setPairingCode(data.code);
      setPairingStatus('polling');
      startPollingStatus();
    } catch (e: any) {
      Alert.alert('Erro na Conexão', e.message);
      setPairingStatus('idle');
    }
  };

  const startPollingStatus = () => {
    if (pollingInterval.current) clearInterval(pollingInterval.current);
    
    pollingInterval.current = setInterval(async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        const token = session?.access_token || '';
        const res = await fetch(`${apiUrl}/api/v1/crm/evolution/instance/status/${user?.id}`, {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        const data = await res.json();
        
        if (data.status === 'open') {
          if (pollingInterval.current) clearInterval(pollingInterval.current);
          setPairingStatus('connected');
          await refreshProfile();
          setTimeout(() => {
            setPairingModalVisible(false);
            setPairingStatus('idle');
            setPairingCode('');
          }, 3000);
        }
      } catch (e) {
        // Ignora erros de rede temporários no polling
      }
    }, 5000);
  };

  const SettingsItem = ({ icon, title, subtitle, onPress, toggle, value }: any) => (
    <TouchableOpacity 
      style={styles.item} 
      onPress={onPress}
      disabled={toggle}
    >
      <View style={[styles.itemIconContainer, { backgroundColor: Colors.primaryMuted }]}>
        <Ionicons name={icon} size={22} color={Colors.primary} />
      </View>
      <View style={styles.itemContent}>
        <Text style={[styles.itemTitle, { color: Colors.text }]}>{title}</Text>
        {subtitle && <Text style={[styles.itemSubtitle, { color: Colors.textSecondary }]}>{subtitle}</Text>}
      </View>
      {toggle ? (
        <Switch 
          value={value} 
          onValueChange={onPress}
          trackColor={{ false: Palette.borderStrong, true: Palette.gold[600] }}
          thumbColor={value ? Colors.primary : Colors.textSecondary}
        />
      ) : (
        <Ionicons name="chevron-forward" size={20} color="#475569" />
      )}
    </TouchableOpacity>
  );

  return (
    <>
      <ScrollView style={[styles.container, { backgroundColor: Colors.bg }]} contentContainerStyle={{ paddingBottom: 100 }}>


      <View style={styles.section}>
        <Text style={[styles.sectionTitle, { color: Colors.textMuted }]}>Pagamentos & Cobranças</Text>
        <View style={[styles.card, { backgroundColor: Colors.bgCard, borderColor: Colors.border }]}>
          <SettingsItem 
            icon="cash-outline" 
            title="Cobrar Cliente" 
            subtitle="Gerar PIX, link de cartão ou registrar dinheiro" 
            onPress={() => router.push('/billing/charge')}
          />
        </View>
      </View>

      <View style={styles.section}>
        <Text style={[styles.sectionTitle, { color: Colors.textMuted }]}>Integrações & IA</Text>
        <View style={[styles.card, { backgroundColor: Colors.bgCard, borderColor: Colors.border }]}>
          <SettingsItem 
            icon="logo-whatsapp" 
            title="Conexão WhatsApp" 
            subtitle={
              profile?.evolution_status === 'connected' 
                ? "🟢 Conectado (Online)" 
                : profile?.evolution_instance 
                  ? "🔵 Aguardando Pareamento" 
                  : "🔴 Robô não provisionado"
            }
            onPress={async () => {
              if (profile?.evolution_status === 'connected') {
                Alert.alert('WhatsApp', 'Seu robô está online e operando.');
              } else if (profile?.evolution_instance) {
                setPairingModalVisible(true);
              } else if (profile?.cnpj) {
                // Lógica de Auto-Cura para usuários antigos
                try {
                  const { data: { session: s } } = await supabase.auth.getSession();
                  const token = s?.access_token || '';
                  const res = await fetch(`${apiUrl}/api/v1/crm/evolution/instance/create`, {
                    method: 'POST',
                    headers: { 
                      'Content-Type': 'application/json',
                      'Authorization': `Bearer ${token}`
                    },
                    body: JSON.stringify({ cnpj: profile.cnpj })
                  });
                  const textData = await res.text();
                  let data: any = {};
                  try {
                    data = JSON.parse(textData);
                  } catch (parseError) {
                    throw new Error(`Parse Error: ${textData.substring(0, 50)}`);
                  }
                  if (!res.ok) throw new Error(data.detail || 'Falha ao criar instância. Tente novamente mais tarde.');
                  await refreshProfile();
                  Alert.alert('Sucesso', 'Robô provisionado! Agora você pode vincular seu celular.');
                } catch (e: any) {
                  Alert.alert('Erro', e.message);
                }
              } else {
                Alert.alert('Atenção', 'Você precisa de um CNPJ cadastrado para ter acesso ao robô de WhatsApp.');
              }
            }}
          />
        </View>
      </View>

      <View style={styles.section}>
        <Text style={[styles.sectionTitle, { color: Colors.textMuted }]}>Negócio & Identidade</Text>
        <View style={[styles.card, { backgroundColor: Colors.bgCard, borderColor: Colors.border }]}>
          <SettingsItem 
            icon="image-outline" 
            title="Logotipo da Empresa" 
            subtitle="Personalize seus documentos" 
            onPress={pickImage}
          />
          <View style={styles.divider} />
          <SettingsItem 
            icon="wallet-outline" 
            title="Contas Bancárias" 
            subtitle="Gerencie seus bancos conectados" 
            onPress={() => router.push('/settings/bank-accounts' as any)}
          />
        </View>
      </View>

      <View style={styles.section}>
        <Text style={[styles.sectionTitle, { color: Colors.textMuted }]}>Segurança</Text>
        <View style={[styles.card, { backgroundColor: Colors.bgCard, borderColor: Colors.border }]}>
          <SettingsItem 
            icon="lock-closed-outline" 
            title="Alterar Senha" 
            onPress={() => router.push('/settings/change-password' as any)}
          />
          <View style={styles.divider} />
          <SettingsItem 
            icon="shield-checkmark-outline" 
            title="Privacidade e Dados" 
            subtitle="Política de Privacidade e Termos"
            onPress={() => Linking.openURL(PRIVACY_POLICY_URL)}
          />
          <View style={styles.divider} />
          <SettingsItem 
            icon="document-text-outline" 
            title="Termos de Uso" 
            onPress={() => Linking.openURL(TERMS_OF_USE_URL)}
          />
          <View style={styles.divider} />
          <SettingsItem 
            icon="trash-outline" 
            title="Excluir Minha Conta" 
            subtitle="Remover todos os seus dados permanentemente"
            onPress={() => {
              Alert.alert(
                'Excluir Conta',
                'Esta ação é irreversível. Todos os seus dados pessoais, transações, notas fiscais e configurações serão permanentemente removidos.',
                [
                  { text: 'Cancelar', style: 'cancel' },
                  { 
                    text: 'Excluir', 
                    style: 'destructive',
                    onPress: async () => {
                      try {
                        setLoading(true);
                        const { error } = await supabase.rpc('delete_user_account');
                        if (error) throw error;
                        await supabase.auth.signOut();
                        Alert.alert('Conta Excluída', 'Seus dados foram removidos com sucesso.');
                      } catch (e: any) {
                        Alert.alert('Erro', 'Não foi possível excluir a conta. Entre em contato com o suporte.');
                      }
                    }
                  },
                ]
              );
            }}
          />
        </View>
      </View>

      <View style={styles.section}>
        <Text style={[styles.sectionTitle, { color: Colors.textMuted }]}>Suporte</Text>
        <View style={[styles.card, { backgroundColor: Colors.bgCard, borderColor: Colors.border }]}>
          <SettingsItem 
            icon="help-circle-outline" 
            title="Central de Ajuda" 
            onPress={() => Linking.openURL(SUPPORT_WHATSAPP)}
          />
          <View style={styles.divider} />
          <SettingsItem 
            icon="information-circle-outline" 
            title="Sobre o MEIFlow" 
            subtitle="Versão 1.0.2 (2026)" 
            onPress={() => Alert.alert('MEIFlow', 'Desenvolvido por PRV para acelerar o microempreendedor.')}
          />
        </View>
      </View>
    </ScrollView>


      {/* Modal de Pareamento WhatsApp (Pairing Code) */}
      <Modal 
        visible={isPairingModalVisible} 
        transparent={true}
        animationType="slide"
        onRequestClose={() => setPairingModalVisible(false)}
      >
        <TouchableOpacity 
          style={styles.modalOverlay} 
          activeOpacity={1} 
          onPressOut={() => {
             if (pairingStatus !== 'polling') setPairingModalVisible(false);
          }}
        >
          <KeyboardAvoidingView 
            style={{ flex: 1 }}
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
            keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 0}
          >
            <ScrollView 
              style={{ flex: 1 }}
              contentContainerStyle={{ flexGrow: 1 }}
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={false}
            >
              <View style={[styles.modalContent, { backgroundColor: Colors.bgCard }]}>
                <View style={styles.modalHeader}>
                  <Text style={[styles.modalTitle, { color: Colors.text }]}>Conectar WhatsApp</Text>
                  {pairingStatus !== 'polling' && (
                    <TouchableOpacity onPress={() => setPairingModalVisible(false)}>
                      <Ionicons name="close" size={24} color="#94A3B8" />
                    </TouchableOpacity>
                  )}
                </View>
             
             {pairingStatus === 'idle' || pairingStatus === 'loading' ? (
               <>
                 <Text style={[styles.modalLabel, { color: Colors.text }]}>Seu Número (com DDD)</Text>
                <TextInput
                  style={[styles.modalInput, { backgroundColor: Colors.bg, borderColor: Colors.borderStrong, color: Colors.text }]}
                  placeholder="5511999999999"
                  placeholderTextColor="#475569"
                  value={whatsappNumber}
                  onChangeText={setWhatsappNumber}
                  keyboardType="numeric"
                />
                <Text style={[styles.modalHint, { color: Colors.textMuted }]}>
                  Digite apenas números, incluindo o código do país (ex: 55) e o DDD.
                </Text>

                <TouchableOpacity 
                  style={[styles.saveBtn, { backgroundColor: '#25D366' }, pairingStatus === 'loading' && { opacity: 0.7 }]} 
                  onPress={handleRequestPairingCode}
                  disabled={pairingStatus === 'loading'}
                >
                  {pairingStatus === 'loading' ? (
                    <ActivityIndicator color="#FFF" />
                  ) : (
                    <Text style={styles.saveBtnText}>Gerar Código Seguro</Text>
                  )}
                </TouchableOpacity>
              </>
            ) : pairingStatus === 'polling' ? (
              <View style={styles.pairingContainer}>
                <Text style={[styles.pairingInstruction, { color: Colors.text }]}>Abra a notificação no seu WhatsApp e digite o código abaixo:</Text>
                <View style={[styles.codeBox, { backgroundColor: Colors.bg, borderColor: Colors.primary }]}>
                  <Text style={[styles.codeText, { color: Colors.text }]}>{pairingCode}</Text>
                </View>
                <View style={styles.pollingIndicator}>
                  <ActivityIndicator color={Colors.primary} size="small" />
                  <Text style={[styles.pollingText, { color: Colors.textSecondary }]}>Aguardando confirmação no celular...</Text>
                </View>
              </View>
            ) : (
              <View style={styles.pairingContainer}>
                <Ionicons name="checkmark-circle" size={80} color="#25D366" />
                <Text style={[styles.modalTitle, { marginTop: 16, color: Colors.text }]}>Conectado!</Text>
                <Text style={[styles.modalHint, { textAlign: 'center', color: Colors.textMuted }]}>Seu robô de IA agora está integrado ao seu WhatsApp.</Text>
              </View>
            )}
           </View>
           </ScrollView>
           </KeyboardAvoidingView>
         </TouchableOpacity>
       </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  section: {
    paddingHorizontal: 20,
    marginTop: 24,
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: 12,
    marginLeft: 4,
  },
  card: {
    borderRadius: 20,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: Palette.border,
  },
  item: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
  },
  itemIconContainer: {
    width: 40,
    height: 40,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  itemContent: {
    flex: 1,
  },
  itemTitle: {
    fontSize: 16,
    fontWeight: '600',
  },
  itemSubtitle: {
    fontSize: 13,
    marginTop: 2,
  },
  divider: {
    height: 1,
    backgroundColor: Palette.border,
    marginLeft: 72,
  },
  modalOverlay: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  modalContent: {
    padding: 24,
    borderTopLeftRadius: 32,
    borderTopRightRadius: 32,
    minHeight: 400,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 32,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '800',
  },
  modalLabel: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 12,
  },
  modalInput: {
    borderRadius: 16,
    borderWidth: 1,
    padding: 16,
    fontSize: 16,
    fontFamily: Typography.fonts.body,
  },
  modalHint: {
    fontSize: 12,
    marginTop: 12,
    lineHeight: 18,
  },
  saveBtn: {
    height: 60,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 40,
  },
  saveBtnText: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: '700',
  },
  pairingContainer: {
    alignItems: 'center',
    paddingVertical: 20,
  },
  pairingInstruction: {
    fontSize: 16,
    textAlign: 'center',
    marginBottom: 24,
    lineHeight: 24,
  },
  codeBox: {
    borderWidth: 2,
    borderRadius: 20,
    paddingVertical: 20,
    paddingHorizontal: 40,
    marginBottom: 32,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.3,
    shadowRadius: 15,
    elevation: 10,
  },
  codeText: {
    fontSize: 40,
    fontWeight: '800',
    letterSpacing: 8,
  },
  pollingIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  pollingText: {
    fontSize: 14,
    fontWeight: '500',
  },
});
