import 'react-native-url-polyfill/auto';
import { createClient } from '@supabase/supabase-js';
import * as SecureStore from 'expo-secure-store';

import { Platform } from 'react-native';

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY!;

const ExpoSecureStoreAdapter = {
  getItem: (key: string) => {
    if (Platform.OS === 'web') {
      if (typeof window !== 'undefined') {
        return Promise.resolve(window.localStorage.getItem(key));
      }
      return Promise.resolve(null);
    }
    return SecureStore.getItemAsync(key);
  },
  setItem: (key: string, value: string) => {
    if (Platform.OS === 'web') {
      if (typeof window !== 'undefined') {
        window.localStorage.setItem(key, value);
      }
      return Promise.resolve();
    }
    return SecureStore.setItemAsync(key, value);
  },
  removeItem: (key: string) => {
    if (Platform.OS === 'web') {
      if (typeof window !== 'undefined') {
        window.localStorage.removeItem(key);
      }
      return Promise.resolve();
    }
    return SecureStore.deleteItemAsync(key);
  },
};

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    storage: ExpoSecureStoreAdapter,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
    flowType: 'pkce',
  },
});

/**
 * Obtém o token JWT ativo do Supabase Auth de forma resiliente.
 * Se o token atual estiver expirado ou perto de expirar (menos de 60s),
 * força o refreshSession para garantir que requisições ao backend recebam
 * um token sempre válido.
 */
export async function getFreshAuthToken(): Promise<string> {
  try {
    const { data: { session } } = await supabase.auth.getSession();
    const now = Math.floor(Date.now() / 1000);
    
    // Se o token existe e tem mais de 60 segundos de validade restante
    if (session?.access_token && session.expires_at && session.expires_at > now + 60) {
      return session.access_token;
    }
    
    // Se está expirado ou ausente, solicita refresh imediato
    const { data: refreshed, error } = await supabase.auth.refreshSession();
    if (!error && refreshed?.session?.access_token) {
      return refreshed.session.access_token;
    }
    
    if (session?.access_token) {
      return session.access_token;
    }
  } catch (e) {
    console.warn('getFreshAuthToken aviso:', e);
  }
  return '';
}
