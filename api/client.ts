import axios from 'axios';
import { decode as base64Decode } from 'base-64';
import { Track } from '../types';

// Lista de APIs para fallback (de tu documentación)
const API_PROVIDERS = [
  'https://hund.qqdl.site',
  'https://monochrome-api.samidy.com',
  'https://api.monochrome.tf',
  'https://arran.monochrome.tf',
  'https://triton.squid.wtf',
  'https://wolf.qqdl.site',
  'https://maus.qqdl.site',
  'https://vogel.qqdl.site',
  'https://katze.qqdl.site',
  'https://hifi-one.spotisaver.net',
  'https://hifi-two.spotisaver.net',
  'https://tidal.kinoplus.online',
  'https://tidal-api.binimum.org',
];

const QUALITIES = ['LOW', 'HIGH', 'LOSSLESS', 'HI_RES_LOSSLESS'];

interface ApiResponse {
  version: string;
  data: any;
}

interface TrackData {
  id: number;
  title: string;
  duration: number;
  artist?: {
    id: number;
    name: string;
    picture?: string;
  };
  album?: {
    id: number;
    title: string;
    cover?: string;
  };
  audioQuality?: string;
  explicit?: boolean;
}

class ApiClient {
  private currentProvider: number = 0;
  private readonly maxRetries: number = 3;

  // Cambiar al siguiente provider si hay error
  private switchProvider(): void {
    this.currentProvider = (this.currentProvider + 1) % API_PROVIDERS.length;
    console.log(`🔄 Cambiando a provider: ${API_PROVIDERS[this.currentProvider]}`);
  }

  // Obtener URL base actual
  private getBaseUrl(): string {
    return API_PROVIDERS[this.currentProvider];
  }

  // Búsqueda de tracks
  async searchTracks(query: string, retryCount: number = 0): Promise<Track[]> {
    try {
      console.log(`🔍 Buscando: "${query}" en ${this.getBaseUrl()}`);
      
      const response = await axios.get<ApiResponse>(`${this.getBaseUrl()}/search/`, {
        params: { s: query, limit: 25 },
        timeout: 10000,
      });

      if (response.data?.data?.items) {
        const tracks = response.data.data.items.map((item: TrackData) => 
          this.formatTrack(item)
        );
        console.log(`✅ Encontrados ${tracks.length} resultados`);
        return tracks;
      }
      
      return [];
    } catch (error) {
      console.log(`❌ Error en search con ${this.getBaseUrl()}:`, 
        error instanceof Error ? error.message : 'Unknown error');
      
      if (retryCount < this.maxRetries) {
        this.switchProvider();
        return this.searchTracks(query, retryCount + 1);
      }
      
      return [];
    }
  }

  // Obtener URL de audio
  async getAudioUrl(trackId: number, quality: string = 'LOSSLESS', retryCount: number = 0): Promise<string | null> {
    try {
      console.log(`🎵 Obteniendo audio del track ${trackId} (${quality}) en ${this.getBaseUrl()}`);
      
      const response = await axios.get<ApiResponse>(`${this.getBaseUrl()}/track/`, {
        params: { id: trackId, quality },
        timeout: 15000,
      });

      if (!response.data?.data) {
        throw new Error('No data in response');
      }

      const { manifestMimeType, manifest } = response.data.data;
      
      if (!manifest) {
        throw new Error('No manifest in response');
      }

      console.log(`📦 Tipo de manifest: ${manifestMimeType}`);
      
      // Decodificar manifest (base64)
      const manifestDecoded = base64Decode(manifest);
      
      // Procesar según el tipo
      let audioUrl: string | null = null;
      
      if (manifestMimeType === 'application/vnd.tidal.bts') {
        audioUrl = this.parseBtsManifest(manifestDecoded);
      } else if (manifestMimeType === 'application/dash+xml') {
        audioUrl = this.parseDashManifest(manifestDecoded);
      } else {
        // Intentar parsear como JSON de todas formas
        try {
          audioUrl = this.parseBtsManifest(manifestDecoded);
        } catch {
          console.log('⚠️ No se pudo parsear el manifest');
        }
      }

      if (audioUrl) {
        console.log(`✅ URL obtenida: ${audioUrl.substring(0, 100)}...`);
        
        // Verificar que la URL sea accesible (opcional)
        try {
          const testResponse = await axios.head(audioUrl, { timeout: 5000 });
          if (testResponse.status === 200 || testResponse.status === 206) {
            console.log('✅ URL verificada');
            return audioUrl;
          }
        } catch {
          console.log('⚠️ No se pudo verificar la URL, pero intentaremos reproducir');
          return audioUrl; // Devolvemos igual, puede funcionar
        }
      }
      
      return audioUrl;
    } catch (error) {
      console.log(`❌ Error en getAudioUrl con ${this.getBaseUrl()}:`, 
        error instanceof Error ? error.message : 'Unknown error');
      
      if (retryCount < this.maxRetries) {
        this.switchProvider();
        return this.getAudioUrl(trackId, quality, retryCount + 1);
      }
      
      return null;
    }
  }

  // Obtener URL con fallback de calidades
  async getAudioUrlWithFallback(trackId: number): Promise<string | null> {
    console.log(`🔍 Buscando audio para track ${trackId} con fallback de calidades`);
    
    for (const quality of QUALITIES) {
      console.log(`  └─ Probando calidad: ${quality}`);
      const url = await this.getAudioUrl(trackId, quality);
      
      if (url) {
        console.log(`  ✅ Éxito con calidad: ${quality}`);
        
        // Asegurar HTTPS
        if (url.startsWith('http://')) {
          const httpsUrl = url.replace('http://', 'https://');
          console.log('  🔄 Convertido a HTTPS');
          return httpsUrl;
        }
        
        return url;
      }
      
      // Pequeña pausa entre intentos
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    
    console.log('❌ No se pudo obtener URL de audio');
    
    // Último recurso: URL de prueba
    return this.getFallbackTestUrl();
  }

  // Parsear manifest BTS (JSON)
  private parseBtsManifest(manifestStr: string): string | null {
    try {
      const data = JSON.parse(manifestStr);
      
      // Buscar URLs en diferentes formatos posibles
      if (data.urls && Array.isArray(data.urls) && data.urls.length > 0) {
        return data.urls[0];
      }
      
      if (data.url) {
        return data.url;
      }
      
      if (data.manifest?.urls?.[0]) {
        return data.manifest.urls[0];
      }
      
      console.log('❌ No se encontró URL en manifest BTS');
      return null;
    } catch (e) {
      console.log('❌ Error parsing BTS manifest:', e instanceof Error ? e.message : 'Unknown error');
      return null;
    }
  }

  // Parsear manifest DASH (XML) - simplificado
  private parseDashManifest(manifestStr: string): string | null {
    try {
      console.log('🔍 Parseando DASH XML...');
      
      // Buscar URL de inicialización
      const initMatch = manifestStr.match(/initialization="([^"]+)"/);
      if (initMatch && initMatch[1]) {
        console.log('✅ URL de inicialización encontrada');
        return initMatch[1];
      }
      
      // Buscar URL de media
      const mediaMatch = manifestStr.match(/media="([^"]+)"/);
      if (mediaMatch && mediaMatch[1]) {
        // Reemplazar $Number$ por 0 para obtener la URL base
        const url = mediaMatch[1].replace(/\$Number\$/, '0');
        console.log('✅ URL de media encontrada');
        return url;
      }
      
      // Buscar cualquier URL en el XML
      const urlRegex = /https?:\/\/[^\s"<>]+/g;
      const matches = manifestStr.match(urlRegex);
      
      if (matches && matches.length > 0) {
        // Filtrar URLs que parecen de audio
        const audioUrl = matches.find(url => 
          url.includes('.mp4') || 
          url.includes('.flac') || 
          url.includes('.m4a') ||
          url.includes('/mediatracks/')
        );
        
        if (audioUrl) {
          console.log('✅ URL encontrada en XML');
          return audioUrl;
        }
      }
      
      console.log('❌ No se encontró URL en DASH XML');
      return null;
    } catch (e) {
      console.log('❌ Error parsing DASH manifest:', e instanceof Error ? e.message : 'Unknown error');
      return null;
    }
  }

  // Obtener recomendaciones
  async getRecommendations(trackId: number, retryCount: number = 0): Promise<Track[]> {
    try {
      console.log(`🎯 Obteniendo recomendaciones para track ${trackId} en ${this.getBaseUrl()}`);
      
      const response = await axios.get<ApiResponse>(`${this.getBaseUrl()}/recommendations/`, {
        params: { id: trackId },
        timeout: 10000,
      });

      if (response.data?.data?.items) {
        const tracks = response.data.data.items.map((item: any) => 
          this.formatTrack(item.track)
        );
        console.log(`✅ ${tracks.length} recomendaciones obtenidas`);
        return tracks;
      }
      
      return [];
    } catch (error) {
      console.log('❌ Error en recommendations:', 
        error instanceof Error ? error.message : 'Unknown error');
      
      if (retryCount < this.maxRetries) {
        this.switchProvider();
        return this.getRecommendations(trackId, retryCount + 1);
      }
      
      return [];
    }
  }

  // Obtener información detallada de un track
  async getTrackInfo(trackId: number, retryCount: number = 0): Promise<any | null> {
    try {
      const response = await axios.get<ApiResponse>(`${this.getBaseUrl()}/info/`, {
        params: { id: trackId },
        timeout: 10000,
      });

      return response.data?.data || null;
    } catch (error) {
      console.log('❌ Error obteniendo info del track:', 
        error instanceof Error ? error.message : 'Unknown error');
      
      if (retryCount < this.maxRetries) {
        this.switchProvider();
        return this.getTrackInfo(trackId, retryCount + 1);
      }
      
      return null;
    }
  }

  // Formatear track para nuestra app
  private formatTrack(item: TrackData): Track {
    // Construir URL de la portada
    let coverUrl = 'https://via.placeholder.com/640x640.png?text=No+Cover';
    
    if (item.album?.cover) {
      coverUrl = `https://resources.tidal.com/images/${item.album.cover}/640x640.jpg`;
    }

    return {
      id: item.id,
      title: item.title || 'Sin título',
      artist: item.artist?.name || 'Artista desconocido',
      album: item.album?.title || 'Álbum desconocido',
      coverUrl: coverUrl,
      duration: item.duration || 0,
      explicit: item.explicit || false,
      quality: item.audioQuality || 'LOSSLESS',
    };
  }

  // URL de prueba para desarrollo (cuando todo falla)
  private getFallbackTestUrl(): string | null {
    const testUrls = [
      'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3',
      'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-2.mp3',
      'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-3.mp3',
    ];
    
    // Devolver una URL de prueba aleatoria
    const randomIndex = Math.floor(Math.random() * testUrls.length);
    console.log(`🎵 Usando URL de prueba: ${testUrls[randomIndex]}`);
    return testUrls[randomIndex];
  }

  // Método para probar la conexión con diferentes providers
  async testProviders(): Promise<void> {
    console.log('🔍 Probando proveedores de API...');
    
    for (let i = 0; i < API_PROVIDERS.length; i++) {
      try {
        const provider = API_PROVIDERS[i];
        console.log(`Probando ${i + 1}/${API_PROVIDERS.length}: ${provider}`);
        
        const response = await axios.get(`${provider}/search/`, {
          params: { s: 'test', limit: 1 },
          timeout: 5000,
        });
        
        if (response.status === 200) {
          console.log(`✅ Provider ${i + 1} funciona correctamente`);
        }
      } catch (error) {
        console.log(`❌ Provider ${i + 1} falló:`, 
          error instanceof Error ? error.message : 'Unknown error');
      }
    }
  }
}

// Exportar una instancia única
export default new ApiClient();