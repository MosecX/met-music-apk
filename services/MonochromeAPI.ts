// services/MonochromeAPI.ts

const RATE_LIMIT_ERROR_MESSAGE = 'Rate limit exceeded';

interface InstancesResponse {
  api: string[];
  streaming: string[];
}

class MonochromeAPI {
  // Forzamos la base url fija como una constante de la clase
  private readonly BASE_URL = 'https://api.monochrome.tf';
  private streamCache: Map<string, string> = new Map();
  private abortController: AbortController | null = null;

  constructor() {
    console.log(`✅ MonochromeAPI inicializada de forma exclusiva en: ${this.BASE_URL}`);
  }

  /**
   * Mantenemos el método para no romper la compatibilidad si otros componentes 
   * de tu app lo consumen, pero devolviendo estrictamente la URL deseada.
   */
  async getInstances(type: 'api' | 'streaming' = 'api'): Promise<string[]> {
    return [this.BASE_URL];
  }

  // Carga de instancias deprecada de forma segura
  async loadInstances(): Promise<void> {
    // Ya no requerimos consultar recursos externos de GitHub, usamos la instancia fija.
    console.log(`🔒 Instancia estática fijada: ${this.BASE_URL}`);
  }

  // Fetch con reintentos optimizado exclusivamente sobre la misma API
  async fetchWithRetry(relativePath: string, options: { type?: 'api' | 'streaming'; signal?: AbortSignal } = {}) {
    // Al solo haber una instancia, reducimos los reintentos a un máximo de 3 en caso de fallos de red sutiles
    const maxAttempts = 3;
    let lastError: Error | null = null;

    const cleanPath = relativePath.startsWith('/') ? relativePath : `/${relativePath}`;
    const url = `${this.BASE_URL}${cleanPath}`;

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        const response = await fetch(url, { signal: options.signal });

        if (response.status === 429) {
          console.warn(`⚠️ Rate limit alcanzado en ${this.BASE_URL}. Intento ${attempt}/${maxAttempts}. Esperando...`);
          await this.delay(600);
          continue;
        }

        if (response.ok) {
          return response;
        }

        if (response.status >= 500) {
          console.warn(`⚠️ Error de servidor ${response.status} en la instancia única. Reintentando...`);
          await this.delay(300);
          continue;
        }

        lastError = new Error(`Petición fallida con estado HTTP ${response.status}`);
      } catch (error: any) {
        if (error.name === 'AbortError') throw error;
        lastError = error;
        console.warn(`⚠️ Error de red/conexión en la instancia única: ${error.message}`);
        await this.delay(200);
      }
    }

    throw lastError || new Error(`No se pudo conectar con la API única en la ruta: ${relativePath}`);
  }

  // Delay helper
  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  // Buscar tracks
  async searchTracks(query: string, options: { signal?: AbortSignal } = {}): Promise<any[]> {
    try {
      const response = await this.fetchWithRetry(`/search/?s=${encodeURIComponent(query)}`, options);
      const data = await response.json();
      
      const items = this.findItemsInResponse(data, 'tracks');
      
      return items.map((item: any) => this.prepareTrack(item.track || item));
    } catch (error) {
      if ((error as any).name === 'AbortError') throw error;
      console.error('Error searching tracks:', error);
      return [];
    }
  }

  // Buscar en la respuesta recursivamente
  private findItemsInResponse(data: any, key: string): any[] {
    if (!data || typeof data !== 'object') return [];

    if (data.items && Array.isArray(data.items)) {
      return data.items;
    }

    if (data.data?.items) {
      return data.data.items;
    }

    if (Array.isArray(data)) {
      return data;
    }

    return [];
  }

  // Preparar track para nuestra app
  prepareTrack(track: any) {
    const normalized = { ...track };

    // Formatear artista
    if (!normalized.artist && Array.isArray(normalized.artists) && normalized.artists.length > 0) {
      normalized.artist = normalized.artists[0];
    }

    // Determinar calidad
    const quality = this.deriveTrackQuality(normalized);
    if (quality) {
      normalized.audioQuality = quality;
    }

    return {
      id: normalized.id,
      title: normalized.version ? `${normalized.title} (${normalized.version})` : normalized.title,
      artist: normalized.artist?.name || 'Unknown Artist',
      album: normalized.album?.title || 'Unknown Album',
      coverUrl: this.getCoverUrl(normalized.album?.cover),
      duration: normalized.duration || 0,
      quality: normalized.audioQuality || 'LOW',
      isrc: normalized.isrc || null, // Aseguramos que propague el ISRC nativo de Tidal al mapear
    };
  }

  // Derivar calidad del track
  private deriveTrackQuality(track: any): string {
    const tags = track.mediaMetadata?.tags || [];
    
    if (tags.includes('HIRES_LOSSLESS')) {
      return 'HI_RES_LOSSLESS';
    } else if (tags.includes('LOSSLESS')) {
      return 'LOSSLESS';
    } else if (tags.includes('HIGH')) {
      return 'HIGH';
    }
    
    return 'LOW';
  }

  // Obtener URL de la portada
  getCoverUrl(coverId: string, size: number = 640): string {
    if (!coverId) return 'https://via.placeholder.com/640';
    
    if (coverId.startsWith('http')) {
      return coverId;
    }

    const formattedId = coverId.replace(/-/g, '/');
    return `https://resources.tidal.com/images/${formattedId}/${size}x${size}.jpg`;
  }

  // Obtener URL del stream
  async getStreamUrl(id: number, quality: string = 'HIGH'): Promise<string | null> {
    const cacheKey = `${id}_${quality}`;
    
    if (this.streamCache.has(cacheKey)) {
      return this.streamCache.get(cacheKey)!;
    }

    try {
      const response = await this.fetchWithRetry(`/track/?id=${id}&quality=${quality}`, { 
        type: 'streaming' 
      });
      
      const data = await response.json();
      const streamUrl = this.extractStreamUrlFromManifest(data);
      
      if (streamUrl) {
        this.streamCache.set(cacheKey, streamUrl);
        return streamUrl;
      }

      return null;
    } catch (error) {
      console.error('Error getting stream URL:', error);
      return null;
    }
  }

  // Extraer URL del manifest
  private extractStreamUrlFromManifest(data: any): string | null {
    try {
      const manifest = data.data?.manifest || data.manifest;
      
      if (!manifest) return null;

      const decoded = atob(manifest);

      // Intentar parsear como JSON (BTS)
      try {
        const jsonData = JSON.parse(decoded);
        if (jsonData.urls?.[0]) {
          let url = jsonData.urls[0];
          if (url.startsWith('http://')) url = url.replace('http://', 'https://');
          return url;
        }
      } catch {
        // Buscar URL en XML
        const urlMatch = decoded.match(/https?:\/\/[^\s"<>]+(?:\.mp4|\.m4a|\.flac)/);
        if (urlMatch) return urlMatch[0];
      }

      return null;
    } catch (error) {
      console.error('Failed to decode manifest:', error);
      return null;
    }
  }

  // Obtener recomendaciones
  async getRecommendations(id: number): Promise<any[]> {
    try {
      const response = await this.fetchWithRetry(`/recommendations/?id=${id}`);
      const data = await response.json();
      
      const items = this.findItemsInResponse(data, 'recommendations');
      
      return items.map((item: any) => this.prepareTrack(item.track || item));
    } catch (error) {
      console.error('Error getting recommendations:', error);
      return [];
    }
  }

  // Obtener recomendaciones basadas en múltiples IDs
  async getRecommendationsFromHistory(trackIds: number[], limit: number = 20): Promise<any[]> {
    if (trackIds.length === 0) {
      return this.getRecommendations(424698825); // Fallback a default
    }

    try {
      const mainId = trackIds[0];
      const mainRecommendations = await this.getRecommendations(mainId);
      
      if (trackIds.length > 1) {
        const additionalIds = trackIds.slice(1, 3);
        const additionalPromises = additionalIds.map(id => this.getRecommendations(id));
        const additionalResults = await Promise.all(additionalPromises);
        
        const allRecommendations = [
          ...mainRecommendations,
          ...additionalResults.flat()
        ];
        
        const uniqueTracks = Array.from(
          new Map(allRecommendations.map(track => [track.id, track])).values()
        );
        
        const shuffled = uniqueTracks.sort(() => Math.random() - 0.5);
        
        return shuffled.slice(0, limit);
      }
      
      return mainRecommendations.slice(0, limit);
    } catch (error) {
      console.error('Error getting recommendations from history:', error);
      return this.getRecommendations(424698825); // Fallback
    }
  }

  // Obtener metadata del track
  async getTrackMetadata(id: number): Promise<any> {
    const response = await this.fetchWithRetry(`/info/?id=${id}`);
    const json = await response.json();
    const data = json.data || json;

    const items = Array.isArray(data) ? data : [data];
    const found = items.find((i: any) => i.id == id || (i.item && i.item.id == id));

    if (found) {
      return this.prepareTrack(found.item || found);
    }

    throw new Error('Track metadata not found');
  }

  // Método que garantiza una URL reproducible
  async getPlayableUrl(id: number): Promise<string> {
    let url = await this.getStreamUrl(id, 'HIGH');
    if (url) return url;

    url = await this.getStreamUrl(id, 'LOSSLESS');
    if (url) return url;

    url = await this.getStreamUrl(id, 'LOW');
    if (url) return url;

    console.log('⚠️ Usando URL de prueba');
    return 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3';
  }

  // Limpiar cache
  clearCache(): void {
    this.streamCache.clear();
  }

  // Cancelar peticiones en curso
  cancelRequests(): void {
    if (this.abortController) {
      this.abortController.abort();
    }
    this.abortController = new AbortController();
  }
}

export default new MonochromeAPI();