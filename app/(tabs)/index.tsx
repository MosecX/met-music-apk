import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Dimensions,
  FlatList,
  RefreshControl,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import ScreenWrapper from '../../components/ScreenWrapper';
import TrackItem from '../../components/TrackItem';
import { usePlayer } from '../../context/PlayerContext';
import MonochromeAPI from '../../services/MonochromeAPI';
import PlayHistoryService from '../../services/PlayHistoryService';
import storageService from '../../services/storage';
import { StoredTrack } from '../../types';

const { width } = Dimensions.get('window');
const OFFLINE_MODE_KEY = '@offline_mode';
const TAB_BAR_HEIGHT = 60;
const PLAYER_HEIGHT = 80;

export default function HomeScreen() {
  const insets = useSafeAreaInsets();
  const [recommendations, setRecommendations] = useState<StoredTrack[]>([]);
  const [filteredRecommendations, setFilteredRecommendations] = useState<StoredTrack[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [offlineMode, setOfflineMode] = useState(false);
  const [downloadedTracks, setDownloadedTracks] = useState<StoredTrack[]>([]);
  const [lastPlayedInfo, setLastPlayedInfo] = useState<string>('');
  const { currentTrack, playTrack } = usePlayer();

  const playerOffset = currentTrack ? PLAYER_HEIGHT : 0;

  useEffect(() => {
    loadSettings();
    loadDownloads();
  }, []);

  useEffect(() => {
    if (offlineMode && downloadedTracks.length > 0) {
      const downloadedIds = downloadedTracks.map(t => t.id);
      setFilteredRecommendations(recommendations.filter(t => downloadedIds.includes(t.id)));
    } else {
      setFilteredRecommendations(recommendations);
    }
  }, [offlineMode, downloadedTracks, recommendations]);

  // Cargar recomendaciones basadas en el historial
  const loadRecommendations = useCallback(async () => {
    try {
      setLoading(true);
      
      console.log('🔍 CARGANDO RECOMENDACIONES');
      console.log('🔍 Modo offline:', offlineMode);
      
      // DEBUG: Ver historial completo
      const fullHistory = await PlayHistoryService.getHistory();
      console.log('📊 HISTORIAL COMPLETO:', fullHistory.map(h => ({
        cancion: h.track.title,
        artista: h.track.artist,
        cuando: new Date(h.playedAt).toLocaleTimeString()
      })));
      
      // 1. Obtener IDs de canciones recientes del historial
      const recentIds = await PlayHistoryService.getRecentTrackIds(5);
      console.log('🎯 IDs recientes:', recentIds);
      
      const lastPlayed = await PlayHistoryService.getLastPlayed();
      console.log('🎵 Última reproducida:', lastPlayed?.track.title);
      
      let tracks: StoredTrack[] = [];
      
      if (recentIds.length > 0) {
        console.log('🎵 HAY HISTORIAL - IDs para recomendaciones:', recentIds);
        
        if (lastPlayed) {
          setLastPlayedInfo(`Basado en tu historial · ${lastPlayed.track.title} ${lastPlayed.track.artist ? `· ${lastPlayed.track.artist}` : ''}`);
        }
        
        // 2. Obtener recomendaciones basadas en el historial
        console.log('🎵 Llamando a getRecommendationsFromHistory con IDs:', recentIds);
        tracks = await MonochromeAPI.getRecommendationsFromHistory(recentIds, 30);
        console.log('🎵 Recomendaciones obtenidas del historial:', tracks.length);
        
        // 3. Si hay pocas recomendaciones, complementar con generales
        if (tracks.length < 10) {
          console.log('🎵 Pocas recomendaciones basadas en historial, complementando con generales...');
          const generalTracks = await MonochromeAPI.getRecommendations(424698825);
          console.log('🎵 Recomendaciones generales obtenidas:', generalTracks.length);
          
          // Mezclar evitando duplicados
          const existingIds = new Set(tracks.map(t => t.id));
          const newTracks = generalTracks.filter(t => !existingIds.has(t.id));
          
          tracks = [...tracks, ...newTracks.slice(0, 10 - tracks.length)];
          console.log('🎵 Total después de complementar:', tracks.length);
        }
      } else {
        // No hay historial, mostrar recomendaciones por defecto
        console.log('🎵 NO HAY HISTORIAL - mostrando recomendaciones generales');
        setLastPlayedInfo('Descubre música nueva');
        tracks = await MonochromeAPI.getRecommendations(424698825);
        console.log('🎵 Recomendaciones generales:', tracks.length);
      }
      
      // 4. Mezclar un poco para dar variedad pero mantener relevancia
      const shuffled = [...tracks];
      for (let i = shuffled.length - 1; i > 0; i--) {
        if (Math.random() > 0.7) { // 30% de probabilidad de mezclar
          const j = Math.floor(Math.random() * (i + 1));
          [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
        }
      }
      
      setRecommendations(shuffled);
      console.log('✅ Recomendaciones finales:', shuffled.length);
      console.log('✅ Primeras 3 recomendaciones:', shuffled.slice(0, 3).map(t => t.title));
      
    } catch (error) {
      console.log('❌ Error loading recommendations:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [offlineMode]);

  // Efecto para cargar recomendaciones al montar y cuando cambia offlineMode
  useEffect(() => {
    loadRecommendations();
  }, [offlineMode, loadRecommendations]);

  const loadSettings = async () => {
    try {
      const saved = await AsyncStorage.getItem(OFFLINE_MODE_KEY);
      setOfflineMode(saved === 'true');
      console.log('⚙️ Modo offline cargado:', saved === 'true');
    } catch (error) {
      console.log('Error loading offline mode:', error);
    }
  };

  const loadDownloads = async () => {
    const tracks = await storageService.getDownloadedTracks();
    setDownloadedTracks(tracks);
    console.log('⬇️ Descargas cargadas:', tracks.length);
  };

  const handleRefresh = () => {
    console.log('🔄 Refrescando recomendaciones...');
    setRefreshing(true);
    loadRecommendations();
  };

  const handleTrackPress = (index: number) => {
    const track = filteredRecommendations[index];
    if (track) {
      if (offlineMode) {
        const isDownloaded = downloadedTracks.some(t => t.id === track.id);
        if (!isDownloaded) {
          Alert.alert(
            '📱 Modo Offline',
            'Esta canción no está disponible sin conexión. Descarga canciones para escucharlas offline.'
          );
          return;
        }
      }
      
      console.log('🎵 Reproduciendo desde inicio:', {
        cancion: track.title,
        artista: track.artist,
        totalEnCola: filteredRecommendations.length,
        indice: index
      });
      
      playTrack(
        track,
        filteredRecommendations,
        index,
        'recommendations'
      );
    }
  };

  if (loading) {
    return (
      <ScreenWrapper>
        <LinearGradient
          colors={['#0A0A0A', '#1A1A1A']}
          style={StyleSheet.absoluteFill}
        />
        <View style={styles.centerContainer}>
          <ActivityIndicator size="large" color="#1DB954" />
          <Text style={styles.loadingText}>Cargando tu música...</Text>
        </View>
      </ScreenWrapper>
    );
  }

  return (
    <ScreenWrapper>
      <LinearGradient
        colors={['#0A0A0A', '#1A1A1A', '#0F0F0F']}
        style={StyleSheet.absoluteFill}
      />
      
      {/* Elementos decorativos */}
      <View style={styles.decorativeCircle1} />
      <View style={styles.decorativeCircle2} />

      <FlatList
        data={filteredRecommendations}
        keyExtractor={(item) => item.id.toString()}
        renderItem={({ item, index }) => (
          <TrackItem
            track={item}
            index={index}
            isActive={currentTrack?.id === item.id}
            onPlay={handleTrackPress}
            showDownload={true}
            showFavorite={true}
          />
        )}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            tintColor="#1DB954"
            colors={['#1DB954']}
            progressBackgroundColor="#1A1A1A"
          />
        }
        ListHeaderComponent={
          <View style={[styles.header, { paddingTop: insets.top + 20 }]}>
            <LinearGradient
              colors={['rgba(29,185,84,0.2)', 'rgba(29,185,84,0.1)']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.heroGradient}
            >
              <View style={styles.hero}>
                <Text style={styles.greeting}>Bienvenido a</Text>
                <Text style={styles.title}>MetMusic</Text>
                
                {offlineMode && (
                  <BlurView intensity={40} tint="dark" style={styles.offlineBadge}>
                    <Ionicons name="cloud-outline" size={14} color="#1DB954" />
                    <Text style={styles.offlineBadgeText}>Modo offline activado</Text>
                  </BlurView>
                )}
              </View>
            </LinearGradient>

            {lastPlayedInfo && !offlineMode && (
              <BlurView intensity={40} tint="dark" style={styles.infoContainer}>
                <Ionicons name="time-outline" size={16} color="#1DB954" />
                <Text style={styles.infoText}>{lastPlayedInfo}</Text>
              </BlurView>
            )}

            {filteredRecommendations.length > 0 && (
              <View style={styles.sectionHeader}>
                <LinearGradient
                  colors={['#1DB954', '#1a7a3a']}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                  style={styles.sectionGradient}
                />
                <Text style={styles.sectionTitle}>
                  {offlineMode ? '📱 Tus descargas' : '🎵 Recomendado para ti'}
                </Text>
              </View>
            )}
          </View>
        }
        ListEmptyComponent={
          offlineMode && filteredRecommendations.length === 0 ? (
            <View style={styles.emptyContainer}>
              <BlurView intensity={30} tint="dark" style={styles.emptyCard}>
                <LinearGradient
                  colors={['rgba(29,185,84,0.2)', 'rgba(29,185,84,0.05)']}
                  style={styles.emptyGradient}
                >
                  <Ionicons name="cloud-offline-outline" size={70} color="rgba(255,255,255,0.2)" />
                  <Text style={styles.emptyTitle}>Modo offline</Text>
                  <Text style={styles.emptyText}>
                    No hay recomendaciones disponibles sin conexión
                  </Text>
                  <View style={styles.emptyDivider} />
                  <Text style={styles.emptyHint}>
                    💡 Para escuchar música sin internet:
                  </Text>
                  <View style={styles.stepsContainer}>
                    <View style={styles.step}>
                      <View style={styles.stepNumber}>
                        <Text style={styles.stepNumberText}>1</Text>
                      </View>
                      <Text style={styles.stepText}>
                        Ve a <Text style={styles.stepHighlight}>Biblioteca</Text>
                      </Text>
                    </View>
                    <View style={styles.step}>
                      <View style={styles.stepNumber}>
                        <Text style={styles.stepNumberText}>2</Text>
                      </View>
                      <Text style={styles.stepText}>
                        Elige una <Text style={styles.stepHighlight}>playlist</Text>
                      </Text>
                    </View>
                    <View style={styles.step}>
                      <View style={styles.stepNumber}>
                        <Text style={styles.stepNumberText}>3</Text>
                      </View>
                      <Text style={styles.stepText}>
                        Toca <Ionicons name="cloud-download-outline" size={14} color="#1DB954" /> para descargar
                      </Text>
                    </View>
                  </View>
                  <Text style={styles.emptyNote}>
                    Las canciones descargadas aparecerán aquí
                  </Text>
                </LinearGradient>
              </BlurView>
            </View>
          ) : null
        }
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[
          styles.listContent,
          {
            paddingBottom: TAB_BAR_HEIGHT + playerOffset + insets.bottom + 20,
          }
        ]}
      />
    </ScreenWrapper>
  );
}

const styles = StyleSheet.create({
  decorativeCircle1: {
    position: 'absolute',
    width: 250,
    height: 250,
    borderRadius: 125,
    backgroundColor: 'rgba(29,185,84,0.05)',
    top: -80,
    right: -80,
  },
  decorativeCircle2: {
    position: 'absolute',
    width: 200,
    height: 200,
    borderRadius: 100,
    backgroundColor: 'rgba(29,185,84,0.03)',
    bottom: -60,
    left: -60,
  },
  header: {
    paddingBottom: 20,
  },
  heroGradient: {
    marginHorizontal: 16,
    marginBottom: 16,
    borderRadius: 30,
    overflow: 'hidden',
  },
  hero: {
    padding: 30,
    alignItems: 'center',
  },
  greeting: {
    color: 'rgba(255,255,255,0.5)',
    fontSize: 14,
    fontWeight: '500',
    letterSpacing: 1,
    marginBottom: 8,
  },
  title: {
    fontSize: 36,
    fontWeight: '800',
    color: '#FFF',
    marginBottom: 12,
    textShadowColor: 'rgba(29,185,84,0.3)',
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 10,
  },
  offlineBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 30,
    gap: 8,
    backgroundColor: 'rgba(29,185,84,0.15)',
    borderWidth: 1,
    borderColor: 'rgba(29,185,84,0.3)',
  },
  offlineBadgeText: {
    color: '#FFF',
    fontSize: 13,
    fontWeight: '500',
  },
  infoContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: 16,
    marginBottom: 20,
    padding: 12,
    borderRadius: 25,
    gap: 8,
    backgroundColor: 'rgba(29,185,84,0.1)',
    borderWidth: 1,
    borderColor: 'rgba(29,185,84,0.2)',
  },
  infoText: {
    flex: 1,
    color: '#FFF',
    fontSize: 13,
    fontWeight: '400',
  },
  sectionHeader: {
    marginHorizontal: 16,
    marginBottom: 16,
    position: 'relative',
  },
  sectionGradient: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    width: 4,
    borderRadius: 2,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#FFF',
    marginLeft: 16,
  },
  listContent: {
    paddingHorizontal: 16,
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    color: '#1DB954',
    fontSize: 14,
    marginTop: 12,
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 20,
    paddingTop: 20,
  },
  emptyCard: {
    width: width * 0.9,
    borderRadius: 30,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  emptyGradient: {
    alignItems: 'center',
    padding: 30,
  },
  emptyTitle: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#FFF',
    marginTop: 16,
    marginBottom: 8,
  },
  emptyText: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.6)',
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 16,
  },
  emptyDivider: {
    width: '50%',
    height: 1,
    backgroundColor: 'rgba(255,255,255,0.1)',
    marginVertical: 16,
  },
  emptyHint: {
    fontSize: 14,
    color: '#1DB954',
    fontWeight: '500',
    marginBottom: 12,
  },
  stepsContainer: {
    width: '100%',
    marginBottom: 12,
  },
  step: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  stepNumber: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: 'rgba(29,185,84,0.2)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
    borderWidth: 1,
    borderColor: 'rgba(29,185,84,0.3)',
  },
  stepNumberText: {
    color: '#1DB954',
    fontSize: 12,
    fontWeight: 'bold',
  },
  stepText: {
    flex: 1,
    fontSize: 13,
    color: '#FFF',
  },
  stepHighlight: {
    color: '#1DB954',
    fontWeight: '600',
  },
  emptyNote: {
    fontSize: 11,
    color: 'rgba(255,255,255,0.3)',
    textAlign: 'center',
    marginTop: 8,
  },
});