import React from 'react';
import { Tabs } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { View, StyleSheet } from 'react-native';
import { BlurView } from 'expo-blur';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useThemeColors, Typography } from '../../constants/theme';

export default function TabLayout() {
  const Colors = useThemeColors();
  const insets = useSafeAreaInsets();

  // Garante padding mínimo de 8px + safe area do sistema (botões Android)
  const bottomPadding = Math.max(insets.bottom, 8) + 8;
  const tabBarHeight = 56 + bottomPadding;

  return (
    <Tabs
      screenOptions={{
        tabBarShowLabel: true,
        tabBarActiveTintColor: Colors.primary,
        tabBarInactiveTintColor: Colors.textMuted,
        tabBarStyle: {
          position: 'absolute',
          bottom: 0,
          left: 0,
          right: 0,
          backgroundColor: 'rgba(15, 23, 42, 0.95)',
          borderTopWidth: 1,
          borderTopColor: 'rgba(255, 255, 255, 0.06)',
          height: tabBarHeight,
          paddingTop: 8,
          paddingBottom: bottomPadding,
        },
        tabBarItemStyle: styles.tabBarItem,
        tabBarLabelStyle: styles.tabBarLabel,
        tabBarBackground: () => (
          <BlurView intensity={30} tint="dark" style={StyleSheet.absoluteFill} />
        ),
        headerStyle: {
          backgroundColor: Colors.bg,
          elevation: 0,
          shadowOpacity: 0,
          borderBottomWidth: 1,
          borderBottomColor: Colors.border,
        },
        headerTitleStyle: {
          color: Colors.text,
          fontSize: 16,
          fontFamily: Typography.fonts.display,
        },
      }}>
      <Tabs.Screen
        name="index"
        options={{
          title: 'Painel',
          headerShown: false,
          tabBarIcon: ({ color, focused }) => (
            <Ionicons name={focused ? 'grid' : 'grid-outline'} size={22} color={color} />
          ),
          tabBarAccessibilityLabel: 'Painel principal',
        }}
      />
      <Tabs.Screen
        name="fiscal"
        options={{
          title: 'Fiscal',
          tabBarIcon: ({ color, focused }) => (
            <Ionicons name={focused ? 'document-text' : 'document-text-outline'} size={22} color={color} />
          ),
          tabBarAccessibilityLabel: 'Gestão fiscal',
        }}
      />
      <Tabs.Screen
        name="clients"
        options={{
          title: 'Clientes',
          tabBarIcon: ({ color, focused }) => (
            <Ionicons name={focused ? 'people' : 'people-outline'} size={22} color={color} />
          ),
          tabBarAccessibilityLabel: 'Gestão de clientes',
        }}
      />
      <Tabs.Screen
        name="assistant"
        options={{
          title: 'IA',
          tabBarIcon: ({ color, focused }) => (
            <View style={[styles.aiIcon, focused && { backgroundColor: Colors.primary }]}>
              <Ionicons name={focused ? 'sparkles' : 'sparkles-outline'} size={20} color={focused ? '#FFF' : color} />
            </View>
          ),
          tabBarAccessibilityLabel: 'Assistente de inteligência artificial',
        }}
      />

      {/* Telas acessíveis pelo dashboard, sem aparecer na tab bar */}
      <Tabs.Screen name="two" options={{ tabBarItemStyle: { display: 'none' }, headerShown: false }} />
      <Tabs.Screen name="opportunities" options={{ tabBarItemStyle: { display: 'none' }, headerShown: false }} />
      <Tabs.Screen name="settings" options={{ tabBarItemStyle: { display: 'none' }, headerShown: false }} />
      <Tabs.Screen name="settings/bank-accounts" options={{ tabBarItemStyle: { display: 'none' }, headerShown: false }} />
      <Tabs.Screen name="settings/change-password" options={{ tabBarItemStyle: { display: 'none' }, headerShown: false }} />
      <Tabs.Screen name="settings/payments" options={{ tabBarItemStyle: { display: 'none' }, headerShown: false }} />
      <Tabs.Screen name="schedule" options={{ tabBarItemStyle: { display: 'none' }, headerShown: false }} />
      <Tabs.Screen name="catalog" options={{ tabBarItemStyle: { display: 'none' }, headerShown: false }} />
      <Tabs.Screen name="pos" options={{ tabBarItemStyle: { display: 'none' }, headerShown: false }} />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  tabBarItem: {
    justifyContent: 'center',
    alignItems: 'center',
    gap: 4,
  },
  tabBarLabel: {
    fontSize: 11,
    fontFamily: Typography.fonts.medium,
    marginTop: 0,
  },
  aiIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
  },
});
