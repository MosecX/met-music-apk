import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { LinearGradient } from 'expo-linear-gradient';
import React, { useEffect, useState } from 'react';
import {
  Alert,
  FlatList,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import ScreenWrapper from '../../components/ScreenWrapper';
import TrackItem from '../../components/TrackItem';
import { usePlayer } from '../../context/PlayerContext';
import { useOffline } from '../../hooks/useOffline';
import storageService from '../../services/storage';
import { StoredTrack } from '../../types';

const OFFLINE_MODE_KEY = '@offline_mode';

export default function SettingsScreen() {
  const [offlineMode, setOfflineMode] = useState(false);
  const [downloadedTracks, setDownloadedTracks] = useState<StoredTrack[]>([]);
  const [showDownloads, setShowDownloads] = useState(false);
  const { isOffline: isNetworkOffline } = useOffline();
  const { playTrack } = usePlayer();

  useEffect(() => {
    loadSettings();
    loadDownloads();
  }, []);

  const loadSettings = async () => {
    try {
      const saved = await AsyncStorage.getItem(OFFLINE_MODE_KEY);
      setOfflineMode(saved === 'true');
    } catch (error) {
      console.log('Error loading offline mode:', error);
    }
  };

  const loadDownloads = async () => {
    const tracks = await storageService.getDownloadedTracks();
    setDownloadedTracks(tracks);
  };

  const handleTrackPress = (track: StoredTrack) => {
    if (offlineMode && !track.localUri) {
      Alert.alert('Modo Offline', 'Esta canción no está disponible sin conexión');
      return;
    }
    playTrack(track);
  };

  const formatBytes = (bytes?: number) => {
    if (!bytes) return '0 B';
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(1024));
    return `${(bytes / Math.pow(1024, i)).toFixed(1)} ${sizes[i]}`;
  };

  const totalSize = downloadedTracks.reduce((acc, track) => acc + (track.fileSize || 0), 0);

  if (showDownloads) {
    return (
      <ScreenWrapper>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => setShowDownloads(false)}>
            <Ionicons name="arrow-back" size={24} color="#FFF" />
          </TouchableOpacity>
          <Text style={styles.title}>Canciones descargadas</Text>
          <View style={{ width: 24 }} />
        </View>

        <View style={styles.statsContainer}>
          <View style={styles.statItem}>
            <Text style={styles.statNumber}>{downloadedTracks.length}</Text>
            <Text style={styles.statLabel}>canciones</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statItem}>
            <Text style={styles.statNumber}>{formatBytes(totalSize)}</Text>
            <Text style={styles.statLabel}>espacio</Text>
          </View>
        </View>

        {downloadedTracks.length > 0 ? (
          <FlatList
            data={downloadedTracks}
            keyExtractor={(item) => item.id.toString()}
            renderItem={({ item, index }) => (
              <TrackItem
                track={item}
                index={index}
                isActive={false}
                onPlay={() => handleTrackPress(item)}
                showDownload={true}
                showFavorite={true}
              />
            )}
            contentContainerStyle={styles.listContent}
          />
        ) : (
          <View style={styles.emptyContainer}>
            <Ionicons name="cloud-offline-outline" size={60} color="#666" />
            <Text style={styles.emptyText}>No hay canciones descargadas</Text>
          </View>
        )}
      </ScreenWrapper>
    );
  }

  return (
    <ScreenWrapper>
      <ScrollView showsVerticalScrollIndicator={false}>
        <View style={styles.header}>
          <Text style={styles.title}>Configuración</Text>
        </View>

        {/* Sección de Estado de Conexión - MEJORADA */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>📶 Estado de conexión</Text>
          
          <LinearGradient
            colors={isNetworkOffline 
              ? ['rgba(255,68,68,0.2)', 'rgba(255,68,68,0.05)'] 
              : ['rgba(29,185,84,0.2)', 'rgba(29,185,84,0.05)']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.networkCard}
          >
            <View style={styles.networkStatusContainer}>
              <View style={[styles.networkIconContainer, { 
                backgroundColor: isNetworkOffline 
                  ? 'rgba(255,68,68,0.15)' 
                  : 'rgba(29,185,84,0.15)' 
              }]}>
                <Ionicons 
                  name={isNetworkOffline ? 'cloud-offline' : 'cloud'} 
                  size={28} 
                  color={isNetworkOffline ? '#FF4444' : '#1DB954'} 
                />
              </View>
              
              <View style={styles.networkTextContainer}>
                <Text style={styles.networkStatusTitle}>
                  {isNetworkOffline ? 'Sin conexión' : 'Conectado a internet'}
                </Text>
                <Text style={styles.networkStatusDetail}>
                  {isNetworkOffline 
                    ? 'Reproduciendo solo canciones descargadas' 
                    : 'Puedes buscar y reproducir cualquier canción'}
                </Text>
              </View>
            </View>
            
            <View style={[styles.networkBadge, { 
              backgroundColor: isNetworkOffline 
                ? 'rgba(255,68,68,0.15)' 
                : 'rgba(29,185,84,0.15)' 
            }]}>
              <Text style={[styles.networkBadgeText, { 
                color: isNetworkOffline ? '#FF4444' : '#1DB954' 
              }]}>
                {offlineMode ? 'MODO OFFLINE' : 'MODO ONLINE'}
              </Text>
            </View>
          </LinearGradient>
        </View>

        {/* Sección de Almacenamiento */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>💾 Almacenamiento</Text>
          
          <TouchableOpacity 
            style={styles.storageCard}
            onPress={() => setShowDownloads(true)}
          >
            <View style={styles.storageInfo}>
              <View style={styles.storageIconContainer}>
                <Ionicons name="cloud-done" size={28} color="#1DB954" />
              </View>
              <View>
                <Text style={styles.storageTitle}>Canciones descargadas</Text>
                <Text style={styles.storageSubtitle}>
                  {downloadedTracks.length} canciones • {formatBytes(totalSize)}
                </Text>
              </View>
            </View>
            <Ionicons name="chevron-forward" size={22} color="#666" />
          </TouchableOpacity>

          {downloadedTracks.length > 0 && (
            <TouchableOpacity
              style={styles.clearButton}
              onPress={() => {
                Alert.alert(
                  'Eliminar todas las descargas',
                  `¿Eliminar ${downloadedTracks.length} canciones del almacenamiento local?`,
                  [
                    { text: 'Cancelar', style: 'cancel' },
                    {
                      text: 'Eliminar todo',
                      style: 'destructive',
                      onPress: async () => {
                        for (const track of downloadedTracks) {
                          if (track.localUri) {
                            await storageService.removeDownloadedTrack(track.id);
                          }
                        }
                        loadDownloads();
                        Alert.alert('✅ Eliminadas', 'Todas las descargas fueron eliminadas');
                      }
                    }
                  ]
                );
              }}
            >
              <Ionicons name="trash-outline" size={20} color="#FF4444" />
              <Text style={styles.clearButtonText}>Eliminar todas las descargas</Text>
            </TouchableOpacity>
          )}
        </View>

        {/* Sección de Información */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>ℹ️ Información</Text>
          
          <View style={styles.infoCard}>
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Versión</Text>
              <Text style={styles.infoValue}>1.0.0</Text>
            </View>
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>API Providers</Text>
              <Text style={styles.infoValue}>14 activos</Text>
            </View>
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Modo actual</Text>
              <View style={[styles.statusChip, { 
                backgroundColor: offlineMode 
                  ? 'rgba(29,185,84,0.15)' 
                  : 'rgba(255,255,255,0.1)' 
              }]}>
                <Text style={[styles.statusChipText, { 
                  color: offlineMode ? '#1DB954' : '#666' 
                }]}>
                  {offlineMode ? 'OFFLINE' : 'ONLINE'}
                </Text>
              </View>
            </View>
          </View>
        </View>
      </ScrollView>
    </ScreenWrapper>
  );
}

const styles = StyleSheet.create({
  header: {
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 10,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#FFF',
  },
  section: {
    marginTop: 24,
    paddingHorizontal: 16,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#B3B3B3',
    marginBottom: 12,
    marginLeft: 4,
  },
  // Nuevo estilo para el card de conexión
  networkCard: {
    borderRadius: 16,
    padding: 16,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.05)',
  },
  networkStatusContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  networkIconContainer: {
    width: 50,
    height: 50,
    borderRadius: 25,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  networkTextContainer: {
    flex: 1,
  },
  networkStatusTitle: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 2,
  },
  networkStatusDetail: {
    color: '#B3B3B3',
    fontSize: 13,
  },
  networkBadge: {
    alignSelf: 'flex-start',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
  },
  networkBadgeText: {
    fontSize: 12,
    fontWeight: '600',
  },
  // Estilos existentes mejorados
  storageCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#1E1E1E',
    padding: 16,
    borderRadius: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.05)',
  },
  storageInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  storageIconContainer: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: 'rgba(29,185,84,0.1)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  storageTitle: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 2,
  },
  storageSubtitle: {
    color: '#B3B3B3',
    fontSize: 12,
  },
  clearButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,68,68,0.1)',
    padding: 14,
    borderRadius: 12,
    gap: 8,
    borderWidth: 1,
    borderColor: 'rgba(255,68,68,0.2)',
  },
  clearButtonText: {
    color: '#FF4444',
    fontSize: 14,
    fontWeight: '600',
  },
  infoCard: {
    backgroundColor: '#1E1E1E',
    padding: 16,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.05)',
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#2A2A2A',
  },
  infoLabel: {
    color: '#B3B3B3',
    fontSize: 14,
  },
  infoValue: {
    color: '#FFF',
    fontSize: 14,
    fontWeight: '600',
  },
  statusChip: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  statusChipText: {
    fontSize: 12,
    fontWeight: '600',
  },
  // Estadísticas
  statsContainer: {
    flexDirection: 'row',
    backgroundColor: '#1E1E1E',
    margin: 16,
    padding: 20,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'space-around',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.05)',
  },
  statItem: {
    alignItems: 'center',
  },
  statNumber: {
    color: '#1DB954',
    fontSize: 28,
    fontWeight: 'bold',
  },
  statLabel: {
    color: '#B3B3B3',
    fontSize: 13,
    marginTop: 4,
  },
  statDivider: {
    width: 1,
    height: 40,
    backgroundColor: '#2A2A2A',
  },
  listContent: {
    paddingHorizontal: 16,
    paddingBottom: 20,
  },
  emptyContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 100,
  },
  emptyText: {
    color: '#666',
    fontSize: 16,
    marginTop: 16,
  },
});