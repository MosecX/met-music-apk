import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import React, { useCallback, useEffect, useState } from 'react';
import {
  Alert,
  Dimensions,
  FlatList,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import ScreenWrapper from '../../components/ScreenWrapper';
import TrackItem from '../../components/TrackItem';
import { usePlayer } from '../../context/PlayerContext';
import { useOffline } from '../../hooks/useOffline';
import storageService from '../../services/storage';
import { StoredTrack } from '../../types';

const { width } = Dimensions.get('window');
const OFFLINE_MODE_KEY = '@offline_mode';
const TAB_BAR_HEIGHT = 60;
const PLAYER_HEIGHT = 80;

export default function SettingsScreen() {
  const insets = useSafeAreaInsets();
  const [offlineMode, setOfflineMode] = useState(false);
  const [downloadedTracks, setDownloadedTracks] = useState<StoredTrack[]>([]);
  const [showDownloads, setShowDownloads] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const { isOffline: isNetworkOffline } = useOffline();
  const { playTrack, currentTrack } = usePlayer();

  const playerOffset = currentTrack ? PLAYER_HEIGHT : 0;

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

  // Función para recargar todos los datos
  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    console.log('🔄 Recargando configuración...');
    
    await Promise.all([
      loadSettings(),
      loadDownloads()
    ]);
    
    setRefreshing(false);
  }, []);

  const handleTrackPress = (track: StoredTrack, index: number) => {
    if (offlineMode && !track.localUri) {
      Alert.alert('📱 Modo Offline', 'Esta canción no está disponible sin conexión');
      return;
    }
    playTrack(
      track,
      downloadedTracks,
      index,
      'downloads'
    );
  };

  const formatBytes = (bytes?: number) => {
    if (!bytes) return '0 B';
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(1024));
    return `${(bytes / Math.pow(1024, i)).toFixed(1)} ${sizes[i]}`;
  };

  const totalSize = downloadedTracks.reduce((acc, track) => acc + (track.fileSize || 0), 0);

  // Pantalla de descargas
  if (showDownloads) {
    return (
      <ScreenWrapper>
        <LinearGradient
          colors={['#0A0A0A', '#1A1A1A', '#0F0F0F']}
          style={StyleSheet.absoluteFill}
        />
        
        <View style={styles.downloadsHeader}>
          <TouchableOpacity 
            style={styles.backButton}
            onPress={() => setShowDownloads(false)}
          >
            <Ionicons name="arrow-back" size={24} color="#FFF" />
          </TouchableOpacity>
          <Text style={styles.downloadsTitle}>Mis Descargas</Text>
          <View style={{ width: 40 }} />
        </View>

        <LinearGradient
          colors={['rgba(29,185,84,0.15)', 'transparent']}
          style={styles.statsGradient}
        >
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
        </LinearGradient>

        {downloadedTracks.length > 0 ? (
          <FlatList
            data={downloadedTracks}
            keyExtractor={(item) => item.id.toString()}
            renderItem={({ item, index }) => (
              <TrackItem
                track={item}
                index={index}
                isActive={currentTrack?.id === item.id}
                onPlay={() => handleTrackPress(item, index)}
                showDownload={true}
                showFavorite={true}
              />
            )}
            refreshControl={
              <RefreshControl
                refreshing={refreshing}
                onRefresh={onRefresh}
                tintColor="#1DB954"
                colors={['#1DB954']}
                progressBackgroundColor="#1A1A1A"
              />
            }
            contentContainerStyle={[
              styles.listContent,
              {
                paddingBottom: TAB_BAR_HEIGHT + playerOffset + insets.bottom + 20,
              }
            ]}
          />
        ) : (
          <View style={styles.emptyDownloads}>
            <BlurView intensity={30} tint="dark" style={styles.emptyCard}>
              <Ionicons name="cloud-offline-outline" size={70} color="#1DB954" />
              <Text style={styles.emptyTitle}>Sin descargas</Text>
              <Text style={styles.emptyText}>
                Las canciones que descargues aparecerán aquí para escucharlas sin internet
              </Text>
            </BlurView>
          </View>
        )}
      </ScreenWrapper>
    );
  }

  // Pantalla principal de configuración
  return (
    <ScreenWrapper>
      <LinearGradient
        colors={['#0A0A0A', '#1A1A1A']}
        style={StyleSheet.absoluteFill}
      />
      
      <ScrollView 
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor="#1DB954"
            colors={['#1DB954']}
            progressBackgroundColor="#1A1A1A"
          />
        }
        contentContainerStyle={[
          styles.scrollContent,
          {
            paddingBottom: TAB_BAR_HEIGHT + playerOffset + insets.bottom + 20,
          }
        ]}
      >
        <View style={styles.header}>
          <LinearGradient
            colors={['rgba(29,185,84,0.2)', 'transparent']}
            style={styles.headerGradient}
          >
            <Text style={styles.title}>Configuración</Text>
            <Text style={styles.subtitle}>Personaliza tu experiencia</Text>
          </LinearGradient>
        </View>

        {/* Sección de Estado de Red */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>
            <Ionicons name="cloud-outline" size={18} color="#1DB954" /> ESTADO DE RED
          </Text>
          
          <LinearGradient
            colors={isNetworkOffline 
              ? ['rgba(255,68,68,0.2)', 'rgba(255,68,68,0.05)'] 
              : ['rgba(29,185,84,0.2)', 'rgba(29,185,84,0.05)']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.networkCard}
          >
            <View style={styles.networkHeader}>
              <View style={[styles.networkIcon, { 
                backgroundColor: isNetworkOffline 
                  ? 'rgba(255,68,68,0.15)' 
                  : 'rgba(29,185,84,0.15)' 
              }]}>
                <Ionicons 
                  name={isNetworkOffline ? 'cloud-offline' : 'cloud'} 
                  size={24} 
                  color={isNetworkOffline ? '#FF4444' : '#1DB954'} 
                />
              </View>
              <View style={styles.networkInfo}>
                <Text style={styles.networkTitle}>
                  {isNetworkOffline ? 'Sin conexión' : 'Conectado'}
                </Text>
                <Text style={styles.networkSubtitle}>
                  {isNetworkOffline 
                    ? 'Reproduciendo solo descargas' 
                    : 'Puedes buscar y reproducir cualquier canción'}
                </Text>
              </View>
            </View>
            
            <View style={styles.badgeContainer}>
              <View style={[styles.modeBadge, { 
                backgroundColor: offlineMode 
                  ? 'rgba(29,185,84,0.15)' 
                  : 'rgba(255,255,255,0.1)' 
              }]}>
                <Ionicons 
                  name={offlineMode ? 'lock-closed' : 'lock-open'} 
                  size={14} 
                  color={offlineMode ? '#1DB954' : '#666'} 
                />
                <Text style={[styles.modeBadgeText, { 
                  color: offlineMode ? '#1DB954' : '#666' 
                }]}>
                  {offlineMode ? 'MODO OFFLINE' : 'MODO ONLINE'}
                </Text>
              </View>
            </View>
          </LinearGradient>
        </View>

        {/* Sección de Almacenamiento */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>
            <Ionicons name="download-outline" size={18} color="#1DB954" /> ALMACENAMIENTO
          </Text>
          
          <TouchableOpacity 
            style={styles.storageCard}
            onPress={() => setShowDownloads(true)}
            activeOpacity={0.7}
          >
            <LinearGradient
              colors={['rgba(29,185,84,0.1)', 'transparent']}
              style={styles.storageGradient}
            >
              <View style={styles.storageContent}>
                <View style={styles.storageLeft}>
                  <View style={styles.storageIcon}>
                    <Ionicons name="musical-notes" size={24} color="#1DB954" />
                  </View>
                  <View>
                    <Text style={styles.storageTitle}>Canciones descargadas</Text>
                    <Text style={styles.storageCount}>
                      {downloadedTracks.length} canciones • {formatBytes(totalSize)}
                    </Text>
                  </View>
                </View>
                <Ionicons name="chevron-forward" size={22} color="#1DB954" />
              </View>

              {downloadedTracks.length > 0 && (
                <View style={styles.progressBar}>
                  <View style={[styles.progressFill, { 
                    width: `${Math.min((totalSize / (100 * 1024 * 1024)) * 100, 100)}%`
                  }]} />
                </View>
              )}
            </LinearGradient>
          </TouchableOpacity>

          {downloadedTracks.length > 0 && (
            <TouchableOpacity
              style={styles.clearButton}
              onPress={() => {
                Alert.alert(
                  '🗑️ Eliminar todas las descargas',
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
                        Alert.alert('✅ Listo', 'Todas las descargas fueron eliminadas');
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
        <View style={[styles.section, styles.lastSection]}>
          <Text style={styles.sectionTitle}>
            <Ionicons name="information-circle-outline" size={18} color="#1DB954" /> INFORMACIÓN
          </Text>
          
          <BlurView intensity={40} tint="dark" style={styles.infoCard}>
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Versión</Text>
              <Text style={styles.infoValue}>1.0.0</Text>
            </View>
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>API Providers</Text>
              <Text style={styles.infoValue}>14 activos</Text>
            </View>
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Calidad predeterminada</Text>
              <Text style={styles.infoValue}>HIGH</Text>
            </View>
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Caché de letras</Text>
              <Text style={styles.infoValue}>24 canciones</Text>
            </View>
          </BlurView>
        </View>
      </ScrollView>
    </ScreenWrapper>
  );
}

const styles = StyleSheet.create({
  scrollContent: {
    flexGrow: 1,
  },
  header: {
    marginBottom: 20,
  },
  headerGradient: {
    paddingHorizontal: 20,
    paddingTop: 40,
    paddingBottom: 30,
    borderBottomLeftRadius: 30,
    borderBottomRightRadius: 30,
  },
  title: {
    fontSize: 34,
    fontWeight: 'bold',
    color: '#FFF',
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 14,
    color: '#B3B3B3',
  },
  section: {
    marginBottom: 24,
    paddingHorizontal: 16,
  },
  lastSection: {
    marginBottom: 0,
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: '600',
    color: '#1DB954',
    marginBottom: 12,
    marginLeft: 4,
    letterSpacing: 1,
  },
  // Tarjeta de red
  networkCard: {
    borderRadius: 20,
    padding: 16,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.05)',
  },
  networkHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  networkIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  networkInfo: {
    flex: 1,
  },
  networkTitle: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 2,
  },
  networkSubtitle: {
    color: '#B3B3B3',
    fontSize: 13,
  },
  badgeContainer: {
    alignItems: 'flex-start',
  },
  modeBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    gap: 6,
  },
  modeBadgeText: {
    fontSize: 12,
    fontWeight: '600',
  },
  // Tarjeta de almacenamiento
  storageCard: {
    borderRadius: 20,
    overflow: 'hidden',
    marginBottom: 12,
    borderWidth: 1,
    borderColor: 'rgba(29,185,84,0.2)',
  },
  storageGradient: {
    padding: 16,
  },
  storageContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  storageLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  storageIcon: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: 'rgba(29,185,84,0.15)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  storageTitle: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 2,
  },
  storageCount: {
    color: '#B3B3B3',
    fontSize: 13,
  },
  progressBar: {
    height: 4,
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderRadius: 2,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: '#1DB954',
    borderRadius: 2,
  },
  clearButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,68,68,0.1)',
    padding: 14,
    borderRadius: 16,
    gap: 8,
    borderWidth: 1,
    borderColor: 'rgba(255,68,68,0.2)',
  },
  clearButtonText: {
    color: '#FF4444',
    fontSize: 14,
    fontWeight: '600',
  },
  // Tarjeta de información
  infoCard: {
    borderRadius: 20,
    padding: 16,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.05)',
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.05)',
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
  // Pantalla de descargas
  downloadsHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 20,
    paddingBottom: 10,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.05)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  downloadsTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#FFF',
  },
  statsGradient: {
    margin: 16,
    marginTop: 8,
    borderRadius: 20,
    overflow: 'hidden',
  },
  statsContainer: {
    flexDirection: 'row',
    padding: 20,
    alignItems: 'center',
    justifyContent: 'space-around',
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
    backgroundColor: 'rgba(255,255,255,0.1)',
  },
  listContent: {
    paddingHorizontal: 16,
  },
  emptyDownloads: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 60,
  },
  emptyCard: {
    padding: 30,
    borderRadius: 30,
    alignItems: 'center',
    width: width * 0.8,
    backgroundColor: 'rgba(255,255,255,0.05)',
  },
  emptyTitle: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#FFF',
    marginTop: 16,
    marginBottom: 8,
  },
  emptyText: {
    color: '#B3B3B3',
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 20,
  },
});