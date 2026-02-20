import { AudioMode, setAudioModeAsync } from 'expo-audio';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { PlayerProvider } from '../context/PlayerContext';

export default function RootLayout() {
  useEffect(() => {
    const setupAudio = async () => {
      const mode: AudioMode = {
        allowsRecording: false,
        playsInSilentMode: true,
        shouldPlayInBackground: true,
        interruptionMode: 'doNotMix',
        shouldDuckAndroid: true,
        playThroughEarpieceAndroid: false,
      };
      await setAudioModeAsync(mode);
      console.log('✅ AudioMode configurado');
    };
    setupAudio();
  }, []);

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <PlayerProvider>
          <StatusBar style="light" />
          <Stack>
            <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
          </Stack>
        </PlayerProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}