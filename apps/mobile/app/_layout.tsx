import { useEffect } from 'react';
import { Stack, useRouter, useSegments } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useAuthStore } from '../stores/authStore';
import { supabase } from '../services/supabase';

export default function RootLayout() {
  const { session, profile, isLoading, setSession, refreshProfile } = useAuthStore();
  const segments = useSegments();
  const router = useRouter();

  useEffect(() => {
    // Inicializar sessão
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
    });

    // Escutar mudanças no auth
    const { data: authListener } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
    });

    return () => {
      authListener.subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    if (isLoading) return;

    const inAuthGroup = segments[0] === 'auth';
    const inOnboarding = segments[0] === 'onboarding';

    if (!session && !inAuthGroup) {
      // Redireciona para login se não estiver logado
      router.replace('/auth/login');
    } else if (session && !profile?.cnpj && !inOnboarding && !inAuthGroup) {
      // Redireciona para onboarding se logado mas sem CNPJ
      router.replace('/onboarding');
    } else if (session && profile?.cnpj && (inAuthGroup || inOnboarding)) {
      // Redireciona para o app se já estiver tudo ok
      router.replace('/(tabs)');
    }
  }, [session, profile, segments, isLoading]);

  return (
    <>
      <StatusBar style="light" />
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="auth/login" options={{ animation: 'fade' }} />
        <Stack.Screen name="auth/register" options={{ animation: 'slide_from_right' }} />
        <Stack.Screen name="onboarding" options={{ gestureEnabled: false }} />
        <Stack.Screen name="(tabs)" options={{ gestureEnabled: false }} />
      </Stack>
    </>
  );
}
