// ============================================================
// MEIFlow Design System — "Trust & Clarity"
// Fintech-grade visual identity for MEI users.
// ============================================================

const DarkPalette = {
  black: '#0F1117',
  navyDeep: '#141620',
  white: '#FFFFFF',
  
  gold: {
    50:  '#FEFCE8',
    400: '#FACC15',
    500: '#EAB308',
    600: '#CA8A04',
    900: '#713F12',
  },
  
  blue: {
    400: '#60A5FA',
    500: '#3B82F6',
    600: '#2563EB',
  },
  
  glass: 'rgba(255, 255, 255, 0.04)',
  border: 'rgba(255, 255, 255, 0.06)',
  borderStrong: 'rgba(255, 255, 255, 0.12)',
  
  accent: '#3B82F6',
  secondary: '#94A3B8',
  warning: '#F59E0B',
  success: '#22C55E',
  destructive: '#EF4444',
};

export const Palette = DarkPalette;

const DarkColors = {
  bg: DarkPalette.black,
  bgCard: '#1A1D27',
  bgInner: '#242836',
  
  primary: DarkPalette.blue[500],
  primaryLight: DarkPalette.blue[400],
  primaryMuted: 'rgba(59, 130, 246, 0.12)',
  secondary: DarkPalette.secondary,
  
  text: '#F1F5F9',
  textSecondary: '#94A3B8',
  textMuted: '#64748B',
  
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
