import { LinearGradient } from 'expo-linear-gradient';
import React from 'react';
import { ColorValue, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context'; // 👈 Importar

interface ScreenWrapperProps {
  children: React.ReactNode;
  gradientColors?: [ColorValue, ColorValue, ...ColorValue[]];
  withSafeArea?: boolean; // 👈 Opcional, para activar/desactivar safe area
}

const ScreenWrapper = ({ 
  children, 
  gradientColors = ['#1a1a1a', '#0a0a0a'] as [ColorValue, ColorValue, ...ColorValue[]],
  withSafeArea = true // 👈 Por defecto activado
}: ScreenWrapperProps) => {
  const insets = useSafeAreaInsets(); // 👈 Obtener insets

  return (
    <View style={styles.container}>
      <LinearGradient
        colors={gradientColors}
        style={StyleSheet.absoluteFill}
      />
      <View style={[
        styles.content,
        withSafeArea && {
          paddingTop: insets.top,
          paddingBottom: insets.bottom,
          paddingLeft: insets.left,
          paddingRight: insets.right,
        }
      ]}>
        {children}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    flex: 1,
  },
});

export default ScreenWrapper;