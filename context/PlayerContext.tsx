import React, { createContext, useContext, useEffect, useRef, useState } from 'react';
import { AppState } from 'react-native';
import { AudioContext, PlaybackNotificationManager } from 'react-native-audio-api';
import MonochromeAPI from '../services/MonochromeAPI';
import PlayHistoryService from '../services/PlayHistoryService';
import PlaybackPersistenceService from '../services/PlaybackPersistenceService';
import { QueueItem, StoredTrack } from '../types';

// Máquina de estados para la reproducción
type PlayerState = 'idle' | 'loading' | 'playing' | 'paused' | 'transitioning';

interface PlayerContextType {
  currentTrack: QueueItem | null;
  queue: QueueItem[];
  originalQueue: QueueItem[];
  currentIndex: number;
  isPlaying: boolean;
  position: number;
  duration: number;
  showExpanded: boolean;
  setShowExpanded: (show: boolean) => void;
  shuffleMode: boolean;
  repeatMode: 'off' | 'all' | 'one';
  playTrack: (track: StoredTrack, tracks?: StoredTrack[], index?: number, source?: string, playlistId?: string) => Promise<void>;
  playTrackAtIndex: (index: number) => Promise<void>;
  playNext: () => Promise<void>;
  playPrevious: () => Promise<void>;
  togglePlayPause: () => Promise<void>;
  seekTo: (seconds: number) => Promise<void>;
  addToQueue: (track: StoredTrack, position?: 'next' | 'end') => void;
  addTracksToQueue: (tracks: StoredTrack[], position?: 'next' | 'end') => void;
  removeFromQueue: (index: number) => void;
  clearQueue: () => Promise<void>;
  moveInQueue: (fromIndex: number, toIndex: number) => void;
  toggleShuffle: () => void;
  toggleRepeat: () => void;
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
  const [queue, setQueue] = useState<QueueItem[]>([]);
  const [originalQueue, setOriginalQueue] = useState<QueueItem[]>([]);
  const [currentIndex, setCurrentIndex] = useState(-1);
  const [showExpanded, setShowExpanded] = useState(false);
  const [shuffleMode, setShuffleMode] = useState(false);
  const [repeatMode, setRepeatMode] = useState<'off' | 'all' | 'one'>('off');
  const [isPlaying, setIsPlaying] = useState(false);
  const [position, setPosition] = useState(0);
  const [duration, setDuration] = useState(0);
  const [playerState, setPlayerState] = useState<PlayerState>('idle');

  // Refs para valores actualizados
  const queueRef = useRef<QueueItem[]>([]);
  const currentIndexRef = useRef<number>(-1);
  const repeatModeRef = useRef<'off' | 'all' | 'one'>('off');
  const isPlayingRef = useRef<boolean>(false);
  const positionRef = useRef<number>(0);
  const durationRef = useRef<number>(0);
  const playerStateRef = useRef<PlayerState>('idle');

  // Refs para el audio
  const audioContextRef = useRef<AudioContext | null>(null);
  const sourceRef = useRef<any>(null);
  const startTimeRef = useRef(0);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const saveIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const hasRestoredRef = useRef(false);
  const animationFrameRef = useRef<number | null>(null);
  
  // Cola de operaciones para evitar carreras
  const operationQueue = useRef<Promise<void>>(Promise.resolve());
  const pendingOperation = useRef<boolean>(false);

  // Sincronizar refs con estado
  useEffect(() => {
    queueRef.current = queue;
    currentIndexRef.current = currentIndex;
    repeatModeRef.current = repeatMode;
    isPlayingRef.current = isPlaying;
    positionRef.current = position;
    durationRef.current = duration;
    playerStateRef.current = playerState;
  }, [queue, currentIndex, repeatMode, isPlaying, position, duration, playerState]);

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

      // Usar funciones anónimas que llaman a las versiones más actuales a través de refs
      PlaybackNotificationManager.addEventListener('playbackNotificationPlay', () => {
        if (!isPlayingRef.current && playerStateRef.current !== 'transitioning') {
          togglePlayPauseRef.current();
        }
      });
      PlaybackNotificationManager.addEventListener('playbackNotificationPause', () => {
        if (isPlayingRef.current && playerStateRef.current !== 'transitioning') {
          togglePlayPauseRef.current();
        }
      });
      PlaybackNotificationManager.addEventListener('playbackNotificationNext', () => {
        if (playerStateRef.current !== 'transitioning') {
          playNextRef.current();
        }
      });
      PlaybackNotificationManager.addEventListener('playbackNotificationPrevious', () => {
        if (playerStateRef.current !== 'transitioning') {
          playPreviousRef.current();
        }
      });
      PlaybackNotificationManager.addEventListener('playbackNotificationSeekTo', (e) => {
        if (playerStateRef.current !== 'transitioning') {
          seekTo(e.value);
        }
      });
    };
    setupNotif();
  }, []);

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

  // ========== FUNCIÓN AUXILIAR PARA DETENER TODO ==========
  const stopCurrentAudio = async () => {
    if (sourceRef.current) {
      try {
        sourceRef.current.stop();
      } catch (e) {}
      sourceRef.current = null;
    }
    if (audioContextRef.current && audioContextRef.current.state === 'running') {
      await audioContextRef.current.suspend();
      // Pequeña pausa para que el hardware se libere
      await new Promise(resolve => setTimeout(resolve, 20));
    }
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    setIsPlaying(false);
    // No resetear position aquí, la mantendremos para la próxima reproducción si es la misma canción
  };

  // ========== REPRODUCCIÓN ==========
  const playAudio = async (track: StoredTrack, startSeconds = 0) => {
    if (!audioContextRef.current) return;

    // Marcar estado como transición
    setPlayerState('loading');

    try {
      // Asegurar que cualquier audio anterior esté detenido
      await stopCurrentAudio();

      const url = track.localUri || await MonochromeAPI.getPlayableUrl(track.id);
      if (!url) throw new Error('No se pudo obtener la URL');

      const response = await fetch(url);
      const arrayBuffer = await response.arrayBuffer();
      const audioBuffer = await audioContextRef.current.decodeAudioData(arrayBuffer);

      sourceRef.current = audioContextRef.current.createBufferSource();
      sourceRef.current.buffer = audioBuffer;
      sourceRef.current.connect(audioContextRef.current.destination);

      sourceRef.current.onEnded = () => {
        // Cuando termina, verificamos el estado actual mediante refs
        if (repeatModeRef.current === 'one') {
          playAudio(track, 0);
        } else if (currentIndexRef.current < queueRef.current.length - 1) {
          playNext();
        } else if (repeatModeRef.current === 'all' && queueRef.current.length > 0) {
          setCurrentIndex(0);
          playAudio(queueRef.current[0], 0);
        } else {
          // Se acabó la cola
          setIsPlaying(false);
          setPosition(0);
          setPlayerState('idle');
        }
      };

      if (audioContextRef.current.state === 'suspended') {
        await audioContextRef.current.resume();
      }

      sourceRef.current.start(0, startSeconds);
      startTimeRef.current = audioContextRef.current.currentTime - startSeconds;
      setDuration(audioBuffer.duration * 1000);
      setPosition(startSeconds * 1000);
      setIsPlaying(true);
      setPlayerState('playing');

      // Intervalo de posición
      if (intervalRef.current) clearInterval(intervalRef.current);
      intervalRef.current = setInterval(() => {
        if (audioContextRef.current && sourceRef.current && isPlayingRef.current) {
          const elapsed = (audioContextRef.current.currentTime - startTimeRef.current) * 1000;
          requestAnimationFrame(() => {
            setPosition(Math.min(elapsed, durationRef.current));
          });
        }
      }, 500);

    } catch (error) {
      console.log('Error en playAudio:', error);
      setPlayerState('idle');
    }
  };

  // ========== OPERACIONES ENCOLADAS ==========
  const enqueueOperation = <T,>(operation: () => Promise<T>): Promise<T> => {
    const result = operationQueue.current.then(() => operation());
    operationQueue.current = result.catch(() => {}) as Promise<void>;
    return result;
  };

  // Refs para funciones (para listeners)
  const playNextRef = useRef<() => Promise<void>>(async () => {});
  const playPreviousRef = useRef<() => Promise<void>>(async () => {});
  const togglePlayPauseRef = useRef<() => Promise<void>>(async () => {});

  // Actualizar refs de funciones
  useEffect(() => {
    playNextRef.current = playNext;
    playPreviousRef.current = playPrevious;
    togglePlayPauseRef.current = togglePlayPause;
  });

  const playTrack = async (
    track: StoredTrack,
    tracks: StoredTrack[] = [track],
    index: number = 0,
    source?: string,
    playlistId?: string
  ) => {
    return enqueueOperation(async () => {
      console.log('🎵 playTrack:', track.title);

      await PlayHistoryService.addToHistory(track, source, playlistId);

      const queueItems: QueueItem[] = tracks.map((t, i) => ({
        ...t,
        queueId: `${t.id}_${Date.now()}_${i}`,
        source: source as any,
        playlistId
      }));

      setOriginalQueue(queueItems);

      let newIndex = index;
      if (shuffleMode) {
        const shuffled = [...queueItems];
        for (let i = shuffled.length - 1; i > 0; i--) {
          const j = Math.floor(Math.random() * (i + 1));
          [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
        }
        newIndex = shuffled.findIndex(item => item.id === track.id);
        if (newIndex === -1) newIndex = 0;
        setQueue(shuffled);
      } else {
        setQueue(queueItems);
      }

      setCurrentIndex(newIndex);
      setShowExpanded(true);
      await playAudio(track);
    });
  };

  const playTrackAtIndex = async (index: number) => {
    if (index < 0 || index >= queue.length) return;
    return enqueueOperation(async () => {
      const track = queue[index];
      setCurrentIndex(index);
      await playAudio(track);
    });
  };

  const togglePlayPause = async () => {
    if (!audioContextRef.current || !sourceRef.current) return;
    if (playerState === 'transitioning' || playerState === 'loading') return;

    if (isPlaying) {
      await audioContextRef.current.suspend();
      setIsPlaying(false);
      setPlayerState('paused');
    } else {
      await audioContextRef.current.resume();
      setIsPlaying(true);
      setPlayerState('playing');
    }
  };

  const seekTo = async (seconds: number) => {
    if (!currentTrack) return;
    return enqueueOperation(async () => {
      await playAudio(currentTrack, seconds);
    });
  };

  const playNext = async () => {
    return enqueueOperation(async () => {
      if (repeatModeRef.current === 'one' && currentTrack) {
        await playAudio(currentTrack, 0);
        return;
      }

      const nextIndex = currentIndexRef.current + 1;
      if (nextIndex < queueRef.current.length) {
        const nextTrack = queueRef.current[nextIndex];
        await PlayHistoryService.addToHistory(nextTrack, nextTrack.source, nextTrack.playlistId);
        setCurrentIndex(nextIndex);
        await playAudio(nextTrack);
      } else if (repeatModeRef.current === 'all' && queueRef.current.length > 0) {
        const firstTrack = queueRef.current[0];
        await PlayHistoryService.addToHistory(firstTrack, firstTrack.source, firstTrack.playlistId);
        setCurrentIndex(0);
        await playAudio(firstTrack);
      } else {
        // No hay siguiente, pausar
        if (isPlaying) {
          await togglePlayPause();
        }
      }
    });
  };

  const playPrevious = async () => {
    return enqueueOperation(async () => {
      if (positionRef.current > 3000) {
        if (currentTrack) await playAudio(currentTrack, 0);
        return;
      }

      const prevIndex = currentIndexRef.current - 1;
      if (prevIndex >= 0) {
        const prevTrack = queueRef.current[prevIndex];
        await PlayHistoryService.addToHistory(prevTrack, prevTrack.source, prevTrack.playlistId);
        setCurrentIndex(prevIndex);
        await playAudio(prevTrack);
      } else if (repeatModeRef.current === 'all' && queueRef.current.length > 0) {
        const lastTrack = queueRef.current[queueRef.current.length - 1];
        await PlayHistoryService.addToHistory(lastTrack, lastTrack.source, lastTrack.playlistId);
        setCurrentIndex(queueRef.current.length - 1);
        await playAudio(lastTrack);
      } else {
        if (currentTrack) await playAudio(currentTrack, 0);
      }
    });
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
    return enqueueOperation(async () => {
      await stopCurrentAudio();
      setQueue([]);
      setOriginalQueue([]);
      setCurrentIndex(-1);
      setIsPlaying(false);
      setPosition(0);
      setDuration(0);
      setShowExpanded(false);
      setPlayerState('idle');
      await PlaybackPersistenceService.clearPlaybackState();
    });
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
