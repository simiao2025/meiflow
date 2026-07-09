import React, { useState, useEffect } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  ScrollView, 
  TouchableOpacity, 
  TextInput,
  Alert,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { supabase } from '../../services/supabase';
import { useAuthStore } from '../../stores/authStore';
import { useFiscalStore } from '../../stores/fiscalStore';

export default function EmitInvoiceScreen() {
  const router = useRouter();
  const { user } = useAuthStore();
  const { fetchFiscalData } = useFiscalStore();

  const [clients, setClients] = useState<any[]>([]);
  const [catalog, setCatalog] = useState<any[]>([]);
  const [loadingData, setLoadingData] = useState(true);
  
  // Form state
  const [selectedClient, setSelectedClient] = useState('');
  const [selectedItem, setSelectedItem] = useState<any>(null);
  const [quantity, setQuantity] = useState('1');
  const [invoiceType, setInvoiceType] = useState<'nfe' | 'nfse'>('nfse');
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (user) {
      loadDropdownData();
    }
  }, [user]);

  const loadDropdownData = async () => {
    try {
      const { data: clientsData } = await supabase
        .from('clients')
        .select('*')
        .eq('user_id', user?.id)
        .order('name');
        
      const { data: catalogData } = await supabase
        .from('catalog_items')
        .select('*')
        .eq('user_id', user?.id)
        .eq('is_active', true)
        .order('name');

      if (clientsData) setClients(clientsData);
      if (catalogData) setCatalog(catalogData);
    } catch (error) {
      console.error('Erro ao carregar dados:', error);
    } finally {
      setLoadingData(false);
    }
  };

  const handleSelectCatalogItem = (item: any) => {
    setSelectedItem(item);
    // Automaticamente seta o tipo de nota com base no tipo do item do catálogo
    if (item.type === 'service') setInvoiceType('nfse');
    if (item.type === 'product') setInvoiceType('nfe');
  };

  const handleEmit = async () => {
    if (!selectedClient || !selectedItem || !quantity) {
      Alert.alert('Atenção', 'Selecione um cliente e um produto/serviço.');
      return;
    }

    setIsSubmitting(true);
    try {
      if (!user) throw new Error("Usuário não autenticado");
      
      const { fiscalService } = require('../../services/api');
      const qty = parseFloat(quantity);
      if (isNaN(qty) || qty <= 0) throw new Error('Quantidade inválida');
      await fiscalService.emitInvoice(user.id, selectedClient, selectedItem.id, qty);

      Alert.alert('Sucesso!', 'Nota Fiscal emitida com sucesso.', [
        { text: 'OK', onPress: () => {
          fetchFiscalData(user.id); // Atualiza a store
          router.back();
        }}
      ]);
    } catch (error: any) {
      Alert.alert('Erro', 'Não foi possível emitir a NF: ' + error.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const calculateTotal = () => {
    if (!selectedItem || !quantity) return '0,00';
    const price = parseFloat(selectedItem.price);
    const qty = parseFloat(quantity);
    if (isNaN(price) || isNaN(qty)) return '0,00';
    return (price * qty).toFixed(2).replace('.', ',');
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={24} color="#F8FAFC" />
        </TouchableOpacity>
        <Text style={styles.title}>Emitir Nota Fiscal</Text>
        <View style={{ width: 40 }} />
      </View>

      {loadingData ? (
        <ActivityIndicator size="large" color="#38BDF8" style={{ marginTop: 50 }} />
      ) : (
<KeyboardAvoidingView
          style={{ flex: 1 }}
          behavior='padding' keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : -300}
        >
        <ScrollView style={styles.form} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
           
           <Text style={styles.label}>Cliente</Text>
          <View style={styles.dropdownContainer}>
            {clients.map(c => (
              <TouchableOpacity 
                key={c.id} 
                style={[styles.dropdownItem, selectedClient === c.id && styles.dropdownItemActive]}
                onPress={() => setSelectedClient(c.id)}
              >
                <Text style={styles.dropdownText}>{c.name}</Text>
              </TouchableOpacity>
            ))}
            {clients.length === 0 && (
              <Text style={styles.emptyText}>Nenhum cliente cadastrado ainda.</Text>
            )}
          </View>

          <Text style={styles.label}>Serviço ou Produto (Catálogo)</Text>
          <View style={styles.dropdownContainer}>
            {catalog.map(item => (
              <TouchableOpacity 
                key={item.id} 
                style={[styles.dropdownItem, selectedItem?.id === item.id && styles.dropdownItemActive]}
                onPress={() => handleSelectCatalogItem(item)}
              >
                <View>
                  <Text style={styles.dropdownText}>{item.name}</Text>
                  <Text style={styles.dropdownSubtext}>
                    {item.type === 'service' ? 'NFS-e' : 'NF-e'} • R$ {item.price} por {item.billing_unit}
                  </Text>
                </View>
              </TouchableOpacity>
            ))}
            {catalog.length === 0 && (
              <Text style={styles.emptyText}>Nenhum item no catálogo ainda.</Text>
            )}
          </View>

          {selectedItem && (
            <View style={styles.row}>
              <View style={{ flex: 1, marginRight: 12 }}>
                <Text style={styles.label}>Qtd. ({selectedItem.billing_unit})</Text>
                <TextInput 
                  style={styles.input}
                  keyboardType="numeric"
                  value={quantity}
                  onChangeText={setQuantity}
                />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.label}>Tipo de Nota</Text>
                <View style={styles.disabledInput}>
                  <Text style={styles.disabledText}>{invoiceType.toUpperCase()}</Text>
                </View>
              </View>
            </View>
          )}

          <View style={styles.totalCard}>
            <Text style={styles.totalLabel}>Valor Total da Nota</Text>
            <Text style={styles.totalValue}>R$ {calculateTotal()}</Text>
          </View>

          <TouchableOpacity 
            style={[styles.submitButton, isSubmitting && { opacity: 0.7 }]} 
            onPress={handleEmit}
            disabled={isSubmitting}
          >
            <LinearGradient colors={['#10B981', '#059669']} style={styles.gradientButton}>
              {isSubmitting ? (
                <ActivityIndicator color="#FFF" />
              ) : (
                <>
                  <Ionicons name="receipt" size={20} color="#FFF" style={{marginRight: 8}} />
                  <Text style={styles.submitText}>Emitir Nota Agora</Text>
                </>
              )}
            </LinearGradient>
          </TouchableOpacity>

        </ScrollView>
        </KeyboardAvoidingView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0F172A' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 24,
    paddingTop: 60,
    paddingBottom: 20,
    backgroundColor: '#1E293B',
    borderBottomWidth: 1,
    borderBottomColor: '#334155'
  },
  backButton: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: '#334155', justifyContent: 'center', alignItems: 'center'
  },
  title: { fontSize: 18, fontWeight: '700', color: '#F8FAFC' },
  form: { padding: 24 },
  label: { fontSize: 14, fontWeight: '600', color: '#94A3B8', marginBottom: 8, marginTop: 16 },
  dropdownContainer: {
    backgroundColor: '#1E293B', borderRadius: 12, borderWidth: 1, borderColor: '#334155', overflow: 'hidden'
  },
  dropdownItem: { padding: 16, borderBottomWidth: 1, borderBottomColor: '#334155' },
  dropdownItemActive: { backgroundColor: '#38BDF820' },
  dropdownText: { fontSize: 16, color: '#F1F5F9', fontWeight: '600' },
  dropdownSubtext: { fontSize: 12, color: '#94A3B8', marginTop: 4 },
  emptyText: { padding: 16, color: '#64748B', textAlign: 'center' },
  row: { flexDirection: 'row', marginTop: 16 },
  input: {
    backgroundColor: '#1E293B', borderRadius: 12, borderWidth: 1, borderColor: '#334155',
    color: '#F8FAFC', fontSize: 16, padding: 16, fontWeight: '600'
  },
  disabledInput: {
    backgroundColor: '#1E293B', borderRadius: 12, borderWidth: 1, borderColor: '#334155',
    padding: 16, justifyContent: 'center', opacity: 0.7
  },
  disabledText: { color: '#94A3B8', fontSize: 16, fontWeight: '600' },
  totalCard: {
    backgroundColor: '#38BDF815', borderRadius: 16, padding: 20,
    marginTop: 32, marginBottom: 24, borderWidth: 1, borderColor: '#38BDF830',
    alignItems: 'center'
  },
  totalLabel: { fontSize: 14, color: '#38BDF8', fontWeight: '600', marginBottom: 8 },
  totalValue: { fontSize: 32, color: '#F8FAFC', fontWeight: '800' },
  submitButton: { borderRadius: 16, overflow: 'hidden', marginBottom: 40 },
  gradientButton: { flexDirection: 'row', height: 60, justifyContent: 'center', alignItems: 'center' },
  submitText: { color: '#FFF', fontSize: 16, fontWeight: '700' }
});
