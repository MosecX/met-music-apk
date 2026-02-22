import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Animated,
  Dimensions,
  FlatList,
  Keyboard,
  RefreshControl,
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

const { width } = Dimensions.get('window');
const OFFLINE_MODE_KEY = '@offline_mode';
const TAB_BAR_HEIGHT = 60;
const PLAYER_HEIGHT = 80;

export default function SearchScreen() {
  const insets = useSafeAreaInsets();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<TrackType[]>([]);
  const [filteredResults, setFilteredResults] = useState<TrackType[]>([]);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [searched, setSearched] = useState(false);
  const [selectedTrackForPlaylist, setSelectedTrackForPlaylist] = useState<TrackType | null>(null);
  const [showPlaylistModal, setShowPlaylistModal] = useState(false);
  const [offlineMode, setOfflineMode] = useState(false);
  const [downloadedTracks, setDownloadedTracks] = useState<StoredTrack[]>([]);
  
  // Animaciones
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const scaleAnim = useRef(new Animated.Value(0.95)).current;
  
  const { currentTrack, playTrack } = usePlayer();

  const playerOffset = currentTrack ? PLAYER_HEIGHT : 0;

  useEffect(() => {
    loadSettings();
    loadDownloads();
    
    // Animación de entrada
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 800,
        useNativeDriver: true,
      }),
      Animated.spring(scaleAnim, {
        toValue: 1,
        friction: 8,
        tension: 40,
        useNativeDriver: true,
      }),
    ]).start();
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

  // Función para recargar la búsqueda actual
  const refreshSearch = useCallback(async () => {
    if (!query.trim() || results.length === 0) return;
    
    setRefreshing(true);
    
    try {
      console.log('🔄 Recargando búsqueda:', query);
      const tracks = await MonochromeAPI.searchTracks(query);
      setResults(tracks);
      
      if (offlineMode) {
        const downloadedIds = downloadedTracks.map(t => t.id);
        setFilteredResults(tracks.filter(t => downloadedIds.includes(t.id)));
      } else {
        setFilteredResults(tracks);
      }
    } catch (err) {
      console.error('Error al recargar', err);
    } finally {
      setRefreshing(false);
    }
  }, [query, offlineMode, downloadedTracks]);

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
          Alert.alert('📱 Modo Offline', 'Esta canción no está disponible sin conexión. Descárgala primero.');
          return;
        }
      }
      
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

  const trendingSearches = [
    'Lo más nuevo',
    'Éxitos 2024',
    'En Vivo',
    'Remixes',
    'Acústico',
    'Rock Latino',
    'Reggaetón',
    'Pop',
  ];

  return (
    <View style={styles.container}>
      <LinearGradient
        colors={['#0A0A0A', '#1A1A1A', '#0F0F0F']}
        locations={[0, 0.5, 1]}
        style={StyleSheet.absoluteFill}
      />
      
      {/* Elementos decorativos */}
      <View style={styles.decorativeCircle1} />
      <View style={styles.decorativeCircle2} />

      <FlatList
        data={filteredResults}
        keyExtractor={(item) => item.id.toString()}
        renderItem={({ item, index }) => (
          <Animated.View
            style={{
              opacity: fadeAnim,
              transform: [{ scale: scaleAnim }],
            }}
          >
            <TrackItem
              track={item}
              index={index}
              isActive={currentTrack?.id === item.id}
              onPlay={handleTrackPress}
              onAddToPlaylist={handleAddToPlaylist}
              onDownload={handleDownload}
              showDownload={true}
              showFavorite={true}
            />
          </Animated.View>
        )}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={refreshSearch}
            tintColor="#1DB954"
            colors={['#1DB954']}
            progressBackgroundColor="#1A1A1A"
          />
        }
        ListHeaderComponent={
          <Animated.View style={{ opacity: fadeAnim }}>
            <View style={[styles.header, { paddingTop: insets.top + 10 }]}>
              <LinearGradient
                colors={['rgba(29,185,84,0.2)', 'rgba(29,185,84,0.1)']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.heroGradient}
              >
                <View style={styles.hero}>
                  <Text style={styles.heroBadge}>🎵 DESCUBRE</Text>
                  <Text style={styles.heroTitle}>Buscar</Text>
                  <Text style={styles.heroSubtitle}>
                    Encuentra tus canciones
                  </Text>
                  {offlineMode && (
                    <BlurView intensity={40} tint="dark" style={styles.offlineBadge}>
                      <Ionicons name="cloud-outline" size={14} color="#1DB954" />
                      <Text style={styles.offlineBadgeText}>Modo offline</Text>
                    </BlurView>
                  )}
                </View>
              </LinearGradient>

              <View style={styles.searchWrapper}>
                <BlurView intensity={80} tint="dark" style={styles.searchContainer}>
                  <View style={styles.searchContent}>
                    <Ionicons name="search" size={18} color="#1DB954" />
                    <TextInput
                      style={styles.searchInput}
                      placeholder={offlineMode ? "Buscar en descargas..." : "Buscar canciones..."}
                      placeholderTextColor="rgba(255,255,255,0.3)"
                      value={query}
                      onChangeText={setQuery}
                      onSubmitEditing={handleSearch}
                      returnKeyType="search"
                      selectionColor="#1DB954"
                    />
                    {query.length > 0 && (
                      <TouchableOpacity onPress={clearSearch}>
                        <Ionicons name="close-circle" size={18} color="rgba(255,255,255,0.5)" />
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
                  activeOpacity={0.8}
                >
                  <LinearGradient
                    colors={['#1DB954', '#1a7a3a']}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                    style={styles.searchButtonGradient}
                  >
                    {loading ? (
                      <ActivityIndicator color="#FFF" size="small" />
                    ) : (
                      <>
                        <Text style={styles.searchButtonText}>Ir</Text>
                      </>
                    )}
                  </LinearGradient>
                </TouchableOpacity>
              </View>

              {!searched && !loading && (
                <View style={styles.trendingSection}>
                  <View style={styles.trendingHeader}>
                    <Ionicons name="trending-up" size={18} color="#1DB954" />
                    <Text style={styles.trendingTitle}>Tendencias</Text>
                  </View>
                  <View style={styles.trendingChips}>
                    {trendingSearches.map((item, index) => (
                      <TouchableOpacity
                        key={index}
                        style={styles.trendingChip}
                        onPress={() => {
                          setQuery(item);
                          handleSearch();
                        }}
                      >
                        <Text style={styles.trendingChipText}>{item}</Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </View>
              )}

              {offlineMode && filteredResults.length === 0 && searched && !loading && (
                <BlurView intensity={40} tint="dark" style={styles.offlineInfo}>
                  <Ionicons name="information-circle" size={20} color="#1DB954" />
                  <Text style={styles.offlineInfoText}>
                    No hay canciones descargadas que coincidan con "{query}"
                  </Text>
                </BlurView>
              )}
            </View>
          </Animated.View>
        }
        ListEmptyComponent={
          searched && !loading ? (
            <Animated.View style={[styles.emptyContainer, { opacity: fadeAnim }]}>
              <BlurView intensity={30} tint="dark" style={styles.emptyCard}>
                <LinearGradient
                  colors={['rgba(29,185,84,0.2)', 'rgba(29,185,84,0.05)']}
                  style={styles.emptyGradient}
                >
                  <Ionicons 
                    name={offlineMode ? "cloud-offline-outline" : "search-outline"} 
                    size={60} 
                    color="rgba(255,255,255,0.2)" 
                  />
                  <Text style={styles.emptyTitle}>
                    {offlineMode ? 'Sin resultados' : 'No encontramos nada'}
                  </Text>
                  <Text style={styles.emptyText}>
                    {offlineMode 
                      ? `"${query}" no está en tus descargas`
                      : 'Prueba con otras palabras'}
                  </Text>
                </LinearGradient>
              </BlurView>
            </Animated.View>
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
          <BlurView intensity={40} tint="dark" style={styles.loadingFooter}>
            <ActivityIndicator size="large" color="#1DB954" />
            <Text style={styles.loadingText}>Buscando...</Text>
          </BlurView>
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
    backgroundColor: '#0A0A0A',
  },
  decorativeCircle1: {
    position: 'absolute',
    width: 200,
    height: 200,
    borderRadius: 100,
    backgroundColor: 'rgba(29,185,84,0.05)',
    top: -50,
    right: -50,
  },
  decorativeCircle2: {
    position: 'absolute',
    width: 150,
    height: 150,
    borderRadius: 75,
    backgroundColor: 'rgba(29,185,84,0.03)',
    bottom: -30,
    left: -30,
  },
  header: {
    paddingBottom: 20,
  },
  heroGradient: {
    marginHorizontal: 16,
    marginBottom: 20,
    borderRadius: 25,
    overflow: 'hidden',
  },
  hero: {
    padding: 20,
    alignItems: 'center',
  },
  heroBadge: {
    fontSize: 10,
    fontWeight: '600',
    color: 'rgba(255,255,255,0.5)',
    letterSpacing: 1.5,
    marginBottom: 8,
  },
  heroTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: '#FFF',
    textAlign: 'center',
    marginBottom: 4,
    textShadowColor: 'rgba(29,185,84,0.3)',
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 8,
  },
  heroSubtitle: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.5)',
    textAlign: 'center',
    lineHeight: 18,
  },
  offlineBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 25,
    gap: 6,
    marginTop: 12,
    backgroundColor: 'rgba(29,185,84,0.15)',
    borderWidth: 1,
    borderColor: 'rgba(29,185,84,0.3)',
  },
  offlineBadgeText: {
    color: '#FFF',
    fontSize: 11,
    fontWeight: '500',
  },
  searchWrapper: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    marginBottom: 20,
    gap: 8,
  },
  searchContainer: {
    flex: 1,
    borderRadius: 22,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  searchContent: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 10,
    gap: 8,
  },
  searchInput: {
    flex: 1,
    color: '#FFF',
    fontSize: 14,
    padding: 0,
    fontWeight: '400',
  },
  searchButton: {
    borderRadius: 22,
    overflow: 'hidden',
    shadowColor: '#1DB954',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.2,
    shadowRadius: 6,
    elevation: 6,
  },
  searchButtonDisabled: {
    opacity: 0.5,
  },
  searchButtonGradient: {
    paddingHorizontal: 18,
    paddingVertical: 10,
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: 60,
  },
  searchButtonText: {
    color: '#FFF',
    fontSize: 14,
    fontWeight: '600',
  },
  trendingSection: {
    paddingHorizontal: 16,
    marginBottom: 20,
  },
  trendingHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 10,
  },
  trendingTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#FFF',
  },
  trendingChips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  trendingChip: {
    backgroundColor: 'rgba(255,255,255,0.08)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  trendingChipText: {
    color: 'rgba(255,255,255,0.8)',
    fontSize: 12,
    fontWeight: '400',
  },
  offlineInfo: {
    marginHorizontal: 16,
    padding: 12,
    borderRadius: 18,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: 'rgba(29,185,84,0.1)',
    borderWidth: 1,
    borderColor: 'rgba(29,185,84,0.2)',
  },
  offlineInfoText: {
    flex: 1,
    color: '#FFF',
    fontSize: 12,
    lineHeight: 18,
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 20,
  },
  emptyCard: {
    width: width * 0.85,
    borderRadius: 25,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  emptyGradient: {
    alignItems: 'center',
    padding: 30,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#FFF',
    marginTop: 16,
    marginBottom: 6,
    textAlign: 'center',
  },
  emptyText: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.4)',
    textAlign: 'center',
    lineHeight: 18,
  },
  listContent: {
    paddingHorizontal: 16,
  },
  loadingFooter: {
    marginHorizontal: 16,
    marginVertical: 16,
    padding: 16,
    borderRadius: 18,
    alignItems: 'center',
    gap: 10,
    backgroundColor: 'rgba(255,255,255,0.05)',
  },
  loadingText: {
    color: 'rgba(255,255,255,0.6)',
    fontSize: 12,
    fontWeight: '400',
  },
});