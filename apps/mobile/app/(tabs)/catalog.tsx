import React, { useState, useEffect, useRef } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
  TextInput, Modal, ActivityIndicator, Animated, Alert, ScrollView, Platform
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
import { Ionicons } from '@expo/vector-icons';
import { useAuthStore } from '../../stores/authStore';
import { supabase } from '../../services/supabase';
import { Typography, Palette, useThemeColors } from '../../constants/theme';
import { useRouter } from 'expo-router';

export default function CatalogScreen() {
  const Colors = useThemeColors();
  const styles = getStyles(Colors);
  const { user } = useAuthStore();
  const router = useRouter();
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'service' | 'product'>('all');
  const [modalVisible, setModalVisible] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  
  // Form states
  const [newItemName, setNewItemName] = useState('');
  const [newItemDesc, setNewItemDesc] = useState('');
  const [newItemPrice, setNewItemPrice] = useState('');
  const [newItemType, setNewItemType] = useState<'service' | 'product'>('service');
  const [newItemUnit, setNewItemUnit] = useState('UN');
  
  // Product specific fields
  const [newNCM, setNewNCM] = useState('');
  const [newBarcode, setNewBarcode] = useState('');
  const [newStock, setNewStock] = useState('0');

  const fadeAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    loadItems();
    Animated.timing(fadeAnim, { toValue: 1, duration: 800, useNativeDriver: true }).start();
  }, []);

  const loadItems = async () => {
    if (!user) return;
    setLoading(true);
    const { data } = await supabase.from('catalog_items').select('*').eq('user_id', user.id).order('created_at', { ascending: false });
    if (data) setItems(data);
    setLoading(false);
  };

  const filtered = items.filter(i => filter === 'all' || i.type === filter);

  const handleSaveItem = async () => {
    if (!user) return;
    if (!newItemName.trim() || !newItemPrice.trim()) {
      Alert.alert('Atenção', 'Nome e Preço são obrigatórios.');
      return;
    }
    
    if (newItemType === 'product' && !newNCM.trim()) {
      Alert.alert('Atenção', 'NCM é obrigatório para produtos físicos.');
      return;
    }
    
    setIsSaving(true);
    const priceValue = parseFloat(newItemPrice.replace(',', '.'));
    
    if (isNaN(priceValue)) {
      Alert.alert('Atenção', 'Digite um preço válido.');
      setIsSaving(false);
      return;
    }

    const payload: any = {
      user_id: user.id,
      name: newItemName,
      description: newItemDesc,
      price: priceValue,
      type: newItemType,
      billing_unit: newItemUnit,
      is_active: true
    };

    if (newItemType === 'product') {
      payload.ncm = newNCM;
      payload.barcode = newBarcode;
      payload.stock_quantity = Math.max(0, parseInt(newStock) || 0);
    }

    const { error } = await supabase.from('catalog_items').insert(payload);

    if (error) {
      console.error('Erro ao salvar item:', error);
      Alert.alert('Erro', error.message || 'Não foi possível salvar o item no catálogo.');
      setIsSaving(false);
      return;
    }

    setModalVisible(false);
    setNewItemName('');
    setNewItemDesc('');
    setNewItemPrice('');
    setNewItemType('service');
    setNewItemUnit('UN');
    setNewNCM('');
    setNewBarcode('');
    setNewStock('0');
    loadItems();
    setIsSaving(false);
  };

  return (
    <View style={styles.container}>
      <LinearGradient colors={[Colors.bg, '#0B1121']} style={StyleSheet.absoluteFill} />
      
      <Animated.View style={{ flex: 1, opacity: fadeAnim }}>
        <View style={styles.header}>
           <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
             <Ionicons name="arrow-back" size={24} color={Colors.text} />
           </TouchableOpacity>
           <View>
             <Text style={styles.eyebrow}>INVENTÁRIO VANGUARD</Text>
             <Text style={styles.h1}>Catálogo</Text>
           </View>
        </View>

        <View style={styles.filterRow}>
          {(['all', 'service', 'product'] as const).map(f => (
            <TouchableOpacity key={f} style={[styles.filterBtn, filter === f && styles.filterBtnActive]} onPress={() => setFilter(f)}>
              <Text style={[styles.filterText, filter === f && { color: Colors.text }]}>
                {f === 'all' ? 'TUDO' : f === 'service' ? 'SERVIÇOS' : 'PRODUTOS'}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {loading ? <ActivityIndicator color={Colors.primary} size="large" style={{ marginTop: 40 }} /> : (
          <FlatList 
            data={filtered} 
            keyExtractor={i => i.id} 
            contentContainerStyle={styles.list}
            renderItem={({ item, index }) => <CatalogItemCard item={item} index={index} />}
            ListEmptyComponent={
              <View style={styles.empty}>
                <Ionicons name="pricetags-outline" size={48} color={Colors.textMuted} />
                <Text style={styles.emptyText}>Nenhum item no inventário</Text>
              </View>
            }
          />
        )}

        <TouchableOpacity style={styles.fab} onPress={() => setModalVisible(true)}>
           <LinearGradient colors={[Colors.primary, Colors.primaryLight]} style={styles.fabGrad}>
              <Ionicons name="add" size={28} color="#FFF" />
           </LinearGradient>
        </TouchableOpacity>
      </Animated.View>

      {/* Modal de Cadastro */}
      <Modal visible={modalVisible} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <BlurView intensity={20} tint="dark" style={StyleSheet.absoluteFill} />
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Novo Item no Catálogo</Text>
              <TouchableOpacity onPress={() => setModalVisible(false)} style={styles.closeBtn}>
                <Ionicons name="close" size={24} color={Colors.textMuted} />
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 20 }}>
              <View style={styles.typeSelector}>
                <TouchableOpacity 
                  style={[styles.typeBtn, newItemType === 'service' && styles.typeBtnActive]}
                  onPress={() => setNewItemType('service')}
                >
                  <Ionicons name="construct-outline" size={16} color={newItemType === 'service' ? Colors.text : Colors.textMuted} />
                  <Text style={[styles.typeBtnText, newItemType === 'service' && {color: Colors.text}]}>Serviço (NFS-e)</Text>
                </TouchableOpacity>
                <TouchableOpacity 
                  style={[styles.typeBtn, newItemType === 'product' && styles.typeBtnActive]}
                  onPress={() => setNewItemType('product')}
                >
                  <Ionicons name="cube-outline" size={16} color={newItemType === 'product' ? Colors.text : Colors.textMuted} />
                  <Text style={[styles.typeBtnText, newItemType === 'product' && {color: Colors.text}]}>Produto (NF-e)</Text>
                </TouchableOpacity>
              </View>

              <Text style={styles.inputLabel}>Nome do Item *</Text>
              <TextInput 
                style={styles.input} 
                placeholder="Ex: Consultoria ou Camiseta" 
                placeholderTextColor="#475569"
                value={newItemName}
                onChangeText={setNewItemName}
              />

              <View style={{flexDirection: 'row', gap: 16}}>
                <View style={{flex: 2}}>
                  <Text style={styles.inputLabel}>Preço (R$) *</Text>
                  <TextInput 
                    style={styles.input} 
                    placeholder="0,00" 
                    placeholderTextColor="#475569"
                    keyboardType="numeric"
                    value={newItemPrice}
                    onChangeText={setNewItemPrice}
                  />
                </View>
                <View style={{flex: 1}}>
                  <Text style={styles.inputLabel}>Unidade</Text>
                  <TextInput 
                    style={styles.input} 
                    placeholder="UN, H..." 
                    placeholderTextColor="#475569"
                    value={newItemUnit}
                    onChangeText={setNewItemUnit}
                    autoCapitalize="characters"
                  />
                </View>
              </View>

              {newItemType === 'product' && (
                <>
                  <View style={{flexDirection: 'row', gap: 16}}>
                    <View style={{flex: 2}}>
                      <Text style={styles.inputLabel}>Estoque Atual</Text>
                      <TextInput 
                        style={styles.input} 
                        placeholder="0" 
                        placeholderTextColor="#475569"
                        keyboardType="numeric"
                        value={newStock}
                        onChangeText={setNewStock}
                      />
                    </View>
                    <View style={{flex: 3}}>
                      <Text style={styles.inputLabel}>NCM (Obrigatório) *</Text>
                      <TextInput 
                        style={styles.input} 
                        placeholder="0000.00.00" 
                        placeholderTextColor="#475569"
                        keyboardType="numeric"
                        maxLength={8}
                        value={newNCM}
                        onChangeText={setNewNCM}
                      />
                    </View>
                  </View>
                  <Text style={styles.inputLabel}>Código de Barras / EAN</Text>
                  <TextInput 
                    style={styles.input} 
                    placeholder="EAN-13 (Opcional)" 
                    placeholderTextColor="#475569"
                    keyboardType="numeric"
                    value={newBarcode}
                    onChangeText={setNewBarcode}
                  />
                </>
              )}

              <Text style={styles.inputLabel}>Descrição (Opcional)</Text>
              <TextInput 
                style={[styles.input, {height: 80, textAlignVertical: 'top'}]} 
                placeholder="Detalhes que aparecerão na NF" 
                placeholderTextColor="#475569"
                multiline
                value={newItemDesc}
                onChangeText={setNewItemDesc}
              />

              <TouchableOpacity 
                style={[styles.saveBtn, isSaving && {opacity: 0.7}]} 
                onPress={handleSaveItem}
                disabled={isSaving}
              >
                <LinearGradient colors={['#10B981', '#059669']} style={styles.saveBtnGrad}>
                  {isSaving ? <ActivityIndicator color="#FFF" /> : <Text style={styles.saveBtnText}>Salvar Item</Text>}
                </LinearGradient>
              </TouchableOpacity>
            </ScrollView>
          </View>
        </View>
      </Modal>
    </View>
  );
}

function CatalogItemCard({ item, index }: any) {
  const Colors = useThemeColors();
  const styles = getStyles(Colors);
  const itemAnim = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.timing(itemAnim, { toValue: 1, duration: 600, delay: index * 100, useNativeDriver: true }).start();
  }, []);

  return (
    <Animated.View style={[styles.bezelOuter, { marginBottom: 16, opacity: itemAnim, transform: [{ translateY: itemAnim.interpolate({ inputRange: [0, 1], outputRange: [30, 0] }) }] }]}>
      <View style={styles.bezelInner}>
         <View style={styles.cardTop}>
            <View style={[styles.typeBadge, { backgroundColor: item.type === 'service' ? Colors.primaryMuted : Palette.secondary + '15' }]}>
               <Ionicons name={item.type === 'service' ? 'construct-outline' : 'cube-outline'} size={16} color={item.type === 'service' ? Colors.primary : Palette.secondary} />
            </View>
            <View style={{ flex: 1, marginLeft: 16 }}>
               <Text style={styles.itemName}>{item.name}</Text>
               <Text style={styles.itemSub}>{item.billing_unit.toUpperCase()}</Text>
            </View>
            <Text style={styles.itemPrice}>R$ {item.price.toFixed(2).replace('.', ',')}</Text>
         </View>
         {item.description ? <Text style={styles.itemDesc}>{item.description}</Text> : null}
         
         {item.type === 'product' && (
           <View style={styles.productFooter}>
             <View style={styles.stockBadge}>
                <Ionicons name="layers-outline" size={12} color={item.stock_quantity > 0 ? '#10B981' : '#EF4444'} />
                <Text style={[styles.stockText, { color: item.stock_quantity > 0 ? '#10B981' : '#EF4444' }]}>
                  {item.stock_quantity || 0} em estoque
                </Text>
             </View>
             {item.ncm && (
               <Text style={styles.ncmText}>NCM: {item.ncm}</Text>
             )}
           </View>
         )}
      </View>
    </Animated.View>
  );
}

const getStyles = (Colors: any) => StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.bg },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingTop: Platform.OS === 'ios' ? 60 : 40,
    marginBottom: 20,
  },
  backBtn: {
    marginRight: 16,
    padding: 4,
  },
  eyebrow: { color: Colors.primary, fontFamily: Typography.fonts.medium, fontSize: 10, letterSpacing: 2, marginBottom: 8 },
  h1: { color: Colors.text, fontFamily: Typography.fonts.display, fontSize: 32 },
  filterRow: { flexDirection: 'row', paddingHorizontal: 24, gap: 10, marginBottom: 20 },
  filterBtn: { paddingHorizontal: 16, paddingVertical: 8, borderRadius: 100, backgroundColor: 'rgba(255,255,255,0.03)', borderWidth: 0.5, borderColor: Colors.border },
  filterBtnActive: { backgroundColor: Colors.primaryMuted, borderColor: Colors.primary },
  filterText: { color: Colors.textMuted, fontSize: 10, fontFamily: Typography.fonts.display, letterSpacing: 1 },
  list: { paddingHorizontal: 24, paddingBottom: 120 },
  bezelOuter: { backgroundColor: 'rgba(255,255,255,0.03)', borderRadius: 24, padding: 1.5, borderWidth: 0.5, borderColor: 'rgba(255,255,255,0.1)' },
  bezelInner: { backgroundColor: '#0F172A', borderRadius: 22.5, padding: 20 },
  cardTop: { flexDirection: 'row', alignItems: 'center' },
  typeBadge: { width: 36, height: 36, borderRadius: 10, justifyContent: 'center', alignItems: 'center' },
  itemName: { color: Colors.text, fontSize: 16, fontFamily: Typography.fonts.display },
  itemSub: { color: Colors.textMuted, fontSize: 10, fontFamily: Typography.fonts.medium, marginTop: 2, letterSpacing: 1 },
  itemPrice: { color: Colors.primary, fontSize: 18, fontFamily: Typography.fonts.display },
  itemDesc: { color: Colors.textSecondary, fontSize: 13, fontFamily: Typography.fonts.body, marginTop: 12, lineHeight: 18, opacity: 0.7 },
  productFooter: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 12, paddingTop: 12, borderTopWidth: 0.5, borderTopColor: 'rgba(255,255,255,0.1)' },
  stockBadge: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: 'rgba(255,255,255,0.05)', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6 },
  stockText: { fontSize: 11, fontFamily: Typography.fonts.display },
  ncmText: { color: Colors.textMuted, fontSize: 11, fontFamily: Typography.fonts.medium },
  empty: { alignItems: 'center', marginTop: 60 },
  emptyText: { color: Colors.textMuted, fontSize: 14, fontFamily: Typography.fonts.medium, marginTop: 12 },
  fab: { position: 'absolute', right: 24, bottom: 110, zIndex: 10 },
  fabGrad: { width: 56, height: 56, borderRadius: 28, justifyContent: 'center', alignItems: 'center', shadowColor: Colors.primary, shadowOpacity: 0.3, shadowRadius: 10, elevation: 5 },
  
  modalOverlay: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.5)' },
  modalContent: { backgroundColor: '#0F172A', borderTopLeftRadius: 32, borderTopRightRadius: 32, padding: 24, paddingBottom: 40, borderWidth: 1, borderColor: 'rgba(255,255,255,0.05)', maxHeight: '90%' },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 },
  modalTitle: { color: Colors.text, fontSize: 18, fontFamily: Typography.fonts.display },
  closeBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: 'rgba(255,255,255,0.05)', justifyContent: 'center', alignItems: 'center' },
  typeSelector: { flexDirection: 'row', backgroundColor: 'rgba(255,255,255,0.03)', borderRadius: 12, padding: 4, marginBottom: 20 },
  typeBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 10, borderRadius: 8, gap: 6 },
  typeBtnActive: { backgroundColor: '#1E293B', shadowColor: '#000', shadowOpacity: 0.2, shadowRadius: 4, elevation: 2 },
  typeBtnText: { color: Colors.textMuted, fontSize: 12, fontFamily: Typography.fonts.medium },
  inputLabel: { color: Colors.textMuted, fontSize: 12, fontFamily: Typography.fonts.medium, marginBottom: 8, marginLeft: 4 },
  input: { backgroundColor: '#1E293B', borderRadius: 12, padding: 16, color: Colors.text, fontFamily: Typography.fonts.medium, fontSize: 14, marginBottom: 16, borderWidth: 1, borderColor: '#334155' },
  saveBtn: { marginTop: 8, borderRadius: 12, overflow: 'hidden' },
  saveBtnGrad: { paddingVertical: 18, alignItems: 'center' },
  saveBtnText: { color: '#FFF', fontSize: 14, fontFamily: Typography.fonts.display },
});
