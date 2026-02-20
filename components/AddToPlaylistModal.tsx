import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import React, { useEffect, useState } from 'react';
import {
    Alert,
    FlatList,
    Modal,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View,
} from 'react-native';
import storageService from '../services/storage';
import { Playlist, StoredTrack } from '../types';

interface Props {
  visible: boolean;
  onClose: () => void;
  track: StoredTrack | null;
  onAdded: () => void;
}

const AddToPlaylistModal = ({ visible, onClose, track, onAdded }: Props) => {
  const [playlists, setPlaylists] = useState<Playlist[]>([]);
  const [showNewPlaylist, setShowNewPlaylist] = useState(false);
  const [newPlaylistName, setNewPlaylistName] = useState('');
  const [favoritesPlaylist, setFavoritesPlaylist] = useState<Playlist | null>(null);

  useEffect(() => {
    if (visible) {
      loadPlaylists();
    }
  }, [visible]);

  const loadPlaylists = async () => {
    const allPlaylists = await storageService.getPlaylists();
    
    // Separar favoritos del resto
    const favorites = allPlaylists.find(p => p.id === 'favorites') || null;
    const others = allPlaylists.filter(p => p.id !== 'favorites');
    
    setFavoritesPlaylist(favorites);
    setPlaylists(others);
  };

  const handleAddToPlaylist = async (playlistId: string) => {
    if (!track) return;

    const success = await storageService.addToPlaylist(playlistId, track);
    if (success) {
      Alert.alert('✅ Agregado', `Canción agregada a la playlist`);
      onAdded();
      onClose();
    } else {
      Alert.alert('❌ Error', 'No se pudo agregar la canción');
    }
  };

  const handleToggleFavorite = async () => {
    if (!track) return;
    
    const isFavorite = await storageService.toggleFavorite(track);
    Alert.alert(
      isFavorite ? '✅ Agregado' : '❌ Eliminado',
      isFavorite ? 'Canción agregada a favoritos' : 'Canción eliminada de favoritos'
    );
    onAdded();
    onClose();
  };

  const handleCreatePlaylist = async () => {
    if (!newPlaylistName.trim()) return;

    const newPlaylist = await storageService.createPlaylist(newPlaylistName);
    setPlaylists([...playlists, newPlaylist]);
    setNewPlaylistName('');
    setShowNewPlaylist(false);
    
    // Si hay un track seleccionado, agregarlo automáticamente
    if (track) {
      await handleAddToPlaylist(newPlaylist.id);
    }
  };

  const renderPlaylistItem = ({ item }: { item: Playlist }) => {
    // Verificar si el track ya está en esta playlist
    const isTrackInPlaylist = track ? item.tracks.some(t => t.id === track.id) : false;
    
    return (
      <TouchableOpacity
        style={styles.playlistItem}
        onPress={() => handleAddToPlaylist(item.id)}
      >
        <LinearGradient
          colors={['#1DB954', '#1a7a3a']}
          style={styles.playlistIcon}
        >
          <Ionicons name="list" size={24} color="#FFF" />
        </LinearGradient>
        <View style={styles.playlistInfo}>
          <Text style={styles.playlistName}>{item.name}</Text>
          <Text style={styles.playlistCount}>
            {item.tracks.length} {item.tracks.length === 1 ? 'canción' : 'canciones'}
          </Text>
        </View>
        {isTrackInPlaylist ? (
          <Ionicons name="checkmark-circle" size={24} color="#1DB954" />
        ) : (
          <Ionicons name="add-circle" size={24} color="#1DB954" />
        )}
      </TouchableOpacity>
    );
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <View style={styles.modalContainer}>
        <View style={styles.modalContent}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>
              Agregar a playlist
            </Text>
            <TouchableOpacity onPress={onClose}>
              <Ionicons name="close" size={24} color="#FFF" />
            </TouchableOpacity>
          </View>

          {track && (
            <View style={styles.currentTrack}>
              <Text style={styles.currentTrackText} numberOfLines={1}>
                {track.title} - {track.artist}
              </Text>
            </View>
          )}

          {/* Sección de Favoritos */}
          {favoritesPlaylist && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>❤️ Favoritos</Text>
              <TouchableOpacity
                style={styles.favoriteItem}
                onPress={handleToggleFavorite}
              >
                <LinearGradient
                  colors={['#FF69B4', '#FF1493']}
                  style={styles.playlistIcon}
                >
                  <Ionicons name="heart" size={24} color="#FFF" />
                </LinearGradient>
                <View style={styles.playlistInfo}>
                  <Text style={styles.playlistName}>Favoritos</Text>
                  <Text style={styles.playlistCount}>
                    {favoritesPlaylist.tracks.length} canciones
                  </Text>
                </View>
                {track && favoritesPlaylist.tracks.some(t => t.id === track.id) ? (
                  <Ionicons name="heart" size={24} color="#FF69B4" />
                ) : (
                  <Ionicons name="heart-outline" size={24} color="#FF69B4" />
                )}
              </TouchableOpacity>
            </View>
          )}

          {/* Separador */}
          <View style={styles.divider} />

          {/* Sección de otras playlists */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>📋 Mis Playlists</Text>

            {showNewPlaylist ? (
              <View style={styles.newPlaylistContainer}>
                <TextInput
                  style={styles.newPlaylistInput}
                  placeholder="Nombre de la nueva playlist"
                  placeholderTextColor="#666"
                  value={newPlaylistName}
                  onChangeText={setNewPlaylistName}
                  autoFocus
                />
                <View style={styles.newPlaylistButtons}>
                  <TouchableOpacity
                    style={[styles.button, styles.cancelButton]}
                    onPress={() => setShowNewPlaylist(false)}
                  >
                    <Text style={styles.buttonText}>Cancelar</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.button, styles.createButton]}
                    onPress={handleCreatePlaylist}
                  >
                    <Text style={styles.buttonText}>Crear</Text>
                  </TouchableOpacity>
                </View>
              </View>
            ) : (
              <TouchableOpacity
                style={styles.createPlaylistButton}
                onPress={() => setShowNewPlaylist(true)}
              >
                <Ionicons name="add-circle" size={24} color="#1DB954" />
                <Text style={styles.createPlaylistText}>Crear nueva playlist</Text>
              </TouchableOpacity>
            )}

            <FlatList
              data={playlists}
              keyExtractor={(item) => item.id}
              renderItem={renderPlaylistItem}
              style={styles.playlistList}
              showsVerticalScrollIndicator={false}
              ListEmptyComponent={
                !showNewPlaylist ? (
                  <Text style={styles.emptyText}>
                    No tienes playlists creadas
                  </Text>
                ) : null
              }
            />
          </View>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  modalContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.7)',
  },
  modalContent: {
    width: '90%',
    maxHeight: '80%',
    backgroundColor: '#282828',
    borderRadius: 15,
    padding: 20,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#FFF',
  },
  currentTrack: {
    backgroundColor: '#1E1E1E',
    padding: 12,
    borderRadius: 8,
    marginBottom: 16,
  },
  currentTrackText: {
    color: '#1DB954',
    fontSize: 14,
  },
  section: {
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#B3B3B3',
    marginBottom: 8,
  },
  divider: {
    height: 1,
    backgroundColor: '#3E3E3E',
    marginVertical: 16,
  },
  favoriteItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1E1E1E',
    padding: 12,
    borderRadius: 8,
    marginBottom: 8,
  },
  createPlaylistButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1E1E1E',
    padding: 12,
    borderRadius: 8,
    marginBottom: 16,
    gap: 8,
  },
  createPlaylistText: {
    color: '#1DB954',
    fontSize: 14,
    fontWeight: '600',
  },
  newPlaylistContainer: {
    marginBottom: 16,
  },
  newPlaylistInput: {
    backgroundColor: '#1E1E1E',
    borderRadius: 8,
    padding: 12,
    color: '#FFF',
    fontSize: 14,
    marginBottom: 12,
  },
  newPlaylistButtons: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 12,
  },
  button: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 6,
  },
  cancelButton: {
    backgroundColor: '#666',
  },
  createButton: {
    backgroundColor: '#1DB954',
  },
  buttonText: {
    color: '#FFF',
    fontSize: 14,
    fontWeight: '600',
  },
  playlistList: {
    maxHeight: 200,
  },
  playlistItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1E1E1E',
    padding: 12,
    borderRadius: 8,
    marginBottom: 8,
  },
  playlistIcon: {
    width: 40,
    height: 40,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  playlistInfo: {
    flex: 1,
  },
  playlistName: {
    color: '#FFF',
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 2,
  },
  playlistCount: {
    color: '#B3B3B3',
    fontSize: 12,
  },
  emptyText: {
    color: '#666',
    textAlign: 'center',
    padding: 20,
    fontStyle: 'italic',
  },
});

export default AddToPlaylistModal;