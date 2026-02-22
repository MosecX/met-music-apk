import AsyncStorage from '@react-native-async-storage/async-storage';
import { StoredTrack } from '../types';

const HISTORY_KEY = '@metmusic_play_history';
const MAX_HISTORY = 50; // Guardar últimas 50 canciones

export interface PlayHistoryItem {
  track: StoredTrack;
  playedAt: number; // timestamp
  source?: string;
  playlistId?: string;
}

class PlayHistoryService {
  // Obtener historial completo
  async getHistory(): Promise<PlayHistoryItem[]> {
    try {
      const history = await AsyncStorage.getItem(HISTORY_KEY);
      return history ? JSON.parse(history) : [];
    } catch (error) {
      console.log('Error getting history:', error);
      return [];
    }
  }

  // Agregar canción al historial
  async addToHistory(track: StoredTrack, source?: string, playlistId?: string) {
    try {
      console.log('📝 Intentando guardar en historial:', track.title, 'ID:', track.id);
      
      const history = await this.getHistory();
      console.log('📚 Historial actual antes de guardar:', history.length, 'canciones');
      
      const newItem: PlayHistoryItem = {
        track,
        playedAt: Date.now(),
        source,
        playlistId
      };

      // Evitar duplicados consecutivos (si es la misma canción que la última, actualizar timestamp)
      if (history.length > 0 && history[0].track.id === track.id) {
        history[0] = newItem;
        console.log('🔄 Actualizando timestamp de canción existente:', track.title);
      } else {
        history.unshift(newItem);
        console.log('➕ Agregando nueva canción al historial:', track.title);
      }

      // Limitar tamaño
      const trimmedHistory = history.slice(0, MAX_HISTORY);
      
      await AsyncStorage.setItem(HISTORY_KEY, JSON.stringify(trimmedHistory));
      
      console.log('✅ Historia guardada exitosamente. Total ahora:', trimmedHistory.length);
      
      // Verificar que se guardó
      const verifyHistory = await this.getHistory();
      console.log('🔍 Verificación - Historial después de guardar:', verifyHistory.length, 'canciones');
      if (verifyHistory.length > 0) {
        console.log('🔍 Primera canción en historial:', verifyHistory[0].track.title);
      }
    } catch (error) {
      console.log('❌ Error saving to history:', error);
    }
  }

  // Obtener última canción reproducida
  async getLastPlayed(): Promise<PlayHistoryItem | null> {
    const history = await this.getHistory();
    console.log('🔍 getLastPlayed - Historial encontrado:', history.length);
    return history.length > 0 ? history[0] : null;
  }

  // Obtener IDs de las últimas N canciones (sin duplicados consecutivos)
  // Obtener IDs de las últimas N canciones (SIN filtrar duplicados, respetando orden)
async getRecentTrackIds(limit: number = 5): Promise<number[]> {
  const history = await this.getHistory();
  
  // SIMPLEMENTE tomar los primeros N IDs en orden (ya vienen ordenados por fecha)
  const ids = history.slice(0, limit).map(item => item.track.id);
  
  console.log('🔍 Recent track IDs (ordenados):', ids);
  console.log('🔍 Recent tracks:', history.slice(0, limit).map(h => h.track.title));
  
  return ids;
}

  // Obtener canciones similares basadas en historial (versión simplificada)
  async getSimilarFromHistory(): Promise<StoredTrack[]> {
    const history = await this.getHistory();
    if (history.length === 0) return [];

    // Obtener artistas más escuchados
    const artistCount: Record<string, number> = {};
    
    history.slice(0, 20).forEach(item => {
      if (item.track.artist) {
        artistCount[item.track.artist] = (artistCount[item.track.artist] || 0) + 1;
      }
    });

    // Por ahora retornamos las últimas 5 canciones del historial
    return history.slice(0, 5).map(item => item.track);
  }

  // Limpiar historial
  async clearHistory() {
    try {
      await AsyncStorage.removeItem(HISTORY_KEY);
      console.log('🗑️ Historial limpiado');
    } catch (error) {
      console.log('Error clearing history:', error);
    }
  }
}

export default new PlayHistoryService();