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
  success: '#22C55E',
  destructive: '#EF4444',
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
  
  success: '#22C55E',
  destructive: '#EF4444',
};

// Default fallback
export const Colors = DarkColors;

export const useThemeColors = () => {
  return DarkColors;
};

export const Typography = {
  fonts: {
    display: 'PlusJakartaSans_800ExtraBold',
    bold: 'PlusJakartaSans_700Bold',
    medium: 'PlusJakartaSans_600SemiBold',
    body: 'PlusJakartaSans_500Medium',
    regular: 'PlusJakartaSans_400Regular',
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


