import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Palette, Typography, useThemeColors } from '../../constants/theme';
import { useRouter } from 'expo-router';
import Animated, { useSharedValue, useAnimatedStyle, withSpring, runOnJS } from 'react-native-reanimated';
import { aiFinanceService } from '../../services/api';
import { supabase } from '../../services/supabase';

export default function ReconciliationScreen() {
  const Colors = useThemeColors();
  const styles = getStyles(Colors);
  const router = useRouter();
  const [suggestions, setSuggestions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentIndex, setCurrentIndex] = useState(0);
  const translateX = useSharedValue(0);

  useEffect(() => {
    fetchSuggestions();
  }, []);

  const fetchSuggestions = async () => {
    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        console.warn("User not logged in");
        setLoading(false);
        return;
      }
      const data = await aiFinanceService.getReconciliationSuggestions(user.id);
      setSuggestions(data);
    } catch (e) {
      console.error("Error fetching suggestions", e);
    } finally {
      setLoading(false);
    }
  };

  const processAction = useCallback(async (approved: boolean, index: number) => {
    const currentItem = suggestions[index];
    try {
      if (approved && currentItem) {
        await aiFinanceService.approveReconciliation(
          currentItem.statement_id,
          currentItem.match_type,
          currentItem.match_id,
          currentItem.statement_amount,
          currentItem.statement_desc
        );
      }
    } catch (e) {
      console.error("Error processing reconciliation action", e);
    }
    
    if (index < suggestions.length - 1) {
      setCurrentIndex(prev => prev + 1);
      translateX.value = withSpring(0);
    } else {
      setCurrentIndex(prev => prev + 1);
    }
  }, [suggestions, translateX]);

  const handleAction = useCallback((approved: boolean) => {
    const current = currentIndex;
    processAction(approved, current);
  }, [currentIndex, processAction]);

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()}>
            <Ionicons name="arrow-back" size={24} color={Colors.text} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Conciliação Inteligente</Text>
          <View style={{ width: 24 }} />
        </View>
        <View style={styles.centerContainer}>
          <ActivityIndicator size="large" color={Colors.primary} />
          <Text style={styles.loadingText}>Buscando sugestões da IA...</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (suggestions.length === 0 || currentIndex >= suggestions.length) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()}>
            <Ionicons name="arrow-back" size={24} color={Colors.text} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Conciliação Inteligente</Text>
          <View style={{ width: 24 }} />
        </View>
        <View style={styles.centerContainer}>
          <Ionicons name="checkmark-done-circle" size={80} color={Colors.primary} style={{ opacity: 0.5 }} />
          <Text style={styles.title}>Tudo conciliado!</Text>
          <Text style={styles.subtitle}>Não há mais transações pendentes de cruzamento.</Text>
        </View>
      </SafeAreaView>
    );
  }

  const currentItem = suggestions[currentIndex];

  const cardStyle = useAnimatedStyle(() => {
    return {
      transform: [{ translateX: translateX.value }]
    };
  });

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={24} color={Colors.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Conciliação Inteligente</Text>
        <View style={{ width: 24 }} />
      </View>

      <View style={styles.cardContainer}>
        <Animated.View style={[styles.card, cardStyle]}>
          <View style={styles.cardHeader}>
            <Text style={styles.bankTransaction}>Transação Bancária</Text>
            <Text style={styles.desc}>{currentItem.statement_desc}</Text>
            <Text style={[styles.amount, { color: currentItem.statement_amount > 0 ? Colors.primary : '#ef4444' }]}>
              R$ {Math.abs(currentItem.statement_amount).toFixed(2)}
            </Text>
          </View>

          <View style={styles.divider} />

          <View style={styles.cardBody}>
            <Text style={styles.aiSuggestion}>Sugestão da IA ✨</Text>
            <Text style={styles.reason}>{currentItem.reason}</Text>
            <View style={styles.matchBadge}>
              <Ionicons name={currentItem.match_type === 'das_payment' ? 'document-text' : 'receipt'} size={16} color={Palette.gold[500]} />
              <Text style={styles.matchText}>Confiança: {(currentItem.confidence * 100).toFixed(0)}%</Text>
            </View>
          </View>
        </Animated.View>
      </View>

      <View style={styles.actions}>
        <TouchableOpacity 
          style={[styles.btn, styles.btnReject]} 
          onPress={() => {
            translateX.value = withSpring(-500, {}, () => runOnJS(handleAction)(false));
          }}
        >
          <Ionicons name="close" size={32} color="#ef4444" />
        </TouchableOpacity>
        
        <TouchableOpacity 
          style={[styles.btn, styles.btnApprove]}
          onPress={() => {
            translateX.value = withSpring(500, {}, () => runOnJS(handleAction)(true));
          }}
        >
          <Ionicons name="checkmark" size={32} color={Colors.primary} />
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const getStyles = (Colors: any) => StyleSheet.create({
  container: { flex: 1, backgroundColor: Palette.black },
  header: { flexDirection: 'row', justifyContent: 'space-between', padding: 20, alignItems: 'center' },
  headerTitle: { color: Colors.text, fontSize: 18, fontFamily: Typography.fonts.display },
  centerContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24 },
  loadingText: { color: Colors.textSecondary, marginTop: 16, fontFamily: Typography.fonts.medium },
  title: { color: Colors.text, fontSize: 24, textAlign: 'center', marginTop: 20, fontFamily: Typography.fonts.display },
  subtitle: { color: Colors.textSecondary, textAlign: 'center', marginTop: 8, lineHeight: 22 },
  cardContainer: { flex: 1, padding: 20, justifyContent: 'center' },
  card: { backgroundColor: Palette.navyDeep, borderRadius: 24, padding: 24, borderWidth: 1, borderColor: Palette.borderStrong },
  cardHeader: { alignItems: 'center', marginBottom: 20 },
  bankTransaction: { color: Colors.textSecondary, fontSize: 12, marginBottom: 8 },
  desc: { color: Colors.text, fontSize: 18, fontFamily: Typography.fonts.medium, textAlign: 'center' },
  amount: { fontSize: 32, fontFamily: Typography.fonts.display, marginTop: 10 },
  divider: { height: 1, backgroundColor: Palette.border, marginVertical: 20 },
  cardBody: { alignItems: 'center' },
  aiSuggestion: { color: Palette.gold[500], fontSize: 14, fontFamily: Typography.fonts.display, marginBottom: 10 },
  reason: { color: Colors.text, fontSize: 14, textAlign: 'center', marginBottom: 15 },
  matchBadge: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: 'rgba(234, 179, 8, 0.1)', padding: 10, borderRadius: 8 },
  matchText: { color: Palette.gold[500], fontSize: 12 },
  actions: { flexDirection: 'row', justifyContent: 'space-evenly', paddingBottom: 40 },
  btn: { width: 70, height: 70, borderRadius: 35, justifyContent: 'center', alignItems: 'center', backgroundColor: Palette.navyDeep, borderWidth: 1, borderColor: Palette.borderStrong },
  btnReject: { borderColor: '#ef444450' },
  btnApprove: { borderColor: `${Colors.primary}50` }
});
