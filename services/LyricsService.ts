import MonochromeAPI from './MonochromeAPI';

export interface LyricLine {
  time: number;  // en segundos
  text: string;
}

export interface LyricsData {
  synced: LyricLine[];
  unsynced: string[];
  provider: 'lrclib' | 'genius' | 'tidal' | null;
}

class LyricsService {
  private cache: Map<number, LyricsData> = new Map();
  private geniusToken = 'QmS9OvsS-7ifRBKx_ochIPQU7oejIS9Eo_z5iWHmCPyhwLVQID3pYTHJmJTa6z8z';

  // Obtener letras de LRCLIB.net (mejor fuente para synced lyrics)
  async fetchFromLRCLIB(track: any): Promise<LyricsData | null> {
    try {
      const artist = track.artist;
      const title = track.title;
      const album = track.album;
      const duration = track.duration;

      const params = new URLSearchParams({
        track_name: title,
        artist_name: artist,
      });
      
      if (album) params.append('album_name', album);
      if (duration) params.append('duration', duration.toString());

      const response = await fetch(`https://lrclib.net/api/get?${params.toString()}`);
      
      if (!response.ok) return null;

      const data = await response.json();

      if (data.syncedLyrics) {
        const synced = this.parseSyncedLyrics(data.syncedLyrics);
        const unsynced = data.plainLyrics ? data.plainLyrics.split('\n').filter((l: string) => l.trim()) : [];

        return {
          synced,
          unsynced,
          provider: 'lrclib'
        };
      }

      return null;
    } catch (error) {
      console.log('❌ LRCLIB fetch failed:', error);
      return null;
    }
  }

  // Obtener letras directamente de Tidal (si la API lo soporta)
  async fetchFromTidal(trackId: number): Promise<LyricsData | null> {
    try {
      // Algunas instancias de la API pueden soportar /lyrics endpoint
      const response = await MonochromeAPI.fetchWithRetry(`/lyrics?id=${trackId}`);
      const data = await response.json();
      
      if (data?.syncedLyrics) {
        return {
          synced: this.parseSyncedLyrics(data.syncedLyrics),
          unsynced: data.plainLyrics?.split('\n') || [],
          provider: 'tidal'
        };
      }
      
      return null;
    } catch {
      return null;
    }
  }

  // Buscar en Genius (para anotaciones, no synced lyrics)
  async searchGenius(title: string, artist: string) {
    try {
      const cleanTitle = title.split('(')[0].split('-')[0].trim();
      const query = encodeURIComponent(`${cleanTitle} ${artist}`);
      
      const response = await fetch(
        `https://api.genius.com/search?q=${query}&access_token=${this.geniusToken}`
      );
      
      if (!response.ok) return null;
      
      const data = await response.json();
      return data.response.hits[0]?.result || null;
    } catch (error) {
      console.log('Genius search failed:', error);
      return null;
    }
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
      .filter(Boolean) as LyricLine[];
  }

  // Formatear a LRC para descargar
  formatAsLRC(lyrics: LyricsData, track: any): string {
    let lrc = `[ti:${track.title}]\n`;
    lrc += `[ar:${track.artist}]\n`;
    lrc += `[al:${track.album}]\n`;
    lrc += `[by:${lyrics.provider}]\n`;
    lrc += '\n';
    
    if (lyrics.synced.length > 0) {
      lyrics.synced.forEach(line => {
        const minutes = Math.floor(line.time / 60);
        const seconds = Math.floor(line.time % 60);
        const centiseconds = Math.floor((line.time % 1) * 100);
        lrc += `[${minutes}:${seconds.toString().padStart(2, '0')}.${centiseconds.toString().padStart(2, '0')}] ${line.text}\n`;
      });
    } else {
      lyrics.unsynced.forEach(line => {
        lrc += `${line}\n`;
      });
    }
    
    return lrc;
  }

  // Método principal: intenta todas las fuentes
  async getLyrics(track: any): Promise<LyricsData | null> {
    // Verificar caché
    if (this.cache.has(track.id)) {
      return this.cache.get(track.id)!;
    }

    // 1. Intentar LRCLIB (mejor para synced)
    let lyrics = await this.fetchFromLRCLIB(track);
    
    // 2. Si no, intentar Tidal
    if (!lyrics) {
      lyrics = await this.fetchFromTidal(track.id);
    }

    // Guardar en caché si se encontró
    if (lyrics) {
      this.cache.set(track.id, lyrics);
    }

    return lyrics;
  }

  // Limpiar caché
  clearCache() {
    this.cache.clear();
  }
}

const lyricsService = new LyricsService();
export default lyricsService;