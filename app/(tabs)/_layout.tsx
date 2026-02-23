// app/(tabs)/_layout.tsx - CON INDICADOR DE ACTUALIZACIÓN
import { Ionicons } from '@expo/vector-icons';
import { BlurView } from 'expo-blur';
import { Tabs } from 'expo-router';
import { useEffect, useState } from 'react';
import { Platform, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Player from '../../components/Player';
import { usePlayer } from '../../context/PlayerContext';
import UpdateService from '../../services/UpdateService';

export default function TabsLayout() {
  const { currentTrack, showExpanded, setShowExpanded, clearQueue } = usePlayer();
  const insets = useSafeAreaInsets();
  const [hasUpdate, setHasUpdate] = useState(false);

  const tabBarHeight = Platform.OS === 'android' ? 60 + insets.bottom : 60;

  // Verificar actualizaciones al iniciar
  useEffect(() => {
    const checkUpdate = async () => {
      const result = await UpdateService.checkForUpdates();
      setHasUpdate(result.hasUpdate);
    };
    
    checkUpdate();
    
    // Verificar cada hora
    const interval = setInterval(checkUpdate, 60 * 60 * 1000);
    return () => clearInterval(interval);
  }, []);

  return (
    <View style={styles.container}>
      <Tabs
        screenOptions={{
          headerShown: false,
          tabBarStyle: {
            position: 'absolute',
            bottom: 0,
            left: 0,
            right: 0,
            backgroundColor: 'transparent',
            borderTopWidth: 0,
            elevation: 0,
            height: currentTrack && !showExpanded ? tabBarHeight + 30 : tabBarHeight,
            paddingBottom: currentTrack && !showExpanded ? insets.bottom + 10 : insets.bottom,
            zIndex: 10,
          },
          tabBarBackground: () => (
            <BlurView
              intensity={80}
              tint="dark"
              style={{
                ...StyleSheet.absoluteFillObject,
                backgroundColor: 'rgba(10,10,10,0.8)',
              }}
            />
          ),
          tabBarActiveTintColor: '#1DB954',
          tabBarInactiveTintColor: 'rgba(255,255,255,0.4)',
          tabBarLabelStyle: {
            fontSize: 11,
            fontWeight: '500',
            marginBottom: Platform.OS === 'ios' ? 0 : 4,
          },
          tabBarIconStyle: {
            marginTop: Platform.OS === 'ios' ? 8 : 4,
          },
        }}
      >
        <Tabs.Screen name="index" options={{ 
          title: 'Inicio',
          tabBarIcon: ({ color, size }) => (
            <Ionicons name={color === '#1DB954' ? 'home' : 'home-outline'} size={size} color={color} />
          )
        }} />
        
        <Tabs.Screen name="search" options={{ 
          title: 'Buscar',
          tabBarIcon: ({ color, size }) => (
            <Ionicons name={color === '#1DB954' ? 'search' : 'search-outline'} size={size} color={color} />
          )
        }} />
        
        <Tabs.Screen name="library" options={{ 
          title: 'Biblioteca',
          tabBarIcon: ({ color, size }) => (
            <Ionicons name={color === '#1DB954' ? 'library' : 'library-outline'} size={size} color={color} />
          )
        }} />
        
        <Tabs.Screen 
          name="settings" 
          options={{ 
            title: 'Ajustes',
            tabBarIcon: ({ color, size }) => (
              <View style={styles.settingsIconContainer}>
                <Ionicons 
                  name={color === '#1DB954' ? 'settings' : 'settings-outline'} 
                  size={size} 
                  color={color} 
                />
                {hasUpdate && (
                  <View style={styles.updateDot} />
                )}
              </View>
            )
          }} 
        />
      </Tabs>

      {currentTrack && currentTrack.id && (
        <View style={[
          styles.playerWrapper,
          { bottom: tabBarHeight }
        ]}>
          <Player
            track={currentTrack}
            onClose={clearQueue}
          />
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#121212',
  },
  playerWrapper: {
    position: 'absolute',
    left: 0,
    right: 0,
    zIndex: 15,
  },
  settingsIconContainer: {
    position: 'relative',
    width: 24,
    height: 24,
    justifyContent: 'center',
    alignItems: 'center',
  },
  updateDot: {
    position: 'absolute',
    top: -2,
    right: -2,
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#1DB954',
    borderWidth: 1,
    borderColor: '#121212',
  },
});