import React, { useState, useRef, useEffect, useCallback } from 'react';
import { 
  View, Text, StyleSheet, FlatList, TextInput, TouchableOpacity, 
  KeyboardAvoidingView, Platform, ActivityIndicator, Animated,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
import { Ionicons } from '@expo/vector-icons';
import { useAuthStore } from '../../stores/authStore';
import { Typography, Palette, useThemeColors } from '../../constants/theme';
import { useAudioRecorder, useAudioPlayer } from 'expo-audio';
import * as Audio from 'expo-audio';
import * as FileSystem from 'expo-file-system/legacy';
import { useAssistantChat } from '../../hooks/useAssistantChat';
import { MessageBubble } from '../../components/chat/MessageBubble';
import { QuickActions } from '../../components/chat/QuickActions';
import { TypingIndicator } from '../../components/chat/TypingIndicator';

const AI_MODELS = [
  { id: 'openai', label: 'GPT-4o', icon: 'logo-github' },
  { id: 'anthropic', label: 'Claude 3.5', icon: 'flash' },
  { id: 'google', label: 'Gemini 1.5', icon: 'planet' },
  { id: 'groq', label: 'Llama 3 (Groq)', icon: 'speedometer' },
];

export default function AssistantScreen() {
  const Colors = useThemeColors();
  const styles = getStyles(Colors);
  const { user } = useAuthStore();
  const [inputText, setInputText] = useState('');
  const [selectedProvider, setSelectedProvider] = useState('openai');
  const [showModelPicker, setShowModelPicker] = useState(false);
  const [recordingUI, setRecordingUI] = useState(false);
  const [playingId, setPlayingId] = useState<string | null>(null);

  const { messages, loading, failedMsgId, sendMessage, sendAudio, retryLastMessage, clearChat } = useAssistantChat(selectedProvider);

  const recorder = useAudioRecorder(Audio.RecordingPresets.LOW_QUALITY);
  const player = useAudioPlayer('');
  const flatListRef = useRef<FlatList>(null);
  const fadeAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const subscription = player.addListener('playbackStatusUpdate', (status) => {
      if (status.didJustFinish) setPlayingId(null);
    });
    return () => subscription.remove();
  }, [player]);

  useEffect(() => {
    Animated.timing(fadeAnim, { toValue: 1, duration: 800, useNativeDriver: true }).start();
  }, []);

  const handleSendMessage = useCallback((text?: string) => {
    const msg = text || inputText;
    if (!msg.trim()) return;
    sendMessage(msg);
    setInputText('');
  }, [inputText, sendMessage]);

  const startRecording = async () => {
    try {
      const { status } = await Audio.requestRecordingPermissionsAsync();
      if (status !== 'granted') return;
      setRecordingUI(true);
      await recorder.prepareToRecordAsync();
      recorder.record();
    } catch (err) {
      setRecordingUI(false);
    }
  };

  const stopRecording = async () => {
    setRecordingUI(false);
    try {
      if (recorder.isRecording) await recorder.stop();
    } catch (err) {}
    const uri = recorder.uri;
    if (uri) processAudio(uri);
  };

  const cancelRecording = async () => {
    setRecordingUI(false);
    try {
      if (recorder.isRecording) await recorder.stop();
    } catch (err) {}
  };

  const processAudio = async (uri: string) => {
    try {
      const base64Audio = await FileSystem.readAsStringAsync(uri, { encoding: 'base64' as any });
      await sendAudio(base64Audio);
    } catch (e) {
      console.error('Erro ao ler áudio do filesystem', e);
    }
  };

  const playAudio = async (base64: string, id: string) => {
    try {
      const fileUri = FileSystem.cacheDirectory + `audio_${id}.mp3`;
      await FileSystem.writeAsStringAsync(fileUri, base64, { encoding: 'base64' as any });
      player.replace(fileUri);
      setPlayingId(id);
      player.play();
    } catch (_) {}
  };

  const showQuickActions = messages.length <= 2;

  return (
    <KeyboardAvoidingView 
      style={{ flex: 1 }} 
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 60}
    >
      <LinearGradient colors={[Colors.bg, '#0B1121']} style={styles.container}>
        {/* Header */}
      <View style={styles.header}>
        <BlurView intensity={20} tint="dark" style={styles.headerBlur}>
          <View style={styles.headerContent}>
            <View style={styles.aiStatus}>
              <LinearGradient colors={[Colors.primary, Colors.secondary]} style={styles.aiBadge}>
                <Ionicons name="sparkles" size={16} color="#FFF" />
              </LinearGradient>
              <View>
                <Text style={styles.headerTitle}>MEI Flow AI</Text>
                <Text style={styles.headerSubtitle}>Inteligência Vanguarda</Text>
              </View>
            </View>
            <View style={{ flexDirection: 'row', gap: 8 }}>
              <TouchableOpacity style={styles.modelBtn} onPress={clearChat}>
                <Ionicons name="trash-outline" size={14} color={Colors.textMuted} />
              </TouchableOpacity>
              <TouchableOpacity style={styles.modelBtn} onPress={() => setShowModelPicker(!showModelPicker)}>
                <Text style={styles.modelText}>{AI_MODELS.find(m => m.id === selectedProvider)?.label || selectedProvider.toUpperCase()}</Text>
                <Ionicons name="chevron-down" size={12} color={Colors.textMuted} />
              </TouchableOpacity>
            </View>
          </View>
        </BlurView>
      </View>

      {showModelPicker && (
        <Animated.View style={styles.pickerOverlay}>
          {AI_MODELS.map(m => (
            <TouchableOpacity key={m.id} style={[styles.pickerItem, selectedProvider === m.id && styles.pickerItemActive]} onPress={() => { setSelectedProvider(m.id); setShowModelPicker(false); }}>
              <Ionicons name={m.icon as any} size={18} color={selectedProvider === m.id ? Colors.primary : Colors.textMuted} />
              <Text style={[styles.pickerLabel, selectedProvider === m.id && { color: Colors.text }]}>{m.label}</Text>
            </TouchableOpacity>
          ))}
        </Animated.View>
      )}

      {/* Messages */}
      <FlatList
        ref={flatListRef}
        data={messages}
        keyExtractor={item => item.id}
        contentContainerStyle={styles.list}
        renderItem={({ item }) => (
          <MessageBubble item={item} playingId={playingId} onPlayAudio={playAudio} />
        )}
        ListFooterComponent={() => (
          <View>
            <TypingIndicator visible={loading} />
            {failedMsgId && !loading && (
              <TouchableOpacity style={styles.retryBtn} onPress={retryLastMessage}>
                <Ionicons name="refresh" size={16} color={Colors.primary} />
                <Text style={styles.retryText}>Tentar novamente</Text>
              </TouchableOpacity>
            )}
          </View>
        )}
        onContentSizeChange={() => flatListRef.current?.scrollToEnd()}
      />

      <QuickActions onAction={handleSendMessage} />

      {/* Input */}
      <View style={styles.inputSection}>
         <View style={styles.bezelOuter}>
              <View style={styles.bezelInner}>
                {recordingUI ? (
                  <>
                    <TouchableOpacity onPress={cancelRecording} style={styles.micBtn}>
                      <Ionicons name="trash-outline" size={22} color="#EF4444" />
                    </TouchableOpacity>
                    <View style={styles.recordingCenter}>
                      <View style={styles.recordingDot} />
                      <Text style={styles.recordingText}>Gravando áudio...</Text>
                    </View>
                    <TouchableOpacity style={styles.sendBtn} onPress={stopRecording}>
                      <Ionicons name="send" size={18} color="#FFF" />
                    </TouchableOpacity>
                  </>
                ) : (
                  <>
                    <TextInput 
                      style={styles.input} 
                      placeholder="Comande sua empresa..." 
                      placeholderTextColor={Colors.textMuted} 
                      value={inputText} 
                      onChangeText={setInputText}
                      multiline
                      maxLength={2000}
                    />
                    {inputText.trim() ? (
                      <TouchableOpacity style={[styles.sendBtn, loading && { opacity: 0.5 }]} onPress={() => handleSendMessage()} disabled={loading}>
                        {loading ? <ActivityIndicator color="#FFF" size="small" /> : <Ionicons name="arrow-up" size={20} color="#FFF" />}
                      </TouchableOpacity>
                    ) : (
                      <TouchableOpacity onPress={startRecording} style={styles.micBtnRight}>
                        <Ionicons name="mic" size={22} color={Colors.primary} />
                      </TouchableOpacity>
                    )}
                  </>
                )}
          </View>
         </View>
      </View>
    </LinearGradient>
    </KeyboardAvoidingView>
  );
}

const getStyles = (Colors: any) => StyleSheet.create({
  container: { flex: 1 },
  header: { paddingTop: Platform.OS === 'ios' ? 50 : 20, zIndex: 10 },
  headerBlur: { borderBottomWidth: 0.5, borderBottomColor: Colors.border },
  headerContent: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 20 },
  aiStatus: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  aiBadge: { width: 36, height: 36, borderRadius: 12, justifyContent: 'center', alignItems: 'center' },
  headerTitle: { color: Colors.text, fontFamily: Typography.fonts.display, fontSize: 16 },
  headerSubtitle: { color: Colors.primary, fontFamily: Typography.fonts.medium, fontSize: 10, letterSpacing: 1 },
  modelBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: 'rgba(255,255,255,0.05)', paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8 },
  modelText: { color: Colors.text, fontSize: 10, fontFamily: Typography.fonts.display },
  pickerOverlay: { position: 'absolute', top: 120, right: 20, left: 20, backgroundColor: Colors.bgCard, borderRadius: 16, padding: 8, zIndex: 100, borderWidth: 1, borderColor: Colors.border },
  pickerItem: { flexDirection: 'row', alignItems: 'center', padding: 12, borderRadius: 10, gap: 10 },
  pickerItemActive: { backgroundColor: 'rgba(16, 185, 129, 0.1)' },
  pickerLabel: { color: Colors.textSecondary, fontFamily: Typography.fonts.medium, fontSize: 14 },
  list: { padding: 20, paddingBottom: 20 },
  msgWrapper: { marginBottom: 16, flexDirection: 'row' },
  userWrap: { justifyContent: 'flex-end' },
  aiWrap: { justifyContent: 'flex-start' },
  bubble: { maxWidth: '85%', padding: 16, borderRadius: 24, overflow: 'hidden' },
  userBubble: { backgroundColor: Colors.primary, borderBottomRightRadius: 4 },
  aiBubble: { backgroundColor: 'rgba(255,255,255,0.05)', borderBottomLeftRadius: 4, borderWidth: 0.5, borderColor: 'rgba(255,255,255,0.1)' },
  errorBubble: { borderColor: 'rgba(239,68,68,0.3)', backgroundColor: 'rgba(239,68,68,0.05)' },
  msgText: { fontSize: 15, fontFamily: Typography.fonts.body, lineHeight: 22 },
  userText: { color: '#FFF' },
  aiText: { color: Colors.text },
  audioBtn: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 12, paddingTop: 12, borderTopWidth: 0.5, borderTopColor: 'rgba(255,255,255,0.1)' },
  audioLabel: { color: Colors.primary, fontFamily: Typography.fonts.medium, fontSize: 12 },
  typingRow: { flexDirection: 'row', alignItems: 'center', gap: 2 },
  typingDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: Colors.textMuted },
  typingText: { color: Colors.textMuted, fontSize: 12, fontFamily: Typography.fonts.medium, marginLeft: 8 },
  retryBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 12, marginTop: 4 },
  retryText: { color: Colors.primary, fontSize: 13, fontFamily: Typography.fonts.display },
  quickRow: { paddingLeft: 24, paddingVertical: 8, flexGrow: 0, flexShrink: 0 },
  quickChip: { paddingHorizontal: 16, paddingVertical: 10, borderRadius: 20, backgroundColor: 'rgba(255,255,255,0.03)', borderWidth: 1, borderColor: '#334155', marginRight: 8 },
  quickChipText: { color: Colors.text, fontSize: 13, fontFamily: Typography.fonts.medium },
  inputSection: { padding: 20, paddingBottom: Platform.OS === 'ios' ? 90 : 100 },
  bezelOuter: { backgroundColor: 'rgba(255,255,255,0.03)', borderRadius: 28, padding: 1.5, borderWidth: 0.5, borderColor: 'rgba(255,255,255,0.1)' },
  bezelInner: { backgroundColor: Colors.bgInner, borderRadius: 26.5, padding: 8, flexDirection: 'row', alignItems: 'center' },
  micBtn: { width: 44, height: 44, borderRadius: 16, justifyContent: 'center', alignItems: 'center', backgroundColor: 'rgba(239,68,68,0.1)' },
  micBtnRight: { width: 44, height: 44, borderRadius: 16, justifyContent: 'center', alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.05)' },
  recordingCenter: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
  recordingDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#EF4444' },
  recordingText: { color: Colors.text, fontFamily: Typography.fonts.medium, fontSize: 14 },
  input: { flex: 1, color: Colors.text, fontFamily: Typography.fonts.body, fontSize: 15, paddingHorizontal: 12, maxHeight: 100 },
  sendBtn: { width: 44, height: 44, borderRadius: 16, backgroundColor: Colors.primary, justifyContent: 'center', alignItems: 'center' },
});
