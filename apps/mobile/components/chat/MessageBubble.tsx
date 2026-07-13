import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { BlurView } from 'expo-blur';
import { Ionicons } from '@expo/vector-icons';
import { useAudioPlayer } from 'expo-audio';
import { useThemeColors, Typography } from '../../constants/theme';

interface MessageBubbleProps {
  item: {
    id: string;
    role: 'user' | 'assistant';
    content: string;
    isError?: boolean;
    audioUri?: string;
  };
  playingId: string | null;
  onPlayAudio: (uri: string, id: string) => void;
}

export function MessageBubble({ item, playingId, onPlayAudio }: MessageBubbleProps) {
  const Colors = useThemeColors();
  const styles = getStyles(Colors);
  const player = useAudioPlayer('');

  const isPlaying = playingId === item.id;

  React.useEffect(() => {
    const subscription = player.addListener('playbackStatusUpdate', (status) => {
      if (status.didJustFinish) {}
    });
    return () => subscription.remove();
  }, [player]);

  return (
    <View style={[styles.msgWrapper, item.role === 'user' ? styles.userWrap : styles.aiWrap]}>
      <View style={[styles.bubble, item.role === 'user' ? styles.userBubble : styles.aiBubble, item.isError && styles.errorBubble]}>
        {item.role === 'assistant' && !item.isError ? (
          <BlurView intensity={10} tint="light" style={StyleSheet.absoluteFill} />
        ) : null}
        <Text style={[styles.msgText, item.role === 'user' ? styles.userText : styles.aiText]}>{item.content}</Text>
        {item.audioUri && (
          <TouchableOpacity style={styles.audioBtn} onPress={() => onPlayAudio(item.audioUri!, item.id)}>
            <Ionicons name={isPlaying ? "pause-circle" : "play-circle"} size={24} color={Colors.primary} />
            <Text style={styles.audioLabel}>Ouvir Resposta</Text>
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
}

const getStyles = (C: any) => StyleSheet.create({
  msgWrapper: { marginBottom: 16, flexDirection: 'row' },
  userWrap: { justifyContent: 'flex-end' },
  aiWrap: { justifyContent: 'flex-start' },
  bubble: { maxWidth: '85%', padding: 16, borderRadius: 24, overflow: 'hidden' },
  userBubble: { backgroundColor: C.primary, borderBottomRightRadius: 4 },
  aiBubble: { backgroundColor: 'rgba(255,255,255,0.05)', borderBottomLeftRadius: 4, borderWidth: 0.5, borderColor: 'rgba(255,255,255,0.1)' },
  errorBubble: { borderColor: 'rgba(239,68,68,0.3)', backgroundColor: 'rgba(239,68,68,0.05)' },
  msgText: { fontSize: 15, fontFamily: Typography.fonts.body, lineHeight: 22 },
  userText: { color: '#FFF' },
  aiText: { color: C.text },
  audioBtn: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 12, paddingTop: 12, borderTopWidth: 0.5, borderTopColor: 'rgba(255,255,255,0.1)' },
  audioLabel: { color: C.primary, fontFamily: Typography.fonts.medium, fontSize: 12 },
});