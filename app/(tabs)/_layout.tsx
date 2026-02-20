import { Ionicons } from '@expo/vector-icons';
import { Tabs } from 'expo-router';
import { Platform, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Player from '../../components/Player';
import { usePlayer } from '../../context/PlayerContext';

export default function TabsLayout() {
  // ✅ SOLO AGREGAMOS playNext y playPrevious a la desestructuración
  const { currentTrack, showExpanded, setShowExpanded, playNext, playPrevious, hasNext, hasPrev, clearQueue } = usePlayer();
  const insets = useSafeAreaInsets();

  // LOG PARA VER QUÉ RECIBE
  console.log('📱 Layout - currentTrack:', currentTrack?.title);

  const tabBarHeight = Platform.OS === 'android' ? 60 + insets.bottom : 60;

  return (
    <View style={styles.container}>
      <Tabs
        screenOptions={{
          // ✅ HEADER COMPLETAMENTE OCULTO (sin texto)
          headerShown: false,
          
          // ✅ TAB BAR configurado
          tabBarStyle: {
            backgroundColor: '#121212',
            borderTopColor: '#282828',
            height: currentTrack && !showExpanded ? tabBarHeight + 30 : tabBarHeight,
            paddingBottom: currentTrack && !showExpanded ? insets.bottom + 10 : insets.bottom,
            position: 'absolute',
            bottom: 0,
            left: 0,
            right: 0,
            elevation: 8,
            zIndex: 10,
          },
          tabBarActiveTintColor: '#1DB954',
          tabBarInactiveTintColor: '#666',
        }}
      >
        <Tabs.Screen name="index" options={{ 
          title: 'Inicio',
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="home" size={size} color={color} />
          )
        }} />
        <Tabs.Screen name="search" options={{ 
          title: 'Buscar',
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="search" size={size} color={color} />
          )
        }} />
        <Tabs.Screen name="library" options={{ 
          title: 'Biblioteca',
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="library" size={size} color={color} />
          )
        }} />
        <Tabs.Screen 
          name="settings" 
          options={{ 
            title: 'Ajustes',
            tabBarIcon: ({ color, size }) => (
              <Ionicons name="settings" size={size} color={color} />
            )
          }} 
        />
      </Tabs>

      {/* Player - AHORA CON CONDICIONAL EXPLÍCITA */}
      {currentTrack && currentTrack.id && (
        <View style={[
          styles.playerWrapper,
          {
            bottom: tabBarHeight + (currentTrack && !showExpanded ? 0 : 0),
          }
        ]}>
          <Player
            track={currentTrack}
            onClose={clearQueue}
            isExpanded={showExpanded}
            onExpandChange={setShowExpanded}
            // ✅ SOLO AGREGAMOS ESTAS PROPS NUEVAS
            onNext={playNext}
            onPrev={playPrevious}
            hasNext={hasNext}
            hasPrev={hasPrev}
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