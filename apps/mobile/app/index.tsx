import { useEffect, useState } from 'react';
import { View, ActivityIndicator, StyleSheet, Text } from 'react-native';
import { useThemeColors } from '../constants/theme';
import NetInfo from '@react-native-community/netinfo';

export default function Index() {
  const Colors = useThemeColors();
  const [isOffline, setIsOffline] = useState(false);

  useEffect(() => {
    const checkConnection = async () => {
      const state = await NetInfo.fetch();
      setIsOffline(!(state.isConnected ?? false));
    };
    checkConnection();
  }, []);

  if (isOffline) {
    return (
      <View style={[styles.container, { backgroundColor: Colors.bg }]}>
        <Text style={[styles.offlineIcon]}>📡</Text>
        <Text style={[styles.offlineTitle, { color: Colors.text }]}>Sem Conexão</Text>
        <Text style={[styles.offlineDesc, { color: Colors.textMuted }]}>
          Algumas funcionalidades podem não estar disponíveis sem internet.
        </Text>
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: Colors.bg }]}>
      <ActivityIndicator size="large" color={Colors.primary} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  offlineIcon: { fontSize: 48, marginBottom: 16 },
  offlineTitle: { fontSize: 20, fontFamily: 'PlusJakartaSans_700Bold', marginBottom: 8 },
  offlineDesc: { fontSize: 14, textAlign: 'center', paddingHorizontal: 40, fontFamily: 'PlusJakartaSans_500Medium', lineHeight: 20 },
});