import { Stack } from 'expo-router';
import React from 'react';

// Signed-out visitors (including after signing out) start on the sign-in screen.
// New users are introduced to the app by the guided tour on their first visit to the dashboard.
export const unstable_settings = { initialRouteName: 'login' };

export default function AuthLayout() {
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="login" />
      <Stack.Screen name="signup" />
      <Stack.Screen name="verify-email" />
      <Stack.Screen name="forgot-password" />
    </Stack>
  );
}
