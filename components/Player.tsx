import { Ionicons } from '@expo/vector-icons';
import Slider from '@react-native-community/slider';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import React, { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Dimensions,
  Image,
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View
} from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
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
  const [currentLyric, setCurrentLyric] = useState('');
  const [loadingLyrics, setLoadingLyrics] = useState(false);
  const [showQueue, setShowQueue] = useState(false);
  const [showPlaylistModal, setShowPlaylistModal] = useState(false);
  const [lyricsContainerHeight, setLyricsContainerHeight] = useState(0);
  const [lyricsItemHeight, setLyricsItemHeight] = useState(60);
  
  // Refs y animaciones
  const scrollViewRef = useRef<ScrollView>(null);
  const lyricsScrollRef = useRef<ScrollView>(null);
  const insets = useSafeAreaInsets();
  const expandAnim = useSharedValue(0);
  const panY = useSharedValue(0);
  const lastActiveIndex = useRef(-1);
  const TAB_BAR_HEIGHT = 60;

  const progress = duration > 0 ? (position / duration) * 100 : 0;

  // ✅ AUTO-NEXT cuando termina la canción
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

  // 🔥 CALCULAR ALTURA RESTANDO EL TAB BAR
  const availableHeight = height - TAB_BAR_HEIGHT - insets.bottom;

  // Estilos animados
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
    const lyricsData = await LyricsService.getLyrics(track);
    if (lyricsData?.synced?.length) {
      setLyrics(lyricsData.synced);
    } else {
      setLyrics([]);
    }
    setLoadingLyrics(false);
  };

  // FORZAR el centrado de la letra actual
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
      default: return '#666';
    }
  };

  const handleQueueItemPress = (index: number) => {
    playTrackAtIndex(index);
    setShowQueue(false);
  };

  return (
    <GestureDetector gesture={panGesture}>
      <Animated.View style={[styles.mainContainer, containerStyle]}>
        <LinearGradient
          colors={isExpanded ? ['#0A0A0A', '#000000'] : ['#1A1A1A', '#0F0F0F']}
          style={StyleSheet.absoluteFill}
        />
        
        <BlurView intensity={isExpanded ? 100 : 10} tint="dark" style={StyleSheet.absoluteFill} />

        {/* MODO MINI */}
        <Animated.View 
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
        </Animated.View>

        {/* MODO EXPANDIDO */}
        <Animated.View 
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
            >
              <Ionicons name="chevron-down" size={28} color="#FFF" />
            </TouchableOpacity>
            <Text style={styles.expandedHeaderTitle}>Reproduciendo</Text>
            <TouchableOpacity 
              hitSlop={{ top: 15, bottom: 15, left: 15, right: 15 }}
              onPress={onClose}
            >
              <Ionicons name="close" size={24} color="#FFF" />
            </TouchableOpacity>
          </View>

          <ScrollView 
            style={styles.expandedScroll}
            contentContainerStyle={styles.expandedContent}
            showsVerticalScrollIndicator={false}
            bounces={false}
          >
            <View style={{ height: 20 }} />
            
            <Image 
              source={{ uri: track.coverUrl }} 
              style={styles.expandedCover}
            />

            <View style={styles.expandedTrackInfo}>
              <Text style={styles.expandedTitle} numberOfLines={2}>{track.title}</Text>
              <Text style={styles.expandedArtist} numberOfLines={1}>{track.artist}</Text>
            </View>

            <View style={styles.expandedProgressContainer}>
              <Slider
                style={styles.expandedSlider}
                value={position}
                minimumValue={0}
                maximumValue={duration || 1}
                onSlidingComplete={(value) => seekTo(value / 1000)}
                minimumTrackTintColor="#1DB954"
                maximumTrackTintColor="#333"
                thumbTintColor="#1DB954"
              />
              <View style={styles.expandedTimeRow}>
                <Text style={styles.expandedTime}>{formatTime(position)}</Text>
                <Text style={styles.expandedTime}>{formatTime(duration)}</Text>
              </View>
            </View>

            <View style={styles.expandedControlsRow}>
              <TouchableOpacity onPress={toggleShuffle} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                <Ionicons name="shuffle" size={24} color={shuffleMode ? '#1DB954' : '#666'} />
              </TouchableOpacity>

              <TouchableOpacity onPress={playPrevious} disabled={!hasPrev} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                <Ionicons name="play-skip-back" size={30} color={hasPrev ? '#FFF' : '#444'} />
              </TouchableOpacity>

              <TouchableOpacity 
                style={styles.expandedPlayButton} 
                onPress={togglePlayPause}
                disabled={isLoading}
              >
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

              <TouchableOpacity onPress={playNext} disabled={!hasNext} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                <Ionicons name="play-skip-forward" size={30} color={hasNext ? '#FFF' : '#444'} />
              </TouchableOpacity>

              <TouchableOpacity onPress={toggleRepeat} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                <Ionicons name={getRepeatIcon()} size={24} color={getRepeatColor()} />
              </TouchableOpacity>
            </View>

            <View style={styles.expandedActionRow}>
              <TouchableOpacity 
                style={[styles.expandedActionButton, lyricsVisible && styles.expandedActionButtonActive]}
                onPress={() => setLyricsVisible(!lyricsVisible)}
              >
                <Ionicons name="musical-notes" size={20} color={lyricsVisible ? '#1DB954' : '#FFF'} />
                <Text style={[styles.expandedActionText, lyricsVisible && styles.expandedActionTextActive]}>
                  Letras
                </Text>
              </TouchableOpacity>

              <TouchableOpacity 
                style={[styles.expandedActionButton, showQueue && styles.expandedActionButtonActive]}
                onPress={() => setShowQueue(true)}
              >
                <Ionicons name="list" size={20} color={showQueue ? '#1DB954' : '#FFF'} />
                <Text style={[styles.expandedActionText, showQueue && styles.expandedActionTextActive]}>
                  Cola ({queueLength})
                </Text>
              </TouchableOpacity>

              {/* Botón para agregar a playlist */}
              <TouchableOpacity 
                style={styles.expandedActionButton}
                onPress={() => setShowPlaylistModal(true)}
              >
                <Ionicons name="add-circle-outline" size={20} color="#FFF" />
                <Text style={styles.expandedActionText}>
                  Agregar
                </Text>
              </TouchableOpacity>
            </View>

            <View style={{ height: 40 }} />
          </ScrollView>
        </Animated.View>

        {/* Modal de letras */}
        <Modal
          visible={lyricsVisible && isExpanded}
          transparent
          animationType="fade"
          onRequestClose={() => setLyricsVisible(false)}
        >
          <View style={styles.modalOverlay}>
            <BlurView intensity={100} tint="dark" style={StyleSheet.absoluteFill} />
            <View 
              style={styles.modalContent}
              onLayout={(event) => {
                const { height } = event.nativeEvent.layout;
                setLyricsContainerHeight(height - 140);
              }}
            >
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>Letras</Text>
                <TouchableOpacity onPress={() => setLyricsVisible(false)}>
                  <Ionicons name="close" size={24} color="#FFF" />
                </TouchableOpacity>
              </View>

              {loadingLyrics ? (
                <View style={styles.lyricsLoading}>
                  <ActivityIndicator size="large" color="#1DB954" />
                  <Text style={styles.lyricsLoadingText}>Cargando letras...</Text>
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
              ) : (
                <View style={styles.noLyrics}>
                  <Ionicons name="musical-notes-outline" size={60} color="#444" />
                  <Text style={styles.noLyricsText}>No hay letras disponibles</Text>
                </View>
              )}
            </View>
          </View>
        </Modal>

        {/* Modal de cola - CON KEYS ÚNICAS CORREGIDAS */}
        <Modal
          visible={showQueue && isExpanded}
          transparent
          animationType="slide"
          onRequestClose={() => setShowQueue(false)}
        >
          <View style={styles.modalOverlay}>
            <BlurView intensity={100} tint="dark" style={StyleSheet.absoluteFill} />
            <View style={[styles.modalContent, styles.queueModal]}>
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>Cola de reproducción</Text>
                <TouchableOpacity onPress={() => setShowQueue(false)}>
                  <Ionicons name="close" size={24} color="#FFF" />
                </TouchableOpacity>
              </View>

              <ScrollView style={styles.queueList}>
                {queue.map((item, index) => {
                  // Generar key ÚNICA usando queueId si existe, o combinación única
                  const uniqueKey = item.queueId || `${item.id}-${index}-${Date.now()}`;
                  
                  return (
                    <TouchableOpacity 
                      key={uniqueKey}
                      style={[
                        styles.queueItem,
                        index === currentPosition && styles.queueItemActive
                      ]}
                      onPress={() => handleQueueItemPress(index)}
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
                        <Ionicons name="play" size={20} color="#1DB954" />
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
            // Opcional: mostrar notificación
            console.log('✅ Canción agregada a playlist');
          }}
        />
      </Animated.View>
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
    borderRadius: 8,
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
    color: '#B3B3B3',
    fontSize: 12,
  },
  miniControls: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },
  miniPlayButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(29,185,84,0.15)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  miniProgressBar: {
    height: 2,
    backgroundColor: '#222',
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
  expandedHeaderTitle: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: '600',
  },
  expandedScroll: {
    flex: 1,
  },
  expandedContent: {
    alignItems: 'center',
    paddingHorizontal: 20,
  },
  expandedCover: {
    width: width * 0.7,
    height: width * 0.7,
    borderRadius: 15,
    marginBottom: 30,
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
    marginBottom: 8,
  },
  expandedArtist: {
    color: '#B3B3B3',
    fontSize: 18,
    textAlign: 'center',
  },
  expandedProgressContainer: {
    width: '100%',
    marginBottom: 30,
  },
  expandedSlider: {
    width: '100%',
    height: 40,
  },
  expandedTimeRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 10,
  },
  expandedTime: {
    color: '#B3B3B3',
    fontSize: 12,
  },
  expandedControlsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 30,
    marginBottom: 30,
  },
  expandedPlayButton: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: '#1DB954',
    justifyContent: 'center',
    alignItems: 'center',
  },
  expandedActionRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 20,
    marginBottom: 20,
  },
  expandedActionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#222',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    gap: 8,
  },
  expandedActionButtonActive: {
    backgroundColor: 'rgba(29,185,84,0.15)',
  },
  expandedActionText: {
    color: '#FFF',
    fontSize: 14,
  },
  expandedActionTextActive: {
    color: '#1DB954',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.95)',
  },
  modalContent: {
    flex: 1,
    marginTop: 100,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 20,
  },
  queueModal: {
    marginTop: 150,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  modalTitle: {
    color: '#FFF',
    fontSize: 20,
    fontWeight: 'bold',
  },
  lyricsScroll: {
    flex: 1,
  },
  lyricsContent: {
    paddingVertical: 20,
  },
  lyricLine: {
    color: '#666',
    fontSize: 16,
    textAlign: 'center',
    marginVertical: 8,
    lineHeight: 24,
  },
  activeLyric: {
    color: '#1DB954',
    fontSize: 20,
    fontWeight: 'bold',
  },
  lyricsLoading: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  lyricsLoadingText: {
    color: '#B3B3B3',
    fontSize: 14,
    marginTop: 12,
  },
  noLyrics: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  noLyricsText: {
    color: '#666',
    fontSize: 16,
    marginTop: 16,
  },
  queueList: {
    flex: 1,
  },
  queueItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1A1A1A',
    padding: 12,
    borderRadius: 8,
    marginBottom: 8,
  },
  queueItemActive: {
    backgroundColor: 'rgba(29,185,84,0.15)',
    borderLeftWidth: 3,
    borderLeftColor: '#1DB954',
  },
  queueItemImage: {
    width: 40,
    height: 40,
    borderRadius: 6,
    marginRight: 12,
  },
  queueItemInfo: {
    flex: 1,
  },
  queueItemTitle: {
    color: '#FFF',
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 2,
  },
  queueItemArtist: {
    color: '#B3B3B3',
    fontSize: 12,
  },
});

export default Player;