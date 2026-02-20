import AsyncStorage from '@react-native-async-storage/async-storage';
import React, { useEffect, useState } from 'react';
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
import storageService from '../../services/storage';

const OFFLINE_MODE_KEY = '@offline_mode';

export default function HomeScreen() {
  const insets = useSafeAreaInsets();
  const [recommendations, setRecommendations] = useState<any[]>([]);
  const [filteredRecommendations, setFilteredRecommendations] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [offlineMode, setOfflineMode] = useState(false);
  const [downloadedTracks, setDownloadedTracks] = useState<any[]>([]);
  const { currentTrack, playTrack } = usePlayer();

  const TAB_BAR_HEIGHT = 60;
  const PLAYER_HEIGHT = 80;
  const playerOffset = currentTrack ? PLAYER_HEIGHT : 0;

  useEffect(() => {
    loadSettings();
    loadDownloads();
    loadRecommendations();
  }, []);

  useEffect(() => {
    if (offlineMode && downloadedTracks.length > 0) {
      const downloadedIds = downloadedTracks.map(t => t.id);
      setFilteredRecommendations(recommendations.filter(t => downloadedIds.includes(t.id)));
    } else {
      setFilteredRecommendations(recommendations);
    }
  }, [offlineMode, downloadedTracks, recommendations]);

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

  const loadRecommendations = async () => {
    try {
      const tracks = await MonochromeAPI.getRecommendations(424698825);
      setRecommendations(tracks);
      
      if (offlineMode) {
        const downloadedIds = downloadedTracks.map(t => t.id);
        setFilteredRecommendations(tracks.filter(t => downloadedIds.includes(t.id)));
      } else {
        setFilteredRecommendations(tracks);
      }
    } catch (error) {
      console.log('Error:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const handleRefresh = () => {
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
    paddingBottom: 20,
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