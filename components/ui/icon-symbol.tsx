// components/ui/icon-symbol.tsx - VERSIÓN SIMPLIFICADA
import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { Platform, Text, type StyleProp, type TextStyle } from 'react-native';

// Solo definimos los nombres que realmente usamos
export type IconSymbolName = 
  | 'house.fill'
  | 'paperplane.fill'
  | 'chevron.right'
  | 'play.fill'
  | 'pause.fill'
  | 'play.skip.forward.fill'
  | 'play.skip.backward.fill'
  | 'shuffle'
  | 'repeat'
  | 'heart.fill'
  | 'heart'
  | 'xmark'
  | 'chevron.down'
  | 'chevron.up'
  | 'music.note'
  | 'list.bullet'
  | 'plus.circle.fill'
  | 'cloud.download.fill'
  | 'checkmark.circle.fill'
  | 'cloud.slash.fill'
  | 'arrow.backward'
  | 'magnifyingglass'
  | 'ellipsis'
  | 'clock'
  | 'trash.fill'
  | 'music.note.list'
  | 'person.fill'
  | 'gear'
  | 'volume.up.fill'
  | 'volume.down.fill'
  | 'volume.off.fill';

// Mapeo directo a nombres de Ionicons (corregidos)
const IONICON_MAPPING: Record<IconSymbolName, any> = {
  'house.fill': 'home',
  'paperplane.fill': 'paper-plane',
  'chevron.right': 'chevron-forward',
  'play.fill': 'play',
  'pause.fill': 'pause',
  'play.skip.forward.fill': 'play-skip-forward',
  'play.skip.backward.fill': 'play-skip-back',
  'shuffle': 'shuffle',
  'repeat': 'repeat',
  'heart.fill': 'heart',
  'heart': 'heart-outline',
  'xmark': 'close',
  'chevron.down': 'chevron-down',
  'chevron.up': 'chevron-up',
  'music.note': 'musical-notes',
  'list.bullet': 'list',
  'plus.circle.fill': 'add-circle',
  'cloud.download.fill': 'cloud-download',
  'checkmark.circle.fill': 'checkmark-circle',
  'cloud.slash.fill': 'cloud-offline',
  'arrow.backward': 'arrow-back',
  'magnifyingglass': 'search',
  'ellipsis': 'ellipsis-horizontal',
  'clock': 'time',
  'trash.fill': 'trash',
  'music.note.list': 'musical-notes',
  'person.fill': 'person',
  'gear': 'settings',
  'volume.up.fill': 'volume-high',
  'volume.down.fill': 'volume-low',
  'volume.off.fill': 'volume-mute',
};

// Mapa de emojis para web
const EMOJI_MAPPING: Record<IconSymbolName, string> = {
  'house.fill': '🏠',
  'paperplane.fill': '✈️',
  'chevron.right': '▶️',
  'play.fill': '▶️',
  'pause.fill': '⏸️',
  'play.skip.forward.fill': '⏩',
  'play.skip.backward.fill': '⏪',
  'shuffle': '🔀',
  'repeat': '🔁',
  'heart.fill': '❤️',
  'heart': '🤍',
  'xmark': '✖️',
  'chevron.down': '⬇️',
  'chevron.up': '⬆️',
  'music.note': '🎵',
  'list.bullet': '📋',
  'plus.circle.fill': '➕',
  'cloud.download.fill': '⬇️',
  'checkmark.circle.fill': '✅',
  'cloud.slash.fill': '📴',
  'arrow.backward': '⬅️',
  'magnifyingglass': '🔍',
  'ellipsis': '⋯',
  'clock': '⏱️',
  'trash.fill': '🗑️',
  'music.note.list': '🎶',
  'person.fill': '👤',
  'gear': '⚙️',
  'volume.up.fill': '🔊',
  'volume.down.fill': '🔉',
  'volume.off.fill': '🔇',
};

/**
 * Componente de iconos que usa MaterialIcons en Android y fallback a emojis en web
 */
export function IconSymbol({
  name,
  size = 24,
  color,
  style,
}: {
  name: IconSymbolName;
  size?: number;
  color: string;
  style?: StyleProp<TextStyle>;
}) {
  // En web, usar emojis para evitar problemas de fuentes
  if (Platform.OS === 'web') {
    return (
      <Text style={[{ fontSize: size, color, textAlign: 'center' }, style]}>
        {EMOJI_MAPPING[name] || '•'}
      </Text>
    );
  }

  // En Android, usar Ionicons
  return (
    <Ionicons
      name={IONICON_MAPPING[name]}
      size={size}
      color={color}
      style={style}
    />
  );
}