import 'react-native-url-polyfill/auto'; // Required for Supabase in React Native
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://hdixcaggffaydrfdvtam.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImhkaXhjYWdnZmZheWRyZmR2dGFtIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzk2NDY0ODcsImV4cCI6MjA5NTIyMjQ4N30.ajP5wiVEWTHBjnsvlPwbVzSpAQZKf6nSADwiIIYZjls';

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    storage: AsyncStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});