import React, { useState } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  Switch, 
  ScrollView, 
  TouchableOpacity,
  Alert
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';

export default function PaymentSettings() {
  const [pixEnabled, setPixEnabled] = useState(true);
  const [boletoEnabled, setBoletoEnabled] = useState(true);
  const [cardEnabled, setCardEnabled] = useState(false);

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.title}>Recebimentos e Bancos</Text>
        <Text style={styles.subtitle}>Escolha como quer receber e conecte suas contas</Text>
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        {/* Métodos de Pagamento */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Métodos Disponíveis para Clientes</Text>
          
          <View style={styles.settingItem}>
            <View style={styles.settingInfo}>
              <View style={[styles.iconBox, { backgroundColor: '#10B98120' }]}>
                <Ionicons name="qr-code-outline" size={20} color="#10B981" />
              </View>
              <View>
                <Text style={styles.settingLabel}>Pix (Recomendado)</Text>
                <Text style={styles.settingDesc}>Recebimento instantâneo, menor taxa.</Text>
              </View>
            </View>
            <Switch 
              value={pixEnabled} 
              onValueChange={setPixEnabled}
              trackColor={{ false: '#334155', true: '#10B981' }}
            />
          </View>

          <View style={styles.settingItem}>
            <View style={styles.settingInfo}>
              <View style={[styles.iconBox, { backgroundColor: '#38BDF820' }]}>
                <Ionicons name="barcode-outline" size={20} color="#38BDF8" />
              </View>
              <View>
                <Text style={styles.settingLabel}>Boleto Bancário</Text>
                <Text style={styles.settingDesc}>Ideal para vendas a prazo e serviços.</Text>
              </View>
            </View>
            <Switch 
              value={boletoEnabled} 
              onValueChange={setBoletoEnabled}
              trackColor={{ false: '#334155', true: '#38BDF8' }}
            />
          </View>

          <View style={styles.settingItem}>
            <View style={styles.settingInfo}>
              <View style={[styles.iconBox, { backgroundColor: '#8B5CF620' }]}>
                <Ionicons name="card-outline" size={20} color="#8B5CF6" />
              </View>
              <View>
                <Text style={styles.settingLabel}>Cartão de Crédito</Text>
                <Text style={styles.settingDesc}>Venda em até 12x para seus clientes.</Text>
              </View>
            </View>
            <Switch 
              value={cardEnabled} 
              onValueChange={setCardEnabled}
              trackColor={{ false: '#334155', true: '#8B5CF6' }}
            />
          </View>
        </View>

        {/* Conexão Bancária */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Contas Bancárias Conectadas</Text>
          <Text style={styles.sectionDesc}>
            Conecte seu banco para sincronizar extratos e automatizar seu financeiro via Open Finance.
          </Text>

          <TouchableOpacity style={styles.addBankButton} onPress={() => Alert.alert('Open Finance', 'Iniciando fluxo seguro de conexão Pluggy...')}>
            <Ionicons name="add-circle-outline" size={24} color="#38BDF8" />
            <Text style={styles.addBankText}>Conectar Nova Conta Bancária</Text>
          </TouchableOpacity>

          <View style={styles.bankCard}>
            <Ionicons name="business" size={24} color="#94A3B8" />
            <View style={styles.bankInfo}>
              <Text style={styles.bankName}>Nubank (Exemplo)</Text>
              <Text style={styles.bankMeta}>Conta Corrente • **** 4589</Text>
            </View>
            <View style={styles.activeBadge}>
              <Text style={styles.activeText}>Conectado</Text>
            </View>
          </View>
        </View>

        <TouchableOpacity style={styles.saveButton}>
          <LinearGradient colors={['#38BDF8', '#0284C7']} style={styles.gradientButton}>
            <Text style={styles.saveButtonText}>Salvar Configurações</Text>
          </LinearGradient>
        </TouchableOpacity>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0F172A',
  },
  header: {
    paddingHorizontal: 24,
    paddingTop: 60,
    marginBottom: 32,
  },
  title: {
    fontSize: 24,
    fontWeight: '800',
    color: '#F8FAFC',
  },
  subtitle: {
    fontSize: 14,
    color: '#94A3B8',
    marginTop: 8,
  },
  content: {
    paddingHorizontal: 24,
    paddingBottom: 40,
  },
  section: {
    marginBottom: 40,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#F8FAFC',
    marginBottom: 16,
  },
  sectionDesc: {
    fontSize: 14,
    color: '#94A3B8',
    marginBottom: 20,
    lineHeight: 20,
  },
  settingItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#1E293B',
    padding: 16,
    borderRadius: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#334155',
  },
  settingInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  iconBox: {
    width: 40,
    height: 40,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  settingLabel: {
    fontSize: 16,
    fontWeight: '700',
    color: '#F1F5F9',
  },
  settingDesc: {
    fontSize: 12,
    color: '#64748B',
    marginTop: 2,
  },
  addBankButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#38BDF8',
    borderStyle: 'dashed',
    padding: 16,
    borderRadius: 16,
    marginBottom: 16,
  },
  addBankText: {
    color: '#38BDF8',
    fontSize: 15,
    fontWeight: '700',
    marginLeft: 8,
  },
  bankCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1E293B',
    padding: 16,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#334155',
  },
  bankInfo: {
    flex: 1,
    marginLeft: 16,
  },
  bankName: {
    fontSize: 16,
    fontWeight: '700',
    color: '#F1F5F9',
  },
  bankMeta: {
    fontSize: 12,
    color: '#64748B',
    marginTop: 2,
  },
  activeBadge: {
    backgroundColor: '#10B98120',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  activeText: {
    color: '#10B981',
    fontSize: 10,
    fontWeight: '800',
  },
  saveButton: {
    marginTop: 10,
    borderRadius: 16,
    overflow: 'hidden',
  },
  gradientButton: {
    height: 60,
    justifyContent: 'center',
    alignItems: 'center',
  },
  saveButtonText: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: '700',
  }
});
