import TrackPlayer, { Event } from 'react-native-track-player';

export const PlaybackService = async function() {
  console.log('🎵 PlaybackService iniciado');

  // Reproducir
  TrackPlayer.addEventListener(Event.RemotePlay, () => {
    console.log('▶️ Remote play');
    TrackPlayer.play();
  });

  // Pausar
  TrackPlayer.addEventListener(Event.RemotePause, () => {
    console.log('⏸️ Remote pause');
    TrackPlayer.pause();
  });

  // Siguiente canción
  TrackPlayer.addEventListener(Event.RemoteNext, () => {
    console.log('⏭️ Remote next');
    TrackPlayer.skipToNext();
  });

  // Anterior canción
  TrackPlayer.addEventListener(Event.RemotePrevious, () => {
    console.log('⏮️ Remote previous');
    TrackPlayer.skipToPrevious();
  });

  // Detener
  TrackPlayer.addEventListener(Event.RemoteStop, () => {
    console.log('⏹️ Remote stop');
    TrackPlayer.stop();
  });

  // Buscar posición
  TrackPlayer.addEventListener(Event.RemoteSeek, (event) => {
    console.log('🔍 Remote seek to:', event.position);
    TrackPlayer.seekTo(event.position);
  });

  // Saltar adelante
  TrackPlayer.addEventListener(Event.RemoteJumpForward, async (event) => {
    console.log('⏩ Remote jump forward');
    const position = await TrackPlayer.getPosition();
    TrackPlayer.seekTo(position + (event.interval || 10));
  });

  // Saltar atrás
  TrackPlayer.addEventListener(Event.RemoteJumpBackward, async (event) => {
    console.log('⏪ Remote jump backward');
    const position = await TrackPlayer.getPosition();
    TrackPlayer.seekTo(Math.max(position - (event.interval || 10), 0));
  });

  // Error de playback
  TrackPlayer.addEventListener(Event.PlaybackError, (event) => {
    console.log('❌ Playback error:', event);
  });

  // Cuando termina la cola
  TrackPlayer.addEventListener(Event.PlaybackQueueEnded, (event) => {
    console.log('📋 Queue ended:', event);
  });

  // Cuando cambia la pista activa
  TrackPlayer.addEventListener(Event.PlaybackActiveTrackChanged, (event) => {
    console.log('🎵 Active track changed:', event.track?.title || 'unknown');
  });

  // Cuando cambia el estado (play/pause/loading/etc)
  TrackPlayer.addEventListener(Event.PlaybackState, (event) => {
    console.log('🔄 Playback state:', event.state);
  });

  console.log('✅ PlaybackService listeners registrados');
};