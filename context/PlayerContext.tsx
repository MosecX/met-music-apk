import React, { createContext, useContext, useEffect, useRef, useState } from 'react';
import { AppState } from 'react-native';
import { AudioContext, PlaybackNotificationManager } from 'react-native-audio-api';
import MonochromeAPI from '../services/MonochromeAPI';
import PlayHistoryService from '../services/PlayHistoryService';
import PlaybackPersistenceService from '../services/PlaybackPersistenceService';
import { QueueItem, StoredTrack } from '../types';

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
  clearQueue: () => void;
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

  const audioContextRef = useRef<AudioContext | null>(null);
  const sourceRef = useRef<any>(null);
  const startTimeRef = useRef(0);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const saveIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const hasRestoredRef = useRef(false);
  const animationFrameRef = useRef<number | null>(null);
  const isSeekingRef = useRef(false);

  const currentTrack = currentIndex >= 0 ? queue[currentIndex] : null;
  const hasNext = currentIndex < queue.length - 1;
  const hasPrev = currentIndex > 0;
  const queueLength = queue.length;

  // Inicialización
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

  // Notificación
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

  // Persistencia
  useEffect(() => {
    if (hasRestoredRef.current) return;
    const loadState = async () => {
      const { queue: savedQueue, originalQueue: savedOriginalQueue, state } = await PlaybackPersistenceService.loadPlaybackState();
      if (savedQueue.length > 0 && state && state.currentIndex >= 0) {
        setQueue(savedQueue);
        setOriginalQueue(savedOriginalQueue);
        setCurrentIndex(state.currentIndex);
        setShuffleMode(state.shuffleMode);
        setRepeatMode(state.repeatMode);
        if (state.position > 0) setPosition(state.position * 1000);
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
          queue, originalQueue, currentIndex,
          position / 1000, isPlaying, shuffleMode, repeatMode
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
      if (nextAppState === 'background' && currentTrack && currentIndex >= 0) {
        await PlaybackPersistenceService.savePlaybackState(
          queue, originalQueue, currentIndex,
          position / 1000, isPlaying, shuffleMode, repeatMode
        );
      }
    };
    const subscription = AppState.addEventListener('change', handleAppStateChange);
    return () => subscription.remove();
  }, [currentTrack, currentIndex, queue, originalQueue, position, isPlaying, shuffleMode, repeatMode]);

  // ========== REPRODUCCIÓN ==========
  const stopCurrentAudio = () => {
    if (sourceRef.current) {
      try {
        sourceRef.current.stop();
        sourceRef.current.onended = null; // eliminar listener anterior
      } catch (e) {}
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
  };

  const playAudio = async (track: StoredTrack, startSeconds = 0) => {
    try {
      if (!audioContextRef.current) return;

      stopCurrentAudio();

      const url = track.localUri || await MonochromeAPI.getPlayableUrl(track.id);
      if (!url) return;

      const response = await fetch(url);
      const arrayBuffer = await response.arrayBuffer();
      const audioBuffer = await audioContextRef.current.decodeAudioData(arrayBuffer);

      const newSource = audioContextRef.current.createBufferSource();
      newSource.buffer = audioBuffer;
      newSource.connect(audioContextRef.current.destination);

      // Manejar fin de canción
      newSource.onEnded = () => {
        // Asegurar que es el final natural (no por stop)
        if (sourceRef.current === newSource) {
          if (repeatMode === 'one') {
            playAudio(track, 0);
          } else if (hasNext) {
            playNext();
          } else if (repeatMode === 'all' && queue.length > 0) {
            setCurrentIndex(0);
            playAudio(queue[0], 0);
          } else {
            setIsPlaying(false);
            setPosition(duration); // opcional: marcar como terminado
          }
        }
      };

      sourceRef.current = newSource;

      if (audioContextRef.current.state === 'suspended') {
        await audioContextRef.current.resume();
      }

      // Importante: guardar el tiempo de inicio justo antes de start
      const startTime = audioContextRef.current.currentTime;
      newSource.start(0, startSeconds);
      
      startTimeRef.current = startTime - startSeconds; // esto nos dará el tiempo base correcto
      setIsPlaying(true);
      setDuration(audioBuffer.duration * 1000);
      setPosition(startSeconds * 1000);

      // Iniciar intervalo de actualización de posición (usando requestAnimationFrame para mayor precisión)
      const updatePosition = () => {
        if (audioContextRef.current && sourceRef.current && isPlaying && !isSeekingRef.current) {
          const elapsed = (audioContextRef.current.currentTime - startTimeRef.current) * 1000;
          setPosition(Math.min(elapsed, duration));
        }
        animationFrameRef.current = requestAnimationFrame(updatePosition);
      };
      animationFrameRef.current = requestAnimationFrame(updatePosition);

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
      await PlayHistoryService.addToHistory(track, source, playlistId);

      const queueItems: QueueItem[] = tracks.map((t, i) => ({
        ...t,
        queueId: `${t.id}_${Date.now()}_${i}`,
        source: source as any,
        playlistId
      }));

      setOriginalQueue(queueItems);

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
      await audioContextRef.current.suspend();
      setIsPlaying(false);
    } else {
      await audioContextRef.current.resume();
      // Recalcular startTime para que la posición continúe correctamente
      startTimeRef.current = audioContextRef.current.currentTime - (position / 1000);
      setIsPlaying(true);
    }
  };

  const seekTo = async (seconds: number) => {
    if (!currentTrack) return;
    isSeekingRef.current = true;
    // Guardamos la canción actual y la posición deseada
    const track = currentTrack;
    // Reiniciamos la reproducción desde la nueva posición
    await playAudio(track, seconds);
    isSeekingRef.current = false;
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

  // Gestión de cola (sin cambios)
  const addToQueue = (track: StoredTrack, position: 'next' | 'end' = 'end') => {
    const queueItem: QueueItem = { ...track, queueId: `${track.id}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}` };
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
    const queueItems = tracks.map(track => ({ ...track, queueId: `${track.id}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}` }));
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
    if (index === currentIndex) playNext();
    setQueue(prev => prev.filter((_, i) => i !== index));
    setOriginalQueue(prev => prev.filter((_, i) => i !== index));
    if (index < currentIndex) setCurrentIndex(prev => prev - 1);
  };

  const clearQueue = async () => {
    stopCurrentAudio();
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
      if (fromIndex === currentIndex) setCurrentIndex(toIndex);
      else if (fromIndex < currentIndex && toIndex >= currentIndex) setCurrentIndex(prev => prev - 1);
      else if (fromIndex > currentIndex && toIndex <= currentIndex) setCurrentIndex(prev => prev + 1);
      return newQueue;
    });
  };

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