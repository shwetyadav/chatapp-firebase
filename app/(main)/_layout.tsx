import { Stack } from 'expo-router';
import React from 'react';

export default function MainLayout() {
  return (
    <Stack screenOptions={{ headerBackTitle: "Back"}}>
      <Stack.Screen 
        name="chats/index" 
        options={{ 
          title: 'Chats',
          headerShown: false,
        }} 
      />
      <Stack.Screen 
        name="chats/[chatId]" 
        options={{ 
          headerShown: true,
        }} 
      />
      <Stack.Screen 
        name="new-chat" 
        options={{ 
          title: 'New Chat',
          headerShown: true,
          presentation: 'modal',
        }} 
      />
      <Stack.Screen 
        name="profile" 
        options={{ 
          title: 'Profile',
          headerShown: true,
        }} 
      />
      <Stack.Screen 
        name="settings" 
        options={{ 
          title: 'Settings',
          headerShown: true,
        }} 
      />
    </Stack>
  );
}
