import { Stack } from 'expo-router';
import { useThemeColors } from '../../constants/theme';

export default function SettingsLayout() {
  const Colors = useThemeColors();

  return (
    <Stack screenOptions={{
      headerStyle: { backgroundColor: Colors.bg },
      headerTintColor: Colors.text,
      headerTitleStyle: { fontWeight: '700' },
      headerShadowVisible: false,
    }}>
      <Stack.Screen name="bank-accounts" options={{ title: 'Contas Bancárias' }} />
      <Stack.Screen name="change-password" options={{ title: 'Alterar Senha' }} />
    </Stack>
  );
}
