import { Ionicons } from '@expo/vector-icons';
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
  onToggleFavorite?: (track: Track) => Promise<boolean>; // ✅ Devuelve boolean
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
        'Eliminar descarga',
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
      setIsFavorite(newFavoriteState); // ✅ Ahora newFavoriteState es boolean
    } catch (error) {
      console.log('Error toggling favorite:', error);
    }
  };

  const getQualityBadge = () => {
    if (!track?.quality) return null;
    
    let badgeColor = '#1DB954';
    let badgeText = 'HIGH';
    
    if (track.quality.includes('HI_RES')) {
      badgeColor = '#EC4899';
      badgeText = 'Hi-Res';
    } else if (track.quality.includes('LOSSLESS')) {
      badgeColor = '#A855F7';
      badgeText = 'Lossless';
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
          colors={['rgba(236,72,153,0.2)', 'transparent']}
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
          <View style={[styles.cover, styles.placeholder]}>
            <Ionicons name="musical-note" size={24} color="#666" />
          </View>
        )}
      </View>
      
      <View style={styles.info}>
        <Text style={styles.title} numberOfLines={1}>
          {track.title}
        </Text>
        
        <View style={styles.artistRow}>
          <Text style={styles.artist} numberOfLines={1}>
            {track.artist}
          </Text>
          <Text style={styles.duration}>
            {formatDuration(track.duration)}
          </Text>
        </View>

        {qualityBadge && (
          <View style={[styles.qualityBadge, { backgroundColor: qualityBadge.badgeColor + '20' }]}>
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
          <Ionicons 
            name={isActive ? 'pause' : 'play'} 
            size={22} 
            color={isActive ? '#EC4899' : '#FFF'} 
          />
        </TouchableOpacity>

        {showFavorite && onToggleFavorite && (
          <TouchableOpacity 
            style={styles.iconButton}
            onPress={handleToggleFavorite}
          >
            <Ionicons 
              name={isFavorite ? 'heart' : 'heart-outline'} 
              size={22} 
              color={isFavorite ? '#FF69B4' : '#FFF'} 
            />
          </TouchableOpacity>
        )}

        {onAddToPlaylist && (
          <TouchableOpacity 
            style={styles.iconButton}
            onPress={() => onAddToPlaylist(track)}
          >
            <Ionicons name="add-circle-outline" size={22} color="#FFF" />
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
                size={22} 
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
    backgroundColor: 'rgba(255,255,255,0.1)',
    marginHorizontal: 16,
    marginVertical: 4,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.05)',
  },
  activeContainer: {
    backgroundColor: 'rgba(236,72,153,0.15)',
    borderColor: '#EC4899',
    transform: [{ scale: 1.02 }],
    shadowColor: '#EC4899',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 5,
    elevation: 5,
  },
  activeGradient: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    borderRadius: 12,
  },
  coverContainer: {
    width: 50,
    height: 50,
    borderRadius: 8,
    overflow: 'hidden',
    marginRight: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 3,
    elevation: 3,
  },
  cover: {
    width: '100%',
    height: '100%',
  },
  placeholder: {
    backgroundColor: '#2A2A2A',
    justifyContent: 'center',
    alignItems: 'center',
  },
  info: {
    flex: 1,
    marginRight: 8,
  },
  title: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 4,
  },
  artistRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  artist: {
    color: '#B3B3B3',
    fontSize: 14,
    flex: 1,
  },
  duration: {
    color: '#666',
    fontSize: 12,
    marginLeft: 8,
  },
  qualityBadge: {
    alignSelf: 'flex-start',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 12,
    marginTop: 2,
  },
  qualityText: {
    fontSize: 10,
    fontWeight: '600',
  },
  actions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  iconButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.1)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  activeIconButton: {
    backgroundColor: 'rgba(236,72,153,0.2)',
  },
});

export default TrackItem;