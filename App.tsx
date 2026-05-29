import React, { useState, useEffect } from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { supabase } from './src/services/supabase';
// ... import your screens ...

export default function App() {
  const [session, setSession] = useState<any>(null);

  useEffect(() => {
    // 1. Check if there's a saved session on load
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
    });

    // 2. Listen for login/logout events
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
    });

    return () => subscription.remove();
  }, []);

  return (
    <NavigationContainer>
      {/* Conditionally render screens based on whether a session exists */}
      {session && session.user ? (
        <AppStack /> // Contains HomeScreen, ActiveRunScreen, ProfileScreen, etc.
      ) : (
        <AuthScreen /> // Only show this if they are completely logged out
      )}
    </NavigationContainer>
  );
}