import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { BlurView } from 'expo-blur';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Typography, Palette } from '../../constants/theme';

interface QuickActionProps {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  color: string;
  onPress?: () => void;
}

export function QuickActions({ actions }: { actions: QuickActionProps[] }) {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>Ações de Fluxo</Text>
      <View style={styles.grid}>
        {actions.map((action, index) => (
          <QuickActionItem key={index} {...action} />
        ))}
      </View>
    </View>
  );
}

function QuickActionItem({ icon, label, color, onPress }: QuickActionProps) {
  return (
    <View style={styles.actionItem}>
      <TouchableOpacity style={styles.actionCircle} onPress={onPress}>
        <BlurView intensity={10} tint="light" style={styles.actionBlur}>
          <Ionicons name={icon as any} size={24} color={color} />
        </BlurView>
      </TouchableOpacity>
      <Text style={styles.actionLabel}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { paddingHorizontal: 24, marginTop: 35 },
  title: {
    color: Colors.text,
    fontSize: 18,
    fontFamily: Typography.fonts.display,
    marginBottom: 15,
    letterSpacing: -0.5,
  },
  grid: { flexDirection: 'row', justifyContent: 'space-between' },
  actionItem: { alignItems: 'center', gap: 10 },
  actionCircle: {
    width: 62,
    height: 62,
    borderRadius: 20,
    overflow: 'hidden',
  },
  actionBlur: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: Palette.border,
  },
  actionLabel: { color: Colors.textSecondary, fontSize: 12, fontFamily: Typography.fonts.medium },
});
