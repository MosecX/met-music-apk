import React, { createContext, useContext, useEffect, useRef, useState } from 'react';
import { AppState } from 'react-native';
import { AudioContext, PlaybackNotificationManager } from 'react-native-audio-api';
import MonochromeAPI from '../services/MonochromeAPI';
import PlayHistoryService from '../services/PlayHistoryService';
import PlaybackPersistenceService from '../services/PlaybackPersistenceService';
import { QueueItem, StoredTrack } from '../types';

interface PlayerContextType {
  // Track actual
  currentTrack: QueueItem | null;
  
  // Cola de reproducción
  queue: QueueItem[];
  originalQueue: QueueItem[];
  currentIndex: number;
  
  // Estados
  isPlaying: boolean;
  position: number;
  duration: number;
  showExpanded: boolean;
  setShowExpanded: (show: boolean) => void;
  
  // Modos de reproducción
  shuffleMode: boolean;
  repeatMode: 'off' | 'all' | 'one';
  
  // Métodos principales
  playTrack: (track: StoredTrack, tracks?: StoredTrack[], index?: number, source?: string, playlistId?: string) => Promise<void>;
  playTrackAtIndex: (index: number) => Promise<void>;
  playNext: () => Promise<void>;
  playPrevious: () => Promise<void>;
  togglePlayPause: () => Promise<void>;
  seekTo: (seconds: number) => Promise<void>;
  
  // Gestión de cola
  addToQueue: (track: StoredTrack, position?: 'next' | 'end') => void;
  addTracksToQueue: (tracks: StoredTrack[], position?: 'next' | 'end') => void;
  removeFromQueue: (index: number) => void;
  clearQueue: () => void;
  moveInQueue: (fromIndex: number, toIndex: number) => void;
  
  // Modos
  toggleShuffle: () => void;
  toggleRepeat: () => void;
  
  // Utilidades
  hasNext: boolean;
  hasPrev: boolean;
  queueLength: number;
  currentPosition: number;
}

const PlayerContext = createContext<PlayerContextType | undefined>(undefined);

export const usePlayer = () => {
  const context = useContext(PlayerContext);
  if (!context) throw new Error('usePlayer must be used within PlayerProvider');
  return context;
};

export const PlayerProvider = ({ children }: { children: React.ReactNode }) => {
  // Estados principales
  const [queue, setQueue] = useState<QueueItem[]>([]);
  const [originalQueue, setOriginalQueue] = useState<QueueItem[]>([]);
  const [currentIndex, setCurrentIndex] = useState(-1);
  const [showExpanded, setShowExpanded] = useState(false);
  const [shuffleMode, setShuffleMode] = useState(false);
  const [repeatMode, setRepeatMode] = useState<'off' | 'all' | 'one'>('off');
  const [isPlaying, setIsPlaying] = useState(false);
  const [position, setPosition] = useState(0);
  const [duration, setDuration] = useState(0);

  // Refs
  const audioContextRef = useRef<AudioContext | null>(null);
  const sourceRef = useRef<any>(null);
  const startTimeRef = useRef(0);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const saveIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const hasRestoredRef = useRef(false);
  const animationFrameRef = useRef<number | null>(null);

  const currentTrack = currentIndex >= 0 ? queue[currentIndex] : null;
  const hasNext = currentIndex < queue.length - 1;
  const hasPrev = currentIndex > 0;
  const queueLength = queue.length;

  // ========== INICIALIZACIÓN ==========
  useEffect(() => {
    audioContextRef.current = new AudioContext();
    console.log('✅ AudioContext creado');

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
      if (saveIntervalRef.current) clearInterval(saveIntervalRef.current);
      if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);
      audioContextRef.current?.close();
      PlaybackNotificationManager.hide();
    };
  }, []);

  // ========== NOTIFICACIÓN ==========
  useEffect(() => {
    const setupNotif = async () => {
      await PlaybackNotificationManager.enableControl('play', true);
      await PlaybackNotificationManager.enableControl('pause', true);
      await PlaybackNotificationManager.enableControl('next', true);
      await PlaybackNotificationManager.enableControl('previous', true);
      await PlaybackNotificationManager.enableControl('seekTo', true);

      PlaybackNotificationManager.addEventListener('playbackNotificationPlay', () => {
        if (!isPlaying) togglePlayPause();
      });
      PlaybackNotificationManager.addEventListener('playbackNotificationPause', () => {
        if (isPlaying) togglePlayPause();
      });
      PlaybackNotificationManager.addEventListener('playbackNotificationNext', playNext);
      PlaybackNotificationManager.addEventListener('playbackNotificationPrevious', playPrevious);
      PlaybackNotificationManager.addEventListener('playbackNotificationSeekTo', (e) => seekTo(e.value));
    };
    setupNotif();
  }, [isPlaying]);

  useEffect(() => {
    if (!currentTrack) return;
    
    PlaybackNotificationManager.show({
      title: currentTrack.title,
      artist: currentTrack.artist,
      artwork: currentTrack.coverUrl,
      duration: Math.floor(duration / 1000),
      elapsedTime: Math.floor(position / 1000),
      state: isPlaying ? 'playing' : 'paused'
    });
  }, [currentTrack, position, isPlaying, duration]);

  // ========== PERSISTENCIA ==========
  useEffect(() => {
    if (hasRestoredRef.current) return;

    const loadState = async () => {
      const { queue: savedQueue, originalQueue: savedOriginalQueue, state } =
        await PlaybackPersistenceService.loadPlaybackState();

      if (savedQueue.length > 0 && state && state.currentIndex >= 0) {
        setQueue(savedQueue);
        setOriginalQueue(savedOriginalQueue);
        setCurrentIndex(state.currentIndex);
        setShuffleMode(state.shuffleMode);
        setRepeatMode(state.repeatMode);
        
        if (state.position > 0) {
          setPosition(state.position * 1000);
        }
      }
      hasRestoredRef.current = true;
    };

    loadState();
  }, []);

  useEffect(() => {
    if (!currentTrack || currentIndex < 0) return;

    if (!saveIntervalRef.current) {
      saveIntervalRef.current = setInterval(() => {
        PlaybackPersistenceService.savePlaybackState(
          queue,
          originalQueue,
          currentIndex,
          position / 1000,
          isPlaying,
          shuffleMode,
          repeatMode
        );
      }, 3000);
    }

    return () => {
      if (saveIntervalRef.current) {
        clearInterval(saveIntervalRef.current);
        saveIntervalRef.current = null;
      }
    };
  }, [currentTrack, currentIndex, queue, originalQueue, position, isPlaying, shuffleMode, repeatMode]);

  // Guardar al cambiar estado de la app
  useEffect(() => {
    const handleAppStateChange = async (nextAppState: string) => {
      if (nextAppState === 'background') {
        if (currentTrack && currentIndex >= 0) {
          await PlaybackPersistenceService.savePlaybackState(
            queue,
            originalQueue,
            currentIndex,
            position / 1000,
            isPlaying,
            shuffleMode,
            repeatMode
          );
        }
      }
    };

    const subscription = AppState.addEventListener('change', handleAppStateChange);
    return () => subscription.remove();
  }, [currentTrack, currentIndex, queue, originalQueue, position, isPlaying, shuffleMode, repeatMode]);

  // ========== REPRODUCCIÓN ==========
  const playAudio = async (track: StoredTrack, startSeconds = 0) => {
    try {
      if (!audioContextRef.current) return;

      // Detener reproducción anterior
      if (sourceRef.current) {
        sourceRef.current.stop();
        sourceRef.current = null;
      }
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
        animationFrameRef.current = null;
      }

      // Obtener URL
      const url = track.localUri || await MonochromeAPI.getPlayableUrl(track.id);
      if (!url) return;

      // Cargar audio
      const response = await fetch(url);
      const arrayBuffer = await response.arrayBuffer();
      const audioBuffer = await audioContextRef.current.decodeAudioData(arrayBuffer);

      // Crear fuente
      sourceRef.current = audioContextRef.current.createBufferSource();
      sourceRef.current.buffer = audioBuffer;
      sourceRef.current.connect(audioContextRef.current.destination);

      // Manejar fin de canción
      sourceRef.current.onended = () => {
        if (repeatMode === 'one') {
          playAudio(track, 0);
        } else if (hasNext) {
          playNext();
        } else if (repeatMode === 'all' && queue.length > 0) {
          setCurrentIndex(0);
          playAudio(queue[0], 0);
        } else {
          setIsPlaying(false);
        }
      };

      // Reanudar contexto si está suspendido
      if (audioContextRef.current.state === 'suspended') {
        await audioContextRef.current.resume();
      }
      
      // Iniciar reproducción
      sourceRef.current.start(0, startSeconds);
      startTimeRef.current = audioContextRef.current.currentTime - startSeconds;
      setIsPlaying(true);
      setDuration(audioBuffer.duration * 1000);
      setPosition(startSeconds * 1000);

      // ✅ INTERVALO CORREGIDO - SIN LOOPS
      intervalRef.current = setInterval(() => {
        if (audioContextRef.current && sourceRef.current) {
          if (isPlaying) {
            const elapsed = (audioContextRef.current.currentTime - startTimeRef.current) * 1000;
            // Usar requestAnimationFrame para evitar loops
            if (animationFrameRef.current) {
              cancelAnimationFrame(animationFrameRef.current);
            }
            animationFrameRef.current = requestAnimationFrame(() => {
              setPosition(Math.min(elapsed, duration));
              animationFrameRef.current = null;
            });
          }
        }
      }, 500); // 500ms es suficiente para una barra suave

    } catch (error) {
      console.log('Error playing audio:', error);
    }
  };

  const playTrack = async (
    track: StoredTrack,
    tracks: StoredTrack[] = [track],
    index: number = 0,
    source?: string,
    playlistId?: string
  ) => {
    try {
      console.log('🎵 playTrack llamado:', track.title);

      // Guardar en historial
      await PlayHistoryService.addToHistory(track, source, playlistId);

      // Convertir a QueueItems
      const queueItems: QueueItem[] = tracks.map((t, i) => ({
        ...t,
        queueId: `${t.id}_${Date.now()}_${i}`,
        source: source as any,
        playlistId
      }));

      setOriginalQueue(queueItems);

      // Aplicar shuffle si está activado
      if (shuffleMode) {
        const shuffled = [...queueItems];
        for (let i = shuffled.length - 1; i > 0; i--) {
          const j = Math.floor(Math.random() * (i + 1));
          [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
        }
        const newIndex = shuffled.findIndex(item => item.id === track.id);
        setQueue(shuffled);
        setCurrentIndex(newIndex >= 0 ? newIndex : 0);
      } else {
        setQueue(queueItems);
        setCurrentIndex(index);
      }

      setShowExpanded(true);

      // Reproducir el track
      await playAudio(track);

    } catch (error) {
      console.log('Error in playTrack:', error);
    }
  };

  const playTrackAtIndex = async (index: number) => {
    if (index >= 0 && index < queue.length) {
      const track = queue[index];
      setCurrentIndex(index);
      await playAudio(track);
    }
  };

  const togglePlayPause = async () => {
    if (!audioContextRef.current || !sourceRef.current) return;

    if (isPlaying) {
      // ⏸️ PAUSAR
      await audioContextRef.current.suspend();
      setIsPlaying(false);
      // La posición se mantiene porque el intervalo ya no actualiza
    } else {
      // ▶️ REANUDAR
      await audioContextRef.current.resume();
      // Recalcular startTime basado en la posición actual
      startTimeRef.current = audioContextRef.current.currentTime - (position / 1000);
      setIsPlaying(true);
    }
  };

  const seekTo = async (seconds: number) => {
    if (!currentTrack) return;
    await playAudio(currentTrack, seconds);
  };

  const playNext = async () => {
    if (repeatMode === 'one') {
      if (currentTrack) await playAudio(currentTrack, 0);
      return;
    }

    if (hasNext) {
      const nextTrack = queue[currentIndex + 1];
      await PlayHistoryService.addToHistory(nextTrack, nextTrack.source, nextTrack.playlistId);
      setCurrentIndex(currentIndex + 1);
      await playAudio(nextTrack);
    } else if (repeatMode === 'all' && queue.length > 0) {
      const firstTrack = queue[0];
      await PlayHistoryService.addToHistory(firstTrack, firstTrack.source, firstTrack.playlistId);
      setCurrentIndex(0);
      await playAudio(firstTrack);
    }
  };

  const playPrevious = async () => {
    if (position > 3000) {
      if (currentTrack) await playAudio(currentTrack, 0);
    } else if (hasPrev) {
      const prevTrack = queue[currentIndex - 1];
      await PlayHistoryService.addToHistory(prevTrack, prevTrack.source, prevTrack.playlistId);
      setCurrentIndex(currentIndex - 1);
      await playAudio(prevTrack);
    } else if (repeatMode === 'all' && queue.length > 0) {
      const lastTrack = queue[queue.length - 1];
      await PlayHistoryService.addToHistory(lastTrack, lastTrack.source, lastTrack.playlistId);
      setCurrentIndex(queue.length - 1);
      await playAudio(lastTrack);
    } else {
      if (currentTrack) await playAudio(currentTrack, 0);
    }
  };

  // ========== GESTIÓN DE COLA ==========
  const addToQueue = (track: StoredTrack, position: 'next' | 'end' = 'end') => {
    const queueItem: QueueItem = {
      ...track,
      queueId: `${track.id}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    };

    setQueue(prev => {
      const newQueue = [...prev];
      if (position === 'next' && currentIndex >= 0) {
        newQueue.splice(currentIndex + 1, 0, queueItem);
      } else {
        newQueue.push(queueItem);
      }
      return newQueue;
    });

    setOriginalQueue(prev => [...prev, queueItem]);
  };

  const addTracksToQueue = (tracks: StoredTrack[], position: 'next' | 'end' = 'end') => {
    const queueItems: QueueItem[] = tracks.map(track => ({
      ...track,
      queueId: `${track.id}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    }));

    setQueue(prev => {
      const newQueue = [...prev];
      if (position === 'next' && currentIndex >= 0) {
        newQueue.splice(currentIndex + 1, 0, ...queueItems);
      } else {
        newQueue.push(...queueItems);
      }
      return newQueue;
    });

    setOriginalQueue(prev => [...prev, ...queueItems]);
  };

  const removeFromQueue = (index: number) => {
    if (index === currentIndex) {
      playNext();
    }

    setQueue(prev => prev.filter((_, i) => i !== index));
    setOriginalQueue(prev => prev.filter((_, i) => i !== index));

    if (index < currentIndex) {
      setCurrentIndex(prev => prev - 1);
    }
  };

  const clearQueue = async () => {
    if (sourceRef.current) {
      sourceRef.current.stop();
    }
    setQueue([]);
    setOriginalQueue([]);
    setCurrentIndex(-1);
    setIsPlaying(false);
    setPosition(0);
    await PlaybackPersistenceService.clearPlaybackState();
  };

  const moveInQueue = (fromIndex: number, toIndex: number) => {
    setQueue(prev => {
      const newQueue = [...prev];
      const [movedItem] = newQueue.splice(fromIndex, 1);
      newQueue.splice(toIndex, 0, movedItem);

      if (fromIndex === currentIndex) {
        setCurrentIndex(toIndex);
      } else if (fromIndex < currentIndex && toIndex >= currentIndex) {
        setCurrentIndex(prev => prev - 1);
      } else if (fromIndex > currentIndex && toIndex <= currentIndex) {
        setCurrentIndex(prev => prev + 1);
      }

      return newQueue;
    });
  };

  // ========== MODOS ==========
  const toggleShuffle = () => {
    setShuffleMode(prev => {
      const newShuffle = !prev;

      if (newShuffle && originalQueue.length > 0) {
        const shuffled = [...originalQueue];
        for (let i = shuffled.length - 1; i > 0; i--) {
          const j = Math.floor(Math.random() * (i + 1));
          [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
        }
        
        if (currentTrack) {
          const currentId = currentTrack.id;
          const newIndex = shuffled.findIndex(t => t.id === currentId);
          if (newIndex >= 0) {
            [shuffled[0], shuffled[newIndex]] = [shuffled[newIndex], shuffled[0]];
            setCurrentIndex(0);
          }
        }
        
        setQueue(shuffled);
      } else if (!newShuffle) {
        setQueue(originalQueue);
        if (currentTrack) {
          const newIndex = originalQueue.findIndex(t => t.id === currentTrack.id);
          setCurrentIndex(newIndex >= 0 ? newIndex : 0);
        }
      }

      return newShuffle;
    });
  };

  const toggleRepeat = () => {
    setRepeatMode(prev => {
      if (prev === 'off') return 'all';
      if (prev === 'all') return 'one';
      return 'off';
    });
  };

  return (
    <PlayerContext.Provider value={{
      currentTrack,
      queue,
      originalQueue,
      currentIndex,
      isPlaying,
      position,
      duration,
      showExpanded,
      setShowExpanded,
      shuffleMode,
      repeatMode,
      playTrack,
      playTrackAtIndex,
      playNext,
      playPrevious,
      togglePlayPause,
      seekTo,
      addToQueue,
      addTracksToQueue,
      removeFromQueue,
      clearQueue,
      moveInQueue,
      toggleShuffle,
      toggleRepeat,
      hasNext,
      hasPrev,
      queueLength,
      currentPosition: currentIndex,
    }}>
      {children}
    </PlayerContext.Provider>
  );
};