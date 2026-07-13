import React from 'react';
import { Tabs, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Platform, View, StyleSheet } from 'react-native';
import { BlurView } from 'expo-blur';
import { useThemeColors, Typography, Palette } from '../../constants/theme';
import { useThemeStore } from '../../stores/themeStore';

export default function TabLayout() {
  const router = useRouter();
  const Colors = useThemeColors();
  const { isDarkMode } = useThemeStore();

  return (
    <Tabs
      screenOptions={{
        tabBarShowLabel: false,
        tabBarActiveTintColor: Colors.primary,
        tabBarInactiveTintColor: Colors.textSecondary,
        tabBarStyle: styles.tabBar,
        tabBarItemStyle: {
          justifyContent: 'center',
          alignItems: 'center',
          paddingTop: Platform.OS === 'android' ? 14 : 14,
          paddingBottom: 0,
        },
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
        tabBarLabelStyle: {
          fontSize: 10,
          fontFamily: Typography.fonts.medium,
          marginTop: -4,
          marginBottom: 4,
        },
      }}>
      <Tabs.Screen
        name="index"
        options={{
          title: 'Painel',
          headerShown: false,
          tabBarIcon: ({ color, focused }) => (
            <Ionicons name={focused ? 'grid' : 'grid-outline'} size={26} color={color} />
          ),
          tabBarAccessibilityLabel: 'Painel principal',
        }}
      />
      <Tabs.Screen
        name="fiscal"
        options={{
          title: 'Fiscal',
          tabBarIcon: ({ color, focused }) => (
            <Ionicons name={focused ? 'document-text' : 'document-text-outline'} size={26} color={color} />
          ),
          tabBarAccessibilityLabel: 'Gestão fiscal',
        }}
      />
      <Tabs.Screen
        name="clients"
        options={{
          title: 'Clientes',
          tabBarIcon: ({ color, focused }) => (
            <Ionicons name={focused ? 'people' : 'people-outline'} size={26} color={color} />
          ),
          tabBarAccessibilityLabel: 'Gestão de clientes',
        }}
      />
      <Tabs.Screen
        name="assistant"
        options={{
          title: 'IA',
          tabBarIcon: ({ color, focused }) => (
            <View style={[styles.aiIcon, focused && { backgroundColor: Colors.primary, elevation: 5 }]}>
              <Ionicons name={focused ? 'sparkles' : 'sparkles-outline'} size={28} color={focused ? '#FFF' : color} />
            </View>
          ),
          tabBarAccessibilityLabel: 'Assistente de inteligência artificial',
        }}
      />
      <Tabs.Screen
        name="opportunities"
        options={{
          title: 'Oportunidades',
          tabBarIcon: ({ color, focused }) => (
            <Ionicons name={focused ? 'rocket' : 'rocket-outline'} size={26} color={color} />
          ),
          tabBarAccessibilityLabel: 'Oportunidades e licitações',
        }}
      />
      <Tabs.Screen
        name="two"
        options={{
          title: 'Finanças',
          tabBarIcon: ({ color, focused }) => (
            <Ionicons name={focused ? 'bar-chart' : 'bar-chart-outline'} size={26} color={color} />
          ),
          tabBarAccessibilityLabel: 'Financeiro',
        }}
      />
      {/* Escondidos */}
      <Tabs.Screen
        name="settings"
        options={{
          title: 'Ajustes',
          tabBarItemStyle: { display: 'none' },
        }}
      />
      <Tabs.Screen name="schedule" options={{ title: 'Agenda', headerShown: false, tabBarItemStyle: { display: 'none' } }} />
      <Tabs.Screen name="catalog" options={{ title: 'Catálogo', headerShown: false, tabBarItemStyle: { display: 'none' } }} />
      <Tabs.Screen name="pos" options={{ tabBarItemStyle: { display: 'none' } }} />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  tabBar: {
    position: 'absolute',
    bottom: 30,
    left: 20,
    right: 20,
    backgroundColor: 'rgba(15, 23, 42, 0.8)',
    borderRadius: 32,
    height: 60,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
    elevation: 10,
    overflow: 'hidden',
    paddingBottom: 0,
    paddingTop: 0,
  },
  aiIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
  }
});
