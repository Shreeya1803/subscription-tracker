import * as WebBrowser from 'expo-web-browser';
import { Linking, Platform } from 'react-native';
import colors from '@/constants/colors';

/**
 * Opens a web page inside the app (Chrome Custom Tab on Android, Safari view on iOS).
 * The user closes it with Done / X or the back gesture and lands exactly where they were.
 */
export async function openInApp(url: string) {
  if (Platform.OS === 'web') {
    await Linking.openURL(url);
    return;
  }
  try {
    await WebBrowser.openBrowserAsync(url, {
      toolbarColor: colors.brand.ink,
      controlsColor: colors.brand.gold,
      secondaryToolbarColor: colors.brand.ink,
      showTitle: true,
      enableBarCollapsing: true,
      presentationStyle: WebBrowser.WebBrowserPresentationStyle.PAGE_SHEET,
    });
  } catch {
    // No in-app browser available on this phone: fall back to the default browser.
    await Linking.openURL(url);
  }
}
