import { Ionicons } from '@expo/vector-icons';
import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { usePlayer } from '../context/PlayerContext';

interface PlayerProps {
  track: any;
  onClose: () => void;
  isExpanded: boolean;
  onExpandChange: (expanded: boolean) => void;
  onNext: () => void;
  onPrev: () => void;
  hasNext: boolean;
  hasPrev: boolean;
}

const Player = ({ 
  track, 
  onClose, 
  isExpanded, 
  onExpandChange,
  onNext,
  onPrev,
  hasNext,
  hasPrev 
}: PlayerProps) => {
  const { isPlaying, position, duration, togglePlayPause } = usePlayer();
  const [isLoading, setIsLoading] = useState(true);
  const insets = useSafeAreaInsets();

  useEffect(() => {
    console.log('🎵 Player montado con track:', track?.title);
    setIsLoading(true);
    const timer = setTimeout(() => {
      setIsLoading(false);
    }, 500);
    return () => clearTimeout(timer);
  }, [track?.id]);

  const progress = duration > 0 ? (position / duration) * 100 : 0;

  const formatTime = (millis: number) => {
    if (!millis) return '0:00';
    const minutes = Math.floor(millis / 60000);
    const seconds = Math.floor((millis % 60000) / 1000);
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  };

  const handlePrevPress = () => {
    if (hasPrev) {
      onPrev();
    }
  };

  const handleNextPress = () => {
    if (hasNext) {
      onNext();
    }
  };

  return (
    <View style={[styles.container, { bottom: insets.bottom }]}>
      <View style={styles.progressBarContainer}>
        <View style={[styles.progressBar, { width: `${progress}%` }]} />
      </View>

      <View style={styles.content}>
        <TouchableOpacity 
          style={styles.trackInfo}
          onPress={() => onExpandChange(true)}
          activeOpacity={0.7}
        >
          <Image source={{ uri: track.coverUrl }} style={styles.cover} />
          <View style={styles.textInfo}>
            <Text style={styles.title} numberOfLines={1}>{track.title}</Text>
            <Text style={styles.artist} numberOfLines={1}>{track.artist}</Text>
          </View>
        </TouchableOpacity>

        <View style={styles.controls}>
          {/* Botón anterior */}
          <TouchableOpacity 
            onPress={handlePrevPress}
            style={[styles.iconButton, !hasPrev && styles.disabled]}
          >
            <Ionicons 
              name="play-skip-back" 
              size={24} 
              color={hasPrev ? '#FFF' : '#666'} 
            />
          </TouchableOpacity>

          {/* Botón Play/Pause */}
          <TouchableOpacity 
            onPress={togglePlayPause} 
            style={styles.playButton}
            disabled={isLoading}
          >
            {isLoading ? (
              <ActivityIndicator size="small" color="#1DB954" />
            ) : (
              <Ionicons 
                name={isPlaying ? 'pause' : 'play'} 
                size={24} 
                color="#1DB954" 
              />
            )}
          </TouchableOpacity>

          {/* Botón siguiente */}
          <TouchableOpacity 
            onPress={handleNextPress}
            style={[styles.iconButton, !hasNext && styles.disabled]}
          >
            <Ionicons 
              name="play-skip-forward" 
              size={24} 
              color={hasNext ? '#FFF' : '#666'} 
            />
          </TouchableOpacity>

          {/* Botón cerrar */}
          <TouchableOpacity onPress={onClose} style={styles.iconButton}>
            <Ionicons name="close" size={22} color="#999" />
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    left: 0,
    right: 0,
    backgroundColor: '#282828',
    borderTopLeftRadius: 15,
    borderTopRightRadius: 15,
    elevation: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.3,
    shadowRadius: 5,
  },
  progressBarContainer: {
    height: 2,
    backgroundColor: '#3E3E3E',
    width: '100%',
  },
  progressBar: {
    height: 2,
    backgroundColor: '#1DB954',
  },
  content: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    height: 70,
  },
  trackInfo: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    marginRight: 10,
  },
  cover: {
    width: 50,
    height: 50,
    borderRadius: 8,
    marginRight: 12,
  },
  textInfo: {
    flex: 1,
  },
  title: {
    color: '#FFF',
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 2,
  },
  artist: {
    color: '#B3B3B3',
    fontSize: 12,
  },
  controls: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  iconButton: {
    padding: 4,
  },
  playButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(29,185,84,0.15)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  disabled: {
    opacity: 0.3,
  },
});

export default Player;