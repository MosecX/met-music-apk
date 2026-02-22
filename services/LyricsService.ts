import MonochromeAPI from './MonochromeAPI';

export interface LyricLine {
  time: number;  // en segundos
  text: string;
}

export interface LyricsData {
  synced: LyricLine[];
  unsynced: string[];
  provider: 'lrclib' | 'tidal' | 'fallback' | null;
}

class LyricsService {
  private cache: Map<number, LyricsData> = new Map();

  // Fetch con timeout para evitar esperas infinitas
  private async fetchWithTimeout(url: string, timeout = 20000): Promise<Response | null> {
    try {
      const controller = new AbortController();
      const id = setTimeout(() => controller.abort(), timeout);

      const response = await fetch(url, {
        signal: controller.signal,
        headers: {
          'User-Agent': 'MetMusic/1.0',
        }
      });
      clearTimeout(id);
      return response;
    } catch (error) {
      console.log('⏱️ Timeout/Error fetching:', url.substring(0, 50));
      return null;
    }
  }

  // Buscar en LRCLIB (mejor para letras sincronizadas)
  async fetchFromLRCLIB(track: any): Promise<LyricsData | null> {
    try {
      const artist = track.artist;
      const title = track.title;
      
      console.log('🔍 Buscando en LRCLIB:', `${title} - ${artist}`);

      // Intentar primero con búsqueda exacta
      const params = new URLSearchParams({
        track_name: title,
        artist_name: artist,
      });
      
      let response = await this.fetchWithTimeout(`https://lrclib.net/api/get?${params.toString()}`);
      
      // Si falla, intentar búsqueda general
      if (!response || !response.ok) {
        console.log('📝 Búsqueda exacta falló, intentando búsqueda general...');
        const searchParams = new URLSearchParams({
          q: `${artist} ${title}`.substring(0, 100)
        });
        response = await this.fetchWithTimeout(`https://lrclib.net/api/search?${searchParams.toString()}`);
        
        if (response?.ok) {
          const results = await response.json();
          if (results && results.length > 0) {
            // Tomar el primer resultado
            const firstResult = results[0];
            const trackParams = new URLSearchParams({
              track_name: firstResult.trackName,
              artist_name: firstResult.artistName,
            });
            response = await this.fetchWithTimeout(`https://lrclib.net/api/get?${trackParams.toString()}`);
          }
        }
      }

      if (!response || !response.ok) {
        console.log('❌ LRCLIB no encontró letras');
        return null;
      }

      const data = await response.json();

      // Procesar letras
      const synced: LyricLine[] = [];
      const unsynced: string[] = [];

      if (data.syncedLyrics) {
        console.log('✅ Letras sincronizadas encontradas');
        const parsed = this.parseSyncedLyrics(data.syncedLyrics);
        synced.push(...parsed);
      }

      if (data.plainLyrics) {
        console.log('📝 Letras planas encontradas');
        const plain = data.plainLyrics.split('\n').filter((l: string) => l.trim());
        unsynced.push(...plain);
      }

      if (synced.length > 0 || unsynced.length > 0) {
        return {
          synced,
          unsynced,
          provider: 'lrclib'
        };
      }

      return null;
    } catch (error: any) {
      console.log('❌ Error en LRCLIB:', error?.message || 'Unknown error');
      return null;
    }
  }

  // Buscar en Tidal a través de la API de Monochrome
  async fetchFromTidal(trackId: number): Promise<LyricsData | null> {
    try {
      console.log('🔍 Buscando en Tidal...');
      
      // Algunas instancias de la API pueden soportar /lyrics endpoint
      const response = await MonochromeAPI.fetchWithRetry(`/lyrics?id=${trackId}`);
      
      if (!response.ok) {
        console.log('❌ Tidal no respondió');
        return null;
      }
      
      const data = await response.json();
      
      if (data?.syncedLyrics) {
        console.log('✅ Letras sincronizadas de Tidal');
        return {
          synced: this.parseSyncedLyrics(data.syncedLyrics),
          unsynced: data.plainLyrics?.split('\n') || [],
          provider: 'tidal'
        };
      }
      
      return null;
    } catch (error: any) {
      console.log('❌ Tidal fetch failed:', error?.message || 'Unknown error');
      return null;
    }
  }

  // Fallback informativo
  private getFallbackLyrics(track: any): LyricsData {
    console.log('📝 Usando fallback lyrics');
    return {
      synced: [],
      unsynced: [
        `🎵 ${track.title || 'Sin título'}`,
        `👤 ${track.artist || 'Artista desconocido'}`,
        `💿 ${track.album || 'Álbum desconocido'}`,
        ``,
        `No hay letras disponibles para esta canción.`,
        `Puedes buscar en:`,
        `• Google: "${track.title || ''} ${track.artist || ''} lyrics"`,
        `• Genius: https://genius.com/search?q=${encodeURIComponent(`${track.title || ''} ${track.artist || ''}`)}`,
        `• LRCLIB: https://lrclib.net/search?q=${encodeURIComponent(`${track.title || ''} ${track.artist || ''}`)}`
      ],
      provider: 'fallback'
    };
  }

  // Parsear letras sincronizadas (formato LRC)
  parseSyncedLyrics(subtitles: string): LyricLine[] {
    if (!subtitles) return [];
    
    const lines = subtitles.split('\n').filter(line => line.trim());
    
    return lines
      .map(line => {
        // Formato: [MM:SS.xx] Letra
        const match = line.match(/\[(\d+):(\d+)\.(\d+)\]\s*(.+)/);
        if (match) {
          const [, minutes, seconds, centiseconds, text] = match;
          const timeInSeconds = 
            parseInt(minutes) * 60 + 
            parseInt(seconds) + 
            parseInt(centiseconds) / 100;
          
          return { time: timeInSeconds, text: text.trim() };
        }
        return null;
      })
      .filter((line): line is LyricLine => line !== null);
  }

  // Método principal
  async getLyrics(track: any): Promise<LyricsData | null> {
    if (!track) return null;

    // Verificar caché
    if (this.cache.has(track.id)) {
      console.log('📦 Usando letras en caché');
      return this.cache.get(track.id)!;
    }

    console.log('🎤 Buscando letras para:', track.title, '-', track.artist);

    // 1. Intentar LRCLIB
    let lyrics = await this.fetchFromLRCLIB(track);
    
    // 2. Si no, intentar Tidal
    if (!lyrics) {
      console.log('🔄 Intentando con Tidal...');
      lyrics = await this.fetchFromTidal(track.id);
    }

    // 3. Si todo falla, usar fallback
    if (!lyrics) {
      console.log('🔄 Usando fallback lyrics');
      lyrics = this.getFallbackLyrics(track);
    }

    // Guardar en caché
    if (lyrics) {
      console.log('✅ Letras obtenidas de:', lyrics.provider);
      this.cache.set(track.id, lyrics);
    }

    return lyrics;
  }

  // Limpiar caché
  clearCache() {
    this.cache.clear();
    console.log('🗑️ Caché de letras limpiado');
  }
}

export default new LyricsService();