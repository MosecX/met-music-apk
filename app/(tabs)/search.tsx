import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Keyboard,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import AddToPlaylistModal from '../../components/AddToPlaylistModal';
import TrackItem from '../../components/TrackItem';
import { usePlayer } from '../../context/PlayerContext';
import MonochromeAPI from '../../services/MonochromeAPI';
import storageService from '../../services/storage';
import { StoredTrack, Track as TrackType } from '../../types';

const OFFLINE_MODE_KEY = '@offline_mode';

export default function SearchScreen() {
  const insets = useSafeAreaInsets();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<TrackType[]>([]);
  const [filteredResults, setFilteredResults] = useState<TrackType[]>([]);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);
  const [selectedTrackForPlaylist, setSelectedTrackForPlaylist] = useState<TrackType | null>(null);
  const [showPlaylistModal, setShowPlaylistModal] = useState(false);
  const [offlineMode, setOfflineMode] = useState(false);
  const [downloadedTracks, setDownloadedTracks] = useState<StoredTrack[]>([]);
  
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
      setFilteredResults(results.filter(t => downloadedIds.includes(t.id)));
    } else {
      setFilteredResults(results);
    }
  }, [offlineMode, downloadedTracks, results]);

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

  const handleSearch = async () => {
    if (!query.trim()) return;
    
    setLoading(true);
    setSearched(true);
    Keyboard.dismiss();
    
    try {
      const tracks = await MonochromeAPI.searchTracks(query);
      setResults(tracks);
      
      if (offlineMode) {
        const downloadedIds = downloadedTracks.map(t => t.id);
        setFilteredResults(tracks.filter(t => downloadedIds.includes(t.id)));
      } else {
        setFilteredResults(tracks);
      }
    } catch (err) {
      console.error('Error al buscar', err);
      setResults([]);
      setFilteredResults([]);
    } finally {
      setLoading(false);
    }
  };

  const clearSearch = () => {
    setQuery('');
    setResults([]);
    setFilteredResults([]);
    setSearched(false);
    Keyboard.dismiss();
  };

  const handleTrackPress = (index: number) => {
    const track = filteredResults[index];
    if (track) {
      if (offlineMode) {
        const isDownloaded = downloadedTracks.some(t => t.id === track.id);
        if (!isDownloaded) {
          Alert.alert('Modo Offline', 'Esta canción no está disponible sin conexión');
          return;
        }
      }
      
      console.log('🎵 Reproduciendo desde búsqueda:', {
        cancion: track.title,
        totalEnCola: filteredResults.length,
        indice: index
      });
      
      playTrack(
        track,
        filteredResults,
        index,
        'search'
      );
    }
  };

  const handleAddToPlaylist = (track: TrackType) => {
    setSelectedTrackForPlaylist(track);
    setShowPlaylistModal(true);
  };

  const handleDownload = async (trackId: number) => {
    try {
      const track = results.find(t => t.id === trackId);
      if (!track) return;
      
      const url = await MonochromeAPI.getPlayableUrl(trackId);
      await storageService.addDownloadedTrack(track as StoredTrack, url);
      await loadDownloads();
      
      if (offlineMode) {
        const downloadedIds = [...downloadedTracks.map(t => t.id), trackId];
        setFilteredResults(results.filter(t => downloadedIds.includes(t.id)));
      }
    } catch (error) {
      throw error;
    }
  };

  // Eliminamos la función handleToggleFavorite ya que no se usa

  return (
    <View style={styles.container}>
      <LinearGradient
        colors={['#1a1a1a', '#0a0a0a']}
        style={StyleSheet.absoluteFill}
      />
      
      <FlatList
        data={filteredResults}
        keyExtractor={(item) => item.id.toString()}
        renderItem={({ item, index }) => {
          if (!item) return null;
          
          return (
            <TrackItem
              track={item}
              index={index}
              isActive={currentTrack?.id === item.id}
              onPlay={handleTrackPress}
              onAddToPlaylist={handleAddToPlaylist}
              onDownload={handleDownload}
              // Eliminamos onToggleFavorite
              showDownload={true}
              // Eliminamos showFavorite
            />
          );
        }}
        ListHeaderComponent={
          <View style={styles.header}>
            <View style={styles.hero}>
              <Text style={styles.heroTitle}>Buscar música</Text>
              <Text style={styles.heroSubtitle}>
                Encuentra tus canciones favoritas
              </Text>
              {offlineMode && (
                <View style={styles.offlineBadge}>
                  <Ionicons name="airplane" size={16} color="#FFF" />
                  <Text style={styles.offlineBadgeText}>Modo offline activado</Text>
                </View>
              )}
            </View>

            <View style={styles.searchWrapper}>
              <BlurView intensity={20} tint="dark" style={styles.searchContainer}>
                <View style={styles.searchContent}>
                  <Ionicons name="search" size={20} color="#9CA3AF" />
                  <TextInput
                    style={styles.searchInput}
                    placeholder={offlineMode ? "Buscar en descargas..." : "Buscar canción"}
                    placeholderTextColor="#9CA3AF"
                    value={query}
                    onChangeText={setQuery}
                    onSubmitEditing={handleSearch}
                    returnKeyType="search"
                  />
                  {query.length > 0 && (
                    <TouchableOpacity onPress={clearSearch}>
                      <Ionicons name="close-circle" size={20} color="#9CA3AF" />
                    </TouchableOpacity>
                  )}
                </View>
              </BlurView>
              
              <TouchableOpacity
                style={[
                  styles.searchButton,
                  (!query.trim() || loading) && styles.searchButtonDisabled
                ]}
                onPress={handleSearch}
                disabled={!query.trim() || loading}
              >
                <LinearGradient
                  colors={['#EC4899', '#A855F7']}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={styles.searchButtonGradient}
                >
                  {loading ? (
                    <ActivityIndicator color="#FFF" size="small" />
                  ) : (
                    <Text style={styles.searchButtonText}>Buscar</Text>
                  )}
                </LinearGradient>
              </TouchableOpacity>
            </View>

            {offlineMode && filteredResults.length === 0 && searched && !loading && (
              <View style={styles.offlineInfo}>
                <Text style={styles.offlineInfoText}>
                  No hay canciones descargadas que coincidan con tu búsqueda
                </Text>
              </View>
            )}
          </View>
        }
        ListEmptyComponent={
          searched && !loading ? (
            <View style={styles.emptyContainer}>
              <Ionicons 
                name={offlineMode ? "cloud-offline-outline" : "search-outline"} 
                size={60} 
                color="#666" 
              />
              <Text style={styles.emptyText}>
                {offlineMode 
                  ? 'No hay canciones descargadas' 
                  : 'No se encontraron resultados'}
              </Text>
            </View>
          ) : null
        }
        contentContainerStyle={[
          styles.listContent,
          {
            paddingBottom: TAB_BAR_HEIGHT + playerOffset + insets.bottom + 20,
          }
        ]}
        showsVerticalScrollIndicator={false}
        initialNumToRender={10}
        maxToRenderPerBatch={10}
        windowSize={5}
        removeClippedSubviews={true}
        ListFooterComponent={loading ? (
          <View style={styles.loadingFooter}>
            <ActivityIndicator size="large" color="#EC4899" />
            <Text style={styles.loadingText}>Buscando...</Text>
          </View>
        ) : null}
      />

      <AddToPlaylistModal
        visible={showPlaylistModal}
        onClose={() => {
          setShowPlaylistModal(false);
          setSelectedTrackForPlaylist(null);
        }}
        track={selectedTrackForPlaylist as StoredTrack | null}
        onAdded={() => {}}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#121212',
  },
  header: {
    paddingTop: 20,
    paddingBottom: 10,
  },
  hero: {
    paddingTop: 40,
    paddingBottom: 30,
    paddingHorizontal: 20,
    alignItems: 'center',
  },
  heroTitle: {
    fontSize: 32,
    fontWeight: '800',
    marginBottom: 8,
    textAlign: 'center',
    color: '#FFF',
    textShadowColor: 'rgba(236, 72, 153, 0.5)',
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 10,
  },
  heroSubtitle: {
    fontSize: 14,
    color: '#9CA3AF',
    textAlign: 'center',
    marginBottom: 12,
  },
  offlineBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(29,185,84,0.2)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    gap: 6,
  },
  offlineBadgeText: {
    color: '#FFF',
    fontSize: 12,
    fontWeight: '600',
  },
  offlineInfo: {
    paddingHorizontal: 20,
    marginTop: 10,
  },
  offlineInfoText: {
    color: '#B3B3B3',
    fontSize: 14,
    textAlign: 'center',
    fontStyle: 'italic',
  },
  searchWrapper: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    marginBottom: 20,
    gap: 8,
  },
  searchContainer: {
    flex: 1,
    borderRadius: 30,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  searchContent: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 8,
  },
  searchInput: {
    flex: 1,
    color: '#FFF',
    fontSize: 16,
    padding: 0,
  },
  searchButton: {
    borderRadius: 30,
    overflow: 'hidden',
    shadowColor: '#EC4899',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 5,
    elevation: 5,
  },
  searchButtonDisabled: {
    opacity: 0.5,
  },
  searchButtonGradient: {
    paddingHorizontal: 20,
    paddingVertical: 12,
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: 80,
  },
  searchButtonText: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: '600',
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 100,
  },
  emptyText: {
    color: '#666',
    fontSize: 16,
    marginTop: 16,
  },
  listContent: {
    paddingHorizontal: 16,
  },
  loadingFooter: {
    paddingVertical: 20,
    alignItems: 'center',
  },
  loadingText: {
    color: '#EC4899',
    marginTop: 12,
    fontSize: 14,
  },
});