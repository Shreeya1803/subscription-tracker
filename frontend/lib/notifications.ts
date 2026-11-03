import Constants from 'expo-constants';
import * as Device from 'expo-device';
import * as Application from 'expo-application';
import * as Notifications from 'expo-notifications';
import { Linking, Platform } from 'react-native';
import { userApi } from '@/lib/api';

/** Android channel the server sends renewal reminders on (see the push_reminders migration). */
export const REMINDER_CHANNEL = 'renewal-reminders';

// Show reminders as a banner even when the app is open.
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

export type ReminderPermission = 'granted' | 'denied' | 'undetermined' | 'unsupported';

/** Push only works on a real phone, in a real build (not Expo Go, not web, not the iOS simulator). */
function pushSupported() {
  return Platform.OS !== 'web' && Device.isDevice && Constants.executionEnvironment !== 'storeClient';
}

async function ensureChannel() {
  if (Platform.OS !== 'android') return;
  // Android 13+: the channel must exist before asking, or the system prompt is not shown.
  await Notifications.setNotificationChannelAsync(REMINDER_CHANNEL, {
    name: 'Renewal reminders',
    description: 'A reminder before one of your subscriptions renews',
    importance: Notifications.AndroidImportance.HIGH,
  });
}

export async function getReminderPermission(): Promise<ReminderPermission> {
  if (!pushSupported()) return 'unsupported';
  const { status } = await Notifications.getPermissionsAsync();
  return status as ReminderPermission;
}

/**
 * Registers this phone for renewal reminders and saves its push token to the account.
 * `ask: true` shows the system permission prompt if the user has not answered it yet;
 * `ask: false` only refreshes the token when permission was already given (used at sign-in).
 */
export async function registerForReminders({ ask }: { ask: boolean }): Promise<ReminderPermission> {
  if (!pushSupported()) return 'unsupported';
  await ensureChannel();

  let { status, canAskAgain } = await Notifications.getPermissionsAsync();
  if (status !== 'granted' && ask && canAskAgain) {
    ({ status } = await Notifications.requestPermissionsAsync());
  }
  if (status !== 'granted') return status as ReminderPermission;

  const projectId = Constants.expoConfig?.extra?.eas?.projectId ?? Constants.easConfig?.projectId;
  const { data: token } = await Notifications.getExpoPushTokenAsync({ projectId });
  await userApi.registerPushToken(token);
  return 'granted';
}

/** Stops reminders on this phone for the signed-in account (called before signing out). */
export async function unregisterFromReminders() {
  if (!pushSupported()) return;
  try {
    await userApi.clearPushToken();
  } catch {
    /* offline: the token moves to the next account that signs in on this phone anyway */
  }
}

/** Notifications were turned off for the app: only the phone's settings can turn them back on. */
/** Opens this app's notification settings on the phone (on/off, sound, vibration). */
export async function openNotificationSettings() {
  if (Platform.OS === 'android' && Application.applicationId) {
    try {
      await Linking.sendIntent('android.settings.APP_NOTIFICATION_SETTINGS', [
        { key: 'android.provider.extra.APP_PACKAGE', value: Application.applicationId },
      ]);
      return;
    } catch {
      /* some phones don't support this screen: fall back to the app's info page */
    }
  }
  await Linking.openSettings();
}