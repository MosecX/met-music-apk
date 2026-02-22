// app/(tabs)/_layout.tsx - VERSIÓN MEJORADA
import { Ionicons } from '@expo/vector-icons';
import { BlurView } from 'expo-blur';
import { Tabs } from 'expo-router';
import { Platform, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Player from '../../components/Player';
import { usePlayer } from '../../context/PlayerContext';

export default function TabsLayout() {
  const { currentTrack, showExpanded, setShowExpanded, clearQueue } = usePlayer();
  const insets = useSafeAreaInsets();

  const tabBarHeight = Platform.OS === 'android' ? 60 + insets.bottom : 60;

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
          tabBarActiveTintColor: '#1DB954', // Rosa neón para activo
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
        <Tabs.Screen name="settings" options={{ 
          title: 'Ajustes',
          tabBarIcon: ({ color, size }) => (
            <Ionicons name={color === '#1DB954' ? 'settings' : 'settings-outline'} size={size} color={color} />
          )
        }} />
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
});