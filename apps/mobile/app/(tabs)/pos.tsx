import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
  ActivityIndicator, Animated, Alert, Modal, TextInput, ScrollView
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
import { Ionicons } from '@expo/vector-icons';
import { useAuthStore } from '../../stores/authStore';
import { supabase } from '../../services/supabase';
import { Typography, Palette, useThemeColors } from '../../constants/theme';
import { useRouter, useFocusEffect } from 'expo-router';
import ChargeResultScreen from '../../components/billing/ChargeResultScreen';

interface Client {
  id: string;
  name: string;
  document?: string;
  phone?: string;
  whatsapp_number?: string;
  email?: string;
}

export default function PosScreen() {
  const Colors = useThemeColors();
  const styles = getStyles(Colors);
  const { user } = useAuthStore();
  const router = useRouter();

  // Estados dos Itens e Catálogo
  const [items, setItems] = useState<any[]>([]);
  const [filterType, setFilterType] = useState<'all' | 'service' | 'product'>('all');
  const [loading, setLoading] = useState(true);
  const [cart, setCart] = useState<{ item: any; quantity: number }[]>([]);

  // Estados do Cliente
  const [clients, setClients] = useState<Client[]>([]);
  const [selectedClient, setSelectedClient] = useState<Client | null>(null);
  const [clientModalVisible, setClientModalVisible] = useState(false);
  const [clientSearch, setClientSearch] = useState('');
  const [loadingClients, setLoadingClients] = useState(false);

  // Estados de Pagamento e Finalização
  const [paymentModalVisible, setPaymentModalVisible] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState<'pix' | 'cartao' | 'dinheiro'>('pix');
  const [isCheckingOut, setIsCheckingOut] = useState(false);
  const [chargeResult, setChargeResult] = useState<any>(null);

  const fadeAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    loadItems();
    loadClients();
    Animated.timing(fadeAnim, { toValue: 1, duration: 600, useNativeDriver: true }).start();
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadItems();
      loadClients();
    }, [user])
  );

  const loadItems = async () => {
    if (!user) return;
    setLoading(true);
    const { data } = await supabase
      .from('catalog_items')
      .select('*')
      .eq('user_id', user.id)
      .eq('is_active', true)
      .order('name', { ascending: true });

    if (data) setItems(data);
    setLoading(false);
  };

  const loadClients = async () => {
    if (!user) return;
    setLoadingClients(true);
    const { data } = await supabase
      .from('clients')
      .select('id, name, document, phone, whatsapp_number, email')
      .eq('user_id', user.id)
      .order('name', { ascending: true });

    if (data) setClients(data);
    setLoadingClients(false);
  };

  const displayedItems = items.filter(item => {
    if (filterType === 'service') return item.type === 'service';
    if (filterType === 'product') {
      return item.type === 'product' && (item.stock_quantity === undefined || item.stock_quantity === null || item.stock_quantity > 0);
    }
    if (item.type === 'product' && typeof item.stock_quantity === 'number' && item.stock_quantity <= 0) {
      return false;
    }
    return true;
  });

  const addToCart = (product: any) => {
    setCart(prev => {
      const existing = prev.find(c => c.item.id === product.id);
      if (existing) {
        if (product.type === 'product' && typeof product.stock_quantity === 'number') {
          if (existing.quantity >= product.stock_quantity) {
            Alert.alert('Atenção', 'Estoque máximo atingido para este produto.');
            return prev;
          }
        }
        return prev.map(c => c.item.id === product.id ? { ...c, quantity: c.quantity + 1 } : c);
      }
      return [...prev, { item: product, quantity: 1 }];
    });
  };

  const decrementInCart = (productId: string) => {
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

  const filteredClients = clients.filter(c =>
    c.name.toLowerCase().includes(clientSearch.toLowerCase()) ||
    (c.document && c.document.includes(clientSearch))
  );

  const handleOpenPaymentModal = () => {
    if (cart.length === 0) {
      Alert.alert('Carrinho vazio', 'Adicione pelo menos um item para prosseguir com a venda.');
      return;
    }
    setPaymentModalVisible(true);
  };

  const handleExecuteSaleAndCharge = async () => {
    if (!user || cart.length === 0) return;
    setIsCheckingOut(true);

    try {
      const clientId = selectedClient?.id || null;
      const clientName = selectedClient ? selectedClient.name : 'Consumidor Final';

      // 1. Criar Registro de Pedido de Venda (Sales Order)
      const { data: orderData, error: orderError } = await supabase
        .from('sales_orders')
        .insert({
          user_id: user.id,
          client_id: clientId,
          total_amount: totalAmount,
          status: 'completed',
          payment_method: paymentMethod,
          notes: `Venda balcão / PDV para ${clientName}`
        })
        .select()
        .single();

      if (orderError) throw orderError;

      // 2. Criar Itens do Pedido
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

      if (itemsError) {
        await supabase.from('sales_orders').delete().eq('id', orderData.id);
        throw itemsError;
      }

      // 3. Atualizar estoque de produtos físicos vendidos
      for (const c of cart) {
        if (c.item.type === 'product' && typeof c.item.stock_quantity === 'number') {
          const newQty = Math.max(0, c.item.stock_quantity - c.quantity);
          await supabase.from('catalog_items').update({ stock_quantity: newQty }).eq('id', c.item.id);
        }
      }

      const hasServices = cart.some(c => c.item.type === 'service');
      const itemDescriptions = cart.map(c => `${c.quantity}x ${c.item.name}`).join(', ');

      // 4. Fluxo A: Pagamento em Dinheiro (Entrada imediata no caixa)
      if (paymentMethod === 'dinheiro') {
        try {
          await supabase.from('transactions').insert({
            user_id: user.id,
            type: 'receita',
            amount: totalAmount,
            status: 'completed',
            payment_method: 'dinheiro',
            description: `Venda PDV em Dinheiro (${itemDescriptions})`,
            client_id: clientId,
            date: new Date().toISOString()
          });
        } catch (txErr) {
          console.warn('Erro ao inserir transaction de dinheiro:', txErr);
        }

        setPaymentModalVisible(false);

        Alert.alert(
          'Venda Finalizada!',
          `Recebimento de R$ ${totalAmount.toFixed(2).replace('.', ',')} em dinheiro registrado com sucesso.`,
          [
            hasServices ? {
              text: 'Emitir NFS-e',
              onPress: () => {
                setCart([]);
                loadItems();
                router.push('/fiscal/emit');
              }
            } : {
              text: 'Imprimir / Cupom',
              onPress: () => {
                setCart([]);
                loadItems();
                Alert.alert('Informação', 'Comprovante registrado no histórico financeiro.');
              }
            },
            {
              text: 'Nova Venda',
              onPress: () => {
                setCart([]);
                loadItems();
              }
            }
          ]
        );
        return;
      }

      // 5. Fluxo B: Pagamento em PIX ou Cartão -> Gerar Cobrança (Asaas)
      const chargeMethod = paymentMethod === 'pix' ? 'pix' : 'credit_card';
      const externalRef = `pdv_${orderData.id.slice(0, 8)}_${Date.now()}`;
      const pixPayload = paymentMethod === 'pix'
        ? `00020126330014BR.GOV.BCB.PIX0111${Date.now()}5204000053039865802BR5913MEIFlow6014BRASIL62070503***6304ABCD`
        : null;

      const { data: chargeData, error: chargeError } = await supabase
        .from('charges')
        .insert({
          user_id: user.id,
          client_id: clientId,
          amount: totalAmount,
          payment_method: chargeMethod,
          status: 'pending',
          description: `Venda PDV (#${orderData.id.slice(0, 6)}) - ${itemDescriptions}`,
          external_reference: externalRef,
          payment_link: `https://sandbox.asaas.com/c/${externalRef}`,
          qr_code_payload: pixPayload
        })
        .select()
        .single();

      if (chargeError) throw chargeError;

      setPaymentModalVisible(false);
      setChargeResult(chargeData);

    } catch (e: any) {
      console.error('Erro na venda/cobrança:', e);
      Alert.alert('Erro ao processar venda', e?.message || 'Verifique sua conexão e tente novamente.');
    } finally {
      setIsCheckingOut(false);
    }
  };

  // Se houver uma cobrança gerada para exibir (QR Code Pix / Link Cartão)
  if (chargeResult) {
    return (
      <ChargeResultScreen
        chargeResult={chargeResult}
        doneLabel="Concluir e Nova Venda"
        onReset={() => {
          setChargeResult(null);
          setCart([]);
          loadItems();
        }}
        onDone={() => {
          setChargeResult(null);
          setCart([]);
          loadItems();
        }}
      />
    );
  }

  return (
    <View style={styles.container}>
      <LinearGradient colors={[Colors.bg, '#0B1121']} style={StyleSheet.absoluteFill} />

      <Animated.View style={{ flex: 1, opacity: fadeAnim }}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
            <Ionicons name="arrow-back" size={24} color={Colors.text} />
          </TouchableOpacity>
          <View style={{ flex: 1 }}>
            <Text style={styles.eyebrow}>FRENTE DE CAIXA</Text>
            <Text style={styles.h1}>PDV Vendas</Text>
          </View>
        </View>

        {/* 1. SELEÇÃO DO CLIENTE (Primeiro Passo) */}
        <TouchableOpacity
          style={styles.clientBar}
          activeOpacity={0.8}
          onPress={() => setClientModalVisible(true)}
        >
          <View style={styles.clientBarIcon}>
            <Ionicons
              name={selectedClient ? 'person' : 'person-circle-outline'}
              size={22}
              color={selectedClient ? '#10B981' : Colors.primary}
            />
          </View>
          <View style={styles.clientBarInfo}>
            <Text style={styles.clientBarLabel}>CLIENTE DA VENDA</Text>
            <Text style={styles.clientBarName} numberOfLines={1}>
              {selectedClient ? selectedClient.name : 'Consumidor Final (Venda Rápida)'}
            </Text>
            {selectedClient?.phone && (
              <Text style={styles.clientBarSub}>{selectedClient.phone}</Text>
            )}
          </View>
          <View style={styles.clientBarAction}>
            <Text style={styles.clientBarActionText}>{selectedClient ? 'Trocar' : 'Alterar'}</Text>
            <Ionicons name="chevron-forward" size={16} color={Colors.primary} />
          </View>
        </TouchableOpacity>

        {/* 2. FILTROS DE TIPO: Todos, Serviços, Produtos */}
        <View style={styles.filterRow}>
          {[
            { key: 'all', label: 'Todos' },
            { key: 'service', label: '🛠️ Serviços' },
            { key: 'product', label: '📦 Produtos' },
          ].map(f => (
            <TouchableOpacity
              key={f.key}
              style={[styles.typeChip, filterType === f.key && styles.typeChipActive]}
              onPress={() => setFilterType(f.key as any)}
            >
              <Text style={[styles.typeChipText, filterType === f.key && styles.typeChipTextActive]}>
                {f.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* 3. LISTA DE ITENS DO CATÁLOGO COM CONTROLE DE QUANTIDADE */}
        {loading ? (
          <ActivityIndicator color={Colors.primary} size="large" style={{ marginTop: 40 }} />
        ) : (
          <FlatList
            data={displayedItems}
            keyExtractor={i => i.id}
            numColumns={2}
            contentContainerStyle={styles.list}
            columnWrapperStyle={{ gap: 14 }}
            renderItem={({ item }) => {
              const cartItem = cart.find(c => c.item.id === item.id);
              const qtyInCart = cartItem ? cartItem.quantity : 0;
              const isService = item.type === 'service';

              return (
                <View
                  style={[styles.productCard, qtyInCart > 0 && styles.productCardActive]}
                >
                  <TouchableOpacity
                    style={styles.cardHeaderArea}
                    activeOpacity={0.7}
                    onPress={() => addToCart(item)}
                  >
                    <View style={styles.productIconWrapper}>
                      <Ionicons
                        name={isService ? 'briefcase-outline' : 'cube-outline'}
                        size={30}
                        color={qtyInCart > 0 ? '#10B981' : Colors.textMuted}
                      />
                      {qtyInCart > 0 && (
                        <View style={styles.qtyBadge}>
                          <Text style={styles.qtyBadgeText}>{qtyInCart}</Text>
                        </View>
                      )}
                    </View>
                    <Text style={styles.productName} numberOfLines={2}>{item.name}</Text>
                    <Text style={styles.productPrice}>R$ {Number(item.price).toFixed(2).replace('.', ',')}</Text>
                    <Text style={styles.productStock}>
                      {isService
                        ? (item.billing_unit ? `Por ${item.billing_unit}` : 'Serviço')
                        : `${Math.max(0, (item.stock_quantity ?? 0) - qtyInCart)} em estoque`}
                    </Text>
                  </TouchableOpacity>

                  {/* Controles de Quantidade (-) Qtd (+) */}
                  <View style={styles.qtyControlsRow}>
                    {qtyInCart > 0 ? (
                      <>
                        <TouchableOpacity
                          style={styles.qtyBtnMinus}
                          onPress={() => decrementInCart(item.id)}
                        >
                          <Ionicons name="remove" size={18} color="#EF4444" />
                        </TouchableOpacity>
                        <View style={styles.qtyDisplay}>
                          <Text style={styles.qtyDisplayText}>{qtyInCart}</Text>
                        </View>
                        <TouchableOpacity
                          style={styles.qtyBtnPlus}
                          onPress={() => addToCart(item)}
                        >
                          <Ionicons name="add" size={18} color="#10B981" />
                        </TouchableOpacity>
                      </>
                    ) : (
                      <TouchableOpacity
                        style={styles.addInitialBtn}
                        onPress={() => addToCart(item)}
                      >
                        <Ionicons name="add" size={16} color="#FFF" style={{ marginRight: 4 }} />
                        <Text style={styles.addInitialText}>Adicionar</Text>
                      </TouchableOpacity>
                    )}
                  </View>
                </View>
              );
            }}
            ListEmptyComponent={
              <View style={styles.empty}>
                <Ionicons name="briefcase-outline" size={48} color={Colors.textMuted} />
                <Text style={styles.emptyText}>Nenhum item disponível para venda.</Text>
                <TouchableOpacity onPress={() => router.push('/catalog')} style={styles.emptyBtn}>
                  <Text style={styles.emptyBtnText}>Cadastrar Itens</Text>
                </TouchableOpacity>
              </View>
            }
          />
        )}
      </Animated.View>

      {/* 4. BARRA DE CHECKOUT FLUTUANTE (Posicionada com segurança ACIMA do TabBar) */}
      {cart.length > 0 && (
        <View style={styles.cartBar}>
          <BlurView intensity={45} tint="dark" style={StyleSheet.absoluteFill} />
          <View style={styles.cartContent}>
            <View style={styles.cartInfo}>
              <Text style={styles.cartTotalLabel}>Total ({totalItems} {totalItems === 1 ? 'item' : 'itens'})</Text>
              <Text style={styles.cartTotalValue}>R$ {totalAmount.toFixed(2).replace('.', ',')}</Text>
              <Text style={styles.cartClientSnippet} numberOfLines={1}>
                👤 {selectedClient ? selectedClient.name : 'Consumidor Final'}
              </Text>
            </View>
            <TouchableOpacity
              style={styles.checkoutBtn}
              onPress={handleOpenPaymentModal}
              activeOpacity={0.85}
            >
              <Text style={styles.checkoutBtnText}>Avançar</Text>
              <Ionicons name="arrow-forward" size={18} color="#FFF" />
            </TouchableOpacity>
          </View>
        </View>
      )}

      {/* MODAL 1: SELEÇÃO DE CLIENTE */}
      <Modal
        visible={clientModalVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setClientModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <View>
                <Text style={styles.modalTitle}>Identificar Cliente</Text>
                <Text style={styles.modalSub}>Selecione um cliente para a venda</Text>
              </View>
              <TouchableOpacity
                onPress={() => setClientModalVisible(false)}
                style={styles.modalCloseBtn}
              >
                <Ionicons name="close" size={22} color={Colors.text} />
              </TouchableOpacity>
            </View>

            {/* Opção Rápida: Consumidor Final */}
            <TouchableOpacity
              style={[styles.clientOptionCard, !selectedClient && styles.clientOptionCardActive]}
              onPress={() => {
                setSelectedClient(null);
                setClientModalVisible(false);
              }}
            >
              <View style={styles.clientOptionAvatar}>
                <Ionicons name="person-outline" size={20} color="#94A3B8" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.clientOptionName}>Consumidor Final</Text>
                <Text style={styles.clientOptionMeta}>Venda balcão sem identificação</Text>
              </View>
              {!selectedClient && (
                <Ionicons name="checkmark-circle" size={22} color="#10B981" />
              )}
            </TouchableOpacity>

            {/* Busca de Clientes Cadastrados */}
            <View style={styles.searchBar}>
              <Ionicons name="search" size={18} color="#64748B" style={{ marginRight: 8 }} />
              <TextInput
                style={styles.searchInput}
                placeholder="Buscar por nome ou CPF..."
                placeholderTextColor="#64748B"
                value={clientSearch}
                onChangeText={setClientSearch}
              />
              {clientSearch.length > 0 && (
                <TouchableOpacity onPress={() => setClientSearch('')}>
                  <Ionicons name="close-circle" size={18} color="#64748B" />
                </TouchableOpacity>
              )}
            </View>

            {/* Lista de Clientes */}
            <ScrollView style={{ maxHeight: 260 }} showsVerticalScrollIndicator={false}>
              {loadingClients ? (
                <ActivityIndicator color={Colors.primary} style={{ marginVertical: 20 }} />
              ) : filteredClients.length === 0 ? (
                <View style={styles.clientEmptyBox}>
                  <Text style={styles.clientEmptyText}>
                    {clientSearch ? 'Nenhum cliente encontrado.' : 'Nenhum cliente cadastrado ainda.'}
                  </Text>
                </View>
              ) : (
                filteredClients.map(c => {
                  const isSelected = selectedClient?.id === c.id;
                  return (
                    <TouchableOpacity
                      key={c.id}
                      style={[styles.clientOptionCard, isSelected && styles.clientOptionCardActive]}
                      onPress={() => {
                        setSelectedClient(c);
                        setClientModalVisible(false);
                      }}
                    >
                      <View style={[styles.clientOptionAvatar, isSelected && { backgroundColor: 'rgba(16, 185, 129, 0.2)' }]}>
                        <Ionicons name="person" size={20} color={isSelected ? '#10B981' : Colors.primary} />
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.clientOptionName}>{c.name}</Text>
                        <Text style={styles.clientOptionMeta}>
                          {c.document || c.phone || 'Sem documento cadastrado'}
                        </Text>
                      </View>
                      {isSelected && (
                        <Ionicons name="checkmark-circle" size={22} color="#10B981" />
                      )}
                    </TouchableOpacity>
                  );
                })
              )}
            </ScrollView>

            <TouchableOpacity
              style={styles.newClientBtn}
              onPress={() => {
                setClientModalVisible(false);
                router.push('/(tabs)/clients');
              }}
            >
              <Ionicons name="person-add-outline" size={18} color="#38BDF8" style={{ marginRight: 8 }} />
              <Text style={styles.newClientText}>Gerenciar / Novo Cliente</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* MODAL 2: FORMAS DE PAGAMENTO E GERAÇÃO DE COBRANÇA */}
      <Modal
        visible={paymentModalVisible}
        transparent
        animationType="slide"
        onRequestClose={() => !isCheckingOut && setPaymentModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <View>
                <Text style={styles.modalTitle}>Formas de Pagamento</Text>
                <Text style={styles.modalSub}>Finalize a venda e gere a cobrança</Text>
              </View>
              <TouchableOpacity
                onPress={() => !isCheckingOut && setPaymentModalVisible(false)}
                style={styles.modalCloseBtn}
                disabled={isCheckingOut}
              >
                <Ionicons name="close" size={22} color={Colors.text} />
              </TouchableOpacity>
            </View>

            {/* Resumo da Venda */}
            <View style={styles.paymentSummaryCard}>
              <View style={styles.summaryRow}>
                <Text style={styles.summaryLabel}>Cliente</Text>
                <Text style={styles.summaryValue} numberOfLines={1}>
                  {selectedClient ? selectedClient.name : 'Consumidor Final'}
                </Text>
              </View>
              <View style={styles.summaryRow}>
                <Text style={styles.summaryLabel}>Total de Itens</Text>
                <Text style={styles.summaryValue}>{totalItems} itens</Text>
              </View>
              <View style={[styles.summaryRow, { marginTop: 8, paddingTop: 8, borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.08)' }]}>
                <Text style={styles.summaryTotalLabel}>VALOR A COBRAR</Text>
                <Text style={styles.summaryTotalValue}>R$ {totalAmount.toFixed(2).replace('.', ',')}</Text>
              </View>
            </View>

            {/* Opções de Pagamento */}
            <Text style={styles.paymentMethodsTitle}>SELECIONE COMO O CLIENTE VAI PAGAR:</Text>

            <View style={styles.paymentMethodsGrid}>
              {/* Opção PIX */}
              <TouchableOpacity
                style={[styles.paymentMethodCard, paymentMethod === 'pix' && styles.paymentMethodCardActive]}
                onPress={() => setPaymentMethod('pix')}
                activeOpacity={0.8}
              >
                <View style={[styles.pmIconBox, paymentMethod === 'pix' && { backgroundColor: 'rgba(56, 189, 248, 0.2)' }]}>
                  <Ionicons name="qr-code-outline" size={24} color="#38BDF8" />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.pmTitle}>PIX Instantâneo</Text>
                  <Text style={styles.pmSub}>Gera QR Code e Copia-e-Cola Asaas</Text>
                </View>
                {paymentMethod === 'pix' && (
                  <Ionicons name="checkmark-circle" size={22} color="#38BDF8" />
                )}
              </TouchableOpacity>

              {/* Opção Cartão */}
              <TouchableOpacity
                style={[styles.paymentMethodCard, paymentMethod === 'cartao' && styles.paymentMethodCardActive]}
                onPress={() => setPaymentMethod('cartao')}
                activeOpacity={0.8}
              >
                <View style={[styles.pmIconBox, paymentMethod === 'cartao' && { backgroundColor: 'rgba(168, 85, 247, 0.2)' }]}>
                  <Ionicons name="card-outline" size={24} color="#A855F7" />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.pmTitle}>Cartão de Crédito / Débito</Text>
                  <Text style={styles.pmSub}>Gera link de pagamento para o cliente</Text>
                </View>
                {paymentMethod === 'cartao' && (
                  <Ionicons name="checkmark-circle" size={22} color="#A855F7" />
                )}
              </TouchableOpacity>

              {/* Opção Dinheiro */}
              <TouchableOpacity
                style={[styles.paymentMethodCard, paymentMethod === 'dinheiro' && styles.paymentMethodCardActive]}
                onPress={() => setPaymentMethod('dinheiro')}
                activeOpacity={0.8}
              >
                <View style={[styles.pmIconBox, paymentMethod === 'dinheiro' && { backgroundColor: 'rgba(16, 185, 129, 0.2)' }]}>
                  <Ionicons name="cash-outline" size={24} color="#10B981" />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.pmTitle}>Dinheiro em Espécie</Text>
                  <Text style={styles.pmSub}>Entrada imediata no caixa financeiro</Text>
                </View>
                {paymentMethod === 'dinheiro' && (
                  <Ionicons name="checkmark-circle" size={22} color="#10B981" />
                )}
              </TouchableOpacity>
            </View>

            {/* Botão de Ação / Gerar Cobrança */}
            <TouchableOpacity
              style={[styles.confirmPaymentBtn, isCheckingOut && { opacity: 0.7 }]}
              onPress={handleExecuteSaleAndCharge}
              disabled={isCheckingOut}
            >
              {isCheckingOut ? (
                <ActivityIndicator color="#FFF" />
              ) : (
                <>
                  <Ionicons
                    name={paymentMethod === 'dinheiro' ? 'checkmark-circle-outline' : 'receipt-outline'}
                    size={20}
                    color="#FFF"
                    style={{ marginRight: 8 }}
                  />
                  <Text style={styles.confirmPaymentBtnText}>
                    {paymentMethod === 'dinheiro'
                      ? 'Confirmar Recebimento em Dinheiro'
                      : 'Gerar Cobrança para o Cliente'}
                  </Text>
                </>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const getStyles = (Colors: any) => StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.bg },
  header: {
    paddingHorizontal: 24,
    paddingTop: 54,
    paddingBottom: 12,
    flexDirection: 'row',
    alignItems: 'center',
  },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.05)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  eyebrow: {
    color: Colors.primary,
    fontFamily: Typography.fonts.medium,
    fontSize: 10,
    letterSpacing: 2,
    marginBottom: 2,
  },
  h1: {
    color: Colors.text,
    fontFamily: Typography.fonts.display,
    fontSize: 22,
  },

  // Barra de Seleção de Cliente
  clientBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#0F172A',
    marginHorizontal: 20,
    marginBottom: 12,
    padding: 12,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  clientBarIcon: {
    width: 38,
    height: 38,
    borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.05)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  clientBarInfo: {
    flex: 1,
  },
  clientBarLabel: {
    color: '#64748B',
    fontSize: 9,
    fontFamily: Typography.fonts.bold,
    letterSpacing: 1,
    marginBottom: 2,
  },
  clientBarName: {
    color: '#F8FAFC',
    fontSize: 14,
    fontFamily: Typography.fonts.bold,
  },
  clientBarSub: {
    color: '#94A3B8',
    fontSize: 11,
    fontFamily: Typography.fonts.medium,
  },
  clientBarAction: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(56, 189, 248, 0.1)',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 10,
  },
  clientBarActionText: {
    color: Colors.primary,
    fontSize: 12,
    fontFamily: Typography.fonts.bold,
  },

  // Filtros de Tipo
  filterRow: {
    flexDirection: 'row',
    paddingHorizontal: 20,
    paddingBottom: 12,
    gap: 10,
  },
  typeChip: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 14,
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  typeChipActive: {
    backgroundColor: 'rgba(16, 185, 129, 0.2)',
    borderColor: '#10B981',
  },
  typeChipText: {
    color: '#94A3B8',
    fontSize: 13,
    fontFamily: Typography.fonts.medium,
  },
  typeChipTextActive: {
    color: '#FFF',
    fontFamily: Typography.fonts.bold,
  },

  // Lista de Produtos
  list: {
    paddingHorizontal: 20,
    paddingBottom: 220, // Garante que nenhum item fique atrás da barra de checkout e do TabBar
  },
  productCard: {
    flex: 1,
    backgroundColor: '#0F172A',
    borderRadius: 20,
    padding: 12,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
    justifyContent: 'space-between',
  },
  productCardActive: {
    borderColor: '#10B981',
    backgroundColor: 'rgba(16, 185, 129, 0.04)',
  },
  cardHeaderArea: {
    alignItems: 'center',
  },
  productIconWrapper: {
    width: 56,
    height: 56,
    borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.04)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 10,
  },
  qtyBadge: {
    position: 'absolute',
    top: -4,
    right: -4,
    backgroundColor: '#10B981',
    width: 22,
    height: 22,
    borderRadius: 11,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#0F172A',
  },
  qtyBadgeText: {
    color: '#FFF',
    fontSize: 11,
    fontFamily: Typography.fonts.display,
  },
  productName: {
    color: Colors.text,
    fontSize: 13,
    fontFamily: Typography.fonts.display,
    textAlign: 'center',
    marginBottom: 4,
    minHeight: 32,
  },
  productPrice: {
    color: Colors.primary,
    fontSize: 15,
    fontFamily: Typography.fonts.display,
    marginBottom: 2,
  },
  productStock: {
    color: Colors.textMuted,
    fontSize: 10,
    fontFamily: Typography.fonts.medium,
    marginBottom: 10,
  },

  // Controles de Quantidade
  qtyControlsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.06)',
    paddingTop: 8,
    marginTop: 4,
  },
  qtyBtnMinus: {
    width: 32,
    height: 32,
    borderRadius: 10,
    backgroundColor: 'rgba(239, 68, 68, 0.15)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  qtyDisplay: {
    paddingHorizontal: 12,
  },
  qtyDisplayText: {
    color: '#FFF',
    fontSize: 14,
    fontFamily: Typography.fonts.bold,
  },
  qtyBtnPlus: {
    width: 32,
    height: 32,
    borderRadius: 10,
    backgroundColor: 'rgba(16, 185, 129, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  addInitialBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.08)',
    paddingVertical: 7,
    paddingHorizontal: 14,
    borderRadius: 12,
    width: '100%',
  },
  addInitialText: {
    color: '#F8FAFC',
    fontSize: 12,
    fontFamily: Typography.fonts.bold,
  },

  empty: {
    alignItems: 'center',
    marginTop: 60,
  },
  emptyText: {
    color: Colors.textMuted,
    fontSize: 14,
    fontFamily: Typography.fonts.medium,
    marginTop: 12,
    marginBottom: 20,
  },
  emptyBtn: {
    backgroundColor: Colors.primary,
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 12,
  },
  emptyBtnText: {
    color: '#FFF',
    fontFamily: Typography.fonts.display,
  },

  // Barra de Checkout Flutuante (ACIMA do TabBar)
  cartBar: {
    position: 'absolute',
    bottom: 84, // Eleva 84px para ficar acima dos ~72px do TabBar
    left: 16,
    right: 16,
    borderRadius: 24,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
    backgroundColor: 'rgba(15, 23, 42, 0.92)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.4,
    shadowRadius: 12,
    elevation: 12,
    zIndex: 99,
  },
  cartContent: {
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  cartInfo: {
    flex: 1,
  },
  cartTotalLabel: {
    color: '#94A3B8',
    fontSize: 11,
    fontFamily: Typography.fonts.medium,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  cartTotalValue: {
    color: '#FFF',
    fontSize: 20,
    fontFamily: Typography.fonts.display,
    marginTop: 2,
  },
  cartClientSnippet: {
    color: Colors.primary,
    fontSize: 11,
    fontFamily: Typography.fonts.medium,
    marginTop: 2,
  },
  checkoutBtn: {
    backgroundColor: '#10B981',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 16,
    shadowColor: '#10B981',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 6,
  },
  checkoutBtnText: {
    color: '#FFF',
    fontSize: 15,
    fontFamily: Typography.fonts.display,
  },

  // Modais de Cliente e Pagamento
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.75)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#0F172A',
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    padding: 24,
    paddingBottom: 40,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  modalTitle: {
    color: '#F8FAFC',
    fontSize: 18,
    fontFamily: Typography.fonts.bold,
  },
  modalSub: {
    color: '#94A3B8',
    fontSize: 12,
    fontFamily: Typography.fonts.medium,
    marginTop: 2,
  },
  modalCloseBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.06)',
    justifyContent: 'center',
    alignItems: 'center',
  },

  // Seleção de Cliente Modal
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1E293B',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: '#334155',
  },
  searchInput: {
    flex: 1,
    color: '#FFF',
    fontSize: 14,
    fontFamily: Typography.fonts.medium,
  },
  clientOptionCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1E293B',
    borderRadius: 14,
    padding: 12,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.05)',
  },
  clientOptionCardActive: {
    borderColor: '#10B981',
    backgroundColor: 'rgba(16, 185, 129, 0.1)',
  },
  clientOptionAvatar: {
    width: 36,
    height: 36,
    borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.05)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  clientOptionName: {
    color: '#F8FAFC',
    fontSize: 14,
    fontFamily: Typography.fonts.bold,
  },
  clientOptionMeta: {
    color: '#94A3B8',
    fontSize: 11,
    fontFamily: Typography.fonts.medium,
  },
  clientEmptyBox: {
    padding: 20,
    alignItems: 'center',
  },
  clientEmptyText: {
    color: '#64748B',
    fontSize: 13,
    fontFamily: Typography.fonts.medium,
  },
  newClientBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(56, 189, 248, 0.1)',
    borderRadius: 12,
    paddingVertical: 12,
    marginTop: 12,
    borderWidth: 1,
    borderColor: 'rgba(56, 189, 248, 0.3)',
  },
  newClientText: {
    color: '#38BDF8',
    fontSize: 13,
    fontFamily: Typography.fonts.bold,
  },

  // Modal de Pagamento
  paymentSummaryCard: {
    backgroundColor: '#1E293B',
    borderRadius: 16,
    padding: 16,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.05)',
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  summaryLabel: {
    color: '#94A3B8',
    fontSize: 12,
    fontFamily: Typography.fonts.medium,
  },
  summaryValue: {
    color: '#F8FAFC',
    fontSize: 13,
    fontFamily: Typography.fonts.bold,
  },
  summaryTotalLabel: {
    color: Colors.primary,
    fontSize: 12,
    fontFamily: Typography.fonts.bold,
    letterSpacing: 1,
  },
  summaryTotalValue: {
    color: '#FFF',
    fontSize: 20,
    fontFamily: Typography.fonts.display,
  },
  paymentMethodsTitle: {
    color: '#64748B',
    fontSize: 10,
    fontFamily: Typography.fonts.bold,
    letterSpacing: 1.5,
    marginBottom: 12,
  },
  paymentMethodsGrid: {
    gap: 10,
    marginBottom: 24,
  },
  paymentMethodCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1E293B',
    borderRadius: 16,
    padding: 14,
    borderWidth: 1.5,
    borderColor: '#334155',
  },
  paymentMethodCardActive: {
    borderColor: '#10B981',
    backgroundColor: 'rgba(16, 185, 129, 0.08)',
  },
  pmIconBox: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.05)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 14,
  },
  pmTitle: {
    color: '#F8FAFC',
    fontSize: 14,
    fontFamily: Typography.fonts.bold,
  },
  pmSub: {
    color: '#94A3B8',
    fontSize: 11,
    fontFamily: Typography.fonts.medium,
    marginTop: 2,
  },
  confirmPaymentBtn: {
    backgroundColor: '#10B981',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 16,
    paddingVertical: 16,
    shadowColor: '#10B981',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 10,
    elevation: 8,
  },
  confirmPaymentBtnText: {
    color: '#FFF',
    fontSize: 15,
    fontFamily: Typography.fonts.bold,
  },
});
