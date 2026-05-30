import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Dimensions, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Palette, Typography } from '../../constants/theme';
import { useRouter } from 'expo-router';
import { aiFinanceService } from '../../services/api';

const { width } = Dimensions.get('window');

export default function OpenFinanceSync() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);

  const handleConnect = async () => {
    setLoading(true);
    try {
      await aiFinanceService.syncBankStatements();
      setSuccess(true);
      setTimeout(() => {
        router.back();
      }, 2000);
    } catch (e) {
      alert("Erro ao conectar ao banco. Tente novamente.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
          <Ionicons name="chevron-back" size={24} color="#FFF" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Open Finance</Text>
      </View>

      <View style={styles.content}>
        <View style={styles.iconWrapper}>
          <Ionicons name="business" size={48} color={Colors.primary} />
          <View style={styles.badge}>
            <Ionicons name="shield-checkmark" size={14} color="#FFF" />
          </View>
        </View>
        
        <Text style={styles.title}>Conecte seu Banco</Text>
        <Text style={styles.subtitle}>
          Deixe a nossa IA ler seu extrato bancário de forma segura e cruzar as informações com suas notas fiscais e impostos.
        </Text>

        <View style={styles.benefits}>
          <View style={styles.benefitRow}>
            <Ionicons name="checkmark-circle" size={20} color={Colors.primary} />
            <Text style={styles.benefitText}>Conciliação bancária 100% automática</Text>
          </View>
          <View style={styles.benefitRow}>
            <Ionicons name="checkmark-circle" size={20} color={Colors.primary} />
            <Text style={styles.benefitText}>Classificação fiscal por Inteligência Artificial</Text>
          </View>
          <View style={styles.benefitRow}>
            <Ionicons name="checkmark-circle" size={20} color={Colors.primary} />
            <Text style={styles.benefitText}>Ambiente criptografado e seguro (Leitura Apenas)</Text>
          </View>
        </View>

        {success ? (
          <View style={styles.successBox}>
             <Ionicons name="checkmark-circle" size={40} color={Colors.primary} />
             <Text style={styles.successText}>Extrato Sincronizado!</Text>
          </View>
        ) : (
          <TouchableOpacity style={styles.connectBtn} onPress={handleConnect} disabled={loading}>
            {loading ? <ActivityIndicator color={Palette.black} /> : <Text style={styles.connectBtnText}>Continuar e Conectar</Text>}
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Palette.black,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingTop: 60,
    paddingHorizontal: 24,
    paddingBottom: 20,
    borderBottomWidth: 1,
    borderBottomColor: Palette.border,
  },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: Palette.navyDeep,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: Palette.borderStrong,
  },
  headerTitle: {
    flex: 1,
    textAlign: 'center',
    color: '#FFF',
    fontSize: 18,
    fontFamily: Typography.fonts.medium,
    marginRight: 40,
  },
  content: {
    flex: 1,
    padding: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconWrapper: {
    width: 96,
    height: 96,
    borderRadius: 48,
    backgroundColor: 'rgba(234, 179, 8, 0.1)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 24,
    borderWidth: 1,
    borderColor: 'rgba(234, 179, 8, 0.3)',
  },
  badge: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    backgroundColor: '#10B981',
    width: 28,
    height: 28,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: Palette.black,
  },
  title: {
    fontSize: 24,
    color: '#FFF',
    fontFamily: Typography.fonts.display,
    marginBottom: 12,
  },
  subtitle: {
    fontSize: 15,
    color: Colors.textSecondary,
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 40,
  },
  benefits: {
    width: '100%',
    gap: 16,
    marginBottom: 48,
  },
  benefitRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  benefitText: {
    color: '#FFF',
    fontSize: 15,
  },
  connectBtn: {
    width: '100%',
    backgroundColor: Colors.primary,
    paddingVertical: 16,
    borderRadius: 16,
    alignItems: 'center',
  },
  connectBtnText: {
    color: Palette.black,
    fontSize: 16,
    fontFamily: Typography.fonts.medium,
    fontWeight: '700',
  },
  successBox: {
    alignItems: 'center',
    gap: 8,
  },
  successText: {
    color: Colors.primary,
    fontSize: 18,
    fontFamily: Typography.fonts.medium,
  }
});
