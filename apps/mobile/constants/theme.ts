// ============================================================
// MEIFlow Elite Design System — High-End "Obsidian & Gold"
// Inspired by Premium Fintechs, Black Cards, and Agency Design.
// ============================================================

export const DarkPalette = {
  black: '#050505',
  navyDeep: '#0A0A0A',
  white: '#FFFFFF',
  
  gold: {
    50:  '#FEFCE8',
    400: '#FACC15',
    500: '#EAB308',
    600: '#CA8A04',
    900: '#713F12',
  },
  
  glass: 'rgba(255, 255, 255, 0.04)',
  border: 'rgba(255, 255, 255, 0.08)',
  borderStrong: 'rgba(255, 255, 255, 0.15)',
  
  accent: '#EAB308',
  secondary: '#A1A1AA',
  warning: '#F59E0B',
};

export const LightPalette = {
  black: '#FFFFFF', // Inverted logic for bg
  navyDeep: '#F8FAFC', // Very light gray (Slate 50)
  white: '#050505', // Text color equivalent
  
  gold: {
    50:  '#FEFCE8',
    400: '#FACC15',
    500: '#EAB308', // Gold stays gold
    600: '#CA8A04',
    900: '#713F12',
  },
  
  glass: 'rgba(0, 0, 0, 0.03)',
  border: 'rgba(0, 0, 0, 0.06)',
  borderStrong: 'rgba(0, 0, 0, 0.12)',
  
  accent: '#CA8A04',
  secondary: '#64748B', // Slate 500
  warning: '#D97706',
};

// Default export for backward compatibility during refactor
export const Palette = DarkPalette;

export const DarkColors = {
  bg: DarkPalette.black,
  bgCard: '#121212',
  bgInner: '#18181B',
  
  primary: DarkPalette.gold[500],
  primaryLight: DarkPalette.gold[400],
  primaryMuted: 'rgba(234, 179, 8, 0.15)',
  secondary: DarkPalette.secondary,
  
  text: '#F8FAFC',
  textSecondary: '#A1A1AA',
  textMuted: '#52525B',
  
  border: DarkPalette.border,
  borderStrong: DarkPalette.borderStrong,
};

export const LightColors = {
  bg: LightPalette.black, // #FFFFFF
  bgCard: '#F1F5F9', // Slate 100
  bgInner: '#E2E8F0', // Slate 200
  
  primary: LightPalette.gold[600],
  primaryLight: LightPalette.gold[500],
  primaryMuted: 'rgba(202, 138, 4, 0.1)',
  secondary: LightPalette.secondary,
  
  text: '#0F172A', // Slate 900
  textSecondary: '#475569', // Slate 600
  textMuted: '#94A3B8', // Slate 400
  
  border: LightPalette.border,
  borderStrong: LightPalette.borderStrong,
};

// Default fallback
export const Colors = DarkColors;

import { useThemeStore } from '../stores/themeStore';

export function useThemeColors() {
  const { isDarkMode } = useThemeStore();
  return isDarkMode ? DarkColors : LightColors;
}

export const Typography = {
  fonts: {
    display: 'PlusJakartaSans_800ExtraBold',
    body: 'PlusJakartaSans_500Medium',
    medium: 'PlusJakartaSans_600SemiBold',
    light: 'PlusJakartaSans_400Regular',
  },
  sizes: {
    h1: 32,
    h2: 24,
    h3: 18,
    body: 15,
    small: 13,
    tiny: 11,
  }
};

export const Spacing = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
  xxl: 48, // Macro-whitespace
};

export const Effects = {
  // Technique: Double-Bezel (Doppelrand)
  glassCard: {
    backgroundColor: Palette.glass,
    borderRadius: 24,
    borderWidth: 0.5,
    borderColor: Palette.border,
  },
  innerBezel: {
    shadowColor: '#FFF',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 0,
  },
  // Custom Motion Curves
  curves: {
    premium: [0.32, 0.72, 0, 1], // Cinematic Inertia
  }
};
