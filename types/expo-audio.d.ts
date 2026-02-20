// types/expo-audio.d.ts

declare module 'expo-audio' {
  export interface AudioPlayer {
    playing: boolean;
    currentTime: number;
    duration: number;
    play: () => void;
    pause: () => void;
    replace: (source: string) => void;
    seekTo: (seconds: number) => void;
    remove: () => void;
    setActiveForLockScreen: (active: boolean, metadata?: any) => void;
    updateLockScreenMetadata: (metadata: any) => void;
    clearLockScreenControls: () => void;
  }

  export interface AudioMode {
    allowsRecording?: boolean;
    playsInSilentMode?: boolean;
    shouldPlayInBackground?: boolean;
    interruptionMode?: 'mixWithOthers' | 'doNotMix' | 'duckOthers';
    allowsRecordingIOS?: boolean;
    staysActiveInBackground?: boolean;
    playsInSilentModeIOS?: boolean;
    shouldDuckAndroid?: boolean;
    playThroughEarpieceAndroid?: boolean;
    interruptionModeIOS?: number;
    interruptionModeAndroid?: number;
  }

  export function useAudioPlayer(source?: string | null, options?: any): AudioPlayer;
  export function createAudioPlayer(source?: string | null, options?: any): AudioPlayer;
  export function setAudioModeAsync(mode: Partial<AudioMode>): Promise<void>;
  export function useAudioPlayerStatus(player: AudioPlayer): any;
  
  export function useAudioRecorder(options?: any, statusListener?: any): any;
  export function useAudioRecorderState(recorder: any, interval?: number): any;
  
  export const AudioModule: any;
  export const RecordingPresets: any;
}