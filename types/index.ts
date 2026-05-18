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
  isrc?: string | null; // 👈 Agregado aquí en la raíz. Así todas las interfaces heredan este metadato nativo.
}

export interface StoredTrack extends Track {
  localUri?: string;
  downloadedAt?: number;
  fileSize?: number;
  streamUrl?: string;
  // 💡 Ya no hace falta duplicarlo aquí, lo hereda automáticamente de Track de forma limpia
}

export interface QueueItem extends StoredTrack {
  queueId: string; // Identificador único para la instancia en la cola
  source?: 'search' | 'playlist' | 'recommendations' | 'downloads'; // Origen de la pista
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