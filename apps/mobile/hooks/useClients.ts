import { useState, useEffect } from 'react';
import * as Location from 'expo-location';
import { supabase } from '../services/supabase';
import { useAuthStore } from '../stores/authStore';

interface ClientData {
  id: string;
  name: string;
  document?: string;
  email?: string;
  phone?: string;
  whatsapp_number?: string;
  person_type?: 'pf' | 'pj';
  formatted_address?: string;
  city?: string;
  state?: string;
  lat?: number;
  lng?: number;
  total_revenue?: number;
}

export function useClients() {
  const { user } = useAuthStore();
  const [clients, setClients] = useState<ClientData[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (user) loadClients();
  }, [user]);

  const loadClients = async () => {
    if (!user) return;
    setLoading(true);
    const { data } = await supabase.from('clients').select('*').eq('user_id', user.id).order('name', { ascending: true });
    if (data) setClients(data);
    setLoading(false);
  };

  const geocodeAddress = async (formattedAddress: string, city: string, state: string): Promise<{ lat: number | null; lng: number | null }> => {
    let clientLat: number | null = null;
    let clientLng: number | null = null;

    if (!formattedAddress) {
      return { lat: null, lng: null };
    }

    // Normaliza o endereço para evitar confusão de traços com palavras-chave
    const cleanAddress = formattedAddress
      .replace(/\s*-\s*/g, ', ')
      .replace(/\s+/g, ' ')
      .trim();

    // Tentativa 1: Expo Geocoding com endereço limpo e qualificado
    try {
      const searchTarget = cleanAddress.includes('Brasil') ? cleanAddress : `${cleanAddress}, Brasil`;
      const geocoded = await Location.geocodeAsync(searchTarget);
      if (geocoded && geocoded.length > 0) {
        clientLat = geocoded[0].latitude;
        clientLng = geocoded[0].longitude;
      }
    } catch (geoError) {
      console.warn('Expo Geocoding failed, trying OSM:', geoError);
    }

    // Helper para validar se o retorno do OSM é um ponto de rua e não o centróide da cidade
    const isPreciseResult = (item: any) => {
      if (!item) return false;
      const t = item.type || '';
      const c = item.class || '';
      // Rejeita resultados que sejam meramente limites municipais ou estaduais genéricos
      if (t === 'administrative' || t === 'state' || c === 'boundary') {
        return false;
      }
      return true;
    };

    // Tentativa 2: OpenStreetMap Nominatim com busca estruturada
    if (!clientLat || !clientLng) {
      try {
        const parts = formattedAddress.split(',').map((s: string) => s.trim());
        const streetPart = parts[0] || '';
        const query = encodeURIComponent(`${streetPart}, ${city}, ${state}, Brasil`);
        const response = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${query}&limit=3&countrycodes=br`, {
          headers: { 'User-Agent': 'MEIFlowApp/1.0' }
        });
        const data = await response.json();

        if (Array.isArray(data) && data.length > 0) {
          const match = data.find(isPreciseResult) || data[0];
          if (isPreciseResult(match)) {
            clientLat = parseFloat(match.lat);
            clientLng = parseFloat(match.lon);
          }
        }
      } catch (osmError) {
        console.warn('OSM Geocoding failed:', osmError);
      }
    }

    // Validação final de integridade numérica
    if (!Number.isFinite(clientLat) || !Number.isFinite(clientLng)) {
      return { lat: null, lng: null };
    }
    return { lat: clientLat, lng: clientLng };
  };

  const saveClient = async (
    clientData: Partial<ClientData>,
    editingId?: string | null
  ): Promise<boolean> => {
    if (!user) return false;

    // Endereço inalterado com coordenadas já gravadas: não regeocodifica
    // (evita apagar lat/lng por falha de rede e reenviar o endereço ao OSM)
    const existing = editingId ? clients.find(c => c.id === editingId) : undefined;
    const addressUnchanged =
      !!existing && existing.formatted_address === clientData.formatted_address && existing.lat != null && existing.lng != null;

    const { lat, lng } = addressUnchanged
      ? { lat: existing!.lat!, lng: existing!.lng! }
      : await geocodeAddress(
          clientData.formatted_address || '',
          clientData.city || '',
          clientData.state || ''
        );

    const dataToSave = {
      ...clientData,
      lat,
      lng,
    };

    let error;
    if (editingId) {
      const { error: updateError } = await supabase.from('clients').update(dataToSave).eq('id', editingId).eq('user_id', user.id);
      error = updateError;
    } else {
      const { error: insertError } = await supabase.from('clients').insert({
        user_id: user.id,
        ...dataToSave,
      });
      error = insertError;
    }

    if (error) {
      console.error(error);
      return false;
    }

    loadClients();
    return true;
  };

  return { clients, loading, loadClients, saveClient };
}