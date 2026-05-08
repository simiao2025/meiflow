import React, { useState, useRef, useEffect } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  FlatList, 
  TextInput, 
  TouchableOpacity, 
  KeyboardAvoidingView, 
  Platform,
  ActivityIndicator,
  ScrollView
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useAuthStore } from '../stores/authStore';

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
}

const AI_MODELS = [
  { id: 'openai', label: 'GPT-4o (OpenAI)', icon: 'flash' },
  { id: 'anthropic', label: 'Claude 3.5 (Anthropic)', icon: 'color-palette' },
  { id: 'google', label: 'Gemini Pro (Google)', icon: 'planet' },
];

export default function AssistantChat() {
  const [messages, setMessages] = useState<Message[]>([
    { id: '1', role: 'assistant', content: 'Olá! Sou seu assistente MEIFlow. Como posso ajudar seu negócio hoje?' }
  ]);
  const [inputText, setInputText] = useState('');
  const [loading, setLoading] = useState(false);
  const [selectedProvider, setSelectedProvider] = useState('openai');
  const [showModelPicker, setShowModelPicker] = useState(false);
  
  const { user } = useAuthStore();
  const flatListRef = useRef<FlatList>(null);

  const sendMessage = async () => {
    if (!inputText.trim() || loading) return;

    const userMsg: Message = { id: Date.now().toString(), role: 'user', content: inputText };
    setMessages(prev => [...prev, userMsg]);
    setInputText('');
    setLoading(true);

    try {
      // Endpoint local do serviço de IA (substituir pela URL real em prod)
      const response = await fetch('http://localhost:8000/api/v1/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: inputText,
          user_id: user?.id,
          provider: selectedProvider
        }),
      });

      const data = await response.json();
      
      const assistantMsg: Message = { 
        id: (Date.now() + 1).toString(), 
        role: 'assistant', 
        content: data.response 
      };
      
      setMessages(prev => [...prev, assistantMsg]);
    } catch (error) {
      console.error('Erro ao chamar IA:', error);
      setMessages(prev => [...prev, { 
        id: 'err', 
        role: 'assistant', 
        content: 'Desculpe, tive um problema na conexão. Verifique se o serviço de IA está rodando.' 
      }]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <LinearGradient colors={['#0F172A', '#1E293B']} style={styles.container}>
      {/* Header do Chat */}
      <View style={styles.header}>
        <View style={styles.headerInfo}>
          <View style={styles.aiBadge}>
            <Ionicons name="sparkles" size={18} color="#38BDF8" />
          </View>
          <View>
            <Text style={styles.headerTitle}>Assistente MEI</Text>
            <Text style={styles.headerStatus}>Online e pronto</Text>
          </View>
        </View>
        
        <TouchableOpacity 
          style={styles.modelSelector} 
          onPress={() => setShowModelPicker(!showModelPicker)}
        >
          <Ionicons 
            name={AI_MODELS.find(m => m.id === selectedProvider)?.icon as any} 
            size={18} 
            color="#38BDF8" 
          />
          <Text style={styles.modelLabel}>{selectedProvider.toUpperCase()}</Text>
          <Ionicons name="chevron-down" size={14} color="#94A3B8" />
        </TouchableOpacity>
      </View>

      {showModelPicker && (
        <View style={styles.pickerContainer}>
          {AI_MODELS.map(model => (
            <TouchableOpacity 
              key={model.id} 
              style={[styles.pickerItem, selectedProvider === model.id && styles.pickerItemActive]}
              onPress={() => {
                setSelectedProvider(model.id);
                setShowModelPicker(false);
              }}
            >
              <Ionicons name={model.icon as any} size={20} color={selectedProvider === model.id ? '#F8FAFC' : '#94A3B8'} />
              <Text style={[styles.pickerLabel, selectedProvider === model.id && styles.pickerLabelActive]}>{model.label}</Text>
            </TouchableOpacity>
          ))}
        </View>
      )}

      {/* Lista de Mensagens */}
      <FlatList
        ref={flatListRef}
        data={messages}
        keyExtractor={item => item.id}
        contentContainerStyle={styles.messageList}
        renderItem={({ item }) => (
          <View style={[
            styles.messageWrapper, 
            item.role === 'user' ? styles.userWrapper : styles.assistantWrapper
          ]}>
            <View style={[
              styles.messageBubble,
              item.role === 'user' ? styles.userBubble : styles.assistantBubble
            ]}>
              <Text style={[
                styles.messageText,
                item.role === 'user' ? styles.userText : styles.assistantText
              ]}>{item.content}</Text>
            </View>
          </View>
        )}
        onContentSizeChange={() => flatListRef.current?.scrollToEnd()}
      />

      {/* Input Area */}
      <KeyboardAvoidingView 
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
      >
        <View style={styles.inputArea}>
          <View style={styles.inputContainer}>
            <TextInput
              style={styles.input}
              placeholder="Pergunte qualquer coisa sobre seu MEI..."
              placeholderTextColor="#64748B"
              value={inputText}
              onChangeText={setInputText}
              multiline
              maxLength={500}
            />
            <TouchableOpacity 
              style={[styles.sendButton, (!inputText.trim() || loading) && styles.sendButtonDisabled]} 
              onPress={sendMessage}
              disabled={!inputText.trim() || loading}
            >
              {loading ? (
                <ActivityIndicator color="#FFFFFF" size="small" />
              ) : (
                <Ionicons name="send" size={20} color="#FFFFFF" />
              )}
            </TouchableOpacity>
          </View>
        </View>
      </KeyboardAvoidingView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 60,
    paddingBottom: 20,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(51, 65, 85, 0.5)',
  },
  headerInfo: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  aiBadge: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: 'rgba(56, 189, 248, 0.1)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  headerTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#F8FAFC',
  },
  headerStatus: {
    fontSize: 12,
    color: '#10B981',
    fontWeight: '600',
  },
  modelSelector: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1E293B',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#334155',
  },
  modelLabel: {
    color: '#F1F5F9',
    fontSize: 11,
    fontWeight: '700',
    marginHorizontal: 6,
  },
  pickerContainer: {
    backgroundColor: '#1E293B',
    marginHorizontal: 20,
    marginTop: 10,
    borderRadius: 16,
    padding: 8,
    borderWidth: 1,
    borderColor: '#334155',
    zIndex: 100,
  },
  pickerItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: 10,
  },
  pickerItemActive: {
    backgroundColor: '#38BDF820',
  },
  pickerLabel: {
    color: '#94A3B8',
    fontSize: 14,
    marginLeft: 10,
    fontWeight: '600',
  },
  pickerLabelActive: {
    color: '#F8FAFC',
  },
  messageList: {
    padding: 20,
    paddingBottom: 40,
  },
  messageWrapper: {
    marginBottom: 16,
    flexDirection: 'row',
  },
  userWrapper: {
    justifyContent: 'flex-end',
  },
  assistantWrapper: {
    justifyContent: 'flex-start',
  },
  messageBubble: {
    maxWidth: '85%',
    padding: 16,
    borderRadius: 20,
  },
  userBubble: {
    backgroundColor: '#38BDF8',
    borderBottomRightRadius: 4,
  },
  assistantBubble: {
    backgroundColor: '#1E293B',
    borderBottomLeftRadius: 4,
    borderWidth: 1,
    borderColor: '#334155',
  },
  messageText: {
    fontSize: 15,
    lineHeight: 22,
  },
  userText: {
    color: '#FFFFFF',
    fontWeight: '500',
  },
  assistantText: {
    color: '#F1F5F9',
  },
  inputArea: {
    padding: 20,
    paddingBottom: Platform.OS === 'ios' ? 40 : 20,
    backgroundColor: '#0F172A',
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1E293B',
    borderRadius: 24,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: '#334155',
  },
  input: {
    flex: 1,
    color: '#F1F5F9',
    fontSize: 15,
    maxHeight: 100,
  },
  sendButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#38BDF8',
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 8,
  },
  sendButtonDisabled: {
    backgroundColor: '#334155',
    opacity: 0.5,
  },
});
