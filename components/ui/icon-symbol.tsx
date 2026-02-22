// components/ui/icon-symbol.tsx
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { SymbolViewProps, SymbolWeight } from 'expo-symbols';
import { ComponentProps } from 'react';
import { Platform, Text, type StyleProp, type TextStyle } from 'react-native';

type IconMapping = Record<SymbolViewProps['name'], ComponentProps<typeof MaterialIcons>['name']>;
type IconSymbolName = keyof typeof MAPPING;

/**
 * Add your SF Symbols to Material Icons mappings here.
 */
const MAPPING = {
  'house.fill': 'home',
  'paperplane.fill': 'send',
  'chevron.left.forwardslash.chevron.right': 'code',
  'chevron.right': 'chevron-right',
  'play.fill': 'play-arrow',
  'pause.fill': 'pause',
  'play.skip.forward.fill': 'skip-next',
  'play.skip.backward.fill': 'skip-previous',
  'shuffle': 'shuffle',
  'repeat': 'repeat',
  'heart.fill': 'favorite',
  'heart': 'favorite-border',
  'xmark': 'close',
  'chevron.down': 'expand-more',
  'chevron.up': 'expand-less',
  'music.note': 'music-note',
  'list.bullet': 'list',
  'plus.circle.fill': 'add-circle',
  'cloud.download.fill': 'cloud-download',
  'checkmark.circle.fill': 'check-circle',
  'cloud.slash.fill': 'cloud-off',
  'arrow.backward': 'arrow-back',
  'magnifyingglass': 'search',
  'ellipsis': 'more-vert',
  'clock': 'access-time',
  'trash.fill': 'delete',
  'trash': 'delete-outline',
  'music.note.list': 'queue-music',
  'person.fill': 'person',
  'gear': 'settings',
  'volume.up.fill': 'volume-up',
  'volume.down.fill': 'volume-down',
  'volume.off.fill': 'volume-off',
} as IconMapping;

/**
 * An icon component that uses native SF Symbols on iOS, and Material Icons on Android and web.
 * This version includes an emoji fallback for web when icons don't load.
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
  weight?: SymbolWeight;
}) {
  // En web, intentar con MaterialIcons primero, si falla usar emojis
  if (Platform.OS === 'web') {
    // Mapeo de nombres a emojis como fallback
    const emojiFallback: Record<string, string> = {
      'home': '🏠',
      'send': '✈️',
      'code': '⚙️',
      'chevron-right': '▶️',
      'play-arrow': '▶️',
      'pause': '⏸️',
      'skip-next': '⏩',
      'skip-previous': '⏪',
      'shuffle': '🔀',
      'repeat': '🔁',
      'favorite': '❤️',
      'favorite-border': '🤍',
      'close': '✖️',
      'expand-more': '⬇️',
      'expand-less': '⬆️',
      'music-note': '🎵',
      'list': '📋',
      'add-circle': '➕',
      'cloud-download': '⬇️',
      'check-circle': '✅',
      'cloud-off': '📴',
      'arrow-back': '⬅️',
      'search': '🔍',
      'more-vert': '⋮',
      'access-time': '⏱️',
      'delete': '🗑️',
      'delete-outline': '🗑️',
      'queue-music': '🎶',
      'person': '👤',
      'settings': '⚙️',
      'volume-up': '🔊',
      'volume-down': '🔉',
      'volume-off': '🔇',
    };

    const materialName = MAPPING[name];
    const fallbackEmoji = emojiFallback[materialName] || '•';

    // Intentar con MaterialIcons, pero capturar error silenciosamente
    try {
      return <MaterialIcons color={color} size={size} name={materialName} style={style} />;
    } catch {
      // Si falla, usar emoji
      return <Text style={[{ fontSize: size, color, textAlign: 'center' }, style]}>{fallbackEmoji}</Text>;
    }
  }

  // En iOS/Android, usar MaterialIcons normalmente
  return <MaterialIcons color={color} size={size} name={MAPPING[name]} style={style} />;
}