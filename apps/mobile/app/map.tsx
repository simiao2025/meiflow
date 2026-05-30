import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator, Alert, Platform } from 'react-native';
import MapView, { Marker, Polyline } from 'react-native-maps';
import * as Location from 'expo-location';
import * as Linking from 'expo-linking';
import { Ionicons } from '@expo/vector-icons';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Colors, Palette, Typography } from '../constants/theme';
import { LinearGradient } from 'expo-linear-gradient';

export default function MapScreen() {
  const router = useRouter();
  const { clientId, clientName, clientAddress, lat, lng } = useLocalSearchParams();
  
  const [location, setLocation] = useState<Location.LocationObject | null>(null);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState('');

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
        setErrorMsg('Não foi possível obter sua localização atual.');
      }
      setLoading(false);
    })();
  }, []);

  const openNavigation = () => {
    if (!targetCoords) return;
    
    const url = Platform.select({
      ios: `maps:0,0?q=${clientAddress || clientName}@${targetCoords.latitude},${targetCoords.longitude}`,
      android: `geo:0,0?q=${targetCoords.latitude},${targetCoords.longitude}(${clientName || 'Cliente'})`
    });

    if (url) {
      Linking.openURL(url).catch(() => {
        // Fallback for google maps web if geo/maps scheme fails
        Linking.openURL(`https://www.google.com/maps/search/?api=1&query=${targetCoords.latitude},${targetCoords.longitude}`);
      });
    }
  };

  if (loading) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color={Colors.primary} />
        <Text style={styles.loadingText}>Buscando satélites...</Text>
      </View>
    );
  }

  if (errorMsg) {
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

  const initialRegion = {
    latitude: targetCoords?.latitude || location?.coords.latitude || -23.550520,
    longitude: targetCoords?.longitude || location?.coords.longitude || -46.633308,
    latitudeDelta: 0.05,
    longitudeDelta: 0.05,
  };

  return (
    <View style={styles.container}>
      <MapView 
        style={styles.map} 
        initialRegion={initialRegion}
        showsUserLocation={true}
        showsMyLocationButton={true}
        userInterfaceStyle="dark"
      >
        {targetCoords && (
          <Marker
            coordinate={targetCoords}
            title={clientName as string || 'Cliente'}
            description={clientAddress as string || 'Endereço do cliente'}
            pinColor={Colors.primary}
          />
        )}
        
        {/* Simple straight line if we have both points - in reality we'd use a Directions API */}
        {location && targetCoords && (
          <Polyline
            coordinates={[
              { latitude: location.coords.latitude, longitude: location.coords.longitude },
              targetCoords
            ]}
            strokeColor={Colors.primary}
            strokeWidth={3}
            lineDashPattern={[5, 5]}
          />
        )}
      </MapView>

      {/* Header overlay */}
      <LinearGradient 
        colors={['rgba(0,0,0,0.8)', 'transparent']} 
        style={styles.headerGradient}
      >
        <TouchableOpacity style={styles.iconBtn} onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={24} color="#FFF" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Navegação</Text>
        <View style={{ width: 44 }} />
      </LinearGradient>

      {/* Bottom overlay with client info and navigate button */}
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
          
          <TouchableOpacity style={styles.navigateBtn} onPress={openNavigation}>
            <Ionicons name="navigate" size={20} color="#000" />
            <Text style={styles.navigateText}>Traçar Rota no Waze/Maps</Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
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
