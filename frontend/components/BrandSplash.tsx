import * as SplashScreen from 'expo-splash-screen';
import React, { useEffect, useRef, useState } from 'react';
import { Animated, Image, StyleSheet, Text } from 'react-native';
import colors from '@/constants/colors';
import { APP_NAME } from '@/lib/brand';

const MIN_VISIBLE_MS = 1200;

/**
 * The app's own splash, drawn exactly like the system one (same navy and logo). Some phones show the
 * system splash for only a moment, or not at all when the app restarts, so this keeps the branded
 * screen visible for at least ~1 second on every phone, then fades into the app.
 */
export function BrandSplash({ ready }: { ready: boolean }) {
  const opacity = useRef(new Animated.Value(1)).current;
  const scale = useRef(new Animated.Value(0.92)).current;
  const shownAt = useRef(Date.now()).current;
  const [gone, setGone] = useState(false);

  useEffect(() => {
    Animated.spring(scale, { toValue: 1, useNativeDriver: true, friction: 7 }).start();
  }, [scale]);

  useEffect(() => {
    if (!ready) return;
    const wait = Math.max(0, MIN_VISIBLE_MS - (Date.now() - shownAt));
    const t = setTimeout(() => {
      Animated.timing(opacity, { toValue: 0, duration: 350, useNativeDriver: true }).start(() => setGone(true));
    }, wait);
    return () => clearTimeout(t);
  }, [ready, opacity, shownAt]);

  if (gone) return null;
  return (
    <Animated.View
      pointerEvents={ready ? 'none' : 'auto'}
      style={[StyleSheet.absoluteFill, styles.screen, { opacity, backgroundColor: colors.brand.ink }]}
      // The system splash can go as soon as this identical screen is on display.
      onLayout={() => void SplashScreen.hideAsync().catch(() => {})}
    >
      <Animated.View style={{ alignItems: 'center', transform: [{ scale }] }}>
        <Image source={require('@/assets/images/splash-icon.png')} style={styles.logo} resizeMode="contain" />
        <Text style={[styles.name, { color: colors.brand.white }]}>{APP_NAME}</Text>
      </Animated.View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  screen: { alignItems: 'center', justifyContent: 'center', zIndex: 1000, elevation: 1000 },
  logo: { width: 120, height: 120 },
  name: { fontFamily: 'Inter_600SemiBold', fontSize: 18, letterSpacing: -0.2, marginTop: 18 },
});
