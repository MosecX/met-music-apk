import AsyncStorage from '@react-native-async-storage/async-storage';
import { QueueItem } from '../types';

const PLAYBACK_STATE_KEY = '@metmusic_playback_state';
const QUEUE_KEY = '@metmusic_queue';
const ORIGINAL_QUEUE_KEY = '@metmusic_original_queue';

export interface PlaybackState {
  currentIndex: number;
  position: number; // en segundos
  isPlaying: boolean;
  shuffleMode: boolean;
  repeatMode: 'off' | 'all' | 'one';
  lastUpdated: number; // timestamp
}

class PlaybackPersistenceService {
  // Guardar estado completo
  async savePlaybackState(
    queue: QueueItem[],
    originalQueue: QueueItem[],
    currentIndex: number,
    position: number,
    isPlaying: boolean,
    shuffleMode: boolean,
    repeatMode: 'off' | 'all' | 'one'
  ) {
    try {
      console.log('💾 Guardando estado de reproducción...');
      
      // Guardar colas
      if (queue.length > 0) {
        await AsyncStorage.setItem(QUEUE_KEY, JSON.stringify(queue));
        await AsyncStorage.setItem(ORIGINAL_QUEUE_KEY, JSON.stringify(originalQueue));
        console.log('💾 Colas guardadas:', queue.length, 'canciones');
      }
      
      // Guardar estado actual
      const state: PlaybackState = {
        currentIndex,
        position,
        isPlaying,
        shuffleMode,
        repeatMode,
        lastUpdated: Date.now()
      };
      
      await AsyncStorage.setItem(PLAYBACK_STATE_KEY, JSON.stringify(state));
      
      console.log('✅ Estado guardado:', {
        currentIndex,
        position,
        isPlaying,
        queueLength: queue.length
      });
    } catch (error) {
      console.log('❌ Error guardando estado:', error);
    }
  }

  // Cargar estado guardado
  async loadPlaybackState(): Promise<{
    queue: QueueItem[];
    originalQueue: QueueItem[];
    state: PlaybackState | null;
  }> {
    try {
      console.log('📂 Cargando estado guardado...');
      
      const [queueJson, originalQueueJson, stateJson] = await Promise.all([
        AsyncStorage.getItem(QUEUE_KEY),
        AsyncStorage.getItem(ORIGINAL_QUEUE_KEY),
        AsyncStorage.getItem(PLAYBACK_STATE_KEY)
      ]);
      
      const queue = queueJson ? JSON.parse(queueJson) : [];
      const originalQueue = originalQueueJson ? JSON.parse(originalQueueJson) : [];
      const state = stateJson ? JSON.parse(stateJson) : null;
      
      console.log('📂 Datos cargados:', {
        queueLength: queue.length,
        stateExists: !!state,
        currentIndex: state?.currentIndex,
        position: state?.position
      });
      
      // Verificar que el estado sea válido
      if (state && queue.length > 0 && state.currentIndex >= 0 && state.currentIndex < queue.length) {
        console.log('✅ Estado válido encontrado');
        return { queue, originalQueue, state };
      } else {
        console.log('⚠️ Estado inválido o incompleto');
        return { queue: [], originalQueue: [], state: null };
      }
    } catch (error) {
      console.log('❌ Error cargando estado:', error);
      return { queue: [], originalQueue: [], state: null };
    }
  }

  // Limpiar estado guardado
  async clearPlaybackState() {
    try {
      await Promise.all([
        AsyncStorage.removeItem(PLAYBACK_STATE_KEY),
        AsyncStorage.removeItem(QUEUE_KEY),
        AsyncStorage.removeItem(ORIGINAL_QUEUE_KEY)
      ]);
      console.log('🗑️ Estado de reproducción limpiado');
    } catch (error) {
      console.log('Error limpiando estado:', error);
    }
  }

  // Guardar solo la posición (para actualizaciones frecuentes)
  async savePosition(position: number, isPlaying: boolean) {
    try {
      const stateJson = await AsyncStorage.getItem(PLAYBACK_STATE_KEY);
      if (stateJson) {
        const state = JSON.parse(stateJson);
        state.position = position;
        state.isPlaying = isPlaying;
        state.lastUpdated = Date.now();
        await AsyncStorage.setItem(PLAYBACK_STATE_KEY, JSON.stringify(state));
        console.log('💾 Posición actualizada:', position);
      }
    } catch (error) {
      console.log('Error guardando posición:', error);
    }
  }
}

export default new PlaybackPersistenceService();