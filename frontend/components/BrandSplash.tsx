import * as SplashScreen from 'expo-splash-screen';
import React, { useEffect, useRef, useState } from 'react';
import { AccessibilityInfo, Animated, Easing, Image, StyleSheet, useWindowDimensions, View } from 'react-native';
import colors from '@/constants/colors';
import { appShift, closeDock, waitForDock } from '@/lib/splashDock';

const EMBLEM = 120; // same width as the system splash image (app.json), so the hand-off is invisible
const HOLD_MS = 900; // minimum time the logo is on screen
const MOVE_MS = 620;

/**
 * Launch splash, "header morph": the navy screen holds while the emblem shrinks and flies into the
 * logo on the first screen (dashboard or sign-in), and that screen slides up into place underneath.
 * With "reduce motion" on, it simply fades.
 */
export function BrandSplash({ ready }: { ready: boolean }) {
  const { width: W, height: H } = useWindowDimensions();
  const shownAt = useRef(Date.now()).current;
  const navy = useRef(new Animated.Value(1)).current;
  const word = useRef(new Animated.Value(0)).current;
  const emblemOpacity = useRef(new Animated.Value(1)).current;
  const move = useRef(new Animated.ValueXY({ x: 0, y: 0 })).current;
  const scale = useRef(new Animated.Value(1)).current;
  const [gone, setGone] = useState(false);

  useEffect(() => {
    Animated.timing(word, { toValue: 1, duration: 260, delay: 120, useNativeDriver: true }).start();
  }, [word]);

  useEffect(() => {
    if (!ready) return;
    let cancelled = false;
    (async () => {
      const reduce = await AccessibilityInfo.isReduceMotionEnabled().catch(() => false);
      await new Promise((r) => setTimeout(r, Math.max(0, HOLD_MS - (Date.now() - shownAt))));
      const dock = reduce ? null : await waitForDock(900);
      closeDock();
      if (cancelled) return;

      const finish = () => setGone(true);
      if (!dock) {
        Animated.timing(navy, { toValue: 0, duration: 320, useNativeDriver: true }).start(finish);
        Animated.timing(emblemOpacity, { toValue: 0, duration: 220, useNativeDriver: true }).start();
        Animated.timing(word, { toValue: 0, duration: 180, useNativeDriver: true }).start();
        return;
      }

      // Land on the emblem inside the logo tile (the tile has ~15% padding around it).
      const inner = dock.width * 0.7;
      const k = inner / EMBLEM;
      const dx = dock.x + dock.width / 2 - W / 2;
      const dy = dock.y + dock.height / 2 - H / 2;
      appShift.setValue(H * 0.22); // hidden behind the navy, so this jump is not seen
      const curve = Easing.bezier(0.65, 0, 0.35, 1);
      Animated.parallel([
        Animated.timing(word, { toValue: 0, duration: 160, useNativeDriver: true }),
        Animated.timing(move, { toValue: { x: dx, y: dy }, duration: MOVE_MS, easing: curve, useNativeDriver: true }),
        Animated.timing(scale, { toValue: k, duration: MOVE_MS, easing: curve, useNativeDriver: true }),
        Animated.timing(appShift, { toValue: 0, duration: MOVE_MS, delay: 120, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
        Animated.timing(navy, { toValue: 0, duration: 420, delay: 200, useNativeDriver: true }),
      ]).start(() => {
        Animated.timing(emblemOpacity, { toValue: 0, duration: 140, useNativeDriver: true }).start(finish);
      });
    })();
    return () => {
      cancelled = true;
    };
  }, [ready, shownAt, W, H, navy, word, emblemOpacity, move, scale]);

  if (gone) return null;
  return (
    <View pointerEvents={ready ? 'none' : 'auto'} style={StyleSheet.absoluteFill}>
      <Animated.View
        style={[StyleSheet.absoluteFill, { backgroundColor: colors.brand.ink, opacity: navy }]}
        // The system splash can go as soon as this identical screen is showing.
        onLayout={() => void SplashScreen.hideAsync().catch(() => {})}
      />
      <Animated.Image
        source={require('@/assets/images/splash-icon.png')}
        resizeMode="contain"
        accessibilityIgnoresInvertColors
        style={[
          styles.emblem,
          { left: W / 2 - EMBLEM / 2, top: H / 2 - EMBLEM / 2, opacity: emblemOpacity },
          { transform: [{ translateX: move.x }, { translateY: move.y }, { scale }] },
        ]}
      />
      <Animated.View style={[styles.wordWrap, { top: H / 2 + EMBLEM / 2 + 22, opacity: word }]}>
        <Image source={require('@/assets/images/splash-wordmark.png')} style={styles.word} resizeMode="contain" accessibilityLabel="Subscript" />
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  emblem: { position: 'absolute', width: EMBLEM, height: EMBLEM },
  wordWrap: { position: 'absolute', left: 0, right: 0, alignItems: 'center' },
  word: { width: 150, height: 28 },
});
