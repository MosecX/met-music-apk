const RATE_LIMIT_ERROR_MESSAGE = 'Rate limit exceeded';

// Interfaz para las instancias de API
interface InstancesResponse {
  api: string[];
  streaming: string[];
}

class MonochromeAPI {
  private INSTANCES_URL = 'https://raw.githubusercontent.com/Monochrome-music/monochrome/main/public/instances.json';
  private apiInstances: string[] = [];
  private streamingInstances: string[] = [];
  private streamCache: Map<string, string> = new Map();
  private abortController: AbortController | null = null;

  constructor() {
    // Precargar instancias al iniciar
    this.loadInstances();
  }

  // Cargar instancias desde GitHub
  async loadInstances(): Promise<void> {
    try {
      const response = await fetch(this.INSTANCES_URL);
      if (!response.ok) throw new Error('Failed to fetch instances');
      const data: InstancesResponse = await response.json();
      this.apiInstances = data.api || [];
      this.streamingInstances = data.streaming || [];
      console.log(`✅ Cargadas ${this.apiInstances.length} APIs y ${this.streamingInstances.length} streaming`);
    } catch (error) {
      console.error('❌ Error cargando instancias:', error);
      // Fallbacks
      this.apiInstances = [
        'https://arran.monochrome.tf',
        'https://api.monochrome.tf',
        'https://triton.squid.wtf',
        'https://wolf.qqdl.site',
      ];
      this.streamingInstances = [...this.apiInstances];
    }
  }

  // Obtener instancias según tipo
  async getInstances(type: 'api' | 'streaming' = 'api'): Promise<string[]> {
    if (this.apiInstances.length === 0) {
      await this.loadInstances();
    }
    return type === 'api' ? this.apiInstances : this.streamingInstances;
  }

  // Fetch con retry entre instancias
  async fetchWithRetry(relativePath: string, options: { type?: 'api' | 'streaming'; signal?: AbortSignal } = {}) {
    const type = options.type || 'api';
    const instances = await this.getInstances(type);
    
    if (instances.length === 0) {
      throw new Error(`No instances configured for type: ${type}`);
    }

    const maxTotalAttempts = instances.length * 2;
    let lastError: Error | null = null;
    let instanceIndex = Math.floor(Math.random() * instances.length);

    for (let attempt = 1; attempt <= maxTotalAttempts; attempt++) {
      const baseUrl = instances[instanceIndex % instances.length];
      const cleanBase = baseUrl.endsWith('/') ? baseUrl.slice(0, -1) : baseUrl;
      const cleanPath = relativePath.startsWith('/') ? relativePath : `/${relativePath}`;
      const url = `${cleanBase}${cleanPath}`;

      try {
        const response = await fetch(url, { signal: options.signal });

        if (response.status === 429) {
          console.warn(`⚠️ Rate limit en ${baseUrl}, probando siguiente...`);
          instanceIndex++;
          await this.delay(500);
          continue;
        }

        if (response.ok) {
          return response;
        }

        if (response.status >= 500) {
          console.warn(`⚠️ Error ${response.status} en ${baseUrl}, probando siguiente...`);
          instanceIndex++;
          continue;
        }

        lastError = new Error(`Request failed with status ${response.status}`);
        instanceIndex++;
      } catch (error: any) {
        if (error.name === 'AbortError') throw error;
        lastError = error;
        console.warn(`⚠️ Error de red en ${baseUrl}: ${error.message}`);
        instanceIndex++;
        await this.delay(200);
      }
    }

    throw lastError || new Error(`All instances failed for: ${relativePath}`);
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
      
      // Buscar la sección de tracks en la respuesta
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

  // NUEVO MÉTODO: Obtener recomendaciones basadas en múltiples IDs
  async getRecommendationsFromHistory(trackIds: number[], limit: number = 20): Promise<any[]> {
    if (trackIds.length === 0) {
      return this.getRecommendations(424698825); // Fallback a default
    }

    try {
      // Usar el ID más reciente para recomendaciones principales
      const mainId = trackIds[0];
      const mainRecommendations = await this.getRecommendations(mainId);
      
      // Si tenemos más IDs, obtener recomendaciones adicionales
      if (trackIds.length > 1) {
        const additionalIds = trackIds.slice(1, 3); // Usar hasta 3 IDs diferentes
        const additionalPromises = additionalIds.map(id => this.getRecommendations(id));
        const additionalResults = await Promise.all(additionalPromises);
        
        // Combinar todas las recomendaciones
        const allRecommendations = [
          ...mainRecommendations,
          ...additionalResults.flat()
        ];
        
        // Eliminar duplicados (por ID)
        const uniqueTracks = Array.from(
          new Map(allRecommendations.map(track => [track.id, track])).values()
        );
        
        // Mezclar ligeramente para variedad
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
    // Intentar con HIGH
    let url = await this.getStreamUrl(id, 'HIGH');
    if (url) return url;

    // Intentar con LOSSLESS
    url = await this.getStreamUrl(id, 'LOSSLESS');
    if (url) return url;

    // Intentar con LOW
    url = await this.getStreamUrl(id, 'LOW');
    if (url) return url;

    // Si todo falla, URL de prueba
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