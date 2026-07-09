import React, { useState, useRef, useEffect } from 'react';
import { 
  View, Text, StyleSheet, FlatList, TextInput, TouchableOpacity, 
  KeyboardAvoidingView, Platform, ActivityIndicator, Animated, ScrollView,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
import { Ionicons } from '@expo/vector-icons';
import { useAuthStore } from '../../stores/authStore';
import { Typography, Palette, useThemeColors } from '../../constants/theme';
import { useAudioRecorder, useAudioPlayer } from 'expo-audio';
import * as Audio from 'expo-audio';
import * as FileSystem from 'expo-file-system/legacy';


const apiUrl = process.env.EXPO_PUBLIC_API_URL || 'http://192.168.1.203';
const CHAT_FILE_URI = FileSystem.documentDirectory + 'meiflow_chat_history.json';
const MAX_STORED_MESSAGES = 100;

const AI_MODELS = [
  { id: 'openai', label: 'GPT-4o', icon: 'logo-github' },
  { id: 'anthropic', label: 'Claude 3.5', icon: 'flash' },
  { id: 'google', label: 'Gemini 1.5', icon: 'planet' },
  { id: 'groq', label: 'Llama 3 (Groq)', icon: 'speedometer' },
];

const QUICK_ACTIONS = [
  { label: '💰 Ver meu saldo', message: 'Qual é meu saldo atual?' },
  { label: '📄 Emitir cobrança', message: 'Quero emitir uma cobrança para um cliente' },
  { label: '📊 Resumo do mês', message: 'Me dê um resumo financeiro deste mês' },
  { label: '📅 Próximos prazos', message: 'Quais são meus próximos prazos fiscais?' },
];

export default function AssistantScreen() {
  const Colors = useThemeColors();
  const styles = getStyles(Colors);
  const { user } = useAuthStore();
  const [messages, setMessages] = useState<any[]>([]);
  const messagesRef = useRef(messages);
  messagesRef.current = messages;
  const [inputText, setInputText] = useState('');
  const [loading, setLoading] = useState(false);
  const [selectedProvider, setSelectedProvider] = useState('openai');
  const [showModelPicker, setShowModelPicker] = useState(false);
  const [failedMsgId, setFailedMsgId] = useState<string | null>(null);
  const [recordingUI, setRecordingUI] = useState(false);
  
  // Audio
  const recorder = useAudioRecorder(Audio.RecordingPresets.HIGH_QUALITY);
  const [playingId, setPlayingId] = useState<string | null>(null);
  const player = useAudioPlayer('');

  useEffect(() => {
    const subscription = player.addListener('playbackStatusUpdate', (status) => {
      if (status.didJustFinish) setPlayingId(null);
    });
    return () => subscription.remove();
  }, [player]);

  const flatListRef = useRef<FlatList>(null);
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const typingAnim = useRef(new Animated.Value(0)).current;

  // Load saved history
  useEffect(() => {
    Animated.timing(fadeAnim, { toValue: 1, duration: 800, useNativeDriver: true }).start();
    loadChatHistory();
  }, []);

  // Typing animation
  useEffect(() => {
    if (loading) {
      Animated.loop(
        Animated.sequence([
          Animated.timing(typingAnim, { toValue: 1, duration: 600, useNativeDriver: true }),
          Animated.timing(typingAnim, { toValue: 0.3, duration: 600, useNativeDriver: true }),
        ])
      ).start();
    } else {
      typingAnim.setValue(0);
    }
  }, [loading]);

  const loadChatHistory = async () => {
    try {
      const fileInfo = await FileSystem.getInfoAsync(CHAT_FILE_URI);
      if (fileInfo.exists) {
        const stored = await FileSystem.readAsStringAsync(CHAT_FILE_URI);
        const parsed = JSON.parse(stored);
        if (parsed.length > 0) {
          setMessages(parsed);
          return;
        }
      }
    } catch (_) {}
    // Default welcome message
    setMessages([{ id: '1', role: 'assistant', content: 'Olá! Como posso ajudar sua empresa hoje? Posso emitir cobranças, agendar serviços ou consultar seu financeiro.' }]);
  };

  const saveChatHistory = async (msgs: any[]) => {
    try {
      const toStore = msgs.slice(-MAX_STORED_MESSAGES).map(m => ({
        id: m.id, role: m.role, content: m.content,
      }));
      await FileSystem.writeAsStringAsync(CHAT_FILE_URI, JSON.stringify(toStore));
    } catch (_) {}
  };

  const sendMessage = async (overrideText?: string) => {
    const text = overrideText || inputText;
    if (!text.trim() || loading) return;

    const userMsg = { id: Date.now().toString(), role: 'user', content: text };
    const currentMessages = messagesRef.current;
    const newMessages = [...currentMessages, userMsg];
    setMessages(newMessages);
    saveChatHistory(newMessages);
    setInputText('');
    setLoading(true);
    setFailedMsgId(null);

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 30000);

      const response = await fetch(`${apiUrl}/api/v1/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'bypass-tunnel-reminder': 'true', 'ngrok-skip-browser-warning': 'true' },
        body: JSON.stringify({
          message: text,
          user_id: user?.id,
          provider: selectedProvider
        }),
        signal: controller.signal,
      });
      clearTimeout(timeoutId);

      const data = await response.json();
      const aiContent = data?.response || data?.message || 'Desculpe, não consegui processar sua solicitação. Tente novamente.';
      const aiMsg = { id: (Date.now() + 1).toString(), role: 'assistant', content: aiContent };
      const updated = [...newMessages, aiMsg];
      setMessages(updated);
      saveChatHistory(updated);
    } catch (e) {
      const errorMsg = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: '⚠️ Não consegui conectar ao servidor. Verifique sua conexão e tente novamente.',
        isError: true,
      };
      setFailedMsgId(userMsg.id);
      const updated = [...newMessages, errorMsg];
      setMessages(updated);
    } finally {
      setLoading(false);
    }
  };

  const retryLastMessage = () => {
  const Colors = useThemeColors();
  const styles = getStyles(Colors);
    if (!failedMsgId) return;
    const failedMsg = messages.find(m => m.id === failedMsgId);
    if (!failedMsg) return;
    // Remove the error message and retry
    const cleaned = messages.filter(m => !m.isError);
    setMessages(cleaned);
    setFailedMsgId(null);
    sendMessage(failedMsg.content);
  };

  const clearChat = async () => {
    const welcome = [{ id: '1', role: 'assistant', content: 'Conversa limpa! Como posso ajudar?' }];
    setMessages(welcome);
    try {
      await FileSystem.deleteAsync(CHAT_FILE_URI, { idempotent: true });
    } catch (_) {}
  };

  const startRecording = async () => {
    try {
      const { status } = await Audio.requestRecordingPermissionsAsync();
      if (status !== 'granted') return;
      setRecordingUI(true);
      await recorder.prepareToRecordAsync();
      recorder.record();
    } catch (err) {
      console.log('Error recording', err);
      setRecordingUI(false);
    }
  };

  const stopRecording = async () => {
    setRecordingUI(false);
    try {
      if (recorder.isRecording) {
        await recorder.stop();
      }
    } catch (err) {
      console.log('Error stopping recording', err);
    }
    const uri = recorder.uri;
    if (uri) processAudio(uri);
  };

  const cancelRecording = async () => {
    setRecordingUI(false);
    try {
      if (recorder.isRecording) {
        await recorder.stop();
      }
    } catch (err) {
      console.log('Error cancelling recording', err);
    }
  };

  const processAudio = async (uri: string) => {
    setLoading(true);
    try {
      const base64Audio = await FileSystem.readAsStringAsync(uri, { encoding: 'base64' as any });
      const response = await fetch(`${apiUrl}/api/v1/chat/audio`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'bypass-tunnel-reminder': 'true', 'ngrok-skip-browser-warning': 'true' },
        body: JSON.stringify({ audio_base64: base64Audio, user_id: user?.id, provider: selectedProvider }),
      });
      const data = await response.json();
      const assistantMsgId = Date.now().toString();
      const currentMessages = messagesRef.current;
      const updated = [...currentMessages,
        { id: 'user_audio_' + assistantMsgId, role: 'user', content: data?.transcription || '🎤 Áudio enviado' },
        { id: assistantMsgId, role: 'assistant', content: data?.response || 'Não consegui processar o áudio.', audioUri: data?.audio_base64 }
      ];
      setMessages(updated);
      saveChatHistory(updated);
      if (data?.audio_base64) playAudio(data.audio_base64, assistantMsgId);
    } catch (e) {
      const currentMessages = messagesRef.current;
      const updated = [...currentMessages, {
        id: Date.now().toString(), role: 'assistant',
        content: '⚠️ Não consegui processar o áudio. Verifique a conexão.', isError: true,
      }];
      setMessages(updated);
    } finally { setLoading(false); }
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
          <View style={[styles.msgWrapper, item.role === 'user' ? styles.userWrap : styles.aiWrap]}>
            <View style={[styles.bubble, item.role === 'user' ? styles.userBubble : styles.aiBubble, item.isError && styles.errorBubble]}>
               {item.role === 'assistant' && !item.isError ? (
                 <BlurView intensity={10} tint="light" style={StyleSheet.absoluteFill} />
               ) : null}
               <Text style={[styles.msgText, item.role === 'user' ? styles.userText : styles.aiText]}>{item.content}</Text>
                {item.audioUri && (
                  <TouchableOpacity style={styles.audioBtn} onPress={() => playingId === item.id ? player.pause() : playAudio(item.audioUri, item.id)}>
                    <Ionicons name={playingId === item.id ? "pause-circle" : "play-circle"} size={24} color={Colors.primary} />
                    <Text style={styles.audioLabel}>Ouvir Resposta</Text>
                  </TouchableOpacity>
                )}
            </View>
          </View>
        )}
        ListFooterComponent={() => (
          <View>
            {/* Typing indicator */}
            {loading && (
              <View style={[styles.msgWrapper, styles.aiWrap]}>
                <Animated.View style={[styles.bubble, styles.aiBubble, { opacity: typingAnim }]}>
                  <View style={styles.typingRow}>
                    <View style={styles.typingDot} />
                    <View style={[styles.typingDot, { marginHorizontal: 4 }]} />
                    <View style={styles.typingDot} />
                    <Text style={styles.typingText}>digitando...</Text>
                  </View>
                </Animated.View>
              </View>
            )}
            {/* Retry button */}
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

      {/* Quick Actions */}
      {showQuickActions && !loading && (
        <View style={{ marginBottom: 8 }}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.quickRow} contentContainerStyle={{ paddingRight: 48 }}>
            {QUICK_ACTIONS.map((action, i) => (
              <TouchableOpacity key={i} style={styles.quickChip} onPress={() => sendMessage(action.message)}>
                <Text style={styles.quickChipText}>{action.label}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>
      )}

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
                      <TouchableOpacity style={[styles.sendBtn, loading && { opacity: 0.5 }]} onPress={() => sendMessage()} disabled={loading}>
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
  pickerOverlay: { position: 'absolute', top: 120, right: 20, left: 20, backgroundColor: '#1E293B', borderRadius: 16, padding: 8, zIndex: 100, borderWidth: 1, borderColor: Colors.border },
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
  bezelInner: { backgroundColor: '#0F172A', borderRadius: 26.5, padding: 8, flexDirection: 'row', alignItems: 'center' },
  micBtn: { width: 44, height: 44, borderRadius: 16, justifyContent: 'center', alignItems: 'center', backgroundColor: 'rgba(239,68,68,0.1)' },
  micBtnRight: { width: 44, height: 44, borderRadius: 16, justifyContent: 'center', alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.05)' },
  recordingCenter: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
  recordingDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#EF4444' },
  recordingText: { color: Colors.text, fontFamily: Typography.fonts.medium, fontSize: 14 },
  input: { flex: 1, color: Colors.text, fontFamily: Typography.fonts.body, fontSize: 15, paddingHorizontal: 12, maxHeight: 100 },
  sendBtn: { width: 44, height: 44, borderRadius: 16, backgroundColor: Colors.primary, justifyContent: 'center', alignItems: 'center' },
});
