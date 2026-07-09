import React, { useState } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  TextInput, 
  TouchableOpacity, 
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  Alert
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';

export default function NewBilling() {
  const [amount, setAmount] = useState('');
  const [description, setDescription] = useState('');
  const [selectedMethod, setSelectedMethod] = useState<'pix' | 'boleto' | 'card'>('pix');

  const handleCreateBilling = () => {
    if (!amount) {
      Alert.alert('Erro', 'Por favor, informe o valor da cobrança.');
      return;
    }
    Alert.alert('Sucesso!', `Cobrança de R$ ${amount} via ${selectedMethod.toUpperCase()} gerada com sucesso.`);
  };

  return (
    <LinearGradient colors={['#0F172A', '#1E293B']} style={styles.container}>
      <KeyboardAvoidingView 
        behavior='padding' keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : -300}
        style={{ flex: 1 }}
      >
        <ScrollView contentContainerStyle={styles.content}>
          <View style={styles.header}>
            <Text style={styles.title}>Nova Cobrança</Text>
            <Text style={styles.subtitle}>Emita cobranças profissionais em segundos</Text>
          </View>

          <View style={styles.form}>
            <Text style={styles.label}>Valor da Cobrança</Text>
            <View style={styles.amountContainer}>
              <Text style={styles.currency}>R$</Text>
              <TextInput
                style={styles.amountInput}
                placeholder="0,00"
                placeholderTextColor="#334155"
                keyboardType="numeric"
                value={amount}
                onChangeText={setAmount}
              />
            </View>

            <Text style={styles.label}>Descrição do Serviço/Venda</Text>
            <View style={styles.inputContainer}>
              <TextInput
                style={styles.input}
                placeholder="Ex: Consultoria de Marketing"
                placeholderTextColor="#64748B"
                value={description}
                onChangeText={setDescription}
              />
            </View>

            <Text style={styles.label}>Forma de Recebimento</Text>
            <View style={styles.methodsGrid}>
              <MethodCard 
                icon="qr-code" 
                label="Pix" 
                active={selectedMethod === 'pix'} 
                onPress={() => setSelectedMethod('pix')} 
              />
              <MethodCard 
                icon="barcode" 
                label="Boleto" 
                active={selectedMethod === 'boleto'} 
                onPress={() => setSelectedMethod('boleto')} 
              />
              <MethodCard 
                icon="card" 
                label="Cartão" 
                active={selectedMethod === 'card'} 
                onPress={() => setSelectedMethod('card')} 
              />
            </View>

            <TouchableOpacity style={styles.createButton} onPress={handleCreateBilling}>
              <LinearGradient colors={['#38BDF8', '#0284C7']} style={styles.gradientButton}>
                <Text style={styles.createButtonText}>Gerar Cobrança</Text>
              </LinearGradient>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </LinearGradient>
  );
}

function MethodCard({ icon, label, active, onPress }: { icon: any, label: string, active: boolean, onPress: () => void }) {
  return (
    <TouchableOpacity 
      style={[styles.methodCard, active && styles.methodCardActive]} 
      onPress={onPress}
    >
      <Ionicons name={icon} size={24} color={active ? '#38BDF8' : '#94A3B8'} />
      <Text style={[styles.methodLabel, active && styles.methodLabelActive]}>{label}</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    padding: 24,
    paddingTop: 60,
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
  },
  form: {
    flex: 1,
  },
  label: {
    color: '#F1F5F9',
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 12,
    marginLeft: 4,
  },
  amountContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 32,
  },
  currency: {
    fontSize: 32,
    fontWeight: '800',
    color: '#38BDF8',
    marginRight: 12,
  },
  amountInput: {
    fontSize: 48,
    fontWeight: '800',
    color: '#F8FAFC',
    flex: 1,
  },
  inputContainer: {
    backgroundColor: '#1E293B',
    borderRadius: 16,
    paddingHorizontal: 16,
    height: 60,
    justifyContent: 'center',
    marginBottom: 32,
    borderWidth: 1,
    borderColor: '#334155',
  },
  input: {
    color: '#F1F5F9',
    fontSize: 16,
  },
  methodsGrid: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 40,
  },
  methodCard: {
    width: '31%',
    backgroundColor: '#1E293B',
    padding: 16,
    borderRadius: 16,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#334155',
  },
  methodCardActive: {
    borderColor: '#38BDF8',
    backgroundColor: '#38BDF810',
  },
  methodLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: '#94A3B8',
    marginTop: 8,
  },
  methodLabelActive: {
    color: '#38BDF8',
  },
  createButton: {
    borderRadius: 16,
    overflow: 'hidden',
    marginTop: 10,
  },
  gradientButton: {
    height: 64,
    justifyContent: 'center',
    alignItems: 'center',
  },
  createButtonText: {
    color: '#FFF',
    fontSize: 18,
    fontWeight: '800',
  }
});
