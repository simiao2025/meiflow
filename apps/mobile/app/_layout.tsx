import { useEffect } from 'react';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import {
  useFonts,
  PlusJakartaSans_400Regular,
  PlusJakartaSans_500Medium,
  PlusJakartaSans_600SemiBold,
  PlusJakartaSans_700Bold,
  PlusJakartaSans_800ExtraBold
} from '@expo-google-fonts/plus-jakarta-sans';
import { Platform, LogBox, Alert } from 'react-native';
import * as SplashScreen from 'expo-splash-screen';
import * as Updates from 'expo-updates';

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

  // Timeout de segurança: esconde splash após 5s mesmo sem carregar tudo
  useEffect(() => {
    const splashTimeout = setTimeout(() => {
      SplashScreen.hideAsync();
    }, 5000);
    return () => clearTimeout(splashTimeout);
  }, []);

  // Verificar atualização OTA disponível
  useEffect(() => {
    const checkUpdate = async () => {
      try {
        if (__DEV__) return;
        const { isAvailable } = await Updates.checkForUpdateAsync();
        if (isAvailable) {
          Alert.alert(
            'Atualização Disponível',
            'Uma nova versão do MEIFlow está disponível. Deseja atualizar agora?',
            [
              { text: 'Agora não', style: 'cancel' },
              {
                text: 'Atualizar',
                onPress: async () => {
                  await Updates.fetchUpdateAsync();
                  await Updates.reloadAsync();
                },
              },
            ]
          );
        }
      } catch {}
    };
    checkUpdate();
  }, []);

  useEffect(() => {
    if ((loaded || error) && !isLoading) {
      SplashScreen.hideAsync();
    }
  }, [loaded, error, isLoading]);

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
      const inTabs = segments[0] === '(tabs)';
      const isChangingPassword = segments[0] === 'auth' && segments[1] === 'change-password';

      const hasCnpj = !!profile?.cnpj;
      const mustChangePassword = !!profile?.must_change_password;

      if (!hasCnpj && !inOnboarding) {
        router.replace('/onboarding');
      } else if (hasCnpj && mustChangePassword && !isChangingPassword) {
        router.replace('/auth/change-password');
      } else if (hasCnpj && !mustChangePassword && (!segments[0] || inAuthGroup || inOnboarding || isChangingPassword)) {
        router.replace('/(tabs)');
      }
    }
  }, [session, isLoading, profile, isProfileLoaded, segments, loaded, isPasswordRecovery]);

  if (!loaded && !error) {
    return null;
  }

  return (
    <SafeAreaProvider>
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
    </SafeAreaProvider>
  );
}
