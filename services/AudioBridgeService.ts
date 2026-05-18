// services/AudioBridgeService.ts

import QobuzBridgeService from './QobuzBridgeService';

class AudioBridgeService {
  async getPlayableUrl(isrc: string | undefined | null, trackId: string): Promise<string> {
    console.log(`\n🔀 [AudioBridge] Procesando solicitud de stream para Track ID: ${trackId}`);

    if (isrc && isrc.trim() !== '') {
      try {
        console.log(`📡 [AudioBridge] Buscando coincidencia para ISRC: [${isrc}] localmente...`);
        
        const searchResult = await QobuzBridgeService.search(isrc);
        
        // 🎯 MAPEO EXACTO: Accedemos directamente a la estructura real descubierta en el log
        const items = searchResult?.data?.tracks?.items || [];
        
        if (items.length > 0) {
          // Tomamos la primera coincidencia (que en tu log es la versión Hi-Res de 24 bits)
          const matchedTrack = items[0];
          const qobuzTrackId = matchedTrack.id?.toString();
          
          if (qobuzTrackId) {
            console.log(`🎯 [AudioBridge] ¡Coincidencia Exacta! Título: "${matchedTrack.title}" | Qobuz ID: ${qobuzTrackId} | Calidad: ${matchedTrack.maximum_bit_depth}-bit`);
            
            // Solicitamos la URL de streaming final usando el puente local
            const streamUrl = await QobuzBridgeService.getStreamUrl(qobuzTrackId);
            return streamUrl;
          }
        } else {
          console.warn(`⚠️ [AudioBridge] No se encontraron tracks en el objeto de Qobuz para el ISRC: [${isrc}]`);
        }
      } catch (error: any) {
        console.error(`❌ [AudioBridge] Error en el puente local de Qobuz: [${error?.message || error}]`);
      }
    } else {
      console.log(`ℹ️ [AudioBridge] Track sin ISRC. Saltando directamente al stream nativo.`);
    }

    // FALLBACK: Solo se ejecuta si el bloque de arriba falla o no hay canciones
    console.warn(`♻️ [AudioBridge] Activando fallback directo hacia Monochrome API...`);
    try {
      const monochromeFallbackUrl = `https://api.monochrome.tf/track/?id=${trackId}&quality=HIGH`;
      console.log(`🔗 [AudioBridge] URL de emergencia generada: ${monochromeFallbackUrl}`);
      return monochromeFallbackUrl;
    } catch (fallbackError) {
      console.error(`💀 [AudioBridge] Fallaron todos los métodos de resolución.`);
      return 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3';
    }
  }
}

export default new AudioBridgeService();