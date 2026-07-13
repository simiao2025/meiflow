import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, ScrollView, StyleSheet, ActivityIndicator, Alert, Modal } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '../../services/supabase';
import { Typography, Palette } from '../../constants/theme';

interface NewTransactionModalProps {
  visible: boolean;
  onClose: () => void;
  onSave: () => void;
  userId: string;
}

const CATEGORIES_RECEITA = ['Serviço Prestado', 'Venda de Produto', 'Comissão', 'Reembolso', 'Outros'];
const CATEGORIES_DESPESA = ['Aluguel', 'Internet/Telefone', 'Material', 'Transporte', 'Alimentação', 'Impostos', 'Marketing', 'Software', 'Outros'];

export function NewTransactionModal({ visible, onClose, onSave, userId }: NewTransactionModalProps) {
  const [txType, setTxType] = useState<'receita' | 'despesa'>('receita');
  const [txAmount, setTxAmount] = useState('');
  const [txDescription, setTxDescription] = useState('');
  const [txCategory, setTxCategory] = useState('');
  const [txPaymentMethod, setTxPaymentMethod] = useState('PIX');
  const [txDate, setTxDate] = useState(new Date().toISOString().split('T')[0]);
  const [isSaving, setIsSaving] = useState(false);

  const handleSave = async () => {
    if (!userId) return;
    if (!txAmount.trim()) {
      Alert.alert('Atenção', 'Informe o valor da transação.');
      return;
    }

    const parsedAmount = parseFloat(txAmount.replace(',', '.'));
    if (isNaN(parsedAmount) || parsedAmount <= 0) {
      Alert.alert('Atenção', 'Digite um valor válido.');
      return;
    }

    setIsSaving(true);
    const { error } = await supabase.from('transactions').insert({
      user_id: userId,
      type: txType,
      amount: txType === 'receita' ? parsedAmount : -parsedAmount,
      description: txDescription || (txType === 'receita' ? 'Receita' : 'Despesa'),
      category: txCategory || 'Outros',
      payment_method: txPaymentMethod,
      date: txDate,
    });

    if (error) {
      console.error(error);
      Alert.alert('Erro', 'Não foi possível salvar a transação.');
    } else {
      onSave();
      resetForm();
    }
    setIsSaving(false);
  };

  const resetForm = () => {
    setTxAmount('');
    setTxDescription('');
    setTxCategory('');
    setTxPaymentMethod('PIX');
    setTxType('receita');
    setTxDate(new Date().toISOString().split('T')[0]);
  };

  const handleClose = () => {
    resetForm();
    onClose();
  };

  return (
    <Modal visible={visible} transparent animationType="slide">
      <View style={styles.modalOverlay}>
        <BlurView intensity={20} tint="dark" style={StyleSheet.absoluteFill} />
        <View style={styles.modalContent}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Nova Transação</Text>
            <TouchableOpacity onPress={handleClose} style={styles.closeBtn}>
              <Ionicons name="close" size={24} color="#94A3B8" />
            </TouchableOpacity>
          </View>

          <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 24 }} keyboardShouldPersistTaps="handled">
            <View style={styles.typeSelector}>
              <TouchableOpacity 
                style={[styles.typeBtn, txType === 'receita' && { backgroundColor: 'rgba(16,185,129,0.15)' }]}
                onPress={() => { setTxType('receita'); setTxCategory(''); }}
              >
                <Ionicons name="arrow-up" size={16} color={txType === 'receita' ? '#10B981' : '#64748B'} />
                <Text style={[styles.typeBtnText, txType === 'receita' && { color: '#10B981' }]}>Receita</Text>
              </TouchableOpacity>
              <TouchableOpacity 
                style={[styles.typeBtn, txType === 'despesa' && { backgroundColor: 'rgba(239,68,68,0.15)' }]}
                onPress={() => { setTxType('despesa'); setTxCategory(''); }}
              >
                <Ionicons name="arrow-down" size={16} color={txType === 'despesa' ? '#EF4444' : '#64748B'} />
                <Text style={[styles.typeBtnText, txType === 'despesa' && { color: '#EF4444' }]}>Despesa</Text>
              </TouchableOpacity>
            </View>

            <Text style={styles.inputLabel}>Valor (R$) *</Text>
            <TextInput style={styles.input} placeholder="0,00" placeholderTextColor="#475569" keyboardType="numeric" value={txAmount} onChangeText={setTxAmount} />

            <Text style={styles.inputLabel}>Descrição</Text>
            <TextInput style={styles.input} placeholder="Ex: Pagamento do cliente João" placeholderTextColor="#475569" value={txDescription} onChangeText={setTxDescription} />

            <Text style={styles.inputLabel}>Categoria</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 16 }}>
              {(txType === 'receita' ? CATEGORIES_RECEITA : CATEGORIES_DESPESA).map(cat => (
                <TouchableOpacity
                  key={cat}
                  style={[styles.catChip, txCategory === cat && styles.catChipActive]}
                  onPress={() => setTxCategory(cat)}
                >
                  <Text style={[styles.catChipText, txCategory === cat && styles.catChipTextActive]}>{cat}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>

            <Text style={styles.inputLabel}>Forma de Pagamento</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 16 }}>
              {['PIX', 'Dinheiro', 'Cartão', 'Boleto', 'Transferência'].map(pm => (
                <TouchableOpacity
                  key={pm}
                  style={[styles.catChip, txPaymentMethod === pm && styles.catChipActive]}
                  onPress={() => setTxPaymentMethod(pm)}
                >
                  <Text style={[styles.catChipText, txPaymentMethod === pm && styles.catChipTextActive]}>{pm}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>

            <Text style={styles.inputLabel}>Data (AAAA-MM-DD)</Text>
            <TextInput style={styles.input} placeholder="2026-05-30" placeholderTextColor="#475569" value={txDate} onChangeText={setTxDate} />

            <TouchableOpacity style={[styles.saveBtn, isSaving && { opacity: 0.7 }]} onPress={handleSave} disabled={isSaving}>
              <LinearGradient colors={txType === 'receita' ? ['#10B981', '#059669'] : ['#EF4444', '#DC2626']} style={styles.saveBtnGrad}>
                {isSaving ? <ActivityIndicator color="#FFF" /> : (
                  <Text style={styles.saveBtnText}>Registrar {txType === 'receita' ? 'Receita' : 'Despesa'}</Text>
                )}
              </LinearGradient>
            </TouchableOpacity>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  modalOverlay: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.5)' },
  modalContent: { backgroundColor: '#0F172A', borderTopLeftRadius: 32, borderTopRightRadius: 32, padding: 24, paddingBottom: 24, borderWidth: 1, borderColor: 'rgba(255,255,255,0.05)', maxHeight: '85%' },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
  modalTitle: { color: '#F1F5F9', fontSize: 18, fontFamily: Typography.fonts.display },
  closeBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: 'rgba(255,255,255,0.05)', justifyContent: 'center', alignItems: 'center' },

  typeSelector: { flexDirection: 'row', backgroundColor: 'rgba(255,255,255,0.03)', borderRadius: 12, padding: 4, marginBottom: 20 },
  typeBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 12, borderRadius: 8, gap: 6 },
  typeBtnText: { color: '#64748B', fontSize: 13, fontFamily: Typography.fonts.medium },

  inputLabel: { color: '#64748B', fontSize: 12, fontFamily: Typography.fonts.medium, marginBottom: 8, marginLeft: 4 },
  input: { backgroundColor: '#1E293B', borderRadius: 12, padding: 14, color: '#F1F5F9', fontFamily: Typography.fonts.medium, fontSize: 14, marginBottom: 16, borderWidth: 1, borderColor: '#334155' },

  catChip: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20, backgroundColor: 'rgba(255,255,255,0.03)', borderWidth: 1, borderColor: '#334155', marginRight: 8 },
  catChipActive: { backgroundColor: 'rgba(234, 179, 8, 0.2)', borderColor: '#EAB308' },
  catChipText: { color: '#64748B', fontSize: 12, fontFamily: Typography.fonts.medium },
  catChipTextActive: { color: '#F1F5F9' },

  saveBtn: { marginTop: 8, borderRadius: 12, overflow: 'hidden' },
  saveBtnGrad: { paddingVertical: 18, alignItems: 'center' },
  saveBtnText: { color: '#FFF', fontSize: 14, fontFamily: Typography.fonts.display },
});