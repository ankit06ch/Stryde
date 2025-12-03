import { GestureHandlerRootView } from 'react-native-gesture-handler';
import React from 'react';
import { Slot } from 'expo-router';

export default function Layout() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <Slot />
    </GestureHandlerRootView>
  );
}