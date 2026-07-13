import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';

interface ClientSelectorProps {
  clients: any[];
  selected: string;
  onSelect: (id: string) => void;
}

export function ClientSelector({ clients, selected, onSelect }: ClientSelectorProps) {
  const router = useRouter();

  return (
    <View style={styles.dropdownContainer}>
      {clients.length === 0 ? (
        <View style={styles.emptyStateContainer}>
          <Text style={styles.emptyText}>Nenhum cliente cadastrado.</Text>
          <TouchableOpacity 
            style={styles.addClientShortcut}
            onPress={() => router.push('/(tabs)/clients')}
          >
            <Ionicons name="person-add-outline" size={16} color="#38BDF8" />
            <Text style={styles.addClientText}>Cadastrar Cliente Rápido</Text>
          </TouchableOpacity>
        </View>
      ) : (
        clients.map((c) => (
          <TouchableOpacity
            key={c.id}
            style={[styles.dropdownItem, selected === c.id && styles.dropdownItemActive]}
            onPress={() => onSelect(c.id)}
          >
            <Text style={styles.dropdownText}>{c.name}</Text>
          </TouchableOpacity>
        ))
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  dropdownContainer: {
    backgroundColor: '#1E293B', borderRadius: 12, borderWidth: 1, borderColor: '#334155', overflow: 'hidden', maxHeight: 200,
  },
  dropdownItem: { padding: 16, borderBottomWidth: 1, borderBottomColor: '#334155' },
  dropdownItemActive: { backgroundColor: '#38BDF820' },
  dropdownText: { fontSize: 16, color: '#F1F5F9', fontWeight: '600' },
  emptyStateContainer: { padding: 16, alignItems: 'center' },
  emptyText: { color: '#64748B', textAlign: 'center', marginBottom: 12 },
  addClientShortcut: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    backgroundColor: 'rgba(56, 189, 248, 0.1)',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(56, 189, 248, 0.3)'
  },
  addClientText: { color: '#38BDF8', fontWeight: '600', marginLeft: 8 },
});