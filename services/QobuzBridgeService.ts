// services/QobuzBridgeService.ts

export interface QobuzSearchResponse {
  success: boolean;
  data?: any;
  error?: string;
}

export interface QobuzStreamResponse {
  url?: string;
  error?: string;
}

class QobuzBridgeService {
  private SEARCH_BASE_URL = 'https://qobuz.kennyy.com.br/api/get-music';
  private DOWNLOAD_BASE_URL = 'https://qobuz.kennyy.com.br/api/download-music';

  /**
   * Réplica local del endpoint /api/search
   */
  async search(query: string, offset: string = '0'): Promise<any> {
    if (!query) {
      throw new Error('Falta el parámetro de búsqueda');
    }

    try {
      console.log(`📡 [QobuzLocalBridge] Buscando: "${query}" | Offset: ${offset}`);
      const apiUrl = `${this.SEARCH_BASE_URL}?q=${encodeURIComponent(query)}&offset=${offset}`;
      
      const response = await fetch(apiUrl);
      if (!response.ok) {
        throw new Error(`Error de servidor Qobuz (HTTP ${response.status})`);
      }
      
      const data = await response.json();
      return data;
    } catch (error: any) {
      console.error('❌ [QobuzLocalBridge] Error en búsqueda:', error?.message || error);
      throw new Error('Error en la comunicación con el servidor de música local');
    }
  }

  /**
   * Réplica local del endpoint /api/stream
   * Busca por ID numérico en calidad máxima (27 = Hi-Res / Lossless)
   */
  async getStreamUrl(trackId: string): Promise<string> {
    if (!trackId) {
      throw new Error('No track ID');
    }

    // Validación idéntica a tu backend para detener IDs alfanuméricos de álbumes
    if (isNaN(Number(trackId))) {
      throw new Error('El ID proporcionado pertenece a un álbum, no a una pista.');
    }

    try {
      console.log(`📡 [QobuzLocalBridge] Solicitando Stream directo para ID: ${trackId}`);
      const apiUrl = `${this.DOWNLOAD_BASE_URL}?track_id=${trackId}&quality=27`;

      const response = await fetch(apiUrl);
      if (!response.ok) {
        throw new Error(`Error de red en pasarela Qobuz (HTTP ${response.status})`);
      }

      const data = await response.json();
      
      if (!data.success || !data.data?.url) {
        throw new Error('No se pudo obtener la URL de streaming desde el payload de Qobuz');
      }

      return data.data.url;
    } catch (error: any) {
      console.error(`❌ [QobuzLocalBridge] Error al obtener stream para ID ${trackId}:`, error?.message || error);
      throw error;
    }
  }
}

export default new QobuzBridgeService();