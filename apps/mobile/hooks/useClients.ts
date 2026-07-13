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

    try {
      let geocoded = await Location.geocodeAsync(formattedAddress);
      if (!geocoded || geocoded.length === 0) {
        geocoded = await Location.geocodeAsync(`${city} - ${state}`);
      }
      if (geocoded && geocoded.length > 0) {
        clientLat = geocoded[0].latitude;
        clientLng = geocoded[0].longitude;
      }
    } catch (geoError) {
      console.warn('Expo Geocoding failed, trying OSM:', geoError);
    }

    if (!clientLat || !clientLng) {
      try {
        const query = encodeURIComponent(formattedAddress);
        const response = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${query}&limit=1`, {
          headers: { 'User-Agent': 'MEIFlowApp/1.0' }
        });
        const data = await response.json();
        
        if (data && data.length > 0) {
          clientLat = parseFloat(data[0].lat);
          clientLng = parseFloat(data[0].lon);
        } else {
          const cityQuery = encodeURIComponent(`${city}, ${state}, Brasil`);
          const cityRes = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${cityQuery}&limit=1`, {
            headers: { 'User-Agent': 'MEIFlowApp/1.0' }
          });
          const cityData = await cityRes.json();
          if (cityData && cityData.length > 0) {
            clientLat = parseFloat(cityData[0].lat);
            clientLng = parseFloat(cityData[0].lon);
          }
        }
      } catch (osmError) {
        console.warn('OSM Geocoding also failed:', osmError);
      }
    }

    return { lat: clientLat, lng: clientLng };
  };

  const saveClient = async (
    clientData: Partial<ClientData>,
    editingId?: string | null
  ): Promise<boolean> => {
    if (!user) return false;

    const { lat, lng } = await geocodeAddress(
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
      const { error: updateError } = await supabase.from('clients').update(dataToSave).eq('id', editingId);
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