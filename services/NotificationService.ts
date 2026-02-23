// services/NotificationService.ts - VERSIÓN FINAL
import { Platform } from 'react-native';
import { PlaybackNotificationManager } from 'react-native-audio-api';

interface NotificationHandlers {
  onPlay: () => void;
  onPause: () => void;
  onNext: () => void;
  onPrevious: () => void;
  onSeek: (seconds: number) => void;
}

class NotificationService {
  private listeners: any[] = [];
  private isAndroid = Platform.OS === 'android';
  private lastUpdate = 0;
  private currentState: 'playing' | 'paused' = 'paused';
  private currentTrackInfo: any = null;
  
  async setup(handlers: NotificationHandlers) {
    this.cleanup();
    
    console.log('🔔 Configurando controles de notificación...');
    
    try {
      // Habilitar controles
      await PlaybackNotificationManager.enableControl('play', true);
      await PlaybackNotificationManager.enableControl('pause', true);
      await PlaybackNotificationManager.enableControl('next', true);
      await PlaybackNotificationManager.enableControl('previous', true);
      await PlaybackNotificationManager.enableControl('seekTo', true);
      
      // Configurar listeners
      this.listeners = [
        PlaybackNotificationManager.addEventListener('playbackNotificationPlay', () => {
          console.log('🎮 ▶️ Play desde notificación');
          this.currentState = 'playing';
          handlers.onPlay();
          this.forceSync();
        }),
        
        PlaybackNotificationManager.addEventListener('playbackNotificationPause', () => {
          console.log('🎮 ⏸️ Pause desde notificación');
          this.currentState = 'paused';
          handlers.onPause();
          this.forceSync();
        }),
        
        PlaybackNotificationManager.addEventListener('playbackNotificationNext', () => {
          console.log('🎮 ⏭️ Next desde notificación');
          handlers.onNext();
        }),
        
        PlaybackNotificationManager.addEventListener('playbackNotificationPrevious', () => {
          console.log('🎮 ⏮️ Previous desde notificación');
          handlers.onPrevious();
        }),
        
        PlaybackNotificationManager.addEventListener('playbackNotificationSeekTo', (event) => {
          console.log('🎮 ⏩ Seek a', event.value, 'segundos');
          handlers.onSeek(event.value);
        })
      ];
      
      // Mostrar notificación inicial
      await PlaybackNotificationManager.show({
        title: 'MetMusic',
        artist: 'Cargando...',
        duration: 0,
        elapsedTime: 0,
        state: 'paused'
      });
      
      console.log('✅ Controles configurados correctamente');
      
    } catch (error) {
      console.log('❌ Error configurando notificación:', error);
    }
  }
  
  async updateMetadata(track: any, position: number, isPlaying: boolean) {
    if (!track) return;
    
    try {
      this.currentTrackInfo = track;
      this.currentState = isPlaying ? 'playing' : 'paused';
      
      // Evitar actualizaciones demasiado frecuentes
      const now = Date.now();
      if (now - this.lastUpdate < 100) return;
      this.lastUpdate = now;
      
      const positionSecs = Math.floor(position / 1000);
      const durationSecs = Math.floor((track.duration || 0) / 1000);
      
      await PlaybackNotificationManager.show({
        title: track.title || 'Sin título',
        artist: track.artist || 'Artista desconocido',
        artwork: track.coverUrl,
        duration: durationSecs,
        elapsedTime: positionSecs,
        state: this.currentState
      });
      
      // Log cada 5 segundos
      if (positionSecs % 5 === 0) {
        console.log(`📱 Notificación: ${track.title} - ${positionSecs}/${durationSecs}s [${this.currentState === 'playing' ? '▶️' : '⏸️'}]`);
      }
    } catch (error) {
      console.log('Error actualizando notificación:', error);
    }
  }
  
  // ✅ NUEVO: Forzar sincronización completa
  async forceSync() {
    if (!this.currentTrackInfo) return;
    
    try {
      console.log(`🔄 Forzando sincronización de notificación: ${this.currentState}`);
      
      await PlaybackNotificationManager.show({
        title: this.currentTrackInfo.title || 'Sin título',
        artist: this.currentTrackInfo.artist || 'Artista desconocido',
        artwork: this.currentTrackInfo.coverUrl,
        duration: Math.floor((this.currentTrackInfo.duration || 0) / 1000),
        elapsedTime: 0,
        state: this.currentState
      });
    } catch (error) {
      console.log('Error en forceSync:', error);
    }
  }
  
  cleanup() {
    this.listeners.forEach(listener => listener?.remove());
    this.listeners = [];
    PlaybackNotificationManager.hide().catch(() => {});
    console.log('🔔 Notificación limpiada');
  }
}

export default new NotificationService();