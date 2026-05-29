import { createClient } from '@supabase/supabase-js';

// Replace these with your actual Supabase project credentials later
const supabaseUrl = 'https://hdixcaggffaydrfdvtam.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImhkaXhjYWdnZmZheWRyZmR2dGFtIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzk2NDY0ODcsImV4cCI6MjA5NTIyMjQ4N30.ajP5wiVEWTHBjnsvlPwbVzSpAQZKf6nSADwiIIYZjls';

export const supabase = createClient(supabaseUrl, supabaseAnonKey);