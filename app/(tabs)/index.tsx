import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import React, { memo, useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Animated,
  Dimensions,
  RefreshControl,
  StyleSheet,
  Text,
  View,
  ViewStyle,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import ScreenWrapper from '../../components/ScreenWrapper';
import TrackItem from '../../components/TrackItem';

import { usePlayer } from '../../context/PlayerContext';
import MonochromeAPI from '../../services/MonochromeAPI';
import PlayHistoryService from '../../services/PlayHistoryService';
import storageService from '../../services/storage';
import { StoredTrack } from '../../types';

// ✅ Corregido el crash: Extraídos 'width' y 'height' correctamente
const { width, height } = Dimensions.get('window');
const OFFLINE_MODE_KEY = '@offline_mode';
const TAB_BAR_HEIGHT = 60;
const PLAYER_HEIGHT = 80;

// Componente optimizado para la animación en cascada de los items
const AnimatedTrackItem = memo(({ item, index, isActive, onPlay }: { 
  item: StoredTrack; 
  index: number; 
  isActive: boolean; 
  onPlay: (idx: number) => void; 
}) => {
  const itemFade = useRef(new Animated.Value(0)).current;
  const itemTranslateY = useRef(new Animated.Value(20)).current;

  useEffect(() => {
    // Animación escalonada basada en su posición (Stagger effect)
    Animated.parallel([
      Animated.timing(itemFade, {
        toValue: 1,
        duration: 400,
        delay: Math.min(index * 40, 400),
        useNativeDriver: true,
      }),
      Animated.timing(itemTranslateY, {
        toValue: 0,
        duration: 400,
        delay: Math.min(index * 40, 400),
        useNativeDriver: true,
      })
    ]).start();
  }, [index]);

  return (
    <Animated.View style={{ opacity: itemFade, transform: [{ translateY: itemTranslateY }] } as ViewStyle}>
      <TrackItem
        track={item}
        index={index}
        isActive={isActive}
        onPlay={onPlay}
        showDownload={true}
        showFavorite={true}
      />
    </Animated.View>
  );
});

export default function HomeScreen() {
  const insets = useSafeAreaInsets();
  const [recommendations, setRecommendations] = useState<StoredTrack[]>([]);
  const [filteredRecommendations, setFilteredRecommendations] = useState<StoredTrack[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [offlineMode, setOfflineMode] = useState(false);
  const [downloadedTracks, setDownloadedTracks] = useState<StoredTrack[]>([]);
  const [lastPlayedInfo, setLastPlayedInfo] = useState<string>('');
  
  // 🔮 Animaciones e interpolaciones dinámicas
  const orb1Y = useRef(new Animated.Value(0)).current;
  const orb2X = useRef(new Animated.Value(0)).current;
  const scrollY = useRef(new Animated.Value(0)).current;

  const { currentTrack, playTrack } = usePlayer();
  const playerOffset = currentTrack ? PLAYER_HEIGHT : 0;

  useEffect(() => {
    loadSettings();
    loadDownloads();

    // Bucles orgánicos infinitos para los fluidos del fondo
    Animated.loop(
      Animated.sequence([
        Animated.timing(orb1Y, { toValue: 40, duration: 8000, useNativeDriver: true }),
        Animated.timing(orb1Y, { toValue: 0, duration: 8000, useNativeDriver: true }),
      ])
    ).start();

    Animated.loop(
      Animated.sequence([
        Animated.timing(orb2X, { toValue: -30, duration: 7000, useNativeDriver: true }),
        Animated.timing(orb2X, { toValue: 0, duration: 7000, useNativeDriver: true }),
      ])
    ).start();
  }, []);

  useEffect(() => {
    if (offlineMode && downloadedTracks.length > 0) {
      const downloadedIds = downloadedTracks.map(t => t.id);
      setFilteredRecommendations(recommendations.filter(t => downloadedIds.includes(t.id)));
    } else {
      setFilteredRecommendations(recommendations);
    }
  }, [offlineMode, downloadedTracks, recommendations]);

  const loadRecommendations = useCallback(async () => {
    try {
      setLoading(true);
      const recentIds = await PlayHistoryService.getRecentTrackIds(5);
      const lastPlayed = await PlayHistoryService.getLastPlayed();
      
      let tracks: StoredTrack[] = [];
      
      if (recentIds.length > 0) {
        if (lastPlayed) {
          setLastPlayedInfo(`Basado en tu historial · ${lastPlayed.track.title} ${lastPlayed.track.artist ? `· ${lastPlayed.track.artist}` : ''}`);
        }
        tracks = await MonochromeAPI.getRecommendationsFromHistory(recentIds, 30);
        
        if (tracks.length < 10) {
          const generalTracks = await MonochromeAPI.getRecommendations(424698825);
          const existingIds = new Set(tracks.map(t => t.id));
          const newTracks = generalTracks.filter(t => !existingIds.has(t.id));
          tracks = [...tracks, ...newTracks.slice(0, 10 - tracks.length)];
        }
      } else {
        setLastPlayedInfo('Descubre música nueva');
        tracks = await MonochromeAPI.getRecommendations(424698825);
      }
      
      const shuffled = [...tracks];
      for (let i = shuffled.length - 1; i > 0; i--) {
        if (Math.random() > 0.7) {
          const j = Math.floor(Math.random() * (i + 1));
          [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
        }
      }
      
      setRecommendations(shuffled);
    } catch (error) {
      console.log('❌ Error loading recommendations:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [offlineMode]);

  useEffect(() => {
    loadRecommendations();
  }, [offlineMode, loadRecommendations]);

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

  const handleRefresh = () => {
    setRefreshing(true);
    loadRecommendations();
  };

  const handleTrackPress = (index: number) => {
    const track = filteredRecommendations[index];
    if (track) {
      if (offlineMode && !downloadedTracks.some(t => t.id === track.id)) {
        Alert.alert('📱 Modo Offline', 'Esta canción no está disponible sin conexión.');
        return;
      }
      playTrack(track, filteredRecommendations, index, 'recommendations');
    }
  };

  // Interpolación del Header al hacer Scroll (Efecto desvanecido sofisticado)
  const headerOpacity = scrollY.interpolate({
    inputRange: [0, 120],
    outputRange: [1, 0.3],
    extrapolate: 'clamp',
  });

  const headerScale = scrollY.interpolate({
    inputRange: [-50, 0],
    outputRange: [1.05, 1],
    extrapolate: 'clamp',
  });

  if (loading) {
    return (
      <ScreenWrapper>
        <LinearGradient colors={['#0A0A0A', '#1A1A1A']} style={StyleSheet.absoluteFill} />
        <View style={styles.centerContainer}>
          <ActivityIndicator size="large" color="#1DB954" />
          <Text style={styles.loadingText}>Cargando tu música...</Text>
        </View>
      </ScreenWrapper>
    );
  }

  return (
    <ScreenWrapper>
      <LinearGradient colors={['#050505', '#121212', '#050505']} style={StyleSheet.absoluteFill} />
      
      {/* 🔮 Orbes Líquidos en Background */}
      <Animated.View style={[styles.decorativeCircle1, { transform: [{ translateY: orb1Y }] }] as ViewStyle[]} />
      <Animated.View style={[styles.decorativeCircle2, { transform: [{ translateX: orb2X }] }] as ViewStyle[]} />

      <Animated.FlatList
        data={filteredRecommendations}
        keyExtractor={(item) => item.id.toString()}
        onScroll={Animated.event(
          [{ nativeEvent: { contentOffset: { y: scrollY } } }],
          { useNativeDriver: true }
        )}
        scrollEventThrottle={16}
        renderItem={({ item, index }) => (
          <AnimatedTrackItem
            item={item}
            index={index}
            isActive={currentTrack?.id === item.id}
            onPlay={handleTrackPress}
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
          <Animated.View style={[styles.header, { paddingTop: insets.top + 10, opacity: headerOpacity, transform: [{ scale: headerScale }] }] as ViewStyle[]}>
            <LinearGradient
              colors={['rgba(29,185,84,0.18)', 'rgba(29,185,84,0.02)']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.heroGradient}
            >
              <View style={styles.hero}>
                <Text style={styles.greeting}>Bienvenido a</Text>
                <Text style={styles.title}>MetMusic</Text>
                
                {offlineMode && (
                  <BlurView intensity={40} tint="dark" style={styles.offlineBadge as ViewStyle}>
                    <Ionicons name="cloud-outline" size={14} color="#1DB954" />
                    <Text style={styles.offlineBadgeText}>Modo offline activado</Text>
                  </BlurView>
                )}
              </View>
            </LinearGradient>

            {lastPlayedInfo && !offlineMode && (
              <BlurView intensity={40} tint="dark" style={styles.infoContainer as ViewStyle}>
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
          </Animated.View>
        }
        ListEmptyComponent={
          offlineMode && filteredRecommendations.length === 0 ? (
            <View style={styles.emptyContainer}>
              <BlurView intensity={30} tint="dark" style={styles.emptyCard as ViewStyle}>
                <LinearGradient colors={['rgba(29,185,84,0.15)', 'rgba(29,185,84,0.02)']} style={styles.emptyGradient}>
                  <Ionicons name="cloud-offline-outline" size={70} color="rgba(255,255,255,0.15)" />
                  <Text style={styles.emptyTitle}>Modo offline</Text>
                  <Text style={styles.emptyText}>No hay recomendaciones disponibles sin conexión</Text>
                  <View style={styles.emptyDivider} />
                  <Text style={styles.emptyHint}>💡 Para escuchar música sin internet:</Text>
                  <View style={styles.stepsContainer}>
                    <View style={styles.step}>
                      <View style={styles.stepNumber}><Text style={styles.stepNumberText}>1</Text></View>
                      <Text style={styles.stepText}>Ve a <Text style={styles.stepHighlight}>Biblioteca</Text></Text>
                    </View>
                    <View style={styles.step}>
                      <View style={styles.stepNumber}><Text style={styles.stepNumberText}>2</Text></View>
                      <Text style={styles.stepText}>Elige una <Text style={styles.stepHighlight}>playlist</Text></Text>
                    </View>
                    <View style={styles.step}>
                      <View style={styles.stepNumber}><Text style={styles.stepNumberText}>3</Text></View>
                      <Text style={styles.stepText}>Toca <Ionicons name="cloud-download-outline" size={14} color="#1DB954" /> para descargar</Text>
                    </View>
                  </View>
                  <Text style={styles.emptyNote}>Las canciones descargadas aparecerán aquí</Text>
                </LinearGradient>
              </BlurView>
            </View>
          ) : null
        }
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[
          styles.listContent,
          { paddingBottom: TAB_BAR_HEIGHT + playerOffset + insets.bottom + 20 }
        ]}
      />
    </ScreenWrapper>
  );
}

const styles = StyleSheet.create({
  decorativeCircle1: {
    position: 'absolute',
    width: 280,
    height: 280,
    borderRadius: 140,
    backgroundColor: 'rgba(29,185,84,0.035)',
    top: -50,
    right: -60,
  },
  decorativeCircle2: {
    position: 'absolute',
    width: 220,
    height: 220,
    borderRadius: 110,
    backgroundColor: 'rgba(29,185,84,0.015)',
    bottom: height * 0.15,
    left: -60,
  },
  header: {
    paddingBottom: 15,
  },
  heroGradient: {
    marginHorizontal: 16,
    marginBottom: 16,
    borderRadius: 24,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.03)',
  },
  hero: {
    paddingVertical: 32,
    paddingHorizontal: 24,
    alignItems: 'center',
  },
  greeting: {
    color: 'rgba(255,255,255,0.4)',
    fontSize: 12,
    fontWeight: '600',
    letterSpacing: 2,
    textTransform: 'uppercase',
    marginBottom: 4,
  },
  title: {
    fontSize: 40,
    fontWeight: '900',
    color: '#FFF',
    marginBottom: 14,
    letterSpacing: -0.8,
    textShadowColor: 'rgba(29,185,84,0.3)',
    textShadowOffset: { width: 0, height: 4 },
    textShadowRadius: 15,
  },
  offlineBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 20,
    gap: 6,
    backgroundColor: 'rgba(29,185,84,0.12)',
    borderWidth: 1,
    borderColor: 'rgba(29,185,84,0.25)',
  },
  offlineBadgeText: {
    color: 'rgba(255,255,255,0.9)',
    fontSize: 12,
    fontWeight: '500',
  },
  infoContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: 16,
    marginBottom: 20,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 16,
    gap: 10,
    backgroundColor: 'rgba(255,255,255,0.015)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.04)',
  },
  infoText: {
    flex: 1,
    color: 'rgba(255,255,255,0.65)',
    fontSize: 13,
    fontWeight: '400',
    lineHeight: 18,
  },
  sectionHeader: {
    marginHorizontal: 16,
    marginBottom: 12,
    position: 'relative',
  },
  sectionGradient: {
    position: 'absolute',
    left: 0,
    top: 2,
    bottom: 2,
    width: 3,
    borderRadius: 1.5,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#FFF',
    marginLeft: 14,
    letterSpacing: -0.3,
  },
  listContent: {
    paddingHorizontal: 0,
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
    fontWeight: '300',
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 16,
    paddingTop: 10,
  },
  emptyCard: {
    width: '100%',
    borderRadius: 24,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.05)',
  },
  emptyGradient: {
    alignItems: 'center',
    padding: 24,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#FFF',
    marginTop: 14,
    marginBottom: 6,
  },
  emptyText: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.5)',
    textAlign: 'center',
    lineHeight: 18,
    marginBottom: 16,
  },
  emptyDivider: {
    width: '40%',
    height: 1,
    backgroundColor: 'rgba(255,255,255,0.08)',
    marginVertical: 12,
  },
  emptyHint: {
    fontSize: 13,
    color: '#1DB954',
    fontWeight: '600',
    marginBottom: 12,
  },
  stepsContainer: {
    width: '100%',
    marginBottom: 10,
  },
  step: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
  },
  stepNumber: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: 'rgba(29,185,84,0.15)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 10,
    borderWidth: 1,
    borderColor: 'rgba(29,185,84,0.25)',
  },
  stepNumberText: {
    color: '#1DB954',
    fontSize: 11,
    fontWeight: 'bold',
  },
  stepText: {
    flex: 1,
    fontSize: 13,
    color: 'rgba(255,255,255,0.8)',
  },
  stepHighlight: {
    color: '#1DB954',
    fontWeight: '600',
  },
  emptyNote: {
    fontSize: 11,
    color: 'rgba(255,255,255,0.25)',
    textAlign: 'center',
    marginTop: 6,
  },
});