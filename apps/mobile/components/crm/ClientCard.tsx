import React, { useEffect, useRef } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Animated, Alert, Linking } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { Typography, useThemeColors } from '../../constants/theme';

interface ClientCardProps {
  item: {
    id: string;
    name: string;
    whatsapp_number?: string;
    formatted_address?: string;
    lat?: number;
    lng?: number;
    total_revenue?: number;
  };
  index: number;
  onEdit: (client: any) => void;
}

export function ClientCard({ item, index, onEdit }: ClientCardProps) {
  const Colors = useThemeColors();
  const styles = getStyles(Colors);
  const itemAnim = useRef(new Animated.Value(0)).current;
  const router = useRouter();

  useEffect(() => {
    Animated.timing(itemAnim, { toValue: 1, duration: 600, delay: index * 50, useNativeDriver: true }).start();
  }, []);

  const openWhatsApp = (phone: string) => {
    const cleanPhone = phone.replace(/\D/g, '');
    Linking.openURL(`whatsapp://send?phone=55${cleanPhone}`);
  };

  const openMap = () => {
    if (!item.lat || !item.lng) {
      Alert.alert('GPS indisponível', 'Este cliente não possui coordenadas GPS.');
      return;
    }
    router.push(`/map?clientId=${item.id}&clientName=${encodeURIComponent(item.name)}&clientAddress=${encodeURIComponent(item.formatted_address || 'Endereço não informado')}&lat=${item.lat}&lng=${item.lng}`);
  };

  return (
    <Animated.View style={[styles.bezelOuter, { marginBottom: 16, opacity: itemAnim, transform: [{ translateY: itemAnim.interpolate({ inputRange: [0, 1], outputRange: [20, 0] }) }] }]}>
      <TouchableOpacity 
        activeOpacity={0.8} 
        onPress={() => router.push(`/client-details?id=${item.id}`)}
        style={styles.bezelInner}
      >
         <View style={styles.cardTop}>
            <View style={styles.avatar}>
               <Text style={styles.avatarText}>{item.name.charAt(0).toUpperCase()}</Text>
            </View>
            <View style={{ flex: 1, marginLeft: 16 }}>
               <Text style={styles.clientName}>{item.name}</Text>
               <Text style={styles.clientSub}>{item.whatsapp_number || 'Sem contato'}</Text>
            </View>
            <TouchableOpacity style={[styles.actionButton, { marginRight: 8 }]} onPress={() => onEdit(item)}>
               <Ionicons name="create-outline" size={18} color="#FBBF24" />
            </TouchableOpacity>
            <TouchableOpacity style={[styles.actionButton, { marginRight: 8 }]} onPress={openMap}>
               <Ionicons name="map" size={18} color="#7DD3FC" />
            </TouchableOpacity>
            <TouchableOpacity style={styles.actionButton} onPress={() => item.whatsapp_number && openWhatsApp(item.whatsapp_number)}>
               <Ionicons name="logo-whatsapp" size={18} color={Colors.primary} />
            </TouchableOpacity>
         </View>
         
         <View style={styles.cardFooter}>
            <View style={styles.stat}>
               <Text style={styles.statLabel}>RECEITA</Text>
               <Text style={styles.statVal}>R$ {item.total_revenue?.toFixed(2).replace('.', ',') || '0,00'}</Text>
            </View>
            <View style={styles.detailsBtn}>
               <Text style={styles.detailsText}>HISTÓRICO</Text>
               <Ionicons name="arrow-forward" size={12} color={Colors.primary} />
            </View>
         </View>
      </TouchableOpacity>
    </Animated.View>
  );
}

const getStyles = (C: any) => StyleSheet.create({
  bezelOuter: { backgroundColor: 'rgba(255,255,255,0.03)', borderRadius: 24, padding: 1.5, borderWidth: 0.5, borderColor: 'rgba(255,255,255,0.08)' },
  bezelInner: { backgroundColor: '#0F172A', borderRadius: 22.5, padding: 20 },
  cardTop: { flexDirection: 'row', alignItems: 'center' },
  avatar: { width: 44, height: 44, borderRadius: 14, backgroundColor: C.primaryMuted, justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: C.primary + '30' },
  avatarText: { color: C.primary, fontFamily: Typography.fonts.display, fontSize: 18 },
  clientName: { color: C.text, fontSize: 16, fontFamily: Typography.fonts.display },
  clientSub: { color: C.textMuted, fontSize: 12, fontFamily: Typography.fonts.medium, marginTop: 2 },
  actionButton: { width: 36, height: 36, borderRadius: 10, backgroundColor: 'rgba(255,255,255,0.03)', justifyContent: 'center', alignItems: 'center', borderWidth: 0.5, borderColor: 'rgba(255,255,255,0.1)' },
  cardFooter: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 16, paddingTop: 16, borderTopWidth: 0.5, borderTopColor: 'rgba(255,255,255,0.1)' },
  stat: { flex: 1 },
  statLabel: { color: C.textMuted, fontSize: 8, fontFamily: Typography.fonts.medium, letterSpacing: 1 },
  statVal: { color: C.primary, fontSize: 16, fontFamily: Typography.fonts.display, marginTop: 2 },
  detailsBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: 'rgba(16, 185, 129, 0.1)', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8 },
  detailsText: { color: C.primary, fontSize: 10, fontFamily: Typography.fonts.display },
});