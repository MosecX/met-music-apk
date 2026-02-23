// services/UpdateService.ts
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Application from 'expo-application';
import Constants from 'expo-constants';

interface UpdateCheckResult {
  hasUpdate: boolean;
  latestVersion: string | null;
  currentVersion: string;
  releaseUrl: string | null;
  error: string | null;
  timestamp: number;
}

interface CachedUpdate {
  result: UpdateCheckResult;
  expiresAt: number;
}

class UpdateService {
  private readonly GITHUB_RAW_URL = 'https://raw.githubusercontent.com/MosecX/met-music-apk/main/app.json';
  private readonly RELEASES_URL = 'https://github.com/MosecX/met-music-apk/releases/latest';
  private readonly CACHE_KEY = '@metmusic_update_cache';
  private readonly CACHE_DURATION = 1000 * 60 * 60; // 1 hora en milisegundos
  private readonly TIMEOUT_MS = 5000; // 5 segundos de timeout

  /**
   * Verifica si hay actualizaciones disponibles comparando con el app.json en GitHub
   */
  async checkForUpdates(forceRefresh = false): Promise<UpdateCheckResult> {
    try {
      // Si no es forzado, verificar caché primero
      if (!forceRefresh) {
        const cached = await this.getCachedResult();
        if (cached) {
          console.log('📦 Usando resultado cacheado de actualizaciones');
          return cached;
        }
      }

      console.log('🔍 Verificando actualizaciones en GitHub...');
      
      const currentVersion = await this.getCurrentVersion();
      
      // Fetch con timeout
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), this.TIMEOUT_MS);

      const response = await fetch(this.GITHUB_RAW_URL, {
        headers: {
          'Cache-Control': 'no-cache, no-store, must-revalidate',
          'Pragma': 'no-cache',
          'Expires': '0',
          'User-Agent': 'MetMusic-App/1.0'
        },
        signal: controller.signal
      }).finally(() => clearTimeout(timeoutId));

      if (!response.ok) {
        throw new Error(`GitHub respondió con estado: ${response.status}`);
      }

      const remoteAppJson = await response.json();
      
      // Validar que el JSON tenga la estructura esperada
      if (!remoteAppJson?.expo?.version) {
        throw new Error('El archivo app.json no contiene la versión esperada');
      }

      const remoteVersion = remoteAppJson.expo.version;
      
      // Validar formato de versión (x.y.z)
      if (!this.isValidVersionFormat(remoteVersion)) {
        throw new Error(`Formato de versión inválido: ${remoteVersion}`);
      }

      const hasUpdate = this.isNewerVersion(remoteVersion, currentVersion);

      const result: UpdateCheckResult = {
        hasUpdate,
        latestVersion: remoteVersion,
        currentVersion,
        releaseUrl: this.RELEASES_URL,
        error: null,
        timestamp: Date.now()
      };

      // Guardar en caché
      await this.cacheResult(result);

      console.log(`📱 Actual: v${currentVersion} | GitHub: v${remoteVersion}`);
      console.log(`🔄 ${hasUpdate ? '¡HAY ACTUALIZACIÓN DISPONIBLE!' : 'Todo actualizado'}`);

      return result;

    } catch (error: any) {
      console.log('❌ Error verificando actualizaciones:', error.message);

      // En caso de error, devolver resultado con error
      return {
        hasUpdate: false,
        latestVersion: null,
        currentVersion: await this.getCurrentVersion(),
        releaseUrl: this.RELEASES_URL,
        error: error.message || 'Error al verificar actualizaciones',
        timestamp: Date.now()
      };
    }
  }

  /**
   * Obtiene la versión actual de la app desde Constants
   */
  private async getCurrentVersion(): Promise<string> {
    try {
      // Intentar obtener desde Constants (app.json)
      const fromConfig = Constants.expoConfig?.version;
      if (fromConfig && this.isValidVersionFormat(fromConfig)) {
        return fromConfig;
      }

      // Fallback: intentar desde Application
      const nativeVersion = Application.nativeApplicationVersion;
      if (nativeVersion && this.isValidVersionFormat(nativeVersion)) {
        return nativeVersion;
      }

      // Fallback final
      return '1.0.0';
    } catch (error) {
      console.log('Error obteniendo versión actual:', error);
      return '1.0.0';
    }
  }

  /**
   * Valida que la versión tenga formato semver (x.y.z)
   */
  private isValidVersionFormat(version: string): boolean {
    const semverRegex = /^\d+\.\d+\.\d+$/;
    return semverRegex.test(version);
  }

  /**
   * Compara dos versiones semver
   */
  private isNewerVersion(remote: string, current: string): boolean {
    try {
      const remoteParts = remote.split('.').map(Number);
      const currentParts = current.split('.').map(Number);

      for (let i = 0; i < 3; i++) {
        const r = remoteParts[i] || 0;
        const c = currentParts[i] || 0;
        if (r > c) return true;
        if (r < c) return false;
      }
      return false; // Son iguales
    } catch (error) {
      console.log('Error comparando versiones:', error);
      return false;
    }
  }

  /**
   * Obtiene resultado cacheado si no ha expirado
   */
  private async getCachedResult(): Promise<UpdateCheckResult | null> {
    try {
      const cachedJson = await AsyncStorage.getItem(this.CACHE_KEY);
      if (!cachedJson) return null;

      const cached: CachedUpdate = JSON.parse(cachedJson);
      
      // Verificar si el caché ha expirado
      if (Date.now() > cached.expiresAt) {
        await AsyncStorage.removeItem(this.CACHE_KEY);
        return null;
      }

      return cached.result;
    } catch (error) {
      console.log('Error leyendo caché:', error);
      return null;
    }
  }

  /**
   * Guarda resultado en caché
   */
  private async cacheResult(result: UpdateCheckResult): Promise<void> {
    try {
      const cached: CachedUpdate = {
        result,
        expiresAt: Date.now() + this.CACHE_DURATION
      };
      await AsyncStorage.setItem(this.CACHE_KEY, JSON.stringify(cached));
    } catch (error) {
      console.log('Error guardando caché:', error);
    }
  }

  /**
   * Obtiene la URL de descarga para la plataforma actual
   */
  getDownloadUrl(): string {
    // Puedes personalizar según plataforma si tienes URLs diferentes
    return this.RELEASES_URL;
  }

  /**
   * Formatea un mensaje de actualización amigable
   */
  formatUpdateMessage(result: UpdateCheckResult): string {
    if (result.error) {
      return `No se pudo verificar: ${result.error}`;
    }
    
    if (result.hasUpdate) {
      return `🎉 Versión ${result.latestVersion} disponible\n\nSe han realizado mejoras y correcciones.\n¿Quieres descargarla ahora?`;
    }
    
    return `✨ Tienes la última versión (${result.currentVersion})`;
  }

  /**
   * Limpia el caché de actualizaciones
   */
  async clearCache(): Promise<void> {
    try {
      await AsyncStorage.removeItem(this.CACHE_KEY);
      console.log('🗑️ Caché de actualizaciones limpiado');
    } catch (error) {
      console.log('Error limpiando caché:', error);
    }
  }
}

// Singleton
export default new UpdateService();