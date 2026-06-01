import { View, ActivityIndicator, StyleSheet } from 'react-native';
import { useThemeColors } from '../constants/theme';

export default function Index() {
  const Colors = useThemeColors();
  
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
});
