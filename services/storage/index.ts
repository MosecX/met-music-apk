import AsyncStorage from '@react-native-async-storage/async-storage';
import { Directory, File, Paths } from 'expo-file-system';
import { Playlist, StoredTrack } from '../../types';
import MonochromeAPI from '../MonochromeAPI';

const STORAGE_KEYS = {
  DOWNLOADED_TRACKS: 'downloaded_tracks',
  PLAYLISTS: 'playlists',
  FAVORITES: 'favorites',
};

class StorageService {
  // ========== CANCIONES DESCARGADAS ==========
  
  async getDownloadedTracks(): Promise<StoredTrack[]> {
    try {
      const data = await AsyncStorage.getItem(STORAGE_KEYS.DOWNLOADED_TRACKS);
      return data ? JSON.parse(data) : [];
    } catch (error) {
      console.log('❌ Error getting downloaded tracks:', error);
      return [];
    }
  }

  async addDownloadedTrack(track: StoredTrack, audioUrl: string): Promise<boolean> {
    try {
      // ✅ NUEVA API: Usamos Directory y Paths
      const musicDir = new Directory(Paths.document, 'music');
      
      // Crear directorio si no existe
      if (!musicDir.exists) {
        musicDir.create({ intermediates: true });
      }

      // Generar nombre de archivo único
      const fileName = `${track.id}_${Date.now()}.mp4`;
      const file = new File(musicDir, fileName);

      console.log('📥 Descargando:', audioUrl);
      
      // ✅ NUEVA API: downloadFileAsync
      const downloadedFile = await File.downloadFileAsync(audioUrl, file, {
        idempotent: true, // Sobrescribe si ya existe
      });

      console.log('✅ Archivo descargado:', downloadedFile.uri);

      // Guardar metadata
      const trackWithLocal = {
        ...track,
        localUri: downloadedFile.uri,
        downloadedAt: Date.now(),
        fileSize: downloadedFile.size,
      };

      const tracks = await this.getDownloadedTracks();
      const exists = tracks.some(t => t.id === track.id);
      
      if (!exists) {
        tracks.push(trackWithLocal);
        await AsyncStorage.setItem(STORAGE_KEYS.DOWNLOADED_TRACKS, JSON.stringify(tracks));
      }

      console.log('✅ Canción descargada:', track.title);
      return true;

    } catch (error) {
      console.log('❌ Error downloading track:', error);
      return false;
    }
  }

  async removeDownloadedTrack(trackId: number): Promise<boolean> {
    try {
      const tracks = await this.getDownloadedTracks();
      const track = tracks.find(t => t.id === trackId);
      
      if (track?.localUri) {
        // ✅ NUEVA API: Crear File desde URI y eliminar
        const file = new File(track.localUri);
        if (file.exists) {
          file.delete();
        }
      }

      const newTracks = tracks.filter(t => t.id !== trackId);
      await AsyncStorage.setItem(STORAGE_KEYS.DOWNLOADED_TRACKS, JSON.stringify(newTracks));
      
      return true;
    } catch (error) {
      console.log('❌ Error removing downloaded track:', error);
      return false;
    }
  }

  async isTrackDownloaded(trackId: number): Promise<boolean> {
    const tracks = await this.getDownloadedTracks();
    return tracks.some(t => t.id === trackId);
  }

  // ========== PLAYLISTS ==========

  async getPlaylists(): Promise<Playlist[]> {
    try {
      const data = await AsyncStorage.getItem(STORAGE_KEYS.PLAYLISTS);
      const playlists = data ? JSON.parse(data) : [];
      
      const hasFavorites = playlists.some((p: Playlist) => p.id === 'favorites');
      if (!hasFavorites) {
        playlists.unshift(this.getDefaultFavoritesPlaylist());
        await this.savePlaylists(playlists);
      }
      
      return playlists;
    } catch (error) {
      console.log('❌ Error getting playlists:', error);
      return [this.getDefaultFavoritesPlaylist()];
    }
  }

  private getDefaultFavoritesPlaylist(): Playlist {
    return {
      id: 'favorites',
      name: '❤️ Favoritos',
      description: 'Tus canciones favoritas',
      tracks: [],
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
  }

  private async savePlaylists(playlists: Playlist[]): Promise<void> {
    await AsyncStorage.setItem(STORAGE_KEYS.PLAYLISTS, JSON.stringify(playlists));
  }

  async createPlaylist(name: string, description?: string): Promise<Playlist> {
    const playlists = await this.getPlaylists();
    
    const newPlaylist: Playlist = {
      id: `playlist_${Date.now()}`,
      name,
      description,
      tracks: [],
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };

    playlists.push(newPlaylist);
    await this.savePlaylists(playlists);
    
    return newPlaylist;
  }

  async addToPlaylist(playlistId: string, track: StoredTrack): Promise<boolean> {
    try {
      const playlists = await this.getPlaylists();
      const playlistIndex = playlists.findIndex(p => p.id === playlistId);
      
      if (playlistIndex === -1) return false;

      const exists = playlists[playlistIndex].tracks.some(t => t.id === track.id);
      if (!exists) {
        playlists[playlistIndex].tracks.push(track);
        playlists[playlistIndex].updatedAt = Date.now();
        await this.savePlaylists(playlists);
      }
      
      return true;
    } catch (error) {
      console.log('❌ Error adding to playlist:', error);
      return false;
    }
  }

  async removeFromPlaylist(playlistId: string, trackId: number): Promise<boolean> {
    try {
      const playlists = await this.getPlaylists();
      const playlistIndex = playlists.findIndex(p => p.id === playlistId);
      
      if (playlistIndex === -1) return false;

      playlists[playlistIndex].tracks = playlists[playlistIndex].tracks.filter(t => t.id !== trackId);
      playlists[playlistIndex].updatedAt = Date.now();
      await this.savePlaylists(playlists);
      
      return true;
    } catch (error) {
      console.log('❌ Error removing from playlist:', error);
      return false;
    }
  }

  async deletePlaylist(playlistId: string): Promise<boolean> {
    if (playlistId === 'favorites') return false;
    
    try {
      const playlists = await this.getPlaylists();
      const newPlaylists = playlists.filter(p => p.id !== playlistId);
      await this.savePlaylists(newPlaylists);
      return true;
    } catch (error) {
      console.log('❌ Error deleting playlist:', error);
      return false;
    }
  }

  // ========== DOWNLOAD PLAYLIST ==========

  async downloadPlaylist(playlistId: string): Promise<boolean> {
    try {
      const playlists = await this.getPlaylists();
      const playlist = playlists.find(p => p.id === playlistId);
      
      if (!playlist) return false;

      console.log(`📥 Descargando playlist: ${playlist.name}`);
      
      const downloadPromises = playlist.tracks.map(async (track) => {
        if (!track.localUri) {
          try {
            const audioUrl = await MonochromeAPI.getPlayableUrl(track.id);
            return this.addDownloadedTrack(track, audioUrl);
          } catch (error) {
            console.log(`❌ Error descargando ${track.title}:`, error);
            return false;
          }
        }
        return true;
      });

      const results = await Promise.all(downloadPromises);
      const success = results.every(r => r === true);
      
      if (success) {
        console.log(`✅ Playlist "${playlist.name}" descargada completamente`);
      } else {
        console.log(`⚠️ Playlist "${playlist.name}" descargada con algunos errores`);
      }
      
      return success;
    } catch (error) {
      console.log('❌ Error downloading playlist:', error);
      return false;
    }
  }

  // ========== FAVORITOS ==========

  async toggleFavorite(track: StoredTrack): Promise<boolean> {
    const playlists = await this.getPlaylists();
    const favorites = playlists.find(p => p.id === 'favorites');
    
    if (!favorites) return false;

    const exists = favorites.tracks.some(t => t.id === track.id);
    
    if (exists) {
      await this.removeFromPlaylist('favorites', track.id);
      return false;
    } else {
      await this.addToPlaylist('favorites', track);
      return true;
    }
  }

  async getFavorites(): Promise<StoredTrack[]> {
    const playlists = await this.getPlaylists();
    const favorites = playlists.find(p => p.id === 'favorites');
    return favorites?.tracks || [];
  }

  async isFavorite(trackId: number): Promise<boolean> {
    const favorites = await this.getFavorites();
    return favorites.some(t => t.id === trackId);
  }
}

export default new StorageService();