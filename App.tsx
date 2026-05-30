import React, { useState, useEffect } from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from './src/services/supabase';

// Import all of your screens
import AuthScreen from './src/screens/AuthScreen';
import HomeScreen from './src/screens/HomeScreen';
import ActiveRunScreen from './src/screens/ActiveRunScreen';
import ProfileScreen from './src/screens/ProfileScreen';
import StatisticsScreen from './src/screens/StatisticsScreen';
import ManualEntryScreen from './src/screens/ManualEntryScreen';
import HistoryScreen from './src/screens/HistoryScreen';

const Stack = createNativeStackNavigator();
const Tab = createBottomTabNavigator();

// Define the Bottom Tab Navigator (Everything here shows up on the bottom bar)
function MainTabs() {
  return (
    <Tab.Navigator 
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarActiveTintColor: '#007AFF',
        tabBarInactiveTintColor: 'gray',
        tabBarIcon: ({ color, size }) => {
          let iconName: keyof typeof Ionicons.glyphMap = 'map';

          if (route.name === 'Home') {
            iconName = 'map';
          } else if (route.name === 'Track') {
            iconName = 'play-circle';
          } else if (route.name === 'Log') {
            iconName = 'add-circle';
          } else if (route.name === 'History') {
            iconName = 'list';
          } else if (route.name === 'Profile') {
            iconName = 'person';
          }

          return <Ionicons name={iconName} size={size} color={color} />;
        },
      })}
    >
      <Tab.Screen name="Home" component={HomeScreen} />
      <Tab.Screen name="Track" component={ActiveRunScreen} options={{ title: 'Run' }} />
      <Tab.Screen name="Log" component={ManualEntryScreen} options={{ title: 'Log' }} />
      <Tab.Screen name="History" component={HistoryScreen} />
      <Tab.Screen name="Profile" component={ProfileScreen} />
    </Tab.Navigator>
  );
}

// Define the main App Stack
function AppStack() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      {/* The main tab interface */}
      <Stack.Screen name="MainTabs" component={MainTabs} />
      
      {/* Screens that pop up over the tabs (like clicking a specific button inside Profile) */}
      <Stack.Screen name="Statistics" component={StatisticsScreen} options={{ headerShown: true, title: 'Statistics' }} />
    </Stack.Navigator>
  );
}

export default function App() {
  const [session, setSession] = useState<any>(null);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
    });

    return () => subscription.remove();
  }, []);

  return (
    <NavigationContainer>
      {session && session.user ? (
        <AppStack />
      ) : (
        <AuthScreen />
      )}
    </NavigationContainer>
  );
}