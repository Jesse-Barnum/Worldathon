import React, { useState, useEffect } from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import NetInfo from '@react-native-community/netinfo';
import { supabase } from './src/services/supabase';

import AuthScreen from './src/screens/AuthScreen';
import HomeScreen from './src/screens/HomeScreen';
import ActiveRunScreen from './src/screens/ActiveRunScreen';
import ManualEntryScreen from './src/screens/ManualEntryScreen';
import ProfileScreen from './src/screens/ProfileScreen';
import HistoryScreen from './src/screens/HistoryScreen'; 
import StatisticsScreen from './src/screens/StatisticsScreen';

const Tab = createBottomTabNavigator();
const Stack = createNativeStackNavigator();

function MainTabs() {
  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarActiveTintColor: '#007AFF',
        tabBarInactiveTintColor: 'gray',
        tabBarStyle: { paddingBottom: 5, paddingTop: 5, height: 60, backgroundColor: '#FFFFFF' },
        tabBarIcon: ({ focused, color, size }) => {
          let iconName: keyof typeof Ionicons.glyphMap = 'help-circle';

          if (route.name === 'Home') iconName = focused ? 'map' : 'map-outline';
          else if (route.name === 'Track') iconName = focused ? 'play-circle' : 'play-circle-outline';
          else if (route.name === 'Manual') iconName = focused ? 'add-circle' : 'add-circle-outline';
          else if (route.name === 'History') iconName = focused ? 'time' : 'time-outline';
          else if (route.name === 'Profile') iconName = focused ? 'person' : 'person-outline';

          return <Ionicons name={iconName} size={size} color={color} />;
        },
      })}
    >
      <Tab.Screen name="Home" component={HomeScreen} />
      <Tab.Screen name="Track" component={ActiveRunScreen} />
      <Tab.Screen name="Manual" component={ManualEntryScreen} />
      <Tab.Screen name="History" component={HistoryScreen} />
      <Tab.Screen name="Profile" component={ProfileScreen} />
    </Tab.Navigator>
  );
}

export default function App() {
  const [session, setSession] = useState<any>(null);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => setSession(session));
    supabase.auth.onAuthStateChange((_event, session) => setSession(session));

    const unsubscribeNetInfo = NetInfo.addEventListener(async (state) => {
      if (state.isConnected && session?.user) {
        try {
          const storedQueue = await AsyncStorage.getItem('offline_runs_queue');
          if (storedQueue) {
            const offlineRuns = JSON.parse(storedQueue);
            if (offlineRuns.length > 0) {
              let totalOfflineMiles = 0, totalOfflineSeconds = 0;
              for (const run of offlineRuns) {
                await supabase.from('runs').insert(run);
                totalOfflineMiles += run.distance_miles;
                totalOfflineSeconds += run.duration_seconds;
              }
              const { data: userData } = await supabase.from('users').select('lifetime_distance_miles, lifetime_duration_seconds').eq('id', session.user.id).single();
              await supabase.from('users').update({ 
                lifetime_distance_miles: (userData?.lifetime_distance_miles || 0) + totalOfflineMiles,
                lifetime_duration_seconds: (userData?.lifetime_duration_seconds || 0) + totalOfflineSeconds
              }).eq('id', session.user.id);
              await AsyncStorage.removeItem('offline_runs_queue');
            }
          }
        } catch (error) { console.error("Error during offline sync:", error); }
      }
    });
    return () => unsubscribeNetInfo();
  }, [session]);

  if (!session) return <AuthScreen />;

  return (
    <NavigationContainer>
      <Stack.Navigator>
        <Stack.Screen name="MainTabs" component={MainTabs} options={{ headerShown: false }} />
        <Stack.Screen 
          name="Statistics" 
          component={StatisticsScreen} 
          options={{ 
            title: 'Your Stats',
            headerTintColor: '#007AFF',
            headerBackTitle: 'Profile'
          }} 
        />
      </Stack.Navigator>
    </NavigationContainer>
  );
}