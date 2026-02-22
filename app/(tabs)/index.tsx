import AsyncStorage from '@react-native-async-storage/async-storage';
import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
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

const OFFLINE_MODE_KEY = '@offline_mode';

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

  const TAB_BAR_HEIGHT = 60;
  const PLAYER_HEIGHT = 80;
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
          setLastPlayedInfo(`Basado en: ${lastPlayed.track.title} ${lastPlayed.track.artist ? `- ${lastPlayed.track.artist}` : ''}`);
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
        setLastPlayedInfo('Recomendaciones para ti');
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
  }, [offlineMode]); // Dependencia: offlineMode

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
          Alert.alert('Modo Offline', 'Esta canción no está disponible sin conexión');
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
        <View style={styles.centerContainer}>
          <ActivityIndicator size="large" color="#1DB954" />
        </View>
      </ScreenWrapper>
    );
  }

  return (
    <ScreenWrapper>
      <View style={styles.header}>
        <Text style={styles.greeting}>Bienvenido</Text>
        <Text style={styles.title}>MetMusic</Text>
        {offlineMode && (
          <View style={styles.offlineBadge}>
            <Text style={styles.offlineBadgeText}>📶 Modo offline</Text>
          </View>
        )}
      </View>

      {lastPlayedInfo && !offlineMode && (
        <View style={styles.infoContainer}>
          <Text style={styles.infoText}>{lastPlayedInfo}</Text>
        </View>
      )}

      {offlineMode && filteredRecommendations.length === 0 && (
        <View style={styles.offlineMessage}>
          <Text style={styles.offlineMessageText}>
            No hay recomendaciones disponibles sin conexión
          </Text>
          <Text style={styles.offlineMessageSubtext}>
            Descarga canciones para verlas aquí
          </Text>
        </View>
      )}

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
          />
        }
        ListHeaderComponent={
          filteredRecommendations.length > 0 ? (
            <Text style={styles.sectionTitle}>
              {offlineMode ? 'Tus descargas' : 'Recomendado para ti'}
            </Text>
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
  header: {
    paddingTop: 40,
    paddingBottom: 10,
    paddingHorizontal: 20,
  },
  greeting: {
    color: '#B3B3B3',
    fontSize: 14,
    marginBottom: 4,
  },
  title: {
    color: '#FFFFFF',
    fontSize: 32,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  offlineBadge: {
    backgroundColor: 'rgba(29,185,84,0.2)',
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 15,
    alignSelf: 'flex-start',
  },
  offlineBadgeText: {
    color: '#1DB954',
    fontSize: 12,
    fontWeight: '600',
  },
  infoContainer: {
    paddingHorizontal: 20,
    paddingBottom: 10,
  },
  infoText: {
    color: '#1DB954',
    fontSize: 14,
    fontStyle: 'italic',
  },
  offlineMessage: {
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 40,
  },
  offlineMessageText: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 8,
    textAlign: 'center',
  },
  offlineMessageSubtext: {
    color: '#B3B3B3',
    fontSize: 14,
    textAlign: 'center',
  },
  sectionTitle: {
    color: '#FFFFFF',
    fontSize: 22,
    fontWeight: 'bold',
    marginLeft: 16,
    marginBottom: 16,
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  listContent: {
    paddingHorizontal: 16,
  },
});