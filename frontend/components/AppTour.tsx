import * as Haptics from 'expo-haptics';
import React, { useEffect, useState } from 'react';
import { Modal, Pressable, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useColors } from '@/hooks/useColors';

export type TourStep = {
  key: string;
  title: string;
  body: string;
  /** The element to highlight. Steps without one show the dialog in the middle of the screen. */
  target?: React.RefObject<View | null>;
  /** Highlight the tab bar at the bottom of the screen. */
  bottomBar?: boolean;
  /** Label for the last button (defaults to "Done"). */
  finishLabel?: string;
};

type Rect = { x: number; y: number; width: number; height: number };

/** One storage key per account, so each person sees the tour once on this phone. */
export const tourDoneKey = (userId: string) => `st_tour_done_v1:${userId}`;

const PAD = 8;
const TAB_BAR = 64;

/**
 * Guided tour: dims the screen, highlights one element at a time and explains it in a dialog
 * with Next / Skip, ending with a Done button.
 */
export function AppTour({
  visible,
  steps,
  beforeStep,
  onSkip,
  onFinish,
}: {
  visible: boolean;
  steps: TourStep[];
  beforeStep?: (step: TourStep) => Promise<void>;
  onSkip: () => void;
  onFinish: () => void;
}) {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { width: W, height: H } = useWindowDimensions();
  const [index, setIndex] = useState(0);
  const [rect, setRect] = useState<Rect | null>(null);
  const [ready, setReady] = useState(false);
  const step = steps[Math.min(index, steps.length - 1)];
  const last = index >= steps.length - 1;

  useEffect(() => {
    if (visible) setIndex(0);
  }, [visible]);

  // Scroll the element into view, then measure where it is on screen.
  useEffect(() => {
    if (!visible || !step) return;
    let cancelled = false;
    setReady(false);
    (async () => {
      await beforeStep?.(step);
      if (cancelled) return;
      if (step.bottomBar) {
        const h = TAB_BAR + insets.bottom;
        setRect({ x: 0, y: H - h, width: W, height: h });
        setReady(true);
      } else if (step.target?.current) {
        step.target.current.measureInWindow((x, y, width, height) => {
          if (cancelled) return;
          setRect(width && height ? { x, y, width, height } : null);
          setReady(true);
        });
      } else {
        setRect(null);
        setReady(true);
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible, index]);

  if (!visible || !step) return null;

  const next = () => {
    void Haptics.selectionAsync();
    if (last) onFinish();
    else setIndex((i) => i + 1);
  };

  // Highlight box (with a little breathing room) and the four dimmed areas around it.
  const hole = rect
    ? {
        x: Math.max(0, rect.x - PAD),
        y: Math.max(0, rect.y - PAD),
        w: Math.min(W, rect.width + PAD * 2),
        h: rect.height + PAD * 2,
      }
    : null;
  const dim = 'rgba(3, 9, 22, 0.72)';
  const spaceBelow = hole ? H - (hole.y + hole.h) : 0;
  const dialogBelow = hole ? spaceBelow > 240 || spaceBelow > hole.y : false;
  const dialogPosition = !hole
    ? { top: Math.max(insets.top + 40, H / 2 - 140) }
    : dialogBelow
      ? { top: hole.y + hole.h + 14 }
      : { bottom: H - hole.y + 14 };

  return (
    <Modal visible transparent animationType="fade" statusBarTranslucent navigationBarTranslucent onRequestClose={onSkip}>
      {hole ? (
        <>
          <View style={[styles.dim, { backgroundColor: dim, top: 0, left: 0, right: 0, height: hole.y }]} />
          <View style={[styles.dim, { backgroundColor: dim, top: hole.y + hole.h, left: 0, right: 0, bottom: 0 }]} />
          <View style={[styles.dim, { backgroundColor: dim, top: hole.y, left: 0, width: hole.x, height: hole.h }]} />
          <View style={[styles.dim, { backgroundColor: dim, top: hole.y, left: hole.x + hole.w, right: 0, height: hole.h }]} />
          <View
            pointerEvents="none"
            style={[styles.ring, { top: hole.y, left: hole.x, width: hole.w, height: hole.h, borderColor: colors.brand.gold }]}
          />
        </>
      ) : (
        <View style={[StyleSheet.absoluteFill, { backgroundColor: dim }]} />
      )}

      {ready ? (
        <View
          style={[styles.dialog, dialogPosition, { backgroundColor: colors.card, borderColor: colors.border }]}
          accessibilityViewIsModal
          accessibilityLiveRegion="polite"
        >
          <Text style={[styles.counter, { color: colors.mutedForeground }]}>
            {index + 1} of {steps.length}
          </Text>
          <Text style={[styles.title, { color: colors.foreground }]}>{step.title}</Text>
          <Text style={[styles.body, { color: colors.mutedForeground }]}>{step.body}</Text>
          <View style={styles.actions}>
            {!last ? (
              <Pressable onPress={onSkip} accessibilityRole="button" hitSlop={8} style={styles.skip}>
                <Text style={[styles.skipText, { color: colors.mutedForeground }]}>Skip tour</Text>
              </Pressable>
            ) : (
              <View />
            )}
            <Pressable
              onPress={next}
              accessibilityRole="button"
              style={({ pressed }) => [styles.next, { backgroundColor: colors.brand.gold }, pressed && { opacity: 0.85 }]}
            >
              <Text style={[styles.nextText, { color: colors.brand.ink }]}>{last ? step.finishLabel ?? 'Done' : 'Next'}</Text>
            </Pressable>
          </View>
        </View>
      ) : null}
    </Modal>
  );
}

const styles = StyleSheet.create({
  dim: { position: 'absolute' },
  ring: { position: 'absolute', borderWidth: 2, borderRadius: 22 },
  dialog: { position: 'absolute', left: 18, right: 18, borderRadius: 22, borderWidth: 1, padding: 18 },
  counter: { fontFamily: 'Inter_500Medium', fontSize: 12 },
  title: { fontFamily: 'Inter_700Bold', fontSize: 19, letterSpacing: -0.3, marginTop: 6 },
  body: { fontFamily: 'Inter_400Regular', fontSize: 14, lineHeight: 21, marginTop: 6 },
  actions: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 16 },
  skip: { paddingVertical: 8 },
  skipText: { fontFamily: 'Inter_500Medium', fontSize: 14 },
  next: { minWidth: 104, minHeight: 44, borderRadius: 14, paddingHorizontal: 18, alignItems: 'center', justifyContent: 'center' },
  nextText: { fontFamily: 'Inter_700Bold', fontSize: 15 },
});
