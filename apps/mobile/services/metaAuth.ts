/**
 * Meta WhatsApp Business Cloud API — Serviço de OAuth Embedded Signup.
 *
 * Fluxo:
 * 1. App pede `auth_url` ao backend (POST /api/v1/crm/meta/oauth/start).
 * 2. App abre auth_url em WebBrowser (expo-web-browser) -> Meta dialog.
 * 3. Usuário concede permissão. Meta redireciona para o callback do backend
 *    (não para o app) -> backend troca code por token e persiste.
 * 4. App fecha WebBrowser e faz polling de status no backend até "connected".
 *
 * Nenhuma chave secreta fica no mobile. Apenas o JWT do Supabase é enviado.
 */
import * as WebBrowser from 'expo-web-browser';
import { supabase } from './supabase';

const API_BASE_URL = process.env.EXPO_PUBLIC_API_URL || '';

WebBrowser.maybeCompleteAuthSession();

async function getAuthToken(): Promise<string> {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session?.access_token) {
    throw new Error('Sessão expirada. Faça login novamente.');
  }
  return session.access_token;
}

export interface MetaOauthStartResponse {
  auth_url: string;
  state: string;
}

export interface MetaStatusResponse {
  status: 'pending' | 'connected' | 'disconnected' | 'error';
  phone_number?: string;
  waba_id?: string;
}

/**
 * Etapa 1 — pede a auth_url ao backend (state + PKCE são gerados no servidor).
 */
export async function startMetaOauth(userId: string): Promise<MetaOauthStartResponse> {
  const token = await getAuthToken();
  const resp = await fetch(`${API_BASE_URL}/api/v1/crm/meta/oauth/start`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
    },
    body: JSON.stringify({ user_id: userId }),
  });
  if (!resp.ok) {
    const err = await resp.json().catch(() => ({}));
    throw new Error(err.detail || 'Falha ao iniciar OAuth Meta.');
  }
  return resp.json();
}

/**
 * Etapa 2 — abre o dialog da Meta em uma WebBrowser session.
 * O resultado retornado pelo WebBrowser não é usado (o callback é no backend),
 * mas aguardamos para saber quando o usuário fecha o navegador.
 */
export async function openMetaDialog(authUrl: string): Promise<void> {
  await WebBrowser.openBrowserAsync(authUrl, {
    controlsColor: '#1877F2', // Azul oficial da Meta (iOS)
    dismissButtonStyle: 'done',
  });
}

/**
 * Etapa 3 — Polling do status no backend até conectar (max 60s).
 */
export async function pollMetaStatus(
  userId: string,
  intervalMs = 2000,
  timeoutMs = 60000
): Promise<MetaStatusResponse> {
  const token = await getAuthToken();
  const start = Date.now();

  return new Promise((resolve, reject) => {
    const poll = async () => {
      try {
        const res = await fetch(
          `${API_BASE_URL}/api/v1/crm/meta/status/${userId}`,
          { headers: { 'Authorization': `Bearer ${token}` } }
        );
        if (!res.ok) throw new Error('Falha ao consultar status Meta.');
        const data: MetaStatusResponse = await res.json();

        if (data.status === 'connected') {
          resolve(data);
          return;
        }
        if (data.status === 'error') {
          reject(new Error('Erro na conexão Meta. Tente novamente.'));
          return;
        }

        if (Date.now() - start >= timeoutMs) {
          reject(new Error('Tempo esgotado aguardando a Meta.'));
          return;
        }
        setTimeout(poll, intervalMs);
      } catch (e: any) {
        // Erros transitórios de rede: continua tentando até timeout
        if (Date.now() - start >= timeoutMs) {
          reject(e);
          return;
        }
        setTimeout(poll, intervalMs);
      }
    };
    poll();
  });
}

/**
 * Desconecta o WhatsApp Cloud API deste MEI via backend.
 */
export async function disconnectMeta(userId: string): Promise<void> {
  const token = await getAuthToken();
  const res = await fetch(`${API_BASE_URL}/api/v1/crm/meta/disconnect/${userId}`, {
    method: 'DELETE',
    headers: { 'Authorization': `Bearer ${token}` },
  });
  if (!res.ok) {
    throw new Error('Falha ao desconectar Meta Cloud API.');
  }
}
