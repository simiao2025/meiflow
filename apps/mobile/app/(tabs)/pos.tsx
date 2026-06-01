import React, { useState, useEffect, useRef } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
  ActivityIndicator, Animated, Alert
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
import { Ionicons } from '@expo/vector-icons';
import { useAuthStore } from '../../stores/authStore';
import { supabase } from '../../services/supabase';
import { Typography, Palette, useThemeColors } from '../../constants/theme';
import { useRouter } from 'expo-router';

export default function PosScreen() {
  const Colors = useThemeColors();
  const styles = getStyles(Colors);
  const { user } = useAuthStore();
  const router = useRouter();
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [cart, setCart] = useState<{item: any, quantity: number}[]>([]);
  const [isCheckingOut, setIsCheckingOut] = useState(false);

  const fadeAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    loadItems();
    Animated.timing(fadeAnim, { toValue: 1, duration: 600, useNativeDriver: true }).start();
  }, []);

  const loadItems = async () => {
    if (!user) return;
    setLoading(true);
    // Only load products with stock > 0 for the POS
    const { data } = await supabase
      .from('catalog_items')
      .select('*')
      .eq('user_id', user.id)
      .eq('type', 'product')
      .eq('is_active', true)
      .gt('stock_quantity', 0)
      .order('name', { ascending: true });
      
    if (data) setItems(data);
    setLoading(false);
  };

  const addToCart = (product: any) => {
  const Colors = useThemeColors();
  const styles = getStyles(Colors);
    setCart(prev => {
      const existing = prev.find(c => c.item.id === product.id);
      if (existing) {
        if (existing.quantity >= product.stock_quantity) {
          Alert.alert('Atenção', 'Estoque insuficiente para adicionar mais.');
          return prev;
        }
        return prev.map(c => c.item.id === product.id ? { ...c, quantity: c.quantity + 1 } : c);
      }
      return [...prev, { item: product, quantity: 1 }];
    });
  };

  const removeFromCart = (productId: string) => {
  const Colors = useThemeColors();
  const styles = getStyles(Colors);
    setCart(prev => {
      const existing = prev.find(c => c.item.id === productId);
      if (existing && existing.quantity > 1) {
        return prev.map(c => c.item.id === productId ? { ...c, quantity: c.quantity - 1 } : c);
      }
      return prev.filter(c => c.item.id !== productId);
    });
  };

  const totalAmount = cart.reduce((sum, c) => sum + (c.item.price * c.quantity), 0);
  const totalItems = cart.reduce((sum, c) => sum + c.quantity, 0);

  const handleCheckout = async () => {
    if (!user || cart.length === 0) return;
    setIsCheckingOut(true);

    try {
      // 1. Create Sales Order
      const { data: orderData, error: orderError } = await supabase
        .from('sales_orders')
        .insert({
          user_id: user.id,
          total_amount: totalAmount,
          status: 'completed',
          payment_method: 'dinheiro' // Hardcoded for now
        })
        .select()
        .single();

      if (orderError) throw orderError;

      // 2. Create Order Items
      const orderItems = cart.map(c => ({
        order_id: orderData.id,
        item_id: c.item.id,
        quantity: c.quantity,
        unit_price: c.item.price,
        total_price: c.item.price * c.quantity
      }));

      const { error: itemsError } = await supabase
        .from('sales_order_items')
        .insert(orderItems);

      if (itemsError) throw itemsError;

      Alert.alert(
        'Venda Concluída', 
        'Venda registrada com sucesso e estoque atualizado.',
        [
          { text: 'Emitir NFC-e', onPress: () => Alert.alert('Em breve', 'Emissão de cupom fiscal requer certificado digital e será implementada na próxima fase.') },
          { text: 'OK', onPress: () => { setCart([]); loadItems(); } }
        ]
      );
    } catch (e) {
      console.error(e);
      Alert.alert('Erro', 'Ocorreu um erro ao finalizar a venda.');
    } finally {
      setIsCheckingOut(false);
    }
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
             <Text style={styles.eyebrow}>FRENTE DE CAIXA</Text>
             <Text style={styles.h1}>PDV Vendas</Text>
           </View>
        </View>

        {loading ? <ActivityIndicator color={Colors.primary} size="large" style={{ marginTop: 40 }} /> : (
          <FlatList 
            data={items} 
            keyExtractor={i => i.id} 
            numColumns={2}
            contentContainerStyle={styles.list}
            columnWrapperStyle={{ gap: 16 }}
            renderItem={({ item }) => {
               const cartItem = cart.find(c => c.item.id === item.id);
               const qtyInCart = cartItem ? cartItem.quantity : 0;
               return (
                 <TouchableOpacity 
                   style={[styles.productCard, qtyInCart > 0 && styles.productCardActive]} 
                   activeOpacity={0.8}
                   onPress={() => addToCart(item)}
                 >
                    <View style={styles.productIconWrapper}>
                      <Ionicons name="cube-outline" size={32} color={qtyInCart > 0 ? Colors.primary : Colors.textMuted} />
                      {qtyInCart > 0 && (
                        <View style={styles.qtyBadge}>
                           <Text style={styles.qtyBadgeText}>{qtyInCart}</Text>
                        </View>
                      )}
                    </View>
                    <Text style={styles.productName} numberOfLines={2}>{item.name}</Text>
                    <Text style={styles.productPrice}>R$ {item.price.toFixed(2).replace('.', ',')}</Text>
                    <Text style={styles.productStock}>{item.stock_quantity - qtyInCart} no estoque</Text>
                    
                    {qtyInCart > 0 && (
                      <TouchableOpacity 
                        style={styles.removeBtn} 
                        onPress={(e) => { e.stopPropagation(); removeFromCart(item.id); }}
                      >
                        <Ionicons name="remove-circle" size={28} color="#EF4444" />
                      </TouchableOpacity>
                    )}
                 </TouchableOpacity>
               );
            }}
            ListEmptyComponent={
              <View style={styles.empty}>
                <Ionicons name="cube-outline" size={48} color={Colors.textMuted} />
                <Text style={styles.emptyText}>Nenhum produto com estoque disponível.</Text>
                <TouchableOpacity onPress={() => router.push('/catalog')} style={styles.emptyBtn}>
                  <Text style={styles.emptyBtnText}>Cadastrar Produtos</Text>
                </TouchableOpacity>
              </View>
            }
          />
        )}
      </Animated.View>

      {/* Cart Summary Bar */}
      {cart.length > 0 && (
        <Animated.View style={styles.cartBar}>
           <BlurView intensity={30} tint="dark" style={StyleSheet.absoluteFill} />
           <View style={styles.cartContent}>
              <View style={styles.cartInfo}>
                 <Text style={styles.cartTotalLabel}>Total ({totalItems} itens)</Text>
                 <Text style={styles.cartTotalValue}>R$ {totalAmount.toFixed(2).replace('.', ',')}</Text>
              </View>
              <TouchableOpacity 
                style={[styles.checkoutBtn, isCheckingOut && { opacity: 0.7 }]} 
                onPress={handleCheckout}
                disabled={isCheckingOut}
              >
                {isCheckingOut ? (
                  <ActivityIndicator color="#FFF" />
                ) : (
                  <>
                    <Text style={styles.checkoutBtnText}>Cobrar</Text>
                    <Ionicons name="arrow-forward" size={18} color="#FFF" />
                  </>
                )}
              </TouchableOpacity>
           </View>
        </Animated.View>
      )}
    </View>
  );
}

const getStyles = (Colors: any) => StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.bg },
  header: { padding: 24, paddingTop: 60, flexDirection: 'row', alignItems: 'center' },
  backBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: 'rgba(255,255,255,0.05)', justifyContent: 'center', alignItems: 'center', marginRight: 16 },
  eyebrow: { color: Colors.primary, fontFamily: Typography.fonts.medium, fontSize: 10, letterSpacing: 2, marginBottom: 2 },
  h1: { color: Colors.text, fontFamily: Typography.fonts.display, fontSize: 24 },
  list: { paddingHorizontal: 24, paddingBottom: 150 },
  
  productCard: { flex: 1, backgroundColor: 'rgba(255,255,255,0.03)', borderRadius: 20, padding: 16, marginBottom: 16, borderWidth: 1, borderColor: 'rgba(255,255,255,0.05)', alignItems: 'center' },
  productCardActive: { borderColor: Colors.primary, backgroundColor: 'rgba(16, 185, 129, 0.05)' },
  productIconWrapper: { width: 64, height: 64, borderRadius: 20, backgroundColor: 'rgba(255,255,255,0.05)', justifyContent: 'center', alignItems: 'center', marginBottom: 12 },
  qtyBadge: { position: 'absolute', top: -5, right: -5, backgroundColor: Colors.primary, width: 24, height: 24, borderRadius: 12, justifyContent: 'center', alignItems: 'center', borderWidth: 2, borderColor: '#0F172A' },
  qtyBadgeText: { color: '#FFF', fontSize: 12, fontFamily: Typography.fonts.display },
  productName: { color: Colors.text, fontSize: 14, fontFamily: Typography.fonts.display, textAlign: 'center', marginBottom: 4 },
  productPrice: { color: Colors.primary, fontSize: 14, fontFamily: Typography.fonts.display, marginBottom: 4 },
  productStock: { color: Colors.textMuted, fontSize: 11, fontFamily: Typography.fonts.medium },
  removeBtn: { position: 'absolute', top: 8, right: 8, backgroundColor: 'rgba(15,23,42,0.8)', borderRadius: 14 },
  
  empty: { alignItems: 'center', marginTop: 60 },
  emptyText: { color: Colors.textMuted, fontSize: 14, fontFamily: Typography.fonts.medium, marginTop: 12, marginBottom: 20 },
  emptyBtn: { backgroundColor: Colors.primary, paddingHorizontal: 20, paddingVertical: 10, borderRadius: 12 },
  emptyBtnText: { color: '#FFF', fontFamily: Typography.fonts.display },

  cartBar: { position: 'absolute', bottom: 0, left: 0, right: 0, overflow: 'hidden', borderTopLeftRadius: 32, borderTopRightRadius: 32, borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)' },
  cartContent: { padding: 24, paddingBottom: 40, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  cartInfo: { flex: 1 },
  cartTotalLabel: { color: Colors.textMuted, fontSize: 12, fontFamily: Typography.fonts.medium, textTransform: 'uppercase', letterSpacing: 1 },
  cartTotalValue: { color: Colors.text, fontSize: 24, fontFamily: Typography.fonts.display, marginTop: 4 },
  checkoutBtn: { backgroundColor: Colors.primary, flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 24, paddingVertical: 16, borderRadius: 20 },
  checkoutBtnText: { color: '#FFF', fontSize: 16, fontFamily: Typography.fonts.display },
});
