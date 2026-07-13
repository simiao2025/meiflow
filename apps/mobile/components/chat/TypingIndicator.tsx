import React, { useEffect, useRef } from 'react';
import { View, Text, Animated, StyleSheet } from 'react-native';
import { useThemeColors, Typography } from '../../constants/theme';

interface TypingIndicatorProps {
  visible: boolean;
}

export function TypingIndicator({ visible }: TypingIndicatorProps) {
  const Colors = useThemeColors();
  const styles = getStyles(Colors);
  const typingAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (visible) {
      Animated.loop(
        Animated.sequence([
          Animated.timing(typingAnim, { toValue: 1, duration: 600, useNativeDriver: true }),
          Animated.timing(typingAnim, { toValue: 0.3, duration: 600, useNativeDriver: true }),
        ])
      ).start();
    } else {
      typingAnim.setValue(0);
    }
  }, [visible]);

  if (!visible) return null;

  return (
    <View style={[styles.msgWrapper, styles.aiWrap]}>
      <Animated.View style={[styles.bubble, { opacity: typingAnim }]}>
        <View style={styles.typingRow}>
          <View style={styles.typingDot} />
          <View style={[styles.typingDot, { marginHorizontal: 4 }]} />
          <View style={styles.typingDot} />
          <Text style={styles.typingText}>digitando...</Text>
        </View>
      </Animated.View>
    </View>
  );
}

const getStyles = (C: any) => StyleSheet.create({
  msgWrapper: { marginBottom: 16, flexDirection: 'row' },
  aiWrap: { justifyContent: 'flex-start' },
  bubble: { maxWidth: '85%', padding: 16, borderRadius: 24, overflow: 'hidden', backgroundColor: 'rgba(255,255,255,0.05)', borderBottomLeftRadius: 4, borderWidth: 0.5, borderColor: 'rgba(255,255,255,0.1)' },
  typingRow: { flexDirection: 'row', alignItems: 'center', gap: 2 },
  typingDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: C.textMuted },
  typingText: { color: C.textMuted, fontSize: 12, fontFamily: Typography.fonts.medium, marginLeft: 8 },
});