import React from 'react';
import { View, Text, StyleSheet, ScrollView } from 'react-native';
import { useThemeColors, Typography, Palette } from '../../constants/theme';
import { Ionicons } from '@expo/vector-icons';

export default function BankAccountsScreen() {
  const Colors = useThemeColors();

  return (
    <ScrollView style={[styles.container, { backgroundColor: Colors.bg }]} contentContainerStyle={styles.content}>
      <View style={styles.emptyState}>
        <View style={[styles.iconContainer, { backgroundColor: Colors.primaryMuted }]}>
          <Ionicons name="wallet-outline" size={48} color={Colors.primary} />
        </View>
        <Text style={[styles.title, { color: Colors.text }]}>Contas Bancárias</Text>
        <Text style={[styles.subtitle, { color: Colors.textSecondary }]}>
          O módulo de Open Finance está em fase de homologação. Em breve, você poderá sincronizar seus extratos bancários automaticamente com o MEIFlow.
        </Text>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    flex: 1,
    padding: 24,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyState: {
    alignItems: 'center',
    maxWidth: 300,
  },
  iconContainer: {
    width: 100,
    height: 100,
    borderRadius: 50,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 24,
  },
  title: {
    fontSize: 24,
    fontFamily: Typography.fonts.display,
    marginBottom: 12,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 15,
    fontFamily: Typography.fonts.body,
    textAlign: 'center',
    lineHeight: 24,
  },
});
