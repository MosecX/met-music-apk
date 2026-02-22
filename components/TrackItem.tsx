import { Ionicons } from '@expo/vector-icons';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import React, { memo, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import storageService from '../services/storage';
import { Track } from '../types';

interface Props {
  track: Track;
  index?: number;
  isActive?: boolean;
  onPlay?: (index: number) => void;
  onPress?: (track: Track) => void;
  onDownload?: (trackId: number) => Promise<void>;
  onAddToPlaylist?: (track: Track) => void;
  onToggleFavorite?: (track: Track) => Promise<boolean>;
  formatDuration?: (seconds: number) => string;
  showDownload?: boolean;
  showFavorite?: boolean;
}

const TrackItem = memo(({ 
  track, 
  index = 0, 
  isActive = false, 
  onPlay,
  onPress,
  onDownload,
  onAddToPlaylist,
  onToggleFavorite,
  formatDuration = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  },
  showDownload = false,
  showFavorite = false,
}: Props) => {
  const [isDownloading, setIsDownloading] = useState(false);
  const [imageError, setImageError] = useState(false);
  const [isDownloaded, setIsDownloaded] = useState(false);
  const [isFavorite, setIsFavorite] = useState(false);

  useEffect(() => {
    checkStatus();
  }, [track.id]);

  const checkStatus = async () => {
    const downloaded = await storageService.isTrackDownloaded(track.id);
    setIsDownloaded(downloaded);
    
    const favorite = await storageService.isFavorite(track.id);
    setIsFavorite(favorite);
  };

  const handlePress = () => {
    if (onPlay) {
      onPlay(index);
    } else if (onPress) {
      onPress(track);
    }
  };

  const handleDownload = async () => {
    if (!onDownload) return;
    
    if (isDownloaded) {
      Alert.alert(
        '🗑️ Eliminar descarga',
        `¿Eliminar "${track.title}" del almacenamiento local?`,
        [
          { text: 'Cancelar', style: 'cancel' },
          {
            text: 'Eliminar',
            style: 'destructive',
            onPress: async () => {
              await storageService.removeDownloadedTrack(track.id);
              setIsDownloaded(false);
            }
          }
        ]
      );
    } else {
      setIsDownloading(true);
      try {
        await onDownload(track.id);
        setIsDownloaded(true);
      } catch (err) {
        Alert.alert('❌ Error', 'No se pudo descargar la canción');
      } finally {
        setIsDownloading(false);
      }
    }
  };

  const handleToggleFavorite = async () => {
    if (!onToggleFavorite) return;
    
    try {
      const newFavoriteState = await onToggleFavorite(track);
      setIsFavorite(newFavoriteState);
    } catch (error) {
      console.log('Error toggling favorite:', error);
    }
  };

  const getQualityBadge = () => {
    if (!track?.quality) return null;
    
    let badgeColor = '#bad21bff';
    let badgeText = 'HIGH';
    
    if (track.quality.includes('HI_RES')) {
      badgeColor = '#1DB954';
      badgeText = 'HI-RES';
    } else if (track.quality.includes('LOSSLESS')) {
      badgeColor = '#A855F7';
      badgeText = 'LOSSLESS';
    }
    
    return { badgeColor, badgeText };
  };

  const qualityBadge = getQualityBadge();

  return (
    <TouchableOpacity 
      style={[
        styles.container,
        isActive && styles.activeContainer
      ]} 
      onPress={handlePress}
      activeOpacity={0.7}
    >
      {isActive && (
        <LinearGradient
          colors={['rgba(29,185,84,0.15)', 'transparent']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={styles.activeGradient}
        />
      )}
      
      <View style={styles.coverContainer}>
        {!imageError ? (
          <Image
            source={{ uri: track.coverUrl }}
            style={styles.cover}
            onError={() => setImageError(true)}
          />
        ) : (
          <LinearGradient
            colors={['#2A2A2A', '#1A1A1A']}
            style={[styles.cover, styles.placeholder]}
          >
            <Ionicons name="musical-note" size={24} color="#666" />
          </LinearGradient>
        )}
        
        {isActive && (
          <BlurView intensity={40} tint="dark" style={styles.playingIndicator}>
            <Ionicons name="volume-high" size={12} color="#FFF" />
          </BlurView>
        )}
      </View>
      
      <View style={styles.info}>
        <Text style={[styles.title, isActive && styles.activeTitle]} numberOfLines={1}>
          {track.title}
        </Text>
        
        <View style={styles.artistRow}>
          <Text style={[styles.artist, isActive && styles.activeArtist]} numberOfLines={1}>
            {track.artist}
          </Text>
          <Text style={styles.duration}>
            {formatDuration(track.duration)}
          </Text>
        </View>

        {qualityBadge && (
          <View style={[styles.qualityBadge, { backgroundColor: qualityBadge.badgeColor + '15' }]}>
            <Text style={[styles.qualityText, { color: qualityBadge.badgeColor }]}>
              {qualityBadge.badgeText}
            </Text>
          </View>
        )}
      </View>

      <View style={styles.actions}>
        <TouchableOpacity 
          style={[
            styles.iconButton,
            isActive && styles.activeIconButton
          ]} 
          onPress={handlePress}
        >
          <LinearGradient
            colors={isActive ? ['#1DB954', '#1a7a3a'] : ['transparent', 'transparent']}
            style={styles.iconGradient}
          />
          <Ionicons 
            name={isActive ? 'pause' : 'play'} 
            size={20} 
            color={isActive ? '#FFF' : '#FFF'} 
          />
        </TouchableOpacity>

        {showFavorite && onToggleFavorite && (
          <TouchableOpacity 
            style={styles.iconButton}
            onPress={handleToggleFavorite}
          >
            <Ionicons 
              name={isFavorite ? 'heart' : 'heart-outline'} 
              size={20} 
              color={isFavorite ? '#FF69B4' : '#FFF'} 
            />
          </TouchableOpacity>
        )}

        {onAddToPlaylist && (
          <TouchableOpacity 
            style={styles.iconButton}
            onPress={() => onAddToPlaylist(track)}
          >
            <Ionicons name="add-circle-outline" size={20} color="#FFF" />
          </TouchableOpacity>
        )}

        {showDownload && onDownload && (
          <TouchableOpacity 
            style={styles.iconButton}
            onPress={handleDownload}
            disabled={isDownloading}
          >
            {isDownloading ? (
              <ActivityIndicator size="small" color="#FFF" />
            ) : (
              <Ionicons 
                name={isDownloaded ? 'cloud-done' : 'cloud-download-outline'} 
                size={20} 
                color={isDownloaded ? '#1DB954' : '#FFF'} 
              />
            )}
          </TouchableOpacity>
        )}
      </View>
    </TouchableOpacity>
  );
});

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    backgroundColor: '#1E1E1E',
    marginHorizontal: 0,
    marginVertical: 4,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.05)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 3,
  },
  activeContainer: {
    borderColor: '#1DB954',
    backgroundColor: 'rgba(29,185,84,0.1)',
    shadowColor: '#1DB954',
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 5,
  },
  activeGradient: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    borderRadius: 16,
  },
  coverContainer: {
    width: 50,
    height: 50,
    borderRadius: 12,
    overflow: 'hidden',
    marginRight: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 4,
    position: 'relative',
  },
  cover: {
    width: '100%',
    height: '100%',
  },
  placeholder: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  playingIndicator: {
    position: 'absolute',
    bottom: 2,
    right: 2,
    width: 18,
    height: 18,
    borderRadius: 9,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(29,185,84,0.8)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.3)',
    overflow: 'hidden',
  },
  info: {
    flex: 1,
    marginRight: 8,
  },
  title: {
    color: '#FFF',
    fontSize: 15,
    fontWeight: '600',
    marginBottom: 2,
  },
  activeTitle: {
    color: '#1DB954',
  },
  artistRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  artist: {
    color: '#B3B3B3',
    fontSize: 13,
    flex: 1,
  },
  activeArtist: {
    color: 'rgba(29,185,84,0.7)',
  },
  duration: {
    color: '#666',
    fontSize: 11,
    marginLeft: 8,
    fontWeight: '500',
  },
  qualityBadge: {
    alignSelf: 'flex-start',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
    marginTop: 2,
  },
  qualityText: {
    fontSize: 9,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  actions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  iconButton: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: 'rgba(255,255,255,0.08)',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.03)',
    overflow: 'hidden',
    position: 'relative',
  },
  activeIconButton: {
    backgroundColor: 'transparent',
    borderColor: 'rgba(29,185,84,0.3)',
  },
  iconGradient: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
});

export default TrackItem;