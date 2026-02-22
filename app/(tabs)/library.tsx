import { Ionicons } from '@expo/vector-icons';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import React, { useCallback, useEffect, useState } from 'react';
import {
  Alert,
  Dimensions,
  FlatList,
  Image,
  Modal,
  RefreshControl,
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
const TAB_BAR_HEIGHT = 60;
const PLAYER_HEIGHT = 80;

export default function LibraryScreen() {
  const insets = useSafeAreaInsets();
  const { currentTrack, playTrack } = usePlayer();
  const { isOffline } = useOffline();
  
  const [playlists, setPlaylists] = useState<Playlist[]>([]);
  const [selectedPlaylist, setSelectedPlaylist] = useState<Playlist | null>(null);
  const [filteredTracks, setFilteredTracks] = useState<StoredTrack[]>([]);
  const [showNewPlaylistModal, setShowNewPlaylistModal] = useState(false);
  const [newPlaylistName, setNewPlaylistName] = useState('');
  const [refreshing, setRefreshing] = useState(false);

  const playerOffset = currentTrack ? PLAYER_HEIGHT : 0;

  useEffect(() => {
    loadData();
  }, []);

  // Filtrar canciones según modo offline
  useEffect(() => {
    if (!selectedPlaylist) return;
    
    if (isOffline) {
      const downloaded = selectedPlaylist.tracks.filter(t => t.localUri !== undefined && t.localUri !== null);
      setFilteredTracks(downloaded);
      console.log('📱 Modo offline: mostrando', downloaded.length, 'de', selectedPlaylist.tracks.length, 'canciones');
    } else {
      setFilteredTracks(selectedPlaylist.tracks);
    }
  }, [selectedPlaylist, isOffline]);

  const loadData = async () => {
    const loadedPlaylists = await storageService.getPlaylists();
    setPlaylists(loadedPlaylists);
  };

  // Pull to refresh
  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadData();
    if (selectedPlaylist) {
      await refreshSelectedPlaylist();
    }
    setRefreshing(false);
  }, [selectedPlaylist]);

  // Recargar la playlist seleccionada
  const refreshSelectedPlaylist = async () => {
    if (!selectedPlaylist) return;
    
    const updatedPlaylists = await storageService.getPlaylists();
    const updated = updatedPlaylists.find(p => p.id === selectedPlaylist.id);
    
    if (updated) {
      setSelectedPlaylist(updated);
      console.log('🔄 Playlist actualizada:', updated.name);
    }
  };

  const createPlaylist = async () => {
    if (!newPlaylistName.trim()) return;
    
    const newPlaylist = await storageService.createPlaylist(newPlaylistName);
    setPlaylists([...playlists, newPlaylist]);
    setNewPlaylistName('');
    setShowNewPlaylistModal(false);
  };

  const handleTrackPress = (track: StoredTrack, index: number) => {
    if (!selectedPlaylist) return;
    
    if (isOffline) {
      const isDownloaded = track.localUri !== undefined && track.localUri !== null;
      if (!isDownloaded) {
        Alert.alert(
          '📱 Modo Offline',
          'Esta canción no está disponible sin conexión. Ve a Ajustes > Canciones descargadas para escuchar tu música offline.',
          [
            { text: 'Cancelar', style: 'cancel' },
            { 
              text: 'Ir a Ajustes',
              onPress: () => {
                // Aquí iría la navegación a Settings
                console.log('Navegar a Settings');
              }
            }
          ]
        );
        return;
      }
    }
    
    playTrack(
      track,
      filteredTracks,
      index,
      'playlist',
      selectedPlaylist.id
    );
  };

  const handleDownloadPlaylist = async (playlist: Playlist) => {
    Alert.alert(
      '📥 Descargar playlist',
      `¿Descargar todas las canciones de "${playlist.name}"?\n\nEsto puede tomar unos minutos.`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Descargar',
          onPress: async () => {
            const success = await storageService.downloadPlaylist(playlist.id);
            if (success) {
              Alert.alert('✅ Completado', 'Playlist descargada correctamente');
              
              if (selectedPlaylist && selectedPlaylist.id === playlist.id) {
                await refreshSelectedPlaylist();
              }
              
              await loadData();
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
      '🗑️ Eliminar descargas',
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
            
            if (selectedPlaylist && selectedPlaylist.id === playlist.id) {
              await refreshSelectedPlaylist();
            }
            
            await loadData();
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
    const downloadedCount = item.tracks.filter(t => t.localUri).length;
    
    return (
      <TouchableOpacity
        style={styles.playlistCard}
        onPress={() => setSelectedPlaylist(item)}
        activeOpacity={0.7}
      >
        {/* Collage fuera del gradiente para que se vea correctamente */}
        <View style={styles.playlistCardContent}>
          {getPlaylistCollage(item, 70)}
          
          <View style={styles.playlistInfo}>
            <Text style={styles.playlistName} numberOfLines={1}>{item.name}</Text>
            <Text style={styles.playlistCount}>
              {item.tracks.length} {item.tracks.length === 1 ? 'canción' : 'canciones'}
            </Text>
            
            {isOffline && downloadedCount > 0 && (
              <Text style={styles.playlistOfflineCount}>
                {downloadedCount} disponibles offline
              </Text>
            )}
            
            {item.id !== 'favorites' && (
              <View style={styles.rowActions}>
                <TouchableOpacity
                  style={styles.rowDownloadButton}
                  onPress={() => handleDownloadPlaylist(item)}
                >
                  <Ionicons name="cloud-download-outline" size={12} color="#1DB954" />
                  <Text style={styles.rowDownloadText}>
                    {fullyDownloaded ? 'Descargada' : 'Descargar'}
                  </Text>
                </TouchableOpacity>

                {fullyDownloaded && (
                  <TouchableOpacity
                    style={styles.rowDeleteButton}
                    onPress={() => handleRemoveDownloads(item)}
                  >
                    <Ionicons name="trash-outline" size={12} color="#FF4444" />
                    <Text style={styles.rowDeleteText}>Eliminar</Text>
                  </TouchableOpacity>
                )}
              </View>
            )}
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  if (selectedPlaylist) {
    const fullyDownloaded = isPlaylistFullyDownloaded(selectedPlaylist);
    const collageSize = width * 0.35;
    const downloadedCount = selectedPlaylist.tracks.filter(t => t.localUri).length;

    return (
      <ScreenWrapper>
        <LinearGradient
          colors={['#0A0A0A', '#1A1A1A']}
          style={StyleSheet.absoluteFill}
        />
        
        <View style={[styles.playlistHeader, { paddingTop: insets.top + 10 }]}>
          <TouchableOpacity 
            style={styles.backButton}
            onPress={() => setSelectedPlaylist(null)}
          >
            <Ionicons name="arrow-back" size={22} color="#FFF" />
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
                    size={14} 
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
                    <Ionicons name="trash-outline" size={14} color="#FF4444" />
                    <Text style={[styles.playlistActionChipText, { color: '#FF4444' }]}>
                      Eliminar
                    </Text>
                  </TouchableOpacity>
                )}

                <TouchableOpacity
                  style={[styles.playlistActionChip, styles.deleteChip]}
                  onPress={() => {
                    Alert.alert(
                      '🗑️ Eliminar playlist',
                      '¿Estás seguro de eliminar esta playlist?',
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
                  <Ionicons name="trash-outline" size={14} color="#FF4444" />
                  <Text style={[styles.playlistActionChipText, { color: '#FF4444' }]}>
                    Playlist
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          )}
        </View>

        <FlatList
          data={filteredTracks}
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
                setTimeout(() => refreshSelectedPlaylist(), 1000);
              }}
            />
          )}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor="#1DB954"
              colors={['#1DB954']}
              progressBackgroundColor="#1A1A1A"
            />
          }
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <BlurView intensity={30} tint="dark" style={styles.emptyCard}>
                <LinearGradient
                  colors={['rgba(29,185,84,0.2)', 'rgba(29,185,84,0.05)']}
                  style={styles.emptyGradient}
                >
                  <Ionicons 
                    name={isOffline ? "cloud-offline-outline" : "musical-notes-outline"} 
                    size={60} 
                    color="rgba(255,255,255,0.2)" 
                  />
                  <Text style={styles.emptyTitle}>
                    {isOffline 
                      ? 'Modo offline' 
                      : 'Playlist vacía'}
                  </Text>
                  <Text style={styles.emptyText}>
                    {isOffline 
                      ? `Esta playlist tiene ${selectedPlaylist.tracks.length} canciones, pero no sabemos si las tienes descargadas.`
                      : 'Agrega canciones a esta playlist'}
                  </Text>
                  
                  {isOffline && selectedPlaylist.tracks.length > 0 && (
                    <>
                      <View style={styles.emptyDivider} />
                      <Text style={styles.emptyHint}>
                        💡 Si descargastes las canciones puedes ir a:
                      </Text>
                      <TouchableOpacity 
                        style={styles.emptyButton}
                        onPress={() => {
                          // Navegar a Settings
                          console.log('Ir a Settings');
                        }}
                      >
                        <Ionicons name="settings-outline" size={16} color="#1DB954" />
                        <Text style={styles.emptyButtonText}>
                          Ir a Ajustes {'>'} Canciones descargadas
                        </Text>
                      </TouchableOpacity>
                      <Text style={styles.emptyNote}>
                        Allí encontrarás todas tus canciones descargadas listas para reproducir
                      </Text>
                    </>
                  )}
                </LinearGradient>
              </BlurView>
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
      <LinearGradient
        colors={['#0A0A0A', '#1A1A1A']}
        style={StyleSheet.absoluteFill}
      />
      
      <View style={[styles.header, { paddingTop: insets.top + 10 }]}>
        <Text style={styles.title}>Biblioteca</Text>
        <TouchableOpacity 
          style={styles.addButton}
          onPress={() => setShowNewPlaylistModal(true)}
        >
          <LinearGradient
            colors={['#1DB954', '#1a7a3a']}
            style={styles.addButtonGradient}
          >
            <Ionicons name="add" size={22} color="#FFF" />
          </LinearGradient>
        </TouchableOpacity>
      </View>

      <FlatList
        data={playlists}
        keyExtractor={(item) => item.id}
        renderItem={renderPlaylistItem}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor="#1DB954"
            colors={['#1DB954']}
            progressBackgroundColor="#1A1A1A"
          />
        }
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
          <BlurView intensity={80} tint="dark" style={styles.modalBlur}>
            <View style={styles.modalContent}>
              <Text style={styles.modalTitle}>Nueva playlist</Text>
              <TextInput
                style={styles.modalInput}
                placeholder="Nombre de la playlist"
                placeholderTextColor="rgba(255,255,255,0.3)"
                value={newPlaylistName}
                onChangeText={setNewPlaylistName}
                autoFocus
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
                  <LinearGradient
                    colors={['#1DB954', '#1a7a3a']}
                    style={styles.createButtonGradient}
                  >
                    <Text style={styles.buttonText}>Crear</Text>
                  </LinearGradient>
                </TouchableOpacity>
              </View>
            </View>
          </BlurView>
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
    paddingBottom: 15,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#FFF',
  },
  addButton: {
    borderRadius: 25,
    overflow: 'hidden',
  },
  addButtonGradient: {
    width: 44,
    height: 44,
    justifyContent: 'center',
    alignItems: 'center',
  },
  listContent: {
    paddingHorizontal: 16,
  },
  playlistCard: {
    marginBottom: 12,
    borderRadius: 16,
    overflow: 'hidden',
    backgroundColor: '#1E1E1E',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.05)',
  },
  playlistCardContent: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
  },
  collagePlaceholder: {
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 10,
  },
  collageImage: {
    borderRadius: 10,
  },
  collageGrid: {
    borderRadius: 10,
    overflow: 'hidden',
  },
  playlistInfo: {
    flex: 1,
    marginLeft: 12,
  },
  playlistName: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 2,
  },
  playlistCount: {
    color: '#B3B3B3',
    fontSize: 12,
    marginBottom: 4,
  },
  playlistOfflineCount: {
    color: '#1DB954',
    fontSize: 11,
    fontWeight: '500',
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
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 15,
    gap: 4,
  },
  rowDownloadText: {
    color: '#1DB954',
    fontSize: 11,
    fontWeight: '500',
  },
  rowDeleteButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,68,68,0.1)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 15,
    gap: 4,
  },
  rowDeleteText: {
    color: '#FF4444',
    fontSize: 11,
    fontWeight: '500',
  },
  playlistHeader: {
    padding: 16,
    marginBottom: 16,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.05)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 15,
  },
  playlistHeaderCollage: {
    borderRadius: 15,
    overflow: 'hidden',
    marginBottom: 15,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  playlistHeaderInfo: {
    alignItems: 'center',
    marginBottom: 15,
  },
  playlistHeaderTitle: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#FFF',
    marginBottom: 4,
    textAlign: 'center',
  },
  playlistHeaderCount: {
    fontSize: 13,
    color: '#B3B3B3',
    marginBottom: 6,
  },
  offlineBadgePlaylist: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    gap: 6,
    backgroundColor: 'rgba(29,185,84,0.15)',
    borderWidth: 1,
    borderColor: 'rgba(29,185,84,0.3)',
  },
  offlineBadgePlaylistText: {
    color: '#FFF',
    fontSize: 12,
    fontWeight: '500',
  },
  playlistActions: {
    marginTop: 5,
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
    backgroundColor: 'rgba(255,255,255,0.08)',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 25,
    gap: 6,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  playlistActionChipText: {
    color: '#FFF',
    fontSize: 13,
    fontWeight: '500',
  },
  deleteChip: {
    backgroundColor: 'rgba(255,68,68,0.1)',
    borderColor: 'rgba(255,68,68,0.2)',
  },
  playlistContent: {
    paddingHorizontal: 16,
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 20,
    paddingTop: 30,
  },
  emptyCard: {
    width: width * 0.9,
    borderRadius: 25,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  emptyGradient: {
    alignItems: 'center',
    padding: 30,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#FFF',
    marginTop: 16,
    marginBottom: 8,
    textAlign: 'center',
  },
  emptyText: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.5)',
    textAlign: 'center',
    lineHeight: 18,
    marginBottom: 12,
  },
  emptyDivider: {
    width: '50%',
    height: 1,
    backgroundColor: 'rgba(255,255,255,0.1)',
    marginVertical: 16,
  },
  emptyHint: {
    fontSize: 13,
    color: '#1DB954',
    fontWeight: '500',
    marginBottom: 10,
  },
  emptyButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(29,185,84,0.15)',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 25,
    gap: 8,
    borderWidth: 1,
    borderColor: 'rgba(29,185,84,0.3)',
    marginBottom: 8,
  },
  emptyButtonText: {
    color: '#FFF',
    fontSize: 13,
    fontWeight: '500',
  },
  emptyNote: {
    fontSize: 11,
    color: 'rgba(255,255,255,0.3)',
    textAlign: 'center',
    marginTop: 4,
  },
  modalContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.8)',
  },
  modalBlur: {
    width: '85%',
    borderRadius: 25,
    overflow: 'hidden',
  },
  modalContent: {
    padding: 24,
  },
  modalTitle: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#FFF',
    marginBottom: 20,
    textAlign: 'center',
  },
  modalInput: {
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderRadius: 15,
    padding: 15,
    color: '#FFF',
    fontSize: 16,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  modalButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
  },
  modalButton: {
    flex: 1,
    borderRadius: 15,
    overflow: 'hidden',
  },
  cancelButton: {
    backgroundColor: 'rgba(255,255,255,0.1)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 14,
  },
  createButton: {
    overflow: 'hidden',
  },
  createButtonGradient: {
    padding: 14,
    alignItems: 'center',
  },
  buttonText: {
    color: '#FFF',
    fontSize: 15,
    fontWeight: '600',
  },
});