import { AudioMode, setAudioModeAsync, useAudioPlayer, useAudioPlayerStatus } from 'expo-audio';
import React, { createContext, useContext, useEffect, useState } from 'react';
import MonochromeAPI from '../services/MonochromeAPI';
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
  
  // Modos
  const [shuffleMode, setShuffleMode] = useState(false);
  const [repeatMode, setRepeatMode] = useState<'off' | 'all' | 'one'>('off');
  
  // Player
  const player = useAudioPlayer();
  const status = useAudioPlayerStatus(player);

  const currentTrack = currentIndex >= 0 ? queue[currentIndex] : null;
  const hasNext = currentIndex < queue.length - 1;
  const hasPrev = currentIndex > 0;
  const queueLength = queue.length;

  // Log para debug
  useEffect(() => {
    console.log('🎵 Queue actual:', {
      currentIndex,
      total: queue.length,
      currentTrack: currentTrack?.title,
      shuffleMode,
      repeatMode
    });
  }, [queue, currentIndex, shuffleMode, repeatMode]);

  // Configurar audio
  useEffect(() => {
    const setupAudio = async () => {
      const mode: AudioMode = {
        allowsRecording: false,
        playsInSilentMode: true,
        shouldPlayInBackground: true,
        interruptionMode: 'doNotMix',
        shouldDuckAndroid: true,
        playThroughEarpieceAndroid: false,
      };
      await setAudioModeAsync(mode);
      console.log('✅ AudioMode configurado');
    };
    setupAudio();
  }, []);

  // Función para generar ID único de cola
  const generateQueueId = (track: StoredTrack): string => {
    return `${track.id}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  };

  // Convertir StoredTrack a QueueItem
  const toQueueItem = (track: StoredTrack, source?: string, playlistId?: string): QueueItem => ({
    ...track,
    queueId: generateQueueId(track),
    source: source as any,
    playlistId
  });

  // Reproducir un track específico
  const playTrack = async (
    track: StoredTrack, 
    tracks: StoredTrack[] = [track], 
    index: number = 0,
    source?: string,
    playlistId?: string
  ) => {
    try {
      // Convertir todos los tracks a QueueItems
      const queueItems = tracks.map(t => toQueueItem(t, source, playlistId));
      
      setOriginalQueue(queueItems);
      
      // Aplicar shuffle si está activado
      if (shuffleMode) {
        const shuffled = [...queueItems];
        for (let i = shuffled.length - 1; i > 0; i--) {
          const j = Math.floor(Math.random() * (i + 1));
          [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
        }
        setQueue(shuffled);
        
        // Encontrar el índice del track seleccionado en la cola mezclada
        const newIndex = shuffled.findIndex(item => item.id === track.id);
        setCurrentIndex(newIndex >= 0 ? newIndex : 0);
      } else {
        setQueue(queueItems);
        setCurrentIndex(index);
      }
      
      setShowExpanded(true);

      if (!player) {
        console.log('Player not initialized');
        return;
      }

      // Obtener URL
      let audioSource = track.localUri;
      if (!audioSource) {
        console.log('🎵 Obteniendo URL para:', track.title);
        audioSource = await MonochromeAPI.getPlayableUrl(track.id);
      }

      if (!audioSource) {
        console.log('❌ No source available');
        return;
      }

      player.replace(audioSource);
      player.play();

    } catch (error) {
      console.log('Error playing track:', error);
    }
  };

  // Reproducir un track por su índice en la cola
  const playTrackAtIndex = async (index: number) => {
    if (index >= 0 && index < queue.length) {
      setCurrentIndex(index);
      const track = queue[index];
      
      let audioSource = track.localUri;
      if (!audioSource) {
        audioSource = await MonochromeAPI.getPlayableUrl(track.id);
      }
      
      if (audioSource && player) {
        player.replace(audioSource);
        player.play();
      }
    }
  };

  // Siguiente canción
  const playNext = async () => {
    if (!player) return;

    if (repeatMode === 'one') {
      // Repetir la misma canción
      player.seekTo(0);
      player.play();
      return;
    }

    if (hasNext) {
      // Hay siguiente en la cola
      await playTrackAtIndex(currentIndex + 1);
    } else if (repeatMode === 'all' && queue.length > 0) {
      // Modo repeat all: volver al principio
      await playTrackAtIndex(0);
    } else {
      // No hay más canciones
      player.pause();
    }
  };

  // Anterior canción
  const playPrevious = async () => {
    if (!player) return;

    if (status?.currentTime > 3) {
      // Si pasaron más de 3 segundos, reiniciar la actual
      player.seekTo(0);
      player.play();
    } else if (hasPrev) {
      // Ir a la anterior
      await playTrackAtIndex(currentIndex - 1);
    } else if (repeatMode === 'all') {
      // Modo repeat all: ir a la última
      await playTrackAtIndex(queue.length - 1);
    }
  };

  // Alternar play/pause
  const togglePlayPause = async () => {
    if (!player) return;
    
    try {
      if (status?.playing) {
        player.pause();
      } else {
        player.play();
      }
    } catch (e) {
      console.log('Error toggling play/pause:', e);
    }
  };

  // Buscar posición
  const seekTo = async (seconds: number) => {
    if (!player) return;
    try {
      player.seekTo(seconds);
    } catch (e) {
      console.log('Error seeking:', e);
    }
  };

  // Agregar a la cola
  const addToQueue = (track: StoredTrack, position: 'next' | 'end' = 'end') => {
    const queueItem = toQueueItem(track);
    
    setQueue(prev => {
      const newQueue = [...prev];
      if (position === 'next' && currentIndex >= 0) {
        // Insertar después de la canción actual
        newQueue.splice(currentIndex + 1, 0, queueItem);
      } else {
        // Agregar al final
        newQueue.push(queueItem);
      }
      return newQueue;
    });
    
    setOriginalQueue(prev => [...prev, queueItem]);
  };

  // Agregar múltiples tracks a la cola
  const addTracksToQueue = (tracks: StoredTrack[], position: 'next' | 'end' = 'end') => {
    const queueItems = tracks.map(t => toQueueItem(t));
    
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

  // Eliminar de la cola
  const removeFromQueue = (index: number) => {
    if (index === currentIndex) {
      // Si estamos eliminando la canción actual, pasar a la siguiente
      playNext();
    }
    
    setQueue(prev => prev.filter((_, i) => i !== index));
    setOriginalQueue(prev => prev.filter((_, i) => i !== index));
    
    if (index < currentIndex) {
      setCurrentIndex(prev => prev - 1);
    }
  };

  // Limpiar cola
  const clearQueue = async () => {
    if (player) {
      try {
        player.pause();
        player.replace('');
      } catch (e) {}
    }
    setQueue([]);
    setOriginalQueue([]);
    setCurrentIndex(-1);
  };

  // Mover en la cola
  const moveInQueue = (fromIndex: number, toIndex: number) => {
    setQueue(prev => {
      const newQueue = [...prev];
      const [movedItem] = newQueue.splice(fromIndex, 1);
      newQueue.splice(toIndex, 0, movedItem);
      
      // Ajustar currentIndex si es necesario
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

  // Alternar shuffle
  const toggleShuffle = () => {
    setShuffleMode(prev => {
      const newShuffle = !prev;
      
      if (newShuffle && originalQueue.length > 0) {
        // Activar shuffle: mezclar la cola
        const shuffled = [...originalQueue];
        for (let i = shuffled.length - 1; i > 0; i--) {
          const j = Math.floor(Math.random() * (i + 1));
          [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
        }
        
        // Mantener la canción actual en su posición
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
        // Desactivar shuffle: restaurar orden original
        setQueue(originalQueue);
        if (currentTrack) {
          const newIndex = originalQueue.findIndex(t => t.id === currentTrack.id);
          setCurrentIndex(newIndex >= 0 ? newIndex : 0);
        }
      }
      
      return newShuffle;
    });
  };

  // Alternar repeat
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
      isPlaying: status?.playing || false,
      position: (status?.currentTime || 0) * 1000,
      duration: (status?.duration || 0) * 1000,
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