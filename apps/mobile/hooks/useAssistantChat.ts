import { useState, useRef, useEffect, useCallback } from 'react';
import * as FileSystem from 'expo-file-system/legacy';
import * as SecureStore from 'expo-secure-store';
import { useAuthStore } from '../stores/authStore';

const apiUrl = process.env.EXPO_PUBLIC_API_URL || '';
const CHAT_FILE_KEY = 'meiflow_chat_history';
const MAX_STORED_MESSAGES = 100;

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  isError?: boolean;
  audioUri?: string;
}

export function useAssistantChat(provider: string = 'openai') {
  const { user } = useAuthStore();
  const [messages, setMessages] = useState<Message[]>([]);
  const messagesRef = useRef(messages);
  messagesRef.current = messages;
  const [loading, setLoading] = useState(false);
  const [failedMsgId, setFailedMsgId] = useState<string | null>(null);

  useEffect(() => {
    loadChatHistory();
  }, []);

  const loadChatHistory = async () => {
    try {
      const stored = await SecureStore.getItemAsync(CHAT_FILE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        if (parsed.length > 0) {
          setMessages(parsed);
          return;
        }
      }
    } catch (_) {}
    setMessages([{ id: '1', role: 'assistant', content: 'Olá! Como posso ajudar sua empresa hoje? Posso emitir cobranças, agendar serviços ou consultar seu financeiro.' }]);
  };

  const saveChatHistory = async (msgs: Message[]) => {
    try {
      const toStore = msgs.slice(-MAX_STORED_MESSAGES).map(m => ({
        id: m.id, role: m.role, content: m.content,
      }));
      await SecureStore.setItemAsync(CHAT_FILE_KEY, JSON.stringify(toStore));
    } catch (_) {}
  };

  const sendMessage = async (text: string) => {
    if (!text.trim() || loading) return;

    const userMsg = { id: Date.now().toString(), role: 'user' as const, content: text };
    const currentMessages = messagesRef.current;
    const newMessages = [...currentMessages, userMsg];
    setMessages(newMessages);
    saveChatHistory(newMessages);
    setLoading(true);
    setFailedMsgId(null);

    try {
      const controller = new AbortController();
      // 90s para cold start do Render + iterações LangGraph (LLM → tools → LLM)
      const timeoutId = setTimeout(() => controller.abort(), 90000);

      const response = await fetch(`${apiUrl}/api/v1/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'bypass-tunnel-reminder': 'true', 'ngrok-skip-browser-warning': 'true' },
        body: JSON.stringify({ message: text, user_id: user?.id, provider }),
        signal: controller.signal,
      });
      clearTimeout(timeoutId);

      const data = await response.json();
      const aiContent = data?.response || data?.message || 'Desculpe, não consegui processar sua solicitação.';
      const aiMsg = { id: (Date.now() + 1).toString(), role: 'assistant' as const, content: aiContent };
      const updated = [...newMessages, aiMsg];
      setMessages(updated);
      saveChatHistory(updated);
    } catch (e: any) {
      let errorMsg = '⚠️ Não foi possível conectar ao servidor. Verifique sua conexão e tente novamente.';
      if (e?.name === 'AbortError' || e?.message?.includes('aborted')) {
        errorMsg = '⏳ O assistente está demorando mais que o esperado (servidor pode estar iniciando). Tente novamente em alguns segundos.';
      } else if (e?.message?.includes('Network request failed') || e?.message?.includes('fetch')) {
        errorMsg = '📡 Sem conexão com a internet. Verifique sua rede e tente novamente.';
      }
      const errorEntry = { id: (Date.now() + 1).toString(), role: 'assistant' as const, content: errorMsg, isError: true };
      setFailedMsgId(userMsg.id);
      const updated = [...newMessages, errorEntry];
      setMessages(updated);
    } finally {
      setLoading(false);
    }
  };

  const retryLastMessage = useCallback(() => {
    if (!failedMsgId) return;
    const failedMsg = messagesRef.current.find(m => m.id === failedMsgId);
    if (!failedMsg) return;
    const cleaned = messagesRef.current.filter(m => !m.isError);
    setMessages(cleaned);
    setFailedMsgId(null);
    sendMessage(failedMsg.content);
  }, [failedMsgId]);

  const clearChat = async () => {
    const welcome = [{ id: '1', role: 'assistant' as const, content: 'Conversa limpa! Como posso ajudar?' }];
    setMessages(welcome);
    try {
      await SecureStore.deleteItemAsync(CHAT_FILE_KEY);
    } catch (_) {}
  };

  return { messages, loading, failedMsgId, sendMessage, retryLastMessage, clearChat };
}