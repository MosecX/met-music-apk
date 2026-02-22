// components/Player.tsx - VERSIÓN COMPLETA CON MODALES FUNCIONALES
import { Ionicons } from '@expo/vector-icons';
import Slider from '@react-native-community/slider';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import React, { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Animated,
  Dimensions,
  Image,
  Linking,
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View
} from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Reanimated, {
  Extrapolate,
  interpolate,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withTiming
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { usePlayer } from '../context/PlayerContext';
import LyricsService from '../services/LyricsService';
import AddToPlaylistModal from './AddToPlaylistModal';

const { width, height } = Dimensions.get('window');

interface PlayerProps {
  track: any;
  onClose: () => void;
}

const Player = ({ track, onClose }: PlayerProps) => {
  const { 
    isPlaying, 
    position, 
    duration, 
    togglePlayPause,
    playNext,
    playPrevious,
    hasNext,
    hasPrev,
    shuffleMode,
    repeatMode,
    toggleShuffle,
    toggleRepeat,
    queueLength,
    currentPosition,
    queue,
    seekTo,
    playTrackAtIndex
  } = usePlayer();

  // Estados
  const [isExpanded, setIsExpanded] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [lyricsVisible, setLyricsVisible] = useState(false);
  const [lyrics, setLyrics] = useState<any[]>([]);
  const [unsyncedLyrics, setUnsyncedLyrics] = useState<string[]>([]);
  const [currentLyric, setCurrentLyric] = useState('');
  const [loadingLyrics, setLoadingLyrics] = useState(false);
  const [lyricsProvider, setLyricsProvider] = useState<string | null>(null);
  const [showQueue, setShowQueue] = useState(false);
  const [showPlaylistModal, setShowPlaylistModal] = useState(false);
  const [lyricsContainerHeight, setLyricsContainerHeight] = useState(0);
  const [lyricsItemHeight, setLyricsItemHeight] = useState(60);
  
  // Estados para el slider
  const [sliderValue, setSliderValue] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  
  // Refs y animaciones
  const scrollViewRef = useRef<ScrollView>(null);
  const lyricsScrollRef = useRef<ScrollView>(null);
  const insets = useSafeAreaInsets();
  const expandAnim = useSharedValue(0);
  const panY = useSharedValue(0);
  const lastActiveIndex = useRef(-1);
  const TAB_BAR_HEIGHT = 60;

  // Animaciones con Animated de React Native
  const decorativeScale1 = useRef(new Animated.Value(1)).current;
  const decorativeScale2 = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(decorativeScale1, {
          toValue: 1.2,
          duration: 3000,
          useNativeDriver: true,
        }),
        Animated.timing(decorativeScale1, {
          toValue: 1,
          duration: 3000,
          useNativeDriver: true,
        }),
      ])
    ).start();

    Animated.loop(
      Animated.sequence([
        Animated.timing(decorativeScale2, {
          toValue: 1.3,
          duration: 4000,
          useNativeDriver: true,
        }),
        Animated.timing(decorativeScale2, {
          toValue: 1,
          duration: 4000,
          useNativeDriver: true,
        }),
      ])
    ).start();
  }, []);

  // Actualizar slider cuando la posición cambia (pero no mientras arrastramos)
  useEffect(() => {
    if (!isDragging) {
      setSliderValue(position);
    }
  }, [position, isDragging]);

  const progress = duration > 0 ? (position / duration) * 100 : 0;

  // Obtener etiqueta de calidad
  const getQualityBadge = () => {
    if (!track?.quality) return null;
    
    let badgeColor = '#1DB954';
    let badgeText = 'HIGH';
    
    if (track.quality.includes('HI_RES')) {
      badgeColor = '#1DB954';
      badgeText = 'HI-RES';
    } else if (track.quality.includes('LOSSLESS')) {
      badgeColor = '#A855F7';
      badgeText = 'LOSSLESS';
    }
    
    return { badgeColor, badgeText };
  };

  const qualityBadge = getQualityBadge();

  // AUTO-NEXT cuando termina la canción
  useEffect(() => {
    if (duration > 0 && position >= duration - 100) {
      console.log('🎵 Canción terminada, pasando a la siguiente');
      playNext();
    }
  }, [position, duration]);

  // Gestos para expandir/contraer
  const panGesture = Gesture.Pan()
    .onUpdate((event) => {
      if (event.translationY < 0 && !isExpanded) {
        panY.value = event.translationY;
      } else if (event.translationY > 0 && isExpanded) {
        panY.value = event.translationY;
      }
    })
    .onEnd((event) => {
      if (!isExpanded && event.translationY < -20) {
        runOnJS(setIsExpanded)(true);
      } else if (isExpanded && event.translationY > 20) {
        runOnJS(setIsExpanded)(false);
      }
      panY.value = withTiming(0, { duration: 150 });
    });

  // Animación de expansión
  useEffect(() => {
    if (isExpanded) {
      expandAnim.value = withTiming(1, { duration: 200 });
    } else {
      expandAnim.value = withTiming(0, { duration: 200 });
    }
  }, [isExpanded]);

  // Altura disponible
  const availableHeight = height - TAB_BAR_HEIGHT - insets.bottom;

  // Estilos animados con Reanimated
  const containerStyle = useAnimatedStyle(() => ({
    position: 'absolute',
    left: 0,
    right: 0,
    height: interpolate(
      expandAnim.value,
      [0, 1],
      [70, availableHeight],
      Extrapolate.CLAMP
    ),
    bottom: 0,
    transform: [{ translateY: panY.value }]
  }));

  const miniOpacity = useAnimatedStyle(() => ({
    opacity: interpolate(expandAnim.value, [0, 0.1, 1], [1, 0, 0]),
  }));

  const expandedOpacity = useAnimatedStyle(() => ({
    opacity: interpolate(expandAnim.value, [0, 0.9, 1], [0, 0, 1]),
  }));

  // Simular carga
  useEffect(() => {
    setIsLoading(true);
    const timer = setTimeout(() => {
      setIsLoading(false);
    }, 500);
    return () => clearTimeout(timer);
  }, [track?.id]);

  // Cargar letras
  useEffect(() => {
    if (lyricsVisible && track) {
      loadLyrics();
    }
  }, [lyricsVisible, track?.id]);

  const loadLyrics = async () => {
    setLoadingLyrics(true);
    setLyrics([]);
    setUnsyncedLyrics([]);
    
    try {
      const lyricsData = await LyricsService.getLyrics(track);
      
      if (lyricsData) {
        setLyrics(lyricsData.synced || []);
        setUnsyncedLyrics(lyricsData.unsynced || []);
        setLyricsProvider(lyricsData.provider);
        console.log(`✅ Letras cargadas de: ${lyricsData.provider}`);
      }
    } catch (error) {
      console.log('❌ Error cargando letras:', error);
    } finally {
      setLoadingLyrics(false);
    }
  };

  // Sincronizar letras con la reproducción
  useEffect(() => {
    if (!lyrics.length || !lyricsVisible || !lyricsScrollRef.current || lyricsContainerHeight === 0) return;
    
    const currentSeconds = position / 1000;
    
    let activeIndex = -1;
    for (let i = 0; i < lyrics.length; i++) {
      if (lyrics[i].time <= currentSeconds) {
        activeIndex = i;
      } else {
        break;
      }
    }
    
    if (activeIndex >= 0) {
      const activeLine = lyrics[activeIndex];
      if (activeLine.text !== currentLyric) {
        setCurrentLyric(activeLine.text);
      }
      
      if (lastActiveIndex.current !== activeIndex) {
        lastActiveIndex.current = activeIndex;
        
        setTimeout(() => {
          if (lyricsScrollRef.current) {
            const targetY = (activeIndex * lyricsItemHeight) - (lyricsContainerHeight / 2) + (lyricsItemHeight / 2);
            lyricsScrollRef.current.scrollTo({
              y: Math.max(0, targetY),
              animated: true
            });
          }
        }, 10);
      }
    }
  }, [position, lyrics, lyricsVisible, lyricsContainerHeight]);

  const formatTime = (millis: number) => {
    if (!millis) return '0:00';
    const minutes = Math.floor(millis / 60000);
    const seconds = Math.floor((millis % 60000) / 1000);
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  };

  const getRepeatIcon = () => {
    switch(repeatMode) {
      case 'one': return 'repeat';
      case 'all': return 'repeat';
      default: return 'repeat-outline';
    }
  };

  const getRepeatColor = () => {
    switch(repeatMode) {
      case 'one': return '#1DB954';
      case 'all': return '#1DB954';
      default: return 'rgba(255,255,255,0.5)';
    }
  };

  const handleQueueItemPress = (index: number) => {
    playTrackAtIndex(index);
    setShowQueue(false);
  };

  // Estilos animados para círculos decorativos
  const circle1Style = {
    transform: [{ scale: decorativeScale1 }]
  };

  const circle2Style = {
    transform: [{ scale: decorativeScale2 }]
  };

  return (
    <GestureDetector gesture={panGesture}>
      <Reanimated.View style={[styles.mainContainer, containerStyle]}>
        {/* Fondo con blur para el mini player */}
        {!isExpanded && (
          <BlurView
            intensity={80}
            tint="dark"
            style={styles.miniBlur}
          />
        )}
        
        {/* Gradiente de fondo para el expanded player */}
        {isExpanded && (
          <LinearGradient
            colors={['#0A0A0A', '#1A1A1A', '#000000']}
            locations={[0, 0.5, 1]}
            style={StyleSheet.absoluteFill}
          />
        )}
        
        {/* Elementos decorativos animados */}
        {isExpanded && (
          <>
            <Animated.View style={[styles.decorativeCircle1, circle1Style]} />
            <Animated.View style={[styles.decorativeCircle2, circle2Style]} />
          </>
        )}

        {/* MODO MINI */}
        <Reanimated.View 
          style={[
            styles.miniContainer, 
            miniOpacity,
            { pointerEvents: isExpanded ? 'none' : 'auto' }
          ]}
        >
          <View style={styles.miniContent}>
            <TouchableOpacity 
              style={styles.miniTrackInfo}
              onPress={() => setIsExpanded(true)}
              activeOpacity={0.7}
            >
              <Image source={{ uri: track.coverUrl }} style={styles.miniCover} />
              <View style={styles.miniTextContainer}>
                <Text style={styles.miniTitle} numberOfLines={1}>{track.title}</Text>
                <Text style={styles.miniArtist} numberOfLines={1}>{track.artist}</Text>
              </View>
            </TouchableOpacity>

            <View style={styles.miniControls}>
              <TouchableOpacity onPress={playPrevious} disabled={!hasPrev}>
                <Ionicons name="play-skip-back" size={22} color={hasPrev ? '#FFF' : '#444'} />
              </TouchableOpacity>

              <TouchableOpacity 
                style={styles.miniPlayButton}
                onPress={togglePlayPause}
                disabled={isLoading}
              >
                {isLoading ? (
                  <ActivityIndicator size="small" color="#1DB954" />
                ) : (
                  <Ionicons name={isPlaying ? 'pause' : 'play'} size={20} color="#1DB954" />
                )}
              </TouchableOpacity>

              <TouchableOpacity onPress={playNext} disabled={!hasNext}>
                <Ionicons name="play-skip-forward" size={22} color={hasNext ? '#FFF' : '#444'} />
              </TouchableOpacity>

              <TouchableOpacity onPress={onClose}>
                <Ionicons name="close" size={20} color="#666" />
              </TouchableOpacity>
            </View>
          </View>
          <View style={styles.miniProgressBar}>
            <View style={[styles.progressFill, { width: `${progress}%` }]} />
          </View>
        </Reanimated.View>

        {/* MODO EXPANDIDO */}
        <Reanimated.View 
          style={[
            styles.expandedContainer, 
            expandedOpacity,
            { pointerEvents: isExpanded ? 'auto' : 'none' }
          ]}
        >
          {/* Header */}
          <View style={[styles.expandedHeader, { paddingTop: insets.top + 20 }]}>
            <TouchableOpacity 
              hitSlop={{ top: 15, bottom: 15, left: 15, right: 15 }}
              onPress={() => setIsExpanded(false)}
              style={styles.headerButton}
            >
              <Ionicons name="chevron-down" size={24} color="#FFF" />
            </TouchableOpacity>
            <Text style={styles.expandedHeaderTitle}>REPRODUCIENDO</Text>
            <TouchableOpacity 
              hitSlop={{ top: 15, bottom: 15, left: 15, right: 15 }}
              onPress={onClose}
              style={styles.headerButton}
            >
              <Ionicons name="close" size={22} color="#FFF" />
            </TouchableOpacity>
          </View>

          <ScrollView 
            ref={scrollViewRef}
            style={styles.expandedScroll}
            contentContainerStyle={styles.expandedContent}
            showsVerticalScrollIndicator={false}
            bounces={false}
            scrollEnabled={!isDragging}
          >
            <View style={{ height: 10 }} />
            
            <View style={styles.coverWrapper}>
              <LinearGradient
                colors={['rgba(29,185,84,0.3)', 'transparent']}
                style={styles.coverGlow}
              />
              <Image 
                source={{ uri: track.coverUrl }} 
                style={styles.expandedCover}
              />
              {qualityBadge && (
                <BlurView intensity={60} tint="dark" style={[styles.coverBadge, { backgroundColor: qualityBadge.badgeColor + '30' }]}>
                  <Text style={[styles.coverBadgeText, { color: qualityBadge.badgeColor }]}>
                    {qualityBadge.badgeText}
                  </Text>
                </BlurView>
              )}
            </View>

            <View style={styles.expandedTrackInfo}>
              <Text style={styles.expandedTitle} numberOfLines={2}>{track.title}</Text>
              <Text style={styles.expandedArtist} numberOfLines={1}>{track.artist}</Text>
            </View>

            <View style={styles.expandedProgressContainer}>
              <View style={styles.timeLabels}>
                <Text style={styles.timeText}>{formatTime(isDragging ? sliderValue : position)}</Text>
                <Text style={styles.timeText}>{formatTime(duration)}</Text>
              </View>
              <Slider
                style={styles.expandedSlider}
                value={sliderValue}
                minimumValue={0}
                maximumValue={duration || 1}
                onValueChange={(value) => {
                  setIsDragging(true);
                  setSliderValue(value);
                }}
                onSlidingComplete={(value) => {
                  seekTo(value / 1000);
                  setIsDragging(false);
                }}
                minimumTrackTintColor="#1DB954"
                maximumTrackTintColor="rgba(255,255,255,0.1)"
                thumbTintColor="#1DB954"
              />
            </View>

            <View style={styles.expandedControlsRow}>
              <TouchableOpacity onPress={toggleShuffle} style={styles.controlButton}>
                <Ionicons name="shuffle" size={22} color={shuffleMode ? '#1DB954' : 'rgba(255,255,255,0.5)'} />
              </TouchableOpacity>

              <TouchableOpacity onPress={playPrevious} disabled={!hasPrev} style={styles.controlButton}>
                <Ionicons name="play-skip-back" size={28} color={hasPrev ? '#FFF' : 'rgba(255,255,255,0.2)'} />
              </TouchableOpacity>

              <TouchableOpacity 
                style={styles.expandedPlayButton} 
                onPress={togglePlayPause}
                disabled={isLoading}
              >
                <LinearGradient
                  colors={['#1DB954', '#A855F7']}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={StyleSheet.absoluteFill}
                />
                {isLoading ? (
                  <ActivityIndicator color="#FFF" size={32} />
                ) : (
                  <Ionicons 
                    name={isPlaying ? 'pause' : 'play'} 
                    size={32} 
                    color="#FFF" 
                  />
                )}
              </TouchableOpacity>

              <TouchableOpacity onPress={playNext} disabled={!hasNext} style={styles.controlButton}>
                <Ionicons name="play-skip-forward" size={28} color={hasNext ? '#FFF' : 'rgba(255,255,255,0.2)'} />
              </TouchableOpacity>

              <TouchableOpacity onPress={toggleRepeat} style={styles.controlButton}>
                <Ionicons name={getRepeatIcon()} size={22} color={getRepeatColor()} />
                {repeatMode === 'one' && (
                  <View style={styles.repeatOneDot} />
                )}
              </TouchableOpacity>
            </View>

            <View style={styles.expandedActionRow}>
              <TouchableOpacity 
                style={[styles.expandedActionButton, lyricsVisible && styles.expandedActionButtonActive]}
                onPress={() => setLyricsVisible(!lyricsVisible)}
              >
                <Ionicons name="musical-notes" size={18} color={lyricsVisible ? '#1DB954' : '#FFF'} />
                <Text style={[styles.expandedActionText, lyricsVisible && styles.expandedActionTextActive]}>
                  Letras
                </Text>
              </TouchableOpacity>

              <TouchableOpacity 
                style={[styles.expandedActionButton, showQueue && styles.expandedActionButtonActive]}
                onPress={() => setShowQueue(true)}
              >
                <Ionicons name="list" size={18} color={showQueue ? '#1DB954' : '#FFF'} />
                <Text style={[styles.expandedActionText, showQueue && styles.expandedActionTextActive]}>
                  Cola ({queueLength})
                </Text>
              </TouchableOpacity>

              <TouchableOpacity 
                style={styles.expandedActionButton}
                onPress={() => setShowPlaylistModal(true)}
              >
                <Ionicons name="add-circle-outline" size={18} color="#FFF" />
                <Text style={styles.expandedActionText}>
                  Guardar
                </Text>
              </TouchableOpacity>
            </View>

            <View style={{ height: 20 }} />
          </ScrollView>
        </Reanimated.View>

        {/* MODAL DE LETRAS - COMPLETO */}
        <Modal
          visible={lyricsVisible && isExpanded}
          transparent
          animationType="fade"
          onRequestClose={() => setLyricsVisible(false)}
        >
          <View style={styles.modalOverlay}>
            <LinearGradient
              colors={['#0A0A0A', '#1A1A1A']}
              style={StyleSheet.absoluteFill}
            />
            <BlurView intensity={80} tint="dark" style={StyleSheet.absoluteFill} />
            <View 
              style={[styles.modalContent, { paddingTop: insets.top + 20 }]}
              onLayout={(event) => {
                const { height } = event.nativeEvent.layout;
                setLyricsContainerHeight(height - 140);
              }}
            >
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>LETRAS</Text>
                <TouchableOpacity onPress={() => setLyricsVisible(false)} style={styles.modalCloseButton}>
                  <Ionicons name="close" size={22} color="#FFF" />
                </TouchableOpacity>
              </View>

              {loadingLyrics ? (
                <View style={styles.lyricsLoading}>
                  <ActivityIndicator size="large" color="#1DB954" />
                  <Text style={styles.lyricsLoadingText}>Buscando letras...</Text>
                </View>
              ) : lyrics.length > 0 ? (
                <ScrollView 
                  ref={lyricsScrollRef}
                  style={styles.lyricsScroll}
                  contentContainerStyle={styles.lyricsContent}
                  showsVerticalScrollIndicator={false}
                  scrollEventThrottle={16}
                >
                  {lyrics.map((line, index) => (
                    <View
                      key={index}
                      onLayout={(event) => {
                        if (index === 0) {
                          setLyricsItemHeight(event.nativeEvent.layout.height);
                        }
                      }}
                    >
                      <Text
                        style={[
                          styles.lyricLine,
                          currentLyric === line.text && styles.activeLyric
                        ]}
                      >
                        {line.text}
                      </Text>
                    </View>
                  ))}
                </ScrollView>
              ) : unsyncedLyrics.length > 0 ? (
                <ScrollView style={styles.lyricsScroll}>
                  {unsyncedLyrics.map((line, index) => (
                    <Text key={index} style={styles.unsyncedLine}>
                      {line}
                    </Text>
                  ))}
                </ScrollView>
              ) : (
                <View style={styles.noLyrics}>
                  <Ionicons name="musical-notes-outline" size={70} color="rgba(255,255,255,0.2)" />
                  <Text style={styles.noLyricsTitle}>Sin letras disponibles</Text>
                  <Text style={styles.noLyricsSubtitle}>
                    Puedes buscar en línea:
                  </Text>
                  <TouchableOpacity 
                    style={styles.lyricsLink}
                    onPress={() => {
                      const query = encodeURIComponent(`${track.title} ${track.artist} lyrics`);
                      Linking.openURL(`https://google.com/search?q=${query}`);
                    }}
                  >
                    <Ionicons name="logo-google" size={18} color="#1DB954" />
                    <Text style={styles.lyricsLinkText}>Buscar en Google</Text>
                  </TouchableOpacity>
                  <TouchableOpacity 
                    style={styles.lyricsLink}
                    onPress={() => {
                      const query = encodeURIComponent(`${track.title} ${track.artist}`);
                      Linking.openURL(`https://genius.com/search?q=${query}`);
                    }}
                  >
                    <Ionicons name="musical-notes" size={18} color="#FFD700" />
                    <Text style={styles.lyricsLinkText}>Buscar en Genius</Text>
                  </TouchableOpacity>
                </View>
              )}

              {lyricsProvider && lyricsProvider !== 'fallback' && (
                <Text style={styles.providerText}>
                  Fuente: {lyricsProvider.toUpperCase()}
                </Text>
              )}
            </View>
          </View>
        </Modal>

        {/* MODAL DE COLA - COMPLETO */}
        <Modal
          visible={showQueue && isExpanded}
          transparent
          animationType="slide"
          onRequestClose={() => setShowQueue(false)}
        >
          <View style={styles.modalOverlay}>
            <LinearGradient
              colors={['#0A0A0A', '#1A1A1A']}
              style={StyleSheet.absoluteFill}
            />
            <BlurView intensity={80} tint="dark" style={StyleSheet.absoluteFill} />
            <View style={[styles.modalContent, styles.queueModal, { paddingTop: insets.top + 20 }]}>
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>COLA DE REPRODUCCIÓN</Text>
                <TouchableOpacity onPress={() => setShowQueue(false)} style={styles.modalCloseButton}>
                  <Ionicons name="close" size={22} color="#FFF" />
                </TouchableOpacity>
              </View>

              <ScrollView style={styles.queueList} showsVerticalScrollIndicator={false}>
                {queue.map((item, index) => {
                  const uniqueKey = item.queueId || `${item.id}-${index}`;
                  
                  return (
                    <TouchableOpacity 
                      key={uniqueKey}
                      style={[
                        styles.queueItem,
                        index === currentPosition && styles.queueItemActive
                      ]}
                      onPress={() => handleQueueItemPress(index)}
                      activeOpacity={0.7}
                    >
                      <Image source={{ uri: item.coverUrl }} style={styles.queueItemImage} />
                      <View style={styles.queueItemInfo}>
                        <Text style={styles.queueItemTitle} numberOfLines={1}>
                          {item.title}
                        </Text>
                        <Text style={styles.queueItemArtist} numberOfLines={1}>
                          {item.artist}
                        </Text>
                      </View>
                      {index === currentPosition && (
                        <View style={styles.playingIndicator}>
                          <Ionicons name="play" size={14} color="#1DB954" />
                        </View>
                      )}
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>
            </View>
          </View>
        </Modal>

        {/* Modal para agregar a playlist */}
        <AddToPlaylistModal
          visible={showPlaylistModal && isExpanded}
          onClose={() => setShowPlaylistModal(false)}
          track={track}
          onAdded={() => {
            console.log('✅ Canción agregada a playlist');
          }}
        />
      </Reanimated.View>
    </GestureDetector>
  );
};

const styles = StyleSheet.create({
  mainContainer: {
    position: 'absolute',
    left: 0,
    right: 0,
    backgroundColor: 'transparent',
    overflow: 'hidden',
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
  miniBlur: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.1)',
  },
  miniContainer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 70,
    backgroundColor: 'transparent',
  },
  miniContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    height: 68,
  },
  miniTrackInfo: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
  },
  miniCover: {
    width: 45,
    height: 45,
    borderRadius: 10,
    marginRight: 12,
  },
  miniTextContainer: {
    flex: 1,
  },
  miniTitle: {
    color: '#FFF',
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 2,
  },
  miniArtist: {
    color: 'rgba(255,255,255,0.6)',
    fontSize: 12,
  },
  miniControls: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  miniPlayButton: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: 'rgba(29,185,84,0.15)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  miniProgressBar: {
    height: 2,
    backgroundColor: 'rgba(255,255,255,0.1)',
    width: '100%',
  },
  progressFill: {
    height: 2,
    backgroundColor: '#1DB954',
  },
  expandedContainer: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: 'transparent',
  },
  expandedHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingBottom: 10,
    backgroundColor: 'transparent',
    zIndex: 10,
  },
  headerButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.05)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  expandedHeaderTitle: {
    color: 'rgba(255,255,255,0.5)',
    fontSize: 13,
    fontWeight: '600',
    letterSpacing: 1,
  },
  expandedScroll: {
    flex: 1,
  },
  expandedContent: {
    alignItems: 'center',
    paddingHorizontal: 20,
  },
  coverWrapper: {
    position: 'relative',
    marginBottom: 30,
  },
  coverGlow: {
    position: 'absolute',
    width: width * 0.75,
    height: width * 0.75,
    borderRadius: width * 0.375,
    top: -width * 0.025,
    left: -width * 0.025,
  },
  expandedCover: {
    width: width * 0.7,
    height: width * 0.7,
    borderRadius: 20,
    shadowColor: '#1DB954',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.3,
    shadowRadius: 20,
    elevation: 15,
  },
  coverBadge: {
    position: 'absolute',
    top: 10,
    right: 10,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    backgroundColor: 'rgba(0,0,0,0.6)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    overflow: 'hidden',
  },
  coverBadgeText: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  expandedTrackInfo: {
    alignItems: 'center',
    marginBottom: 30,
  },
  expandedTitle: {
    color: '#FFF',
    fontSize: 24,
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: 6,
    paddingHorizontal: 20,
  },
  expandedArtist: {
    color: 'rgba(255,255,255,0.6)',
    fontSize: 16,
    textAlign: 'center',
  },
  expandedProgressContainer: {
    width: '100%',
    marginBottom: 20,
    paddingHorizontal: 10,
  },
  timeLabels: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 5,
    paddingHorizontal: 5,
  },
  timeText: {
    color: 'rgba(255,255,255,0.5)',
    fontSize: 12,
    fontWeight: '500',
  },
  expandedSlider: {
    width: '100%',
    height: 40,
  },
  expandedControlsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 20,
    marginBottom: 25,
  },
  controlButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
  },
  repeatOneDot: {
    position: 'absolute',
    top: 8,
    right: 8,
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#1DB954',
  },
  expandedPlayButton: {
    width: 70,
    height: 70,
    borderRadius: 35,
    backgroundColor: '#1DB954',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#1DB954',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 10,
    elevation: 8,
    overflow: 'hidden',
  },
  expandedActionRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 12,
    marginBottom: 20,
  },
  expandedActionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.05)',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 25,
    gap: 8,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  expandedActionButtonActive: {
    backgroundColor: 'rgba(29,185,84,0.15)',
    borderColor: 'rgba(29,185,84,0.3)',
  },
  expandedActionText: {
    color: '#FFF',
    fontSize: 13,
    fontWeight: '500',
  },
  expandedActionTextActive: {
    color: '#1DB954',
  },
  // Estilos para modales
  modalOverlay: {
    flex: 1,
  },
  modalContent: {
    flex: 1,
    padding: 20,
  },
  queueModal: {
    marginTop: 0,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  modalTitle: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: '600',
    letterSpacing: 1,
  },
  modalCloseButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.05)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  lyricsScroll: {
    flex: 1,
  },
  lyricsContent: {
    paddingVertical: 20,
  },
  lyricLine: {
    color: 'rgba(255,255,255,0.5)',
    fontSize: 16,
    textAlign: 'center',
    marginVertical: 8,
    lineHeight: 24,
    paddingHorizontal: 20,
  },
  activeLyric: {
    color: '#1DB954',
    fontSize: 20,
    fontWeight: 'bold',
  },
  unsyncedLine: {
    color: 'rgba(255,255,255,0.7)',
    fontSize: 16,
    textAlign: 'center',
    marginVertical: 4,
    lineHeight: 24,
    paddingHorizontal: 20,
  },
  lyricsLoading: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  lyricsLoadingText: {
    color: 'rgba(255,255,255,0.6)',
    fontSize: 14,
    marginTop: 12,
  },
  noLyrics: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingBottom: 40,
  },
  noLyricsTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#FFF',
    marginTop: 16,
    marginBottom: 8,
  },
  noLyricsSubtitle: {
    color: 'rgba(255,255,255,0.5)',
    fontSize: 14,
    marginBottom: 16,
  },
  lyricsLink: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.05)',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 25,
    marginVertical: 6,
    width: '80%',
    gap: 10,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  lyricsLinkText: {
    color: '#FFF',
    fontSize: 15,
    flex: 1,
  },
  providerText: {
    color: 'rgba(255,255,255,0.3)',
    fontSize: 11,
    textAlign: 'center',
    marginTop: 10,
  },
  queueList: {
    flex: 1,
  },
  queueItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.03)',
    padding: 12,
    borderRadius: 12,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.05)',
  },
  queueItemActive: {
    backgroundColor: 'rgba(29,185,84,0.1)',
    borderColor: 'rgba(29,185,84,0.3)',
  },
  queueItemImage: {
    width: 44,
    height: 44,
    borderRadius: 8,
    marginRight: 12,
  },
  queueItemInfo: {
    flex: 1,
  },
  queueItemTitle: {
    color: '#FFF',
    fontSize: 15,
    fontWeight: '600',
    marginBottom: 2,
  },
  queueItemArtist: {
    color: 'rgba(255,255,255,0.5)',
    fontSize: 13,
  },
  playingIndicator: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: 'rgba(29,185,84,0.2)',
    justifyContent: 'center',
    alignItems: 'center',
  },
});

export default Player;