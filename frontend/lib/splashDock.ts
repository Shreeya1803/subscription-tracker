import { Animated } from 'react-native';

/**
 * Hand-off between the launch splash and the first screen. The first screen's logo reports where it
 * sits; the splash flies its emblem there while the screen slides up into place.
 */
export type DockRect = { x: number; y: number; width: number; height: number };

let target: DockRect | null = null;
let open = true; // only the first screen after launch takes part
const waiting = new Set<(r: DockRect) => void>();

/** Called by the logo on the first screen with its position on screen. */
export function reportDock(rect: DockRect) {
  if (!open || !rect.width) return;
  target = rect;
  waiting.forEach((resolve) => resolve(rect));
  waiting.clear();
}

/** Waits briefly for the first screen's logo; null if it never reports (then the splash just fades). */
export function waitForDock(timeoutMs: number): Promise<DockRect | null> {
  if (target) return Promise.resolve(target);
  return new Promise((resolve) => {
    const done = (r: DockRect | null) => {
      waiting.delete(done as (r: DockRect) => void);
      resolve(r);
    };
    waiting.add(done as (r: DockRect) => void);
    setTimeout(() => done(null), timeoutMs);
  });
}

export function closeDock() {
  open = false;
  waiting.clear();
}

export const isDockOpen = () => open;

/** Vertical offset of the app behind the splash (0 = in place). The splash animates it to 0. */
export const appShift = new Animated.Value(0);
