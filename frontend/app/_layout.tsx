import React, { useEffect, useRef } from 'react';import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { KeyboardProvider } from 'react-native-keyboard-controller';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import {
  Inter_400Regular,
  Inter_500Medium,
  Inter_600SemiBold,
  Inter_700Bold,
  useFonts,
} from '@expo-google-fonts/inter';
   import { router, Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { BrandSplash } from '@/components/BrandSplash';
import { AuthProvider, useAuth } from '@/context/AuthContext';
import { SubscriptionProvider } from '@/context/SubscriptionContext';
import { useLastReminderTap } from '@/lib/notifications'; // also shows reminders while the app is open
// Prevent the splash screen from auto-hiding before asset loading is complete.
SplashScreen.preventAutoHideAsync();

function RootLayoutNav() {
       const { status } = useAuth();
     const lastNotification = useLastReminderTap();
     const openedNotification = useRef<string | null>(null);


     // Tapping a renewal reminder opens that subscription (once signed in).
     useEffect(() => {
       if (status !== 'signedIn' || !lastNotification) return;
       const { identifier, content } = lastNotification.notification.request;
       if (openedNotification.current === identifier) return;
       openedNotification.current = identifier;
       const id = content.data?.subscriptionId;
       if (typeof id === 'string') {
         setTimeout(() => router.push({ pathname: '/subscription/[id]', params: { id } }), 0);
       }
     }, [lastNotification, status]);

  const signedIn = status === 'signedIn';
  const signedOut = status === 'signedOut';
  return (
    <>
    {status === 'loading' ? null : (
    <Stack screenOptions={{ headerBackTitle: 'Back' }}>
      <Stack.Protected guard={signedIn}>
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen
          name="add"
          options={{
            presentation: 'formSheet',
            sheetAllowedDetents: [0.92],
            sheetGrabberVisible: true,
            headerShown: false,
            contentStyle: { backgroundColor: 'transparent' },
          }}
        />
        <Stack.Screen
  name="upgrade"
  options={{
    presentation: 'formSheet',
    sheetAllowedDetents: [0.92],
    sheetGrabberVisible: true,
    headerShown: false,
    contentStyle: { backgroundColor: 'transparent' },
  }}
/>
        <Stack.Screen name="subscription/[id]" options={{ headerShown: false }} />
      </Stack.Protected>
      <Stack.Protected guard={signedOut}>
        <Stack.Screen name="(auth)" options={{ headerShown: false }} />
      </Stack.Protected>
    </Stack>
    )}
    {/* Branded splash on top until the first screen is ready (then it fades out and removes itself). */}
    <BrandSplash ready={status !== 'loading'} />
    </>
  );
}

export default function RootLayout() {
  const [fontsLoaded, fontError] = useFonts({
    Inter_400Regular,
    Inter_500Medium,
    Inter_600SemiBold,
    Inter_700Bold,
  });

  if (!fontsLoaded && !fontError) return null;

  return (
    <SafeAreaProvider>
      <ErrorBoundary>
        <AuthProvider>
          <SubscriptionProvider>
            <GestureHandlerRootView style={{ flex: 1 }}>
              <KeyboardProvider>
                <RootLayoutNav />
              </KeyboardProvider>
            </GestureHandlerRootView>
          </SubscriptionProvider>
        </AuthProvider>
      </ErrorBoundary>
    </SafeAreaProvider>
  );
}
