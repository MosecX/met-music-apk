import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import React, { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Animated,
  Dimensions,
  Keyboard,
  StyleSheet,
  Text,
  TextInput,
  TextStyle,
  TouchableOpacity,
  View,
  ViewStyle
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import AddToPlaylistModal from '../../components/AddToPlaylistModal';
import TrackItem from '../../components/TrackItem';
import { usePlayer } from '../../context/PlayerContext';
import MonochromeAPI from '../../services/MonochromeAPI';
import storageService from '../../services/storage';
import { StoredTrack, Track as TrackType } from '../../types';

const { width, height } = Dimensions.get('window');
const OFFLINE_MODE_KEY = '@offline_mode';
const TAB_BAR_HEIGHT = 60;
const PLAYER_HEIGHT = 80;

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
  
  // 🎇 Animaciones de Orbes Líquidos y Contenido
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const orb1Y = useRef(new Animated.Value(0)).current;
  const orb2X = useRef(new Animated.Value(0)).current;
  const scrollY = useRef(new Animated.Value(0)).current;
  
  const { currentTrack, playTrack, isPlaying } = usePlayer();
  const playerOffset = currentTrack ? PLAYER_HEIGHT : 0;

  useEffect(() => {
    loadSettings();
    loadDownloads();
    
    // Animación de entrada de la UI
    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: 600,
      useNativeDriver: true,
    }).start();

    // Loop infinito de fluidos en el fondo para dar vida al cristal
    Animated.loop(
      Animated.sequence([
        Animated.timing(orb1Y, { toValue: 40, duration: 6000, useNativeDriver: true }),
        Animated.timing(orb1Y, { toValue: 0, duration: 6000, useNativeDriver: true }),
      ])
    ).start();

    Animated.loop(
      Animated.sequence([
        Animated.timing(orb2X, { toValue: -30, duration: 5000, useNativeDriver: true }),
        Animated.timing(orb2X, { toValue: 0, duration: 5000, useNativeDriver: true }),
      ])
    ).start();
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
    } catch (err) {
      console.error(err);
      setResults([]);
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
      if (offlineMode && !downloadedTracks.some(t => t.id === track.id)) {
        Alert.alert('📱 Modo Offline', 'Descarga la canción primero.');
        return;
      }

      // Mapeamos el array completo para inyectar un casteo limpio por si TypeScript se queja del isrc en local
      const trackQueue = filteredResults.map(t => ({
        ...t,
        isrc: (t as any).isrc || null // Nos aseguramos de propagar el ISRC de Monochrome al contexto
      }));

      playTrack(trackQueue[index] as any, trackQueue as any, index, 'search');
    }
  };

  const handleDownload = async (trackId: number) => {
    try {
      const trackToDownload = filteredResults.find(t => t.id === trackId);
      
      if (!trackToDownload) {
        Alert.alert('❌ Error', 'No se encontró la información de la canción.');
        return;
      }

      const audioUrl = await MonochromeAPI.getPlayableUrl(trackToDownload.id);
      
      const trackMetadata: StoredTrack = {
        ...trackToDownload,
        localUri: '',
        downloadedAt: Date.now(),
        isrc: (trackToDownload as any).isrc || null // Guardamos también el metadato ISRC en local
      };

      const success = await storageService.addDownloadedTrack(trackMetadata, audioUrl);
      
      if (success) {
        Alert.alert('📥 Descarga Exitosa', `"${trackToDownload.title}" se guardó en alta resolución.`);
        await loadDownloads();
      } else {
        Alert.alert('❌ Error', 'Ocurrió un problema guardando el archivo de audio.');
      }
    } catch (error) {
      console.error('Error al descargar track:', error);
      Alert.alert('❌ Error', 'No se pudo obtener el enlace de descarga.');
    }
  };

  const searchHeaderHeight = insets.top + 75;
  const headerTranslateY = scrollY.interpolate({
    inputRange: [0, 60],
    outputRange: [0, -10],
    extrapolate: 'clamp',
  });

  const trendingSearches = ['Lo más nuevo', 'Éxitos 2024', 'En Vivo', 'Remixes', 'Acústico', 'Reggaetón'];

  const featuredTrack = filteredResults[0];
  const remainingTracks = filteredResults.slice(1);

  return (
    <View style={styles.container}>
      {/* Fondo de Profundidad Absoluta */}
      <View style={styles.absoluteDark} />
      
      {/* 🔮 Orbes de Luz Líquida con Movimiento Orgánico */}
      <Animated.View style={[styles.liquidOrbGreen, { transform: [{ translateY: orb1Y }] }] as ViewStyle[]} />
      <Animated.View style={[styles.liquidOrbWhite, { transform: [{ translateX: orb2X }] }] as ViewStyle[]} />

      {/* 🛠️ CAPA 1: Dock de Búsqueda Flotante de Cristal Superior */}
      <Animated.View style={[styles.floatingHeaderContainer, { transform: [{ translateY: headerTranslateY }] }] as ViewStyle[]}>
        <BlurView intensity={70} tint="dark" style={[styles.glassDock, { paddingTop: insets.top + 8 }] as ViewStyle[]}>
          <View style={styles.searchRow}>
            <View style={styles.inputWrapper}>
              <Ionicons name="search" size={16} color="rgba(255,255,255,0.3)" style={styles.searchIcon as TextStyle} />
              <TextInput
                style={styles.searchInput}
                placeholder={offlineMode ? "Buscar descargas..." : "Artistas, álbumes, canciones..."}
                placeholderTextColor="rgba(255,255,255,0.2)"
                value={query}
                onChangeText={setQuery}
                onSubmitEditing={handleSearch}
                returnKeyType="search"
                selectionColor="#1DB954"
              />
              {query.length > 0 && (
                <TouchableOpacity onPress={clearSearch} style={styles.iconButton}>
                  <Ionicons name="close-circle-outline" size={16} color="rgba(255,255,255,0.4)" />
                </TouchableOpacity>
              )}
            </View>
            
            {offlineMode && (
              <View style={styles.offlineIndicator}>
                <View style={styles.pulseDot} />
              </View>
            )}
          </View>
        </BlurView>
      </Animated.View>

      {/* 🛠️ CAPA 2: Lista Editorial Asimétrica con Scroll */}
      <Animated.FlatList
        data={remainingTracks}
        keyExtractor={(item) => item.id.toString()}
        onScroll={Animated.event(
          [{ nativeEvent: { contentOffset: { y: scrollY } } }],
          { useNativeDriver: true }
        )}
        scrollEventThrottle={16}
        renderItem={({ item, index }) => (
          <Animated.View style={{ opacity: fadeAnim } as ViewStyle}>
            <TrackItem
              track={item}
              index={index + 1}
              isActive={currentTrack?.id === item.id}
              onPlay={() => handleTrackPress(index + 1)} // Corregido para reproducir el índice real mapeado
              onAddToPlaylist={(t) => { setSelectedTrackForPlaylist(t); setShowPlaylistModal(true); }}
              onDownload={handleDownload}
              showDownload={true}
              showFavorite={true}
            />
          </Animated.View>
        )}
        contentContainerStyle={[
          styles.scrollContainer,
          { paddingTop: searchHeaderHeight + 20, paddingBottom: TAB_BAR_HEIGHT + playerOffset + insets.bottom + 20 }
        ] as ViewStyle[]}
        ListHeaderComponent={
          <Animated.View style={{ opacity: fadeAnim } as ViewStyle}>
            {!searched && !loading && (
              <View style={styles.editorialIntro}>
                <Text style={styles.editorialSubtitle}>EXPLORA EL SONIDO</Text>
                <Text style={styles.editorialTitle}>Descubrir</Text>
                
                <View style={styles.trendingGrid}>
                  {trendingSearches.map((item, index) => (
                    <TouchableOpacity
                      key={index}
                      style={styles.editorialCardChip}
                      onPress={() => {
                        setQuery(item);
                        setTimeout(() => handleSearch(), 50);
                      }}
                    >
                      <LinearGradient
                        colors={['rgba(255,255,255,0.03)', 'rgba(255,255,255,0.005)']}
                        style={styles.chipGradient}
                      >
                        <Text style={styles.chipText}>{item}</Text>
                        <Ionicons name="arrow-forward-circle-outline" size={14} color="rgba(255,255,255,0.2)" />
                      </LinearGradient>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>
            )}

            {/* 🌟 TARJETA ASIMÉTRICA DESTACADA (BEST MATCH) */}
            {searched && featuredTrack && (
              <View style={styles.featuredSection}>
                <Text style={styles.sectionLabel}>Resultado principal</Text>
                <TouchableOpacity 
                  activeOpacity={0.9} 
                  onPress={() => handleTrackPress(0)}
                  style={styles.featuredGlassContainer}
                >
                  <BlurView intensity={25} tint="light" style={styles.featuredGlassCard as ViewStyle}>
                    <View style={styles.featuredDetails}>
                      <View style={styles.featuredMeta}>
                        <Text style={styles.featuredTrackName} numberOfLines={1}>{featuredTrack.title}</Text>
                        <Text style={styles.featuredArtistName} numberOfLines={1}>{featuredTrack.artist}</Text>
                      </View>
                      <View style={styles.playFabContainer}>
                        <LinearGradient colors={['#1DB954', '#147a35']} style={styles.playFab}>
                          <Ionicons name={currentTrack?.id === featuredTrack.id && isPlaying ? "pause" : "play"} size={20} color="#FFF" />
                        </LinearGradient>
                      </View>
                    </View>
                  </BlurView>
                </TouchableOpacity>
                {remainingTracks.length > 0 && <Text style={styles.sectionLabelNext}>Siguientes resultados</Text>}
              </View>
            )}

            {loading && (
              <View style={styles.loaderContainer}>
                <ActivityIndicator size="small" color="#1DB954" />
              </View>
            )}
          </Animated.View>
        }
        ListEmptyComponent={
          searched && !loading && filteredResults.length === 0 ? (
            <BlurView intensity={10} tint="dark" style={styles.emptyEditorialBox as ViewStyle}>
              <Text style={styles.emptyEditorialTitle}>Vacío absoluto</Text>
              <Text style={styles.emptyEditorialText}>No hay registros locales ni remotos para tu criterio.</Text>
            </BlurView>
          ) : null
        }
        showsVerticalScrollIndicator={false}
      />

      <AddToPlaylistModal
        visible={showPlaylistModal}
        onClose={() => { setShowPlaylistModal(false); setSelectedTrackForPlaylist(null); }}
        track={selectedTrackForPlaylist as StoredTrack | null}
        onAdded={() => {}}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#020202',
  },
  absoluteDark: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#030303',
  },
  liquidOrbGreen: {
    position: 'absolute',
    width: width * 0.9,
    height: width * 0.9,
    borderRadius: (width * 0.9) / 2,
    backgroundColor: 'rgba(29,185,84,0.05)',
    top: -80,
    right: -40,
  },
  liquidOrbWhite: {
    position: 'absolute',
    width: width * 0.5,
    height: width * 0.5,
    borderRadius: (width * 0.5) / 2,
    backgroundColor: 'rgba(255,255,255,0.012)',
    top: height * 0.4,
    left: -50,
  },
  floatingHeaderContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 10,
  },
  glassDock: {
    borderBottomWidth: 1,
    borderColor: 'rgba(255,255,255,0.04)',
    paddingBottom: 12,
    paddingHorizontal: 16,
    backgroundColor: 'rgba(6,6,6,0.3)',
  },
  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  inputWrapper: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    height: 42,
    borderRadius: 14,
    backgroundColor: 'rgba(255,255,255,0.02)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
    paddingHorizontal: 12,
  },
  searchIcon: {
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    color: '#FFF',
    fontSize: 14,
    fontWeight: '300',
  },
  iconButton: {
    padding: 4,
  },
  offlineIndicator: {
    justifyContent: 'center',
    alignItems: 'center',
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: 'rgba(29,185,84,0.1)',
  },
  pulseDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#1DB954',
  },
  scrollContainer: {
    paddingHorizontal: 0,
  },
  editorialIntro: {
    paddingHorizontal: 24,
    marginTop: 15,
  },
  editorialSubtitle: {
    fontSize: 10,
    fontWeight: '700',
    color: 'rgba(255,255,255,0.3)',
    letterSpacing: 2,
    marginBottom: 4,
  },
  editorialTitle: {
    fontSize: 36,
    fontWeight: '800',
    color: '#FFF',
    letterSpacing: -1,
    marginBottom: 24,
  },
  trendingGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  editorialCardChip: {
    width: (width - 58) / 2,
    borderRadius: 16,
    overflow: 'hidden',
  },
  chipGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.04)',
    gap: 8,
  },
  chipText: {
    flex: 1,
    color: 'rgba(255,255,255,0.7)',
    fontSize: 13,
    fontWeight: '400',
  },
  featuredSection: {
    paddingHorizontal: 20,
    marginBottom: 20,
  },
  sectionLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: 'rgba(255,255,255,0.3)',
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: 12,
  },
  sectionLabelNext: {
    fontSize: 11,
    fontWeight: '600',
    color: 'rgba(255,255,255,0.3)',
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginTop: 24,
    marginBottom: 4,
  },
  featuredGlassContainer: {
    borderRadius: 24,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.3,
    shadowRadius: 20,
    elevation: 8,
  },
  featuredGlassCard: {
    backgroundColor: 'rgba(255,255,255,0.02)',
    padding: 24,
    height: 120,
    justifyContent: 'flex-end',
  },
  featuredDetails: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  featuredMeta: {
    flex: 1,
    marginRight: 16,
  },
  featuredTrackName: {
    fontSize: 22,
    fontWeight: '700',
    color: '#FFF',
    letterSpacing: -0.5,
    marginBottom: 4,
  },
  featuredArtistName: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.4)',
    fontWeight: '400',
  },
  playFabContainer: {
    borderRadius: 25,
    overflow: 'hidden',
  },
  playFab: {
    width: 46,
    height: 46,
    borderRadius: 23,
    alignItems: 'center',
    justifyContent: 'center',
  },
  loaderContainer: {
    padding: 30,
    alignItems: 'center',
  },
  emptyEditorialBox: {
    marginHorizontal: 24,
    padding: 32,
    borderRadius: 20,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.03)',
    backgroundColor: 'rgba(255,255,255,0.005)',
    marginTop: 40,
  },
  emptyEditorialTitle: {
    color: 'rgba(255,255,255,0.5)',
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 4,
  },
  emptyEditorialText: {
    color: 'rgba(255,255,255,0.25)',
    fontSize: 12,
    textAlign: 'center',
  },
});