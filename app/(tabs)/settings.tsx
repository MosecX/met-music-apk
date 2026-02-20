import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import React, { useEffect, useState } from 'react';
import {
    Alert,
    FlatList,
    ScrollView,
    StyleSheet,
    Switch,
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

  const handleToggleOffline = async (value: boolean) => {
    setOfflineMode(value);
    await AsyncStorage.setItem(OFFLINE_MODE_KEY, value.toString());
    
    Alert.alert(
      'Modo Offline',
      value 
        ? 'Solo se mostrarán y reproducirán canciones descargadas' 
        : 'Modo offline desactivado'
    );
  };

  const handleClearAllDownloads = () => {
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

        {/* Sección de Offline */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>📶 Conexión</Text>
          
          <View style={styles.settingItem}>
            <View style={styles.settingInfo}>
              <Ionicons name="airplane" size={24} color="#1DB954" />
              <View style={styles.settingTexts}>
                <Text style={styles.settingTitle}>Modo offline</Text>
                <Text style={styles.settingDescription}>
                  {offlineMode 
                    ? 'Solo canciones descargadas' 
                    : 'Mostrar todas las canciones'}
                </Text>
              </View>
            </View>
            <Switch
              value={offlineMode}
              onValueChange={handleToggleOffline}
              trackColor={{ false: '#3E3E3E', true: '#1DB954' }}
              thumbColor="#FFF"
            />
          </View>

          <View style={styles.networkStatus}>
            <Ionicons 
              name={isNetworkOffline ? 'cloud-offline' : 'cloud'} 
              size={20} 
              color={isNetworkOffline ? '#FF4444' : '#1DB954'} 
            />
            <Text style={[
              styles.networkStatusText,
              { color: isNetworkOffline ? '#FF4444' : '#1DB954' }
            ]}>
              {isNetworkOffline ? 'Sin conexión a internet' : 'Conectado'}
            </Text>
          </View>
        </View>

        {/* Sección de Almacenamiento */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>💾 Almacenamiento</Text>
          
          <TouchableOpacity 
            style={styles.storageCard}
            onPress={() => setShowDownloads(true)}
          >
            <View style={styles.storageInfo}>
              <Ionicons name="cloud-done" size={32} color="#1DB954" />
              <View>
                <Text style={styles.storageTitle}>Canciones descargadas</Text>
                <Text style={styles.storageSubtitle}>
                  {downloadedTracks.length} canciones • {formatBytes(totalSize)}
                </Text>
              </View>
            </View>
            <Ionicons name="chevron-forward" size={24} color="#666" />
          </TouchableOpacity>

          {downloadedTracks.length > 0 && (
            <TouchableOpacity
              style={styles.clearButton}
              onPress={handleClearAllDownloads}
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
              <Text style={styles.infoLabel}>Modo offline</Text>
              <Text style={[styles.infoValue, { color: offlineMode ? '#1DB954' : '#666' }]}>
                {offlineMode ? 'ACTIVADO' : 'DESACTIVADO'}
              </Text>
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
  settingItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#1E1E1E',
    padding: 16,
    borderRadius: 12,
    marginBottom: 8,
  },
  settingInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    gap: 12,
  },
  settingTexts: {
    flex: 1,
  },
  settingTitle: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 2,
  },
  settingDescription: {
    color: '#B3B3B3',
    fontSize: 12,
  },
  networkStatus: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1E1E1E',
    padding: 12,
    borderRadius: 12,
    gap: 8,
    marginTop: 4,
  },
  networkStatusText: {
    fontSize: 14,
    fontWeight: '500',
  },
  storageCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#1E1E1E',
    padding: 16,
    borderRadius: 12,
    marginBottom: 12,
  },
  storageInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
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
  },
  clearButtonText: {
    color: '#FF4444',
    fontSize: 14,
    fontWeight: '600',
  },
  infoCard: {
    backgroundColor: '#1E1E1E',
    padding: 16,
    borderRadius: 12,
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 8,
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
  // Estadísticas
  statsContainer: {
    flexDirection: 'row',
    backgroundColor: '#1E1E1E',
    margin: 16,
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'space-around',
  },
  statItem: {
    alignItems: 'center',
  },
  statNumber: {
    color: '#1DB954',
    fontSize: 24,
    fontWeight: 'bold',
  },
  statLabel: {
    color: '#B3B3B3',
    fontSize: 12,
    marginTop: 2,
  },
  statDivider: {
    width: 1,
    height: 30,
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