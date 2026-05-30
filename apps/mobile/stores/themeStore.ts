import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';

type ThemeMode = 'light' | 'dark' | 'system';

interface ThemeState {
  theme: ThemeMode;
  isDarkMode: boolean; // Computed or manually overridden
  setTheme: (theme: ThemeMode) => void;
  toggleDarkMode: () => void;
}

export const useThemeStore = create<ThemeState>()(
  persist(
    (set, get) => ({
      theme: 'dark', // Padrão
      isDarkMode: true,
      
      setTheme: (theme) => set({ theme, isDarkMode: theme === 'dark' }),
      
      toggleDarkMode: () => {
        const newIsDark = !get().isDarkMode;
        set({
          isDarkMode: newIsDark,
          theme: newIsDark ? 'dark' : 'light',
        });
      },
    }),
    {
      name: 'meiflow-theme-storage',
      storage: createJSONStorage(() => AsyncStorage),
    }
  )
);
