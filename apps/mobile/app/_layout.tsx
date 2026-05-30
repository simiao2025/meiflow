import { useEffect } from 'react';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { 
  useFonts, 
  PlusJakartaSans_400Regular,
  PlusJakartaSans_500Medium,
  PlusJakartaSans_600SemiBold,
  PlusJakartaSans_700Bold,
  PlusJakartaSans_800ExtraBold 
} from '@expo-google-fonts/plus-jakarta-sans';
import { Platform, LogBox } from 'react-native';
import * as SplashScreen from 'expo-splash-screen';

LogBox.ignoreLogs([
  'expo-notifications: Android Push notifications',
  'Value being stored in SecureStore is larger than 2048 bytes'
]);
import { activateKeepAwakeAsync } from 'expo-keep-awake';
import Constants from 'expo-constants';
import { useThemeColors } from '../constants/theme';

let Notifications: any = null;
if (Constants.appOwnership !== 'expo') {
  try {
    Notifications = require('expo-notifications');
    Notifications.setNotificationHandler({
      handleNotification: async () => ({
        shouldShowAlert: true,
        shouldPlaySound: true,
        shouldSetBadge: false,
      }),
    });
  } catch (e) {
    console.log('Failed to load expo-notifications', e);
  }
}


import { useAuthStore } from '../stores/authStore';
import { useRouter, useSegments } from 'expo-router';

// Previne o splash de sumir antes das fontes carregarem
SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  // Mantém a tela ativa durante o desenvolvimento (Apenas Android/iOS)
  useEffect(() => {
    if (__DEV__ && Platform.OS !== 'web') {
      activateKeepAwakeAsync().catch(() => {
        // Silencioso se falhar
      });
    }
  }, []);
  
  const { session, isLoading, profile, isProfileLoaded, isPasswordRecovery } = useAuthStore();

  const segments = useSegments();
  const router = useRouter();
  const Colors = useThemeColors();

  const [loaded, error] = useFonts({
    PlusJakartaSans_400Regular,
    PlusJakartaSans_500Medium,
    PlusJakartaSans_600SemiBold,
    PlusJakartaSans_700Bold,
    PlusJakartaSans_800ExtraBold,
  });

  useEffect(() => {
    if (loaded || error) {
      SplashScreen.hideAsync();
    }
  }, [loaded, error]);

  useEffect(() => {
    if (isLoading || !loaded) return;

    const inAuthGroup = segments[0] === 'auth';
    const inOnboarding = segments[0] === 'onboarding';

    if (!session) {
      if (!inAuthGroup) {
        router.replace('/auth/login');
      }
    } else {
      // Usuário logado
      if (!isProfileLoaded) return;

      // Se está em recuperação de senha, não redireciona
      if (isPasswordRecovery) {
        const allowedPaths = ['change-password', 'recover'];
        if (!allowedPaths.includes(segments[segments.length - 1])) {
          router.replace('/auth/change-password');
        }
        return;
      }

      const inAuthGroup = segments[0] === 'auth';
      const inOnboarding = segments[0] === 'onboarding';
      const isChangingPassword = segments[segments.length - 1] === 'change-password';

      const hasCnpj = !!profile?.cnpj;
      const mustChangePassword = !!profile?.must_change_password;

      if (!hasCnpj && !inOnboarding) {
        router.replace('/onboarding');
      } else if (hasCnpj && mustChangePassword && !isChangingPassword) {
        router.replace('/auth/change-password');
      } else if (hasCnpj && !mustChangePassword && (inAuthGroup || inOnboarding || isChangingPassword)) {
        router.replace('/(tabs)');
      }
    }
  }, [session, isLoading, profile, isProfileLoaded, segments, loaded, isPasswordRecovery]);

  if (!loaded && !error) {
    return null;
  }

  return (
    <>
      <StatusBar style="light" />
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: Colors.bg },
          animation: 'fade_from_bottom',
        }}
      >
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="onboarding" options={{ headerShown: false }} />
        <Stack.Screen name="auth/login" options={{ headerShown: false }} />
        <Stack.Screen name="auth/register" options={{ headerShown: false }} />
        <Stack.Screen name="auth/recover" options={{ headerShown: false }} />
        <Stack.Screen name="auth/change-password" options={{ headerShown: false }} />
        <Stack.Screen name="profile" options={{ presentation: 'modal', headerShown: true, headerTitle: 'Perfil', headerStyle: { backgroundColor: Colors.bg }, headerTintColor: Colors.text }} />
      </Stack>
    </>
  );
}
