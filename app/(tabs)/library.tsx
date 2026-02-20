import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import React, { useEffect, useState } from 'react';
import {
  Alert,
  Dimensions,
  FlatList,
  Image,
  Modal,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import ScreenWrapper from '../../components/ScreenWrapper';
import TrackItem from '../../components/TrackItem';
import { usePlayer } from '../../context/PlayerContext';
import { useOffline } from '../../hooks/useOffline';
import storageService from '../../services/storage';
import { Playlist, StoredTrack } from '../../types';

const { width } = Dimensions.get('window');

export default function LibraryScreen() {
  const insets = useSafeAreaInsets();
  const { currentTrack, playTrack } = usePlayer();
  const { isOffline } = useOffline();
  
  const [playlists, setPlaylists] = useState<Playlist[]>([]);
  const [selectedPlaylist, setSelectedPlaylist] = useState<Playlist | null>(null);
  const [showNewPlaylistModal, setShowNewPlaylistModal] = useState(false);
  const [newPlaylistName, setNewPlaylistName] = useState('');

  const TAB_BAR_HEIGHT = 60;
  const PLAYER_HEIGHT = 80;
  const playerOffset = currentTrack ? PLAYER_HEIGHT : 0;

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    const loadedPlaylists = await storageService.getPlaylists();
    setPlaylists(loadedPlaylists);
  };

  const createPlaylist = async () => {
    if (!newPlaylistName.trim()) return;
    
    const newPlaylist = await storageService.createPlaylist(newPlaylistName);
    setPlaylists([...playlists, newPlaylist]);
    setNewPlaylistName('');
    setShowNewPlaylistModal(false);
  };

  // ✅ FUNCIÓN CORREGIDA - Maneja modo offline
  const handleTrackPress = (track: StoredTrack, index: number) => {
    if (!selectedPlaylist) return;
    
    // Verificar modo offline
    if (isOffline) {
      const isDownloaded = track.localUri !== undefined && track.localUri !== null;
      if (!isDownloaded) {
        Alert.alert(
          'Modo Offline', 
          'Esta canción no está disponible sin conexión. Descárgala primero.'
        );
        return;
      }
      console.log('📱 Reproduciendo OFFLINE desde playlist:', track.localUri);
    }
    
    console.log('🎵 Reproduciendo playlist:', {
      cancion: track.title,
      totalEnCola: selectedPlaylist.tracks.length,
      indice: index,
      fuente: isOffline ? 'local' : 'streaming'
    });
    
    playTrack(
      track,
      selectedPlaylist.tracks,
      index,
      'playlist',
      selectedPlaylist.id
    );
  };

  const handleDownloadPlaylist = async (playlist: Playlist) => {
    Alert.alert(
      'Descargar playlist',
      `¿Descargar todas las canciones de "${playlist.name}"?\n\nEsto puede tomar unos minutos.`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Descargar',
          onPress: async () => {
            const success = await storageService.downloadPlaylist(playlist.id);
            if (success) {
              Alert.alert('✅ Completado', 'Playlist descargada correctamente');
              loadData();
            } else {
              Alert.alert('❌ Error', 'Hubo un problema al descargar la playlist');
            }
          }
        }
      ]
    );
  };

  const handleRemoveDownloads = async (playlist: Playlist) => {
    Alert.alert(
      'Eliminar descargas',
      `¿Eliminar todas las descargas de "${playlist.name}"?`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Eliminar',
          style: 'destructive',
          onPress: async () => {
            for (const track of playlist.tracks) {
              if (track.localUri) {
                await storageService.removeDownloadedTrack(track.id);
              }
            }
            loadData();
            Alert.alert('✅ Eliminadas', 'Descargas eliminadas correctamente');
          }
        }
      ]
    );
  };

  const handleToggleFavorite = async (track: StoredTrack) => {
    const isFavorite = await storageService.toggleFavorite(track);
    loadData();
    return isFavorite;
  };

  const isPlaylistFullyDownloaded = (playlist: Playlist): boolean => {
    return playlist.tracks.length > 0 && playlist.tracks.every(t => t.localUri !== undefined && t.localUri !== null);
  };

  const getPlaylistCollage = (playlist: Playlist, size: number = 70) => {
    const tracks = playlist.tracks.slice(0, 4);
    const imageSize = size;
    const halfSize = size / 2;
    
    if (tracks.length === 0) {
      return (
        <LinearGradient
          colors={playlist.id === 'favorites' ? ['#FF69B4', '#FF1493'] : ['#1DB954', '#1a7a3a']}
          style={[styles.collagePlaceholder, { width: imageSize, height: imageSize }]}
        >
          <Ionicons 
            name={playlist.id === 'favorites' ? 'heart' : 'musical-notes'} 
            size={imageSize * 0.4} 
            color="#FFF" 
          />
        </LinearGradient>
      );
    }

    if (tracks.length === 1) {
      return (
        <Image 
          source={{ uri: tracks[0].coverUrl }} 
          style={[styles.collageImage, { width: imageSize, height: imageSize }]}
        />
      );
    }

    if (tracks.length === 2) {
      return (
        <View style={[styles.collageGrid, { width: imageSize, height: imageSize }]}>
          <Image source={{ uri: tracks[0].coverUrl }} style={{ width: halfSize, height: imageSize }} />
          <Image source={{ uri: tracks[1].coverUrl }} style={{ width: halfSize, height: imageSize }} />
        </View>
      );
    }

    if (tracks.length === 3) {
      return (
        <View style={[styles.collageGrid, { width: imageSize, height: imageSize }]}>
          <Image source={{ uri: tracks[0].coverUrl }} style={{ width: halfSize, height: imageSize }} />
          <View style={{ width: halfSize, height: imageSize }}>
            <Image source={{ uri: tracks[1].coverUrl }} style={{ width: halfSize, height: halfSize }} />
            <Image source={{ uri: tracks[2].coverUrl }} style={{ width: halfSize, height: halfSize }} />
          </View>
        </View>
      );
    }

    return (
      <View style={[styles.collageGrid, { width: imageSize, height: imageSize, flexWrap: 'wrap' }]}>
        <Image source={{ uri: tracks[0].coverUrl }} style={{ width: halfSize, height: halfSize }} />
        <Image source={{ uri: tracks[1].coverUrl }} style={{ width: halfSize, height: halfSize }} />
        <Image source={{ uri: tracks[2].coverUrl }} style={{ width: halfSize, height: halfSize }} />
        <Image source={{ uri: tracks[3].coverUrl }} style={{ width: halfSize, height: halfSize }} />
      </View>
    );
  };

  const renderPlaylistItem = ({ item }: { item: Playlist }) => {
    const fullyDownloaded = isPlaylistFullyDownloaded(item);
    
    return (
      <TouchableOpacity
        style={styles.playlistCard}
        onPress={() => setSelectedPlaylist(item)}
      >
        {getPlaylistCollage(item, 70)}
        
        <View style={styles.playlistInfo}>
          <Text style={styles.playlistName} numberOfLines={1}>{item.name}</Text>
          <Text style={styles.playlistCount}>
            {item.tracks.length} {item.tracks.length === 1 ? 'canción' : 'canciones'}
          </Text>
          
          {item.id !== 'favorites' && (
            <View style={styles.rowActions}>
              <TouchableOpacity
                style={styles.rowDownloadButton}
                onPress={() => handleDownloadPlaylist(item)}
              >
                <Ionicons name="cloud-download-outline" size={14} color="#1DB954" />
                <Text style={styles.rowDownloadText}>Descargar</Text>
              </TouchableOpacity>

              {fullyDownloaded && (
                <TouchableOpacity
                  style={styles.rowDeleteButton}
                  onPress={() => handleRemoveDownloads(item)}
                >
                  <Ionicons name="trash-outline" size={14} color="#FF4444" />
                  <Text style={styles.rowDeleteText}>Eliminar</Text>
                </TouchableOpacity>
              )}
            </View>
          )}
        </View>
      </TouchableOpacity>
    );
  };

  if (selectedPlaylist) {
    const fullyDownloaded = isPlaylistFullyDownloaded(selectedPlaylist);
    const collageSize = width * 0.4;

    return (
      <ScreenWrapper>
        <View style={styles.playlistHeader}>
          <TouchableOpacity 
            style={styles.backButton}
            onPress={() => setSelectedPlaylist(null)}
          >
            <Ionicons name="arrow-back" size={24} color="#FFF" />
          </TouchableOpacity>
          
          <View style={[styles.playlistHeaderCollage, { width: collageSize, height: collageSize, alignSelf: 'center' }]}>
            {getPlaylistCollage(selectedPlaylist, collageSize)}
          </View>
          
          <View style={styles.playlistHeaderInfo}>
            <Text style={styles.playlistHeaderTitle}>{selectedPlaylist.name}</Text>
            <Text style={styles.playlistHeaderCount}>
              {selectedPlaylist.tracks.length} canciones
            </Text>
          </View>

          {selectedPlaylist.id !== 'favorites' && (
            <View style={styles.playlistActions}>
              <View style={styles.playlistActionRow}>
                <TouchableOpacity
                  style={styles.playlistActionChip}
                  onPress={() => handleDownloadPlaylist(selectedPlaylist)}
                >
                  <Ionicons 
                    name={fullyDownloaded ? "checkmark-circle" : "cloud-download-outline"} 
                    size={16} 
                    color={fullyDownloaded ? "#1DB954" : "#FFF"} 
                  />
                  <Text style={[
                    styles.playlistActionChipText,
                    fullyDownloaded && { color: '#1DB954' }
                  ]}>
                    {fullyDownloaded ? 'Descargada' : 'Descargar'}
                  </Text>
                </TouchableOpacity>

                {fullyDownloaded && (
                  <TouchableOpacity
                    style={[styles.playlistActionChip, styles.deleteChip]}
                    onPress={() => handleRemoveDownloads(selectedPlaylist)}
                  >
                    <Ionicons name="trash-outline" size={16} color="#FF4444" />
                    <Text style={[styles.playlistActionChipText, { color: '#FF4444' }]}>
                      Eliminar
                    </Text>
                  </TouchableOpacity>
                )}

                <TouchableOpacity
                  style={[styles.playlistActionChip, styles.deleteChip]}
                  onPress={() => {
                    Alert.alert(
                      'Eliminar playlist',
                      '¿Estás seguro?',
                      [
                        { text: 'Cancelar', style: 'cancel' },
                        {
                          text: 'Eliminar',
                          style: 'destructive',
                          onPress: async () => {
                            await storageService.deletePlaylist(selectedPlaylist.id);
                            setSelectedPlaylist(null);
                            loadData();
                          }
                        }
                      ]
                    );
                  }}
                >
                  <Ionicons name="trash-outline" size={16} color="#FF4444" />
                  <Text style={[styles.playlistActionChipText, { color: '#FF4444' }]}>
                    Playlist
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          )}
        </View>

        <FlatList
          data={selectedPlaylist.tracks}
          keyExtractor={(item) => item.id.toString()}
          renderItem={({ item, index }) => (
            <TrackItem
              track={item}
              index={index}
              isActive={currentTrack?.id === item.id}
              onPlay={() => handleTrackPress(item, index)}
              onToggleFavorite={handleToggleFavorite}
              showDownload={true}
              showFavorite={true}
              onDownload={async (trackId) => {
                setTimeout(() => loadData(), 1000);
              }}
            />
          )}
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Ionicons name="musical-notes-outline" size={60} color="#666" />
              <Text style={styles.emptyText}>
                No hay canciones en esta playlist
              </Text>
            </View>
          }
          contentContainerStyle={[
            styles.playlistContent,
            {
              paddingBottom: TAB_BAR_HEIGHT + playerOffset + insets.bottom + 20,
            }
          ]}
          showsVerticalScrollIndicator={false}
        />
      </ScreenWrapper>
    );
  }

  return (
    <ScreenWrapper>
      <View style={styles.header}>
        <Text style={styles.title}>Tu Biblioteca</Text>
        <TouchableOpacity onPress={() => setShowNewPlaylistModal(true)}>
          <Ionicons name="add-circle" size={28} color="#1DB954" />
        </TouchableOpacity>
      </View>

      <FlatList
        data={playlists}
        keyExtractor={(item) => item.id}
        renderItem={renderPlaylistItem}
        contentContainerStyle={[
          styles.listContent,
          {
            paddingBottom: TAB_BAR_HEIGHT + playerOffset + insets.bottom + 20,
          }
        ]}
        showsVerticalScrollIndicator={false}
      />

      <Modal
        visible={showNewPlaylistModal}
        transparent
        animationType="slide"
      >
        <View style={styles.modalContainer}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Nueva playlist</Text>
            <TextInput
              style={styles.modalInput}
              placeholder="Nombre de la playlist"
              placeholderTextColor="#666"
              value={newPlaylistName}
              onChangeText={setNewPlaylistName}
            />
            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={[styles.modalButton, styles.cancelButton]}
                onPress={() => setShowNewPlaylistModal(false)}
              >
                <Text style={styles.buttonText}>Cancelar</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalButton, styles.createButton]}
                onPress={createPlaylist}
              >
                <Text style={styles.buttonText}>Crear</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </ScreenWrapper>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 10,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#FFF',
  },
  listContent: {
    paddingHorizontal: 16,
  },
  playlistCard: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
    backgroundColor: '#1E1E1E',
    borderRadius: 12,
    overflow: 'hidden',
    height: 70,
  },
  collagePlaceholder: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  collageImage: {
    resizeMode: 'cover',
  },
  collageGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  playlistInfo: {
    flex: 1,
    padding: 12,
  },
  playlistName: {
    color: '#FFF',
    fontSize: 15,
    fontWeight: '600',
    marginBottom: 2,
  },
  playlistCount: {
    color: '#B3B3B3',
    fontSize: 11,
    marginBottom: 6,
  },
  rowActions: {
    flexDirection: 'row',
    gap: 8,
  },
  rowDownloadButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(29,185,84,0.1)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 12,
    gap: 4,
  },
  rowDownloadText: {
    color: '#1DB954',
    fontSize: 10,
    fontWeight: '500',
  },
  rowDeleteButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,68,68,0.1)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 12,
    gap: 4,
  },
  rowDeleteText: {
    color: '#FF4444',
    fontSize: 10,
    fontWeight: '500',
  },
  playlistHeader: {
    padding: 16,
    backgroundColor: '#1E1E1E',
    marginBottom: 16,
  },
  backButton: {
    marginBottom: 12,
  },
  playlistHeaderCollage: {
    borderRadius: 12,
    overflow: 'hidden',
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 5,
    elevation: 5,
  },
  playlistHeaderInfo: {
    alignItems: 'center',
    marginBottom: 12,
  },
  playlistHeaderTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#FFF',
    marginBottom: 2,
    textAlign: 'center',
  },
  playlistHeaderCount: {
    fontSize: 12,
    color: '#B3B3B3',
  },
  playlistActions: {
    marginTop: 4,
  },
  playlistActionRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 8,
    flexWrap: 'wrap',
  },
  playlistActionChip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.1)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    gap: 6,
  },
  playlistActionChipText: {
    color: '#FFF',
    fontSize: 12,
    fontWeight: '500',
  },
  deleteChip: {
    backgroundColor: 'rgba(255,68,68,0.1)',
  },
  playlistContent: {
    paddingHorizontal: 16,
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 50,
  },
  emptyText: {
    color: '#666',
    fontSize: 16,
    marginTop: 16,
  },
  modalContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  modalContent: {
    width: '80%',
    backgroundColor: '#282828',
    borderRadius: 12,
    padding: 20,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#FFF',
    marginBottom: 16,
  },
  modalInput: {
    backgroundColor: '#1E1E1E',
    borderRadius: 8,
    padding: 12,
    color: '#FFF',
    fontSize: 16,
    marginBottom: 20,
  },
  modalButtons: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 12,
  },
  modalButton: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 8,
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
});