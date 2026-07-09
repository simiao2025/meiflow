import React, { useState, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator, Alert, Platform } from 'react-native';
import { WebView } from 'react-native-webview';
import * as Location from 'expo-location';
import * as Linking from 'expo-linking';
import { Ionicons } from '@expo/vector-icons';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Palette, Typography, useThemeColors } from '../constants/theme';
import { LinearGradient } from 'expo-linear-gradient';

export default function MapScreen() {
  const Colors = useThemeColors();
  const styles = getStyles(Colors);
  const router = useRouter();
  const { clientId, clientName, clientAddress, lat, lng } = useLocalSearchParams();
  
  const [location, setLocation] = useState<Location.LocationObject | null>(null);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState('');
  const mapTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const targetCoords = lat && lng ? {
    latitude: parseFloat(lat as string),
    longitude: parseFloat(lng as string),
  } : null;

  useEffect(() => {
    (async () => {
      setLoading(true);

      let { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        setErrorMsg('Permissão de acesso à localização foi negada.');
        setLoading(false);
        return;
      }

      try {
        let currentLocation = await Location.getCurrentPositionAsync({});
        setLocation(currentLocation);
      } catch (error) {
        // Localização falhou mas o mapa ainda funciona
        console.warn('Falha ao obter localização:', error);
      }
      setLoading(false);
    })();

    return () => {
      if (mapTimeoutRef.current) clearTimeout(mapTimeoutRef.current);
    };
  }, []);

  const openNavigationExternal = () => {
    if (!targetCoords) return;

    const latLng = `${targetCoords.latitude},${targetCoords.longitude}`;
    const label = encodeURIComponent((clientName as string) || 'Cliente');

    Alert.alert('Abrir com', 'Escolha um aplicativo de navegação', [
      {
        text: 'Google Maps',
        onPress: () => Linking.openURL(`https://www.google.com/maps/dir/?api=1&destination=${latLng}`),
      },
      {
        text: 'Waze',
        onPress: () => Linking.openURL(`https://waze.com/ul?ll=${latLng}&navigate=yes`),
      },
      {
        text: 'Cancelar',
        style: 'cancel',
      },
    ]);
  };

  const qLat = targetCoords?.latitude ?? -23.550520;
  const qLng = targetCoords?.longitude ?? -46.633308;
  const mapHtml = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
      <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />
      <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
      <style>
        * { margin: 0; padding: 0; }
        body { background: #0A0A0A; }
        #map { width: 100vw; height: 100vh; }
        .leaflet-control-zoom a { background: #1E293B !important; color: #F8FAFC !important; border-color: #334155 !important; }
        .leaflet-control-attribution { background: rgba(15,23,42,0.8) !important; color: #64748B !important; }
        .leaflet-control-attribution a { color: #94A3B8 !important; }
      </style>
    </head>
    <body>
      <div id="map"></div>
      <script>
        var map = L.map('map', { zoomControl: true, attributionControl: true }).setView([${qLat}, ${qLng}], 15);
        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
          maxZoom: 19,
          attribution: '&copy; <a href="https://openstreetmap.org/copyright">OpenStreetMap</a>'
        }).addTo(map);
        L.marker([${qLat}, ${qLng}]).addTo(map)
          .bindPopup('${String(clientName || 'Cliente').replace(/'/g, "\\'")}')
          .openPopup();
        ${location?.coords ? `L.circle([${location.coords.latitude}, ${location.coords.longitude}], { radius: 30, color: '#38BDF8', fillColor: '#38BDF8', fillOpacity: 0.2 }).addTo(map);` : ''}
      </script>
    </body>
    </html>
  `;

  const currentCoords = location?.coords;

  if (loading) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color={Colors.primary} />
        <Text style={styles.loadingText}>Preparando mapa...</Text>
      </View>
    );
  }

  if (errorMsg && !targetCoords) {
    return (
      <View style={styles.centerContainer}>
        <Ionicons name="warning-outline" size={48} color={Palette.warning} />
        <Text style={styles.errorText}>{errorMsg}</Text>
        <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
          <Text style={styles.backBtnText}>Voltar</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.map}>
        <WebView
          source={{ html: mapHtml }}
          style={{ flex: 1 }}
          javaScriptEnabled={true}
          domStorageEnabled={true}
          originWhitelist={['*']}
          scalesPageToFit={true}
        />
      </View>

      {/* Header overlay */}
      <LinearGradient 
        colors={['rgba(0,0,0,0.8)', 'transparent']} 
        style={styles.headerGradient}
        pointerEvents="box-none"
      >
        <TouchableOpacity style={styles.iconBtn} onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={24} color="#FFF" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Navegação</Text>
        <View style={{ width: 44 }} />
      </LinearGradient>

      {/* Bottom overlay */}
      {targetCoords && (
        <View style={styles.bottomCard}>
          <View style={styles.clientInfo}>
            <View style={styles.clientIcon}>
              <Ionicons name="person" size={24} color={Colors.primary} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.clientName}>{clientName || 'Cliente'}</Text>
              <Text style={styles.clientAddress} numberOfLines={2}>{clientAddress || 'Endereço não informado'}</Text>
            </View>
          </View>
          
          <TouchableOpacity style={styles.navigateBtn} onPress={openNavigationExternal}>
            <Ionicons name="navigate" size={20} color="#000" />
            <Text style={styles.navigateText}>Abrir Navegação (Maps/Waze)</Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
}

const getStyles = (Colors: any) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Palette.black,
  },
  centerContainer: {
    flex: 1,
    backgroundColor: Palette.black,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  loadingText: {
    color: Colors.textSecondary,
    marginTop: 16,
    fontFamily: Typography.fonts.medium,
  },
  errorText: {
    color: Colors.text,
    textAlign: 'center',
    marginTop: 16,
    marginBottom: 24,
    fontFamily: Typography.fonts.medium,
  },
  backBtn: {
    backgroundColor: Palette.navyDeep,
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Palette.border,
  },
  backBtnText: {
    color: Colors.text,
    fontFamily: Typography.fonts.bold,
  },
  map: {
    width: '100%',
    height: '100%',
  },
  headerGradient: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 120,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: Platform.OS === 'ios' ? 50 : 30,
  },
  iconBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  headerTitle: {
    color: Colors.text,
    fontSize: 18,
    fontFamily: Typography.fonts.display,
  },
  bottomCard: {
    position: 'absolute',
    bottom: 30,
    left: 20,
    right: 20,
    backgroundColor: Palette.navyDeep,
    borderRadius: 24,
    padding: 20,
    borderWidth: 1,
    borderColor: Palette.border,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.5,
    shadowRadius: 20,
    elevation: 10,
  },
  clientInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 20,
  },
  clientIcon: {
    width: 48,
    height: 48,
    borderRadius: 16,
    backgroundColor: 'rgba(212, 175, 55, 0.1)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  clientName: {
    color: Colors.text,
    fontSize: 16,
    fontFamily: Typography.fonts.display,
    marginBottom: 4,
  },
  clientAddress: {
    color: Colors.textSecondary,
    fontSize: 13,
    fontFamily: Typography.fonts.regular,
  },
  navigateBtn: {
    backgroundColor: Colors.primary,
    borderRadius: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    gap: 8,
  },
  navigateText: {
    color: Palette.black,
    fontSize: 15,
    fontFamily: Typography.fonts.bold,
  },
});
