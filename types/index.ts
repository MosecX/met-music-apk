// types/index.ts

export interface Track {
  id: number;
  title: string;
  artist: string;
  album: string;
  coverUrl: string;
  duration: number;
  explicit?: boolean;
  quality?: string;
}

export interface StoredTrack extends Track {
  localUri?: string;
  downloadedAt?: number;
  fileSize?: number;
  streamUrl?: string;
}

export interface QueueItem extends StoredTrack {
  queueId: string; // Identificador único para la cola
  source?: 'search' | 'playlist' | 'recommendations' | 'downloads'; // De dónde viene
  playlistId?: string; // Si viene de una playlist, su ID
}

export interface Artist {
  id: number;
  name: string;
  picture?: string;
}

export interface Album {
  id: number;
  title: string;
  cover?: string;
}

export interface Playlist {
  id: string;
  name: string;
  description?: string;
  coverUrl?: string;
  tracks: StoredTrack[];
  createdAt: number;
  updatedAt: number;
  isFavorite?: boolean;
}