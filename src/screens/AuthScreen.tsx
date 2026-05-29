import React, { useState } from 'react';
import { View, Text, TextInput, Pressable, StyleSheet, Alert, ActivityIndicator, KeyboardAvoidingView, Platform } from 'react-native';
import { supabase } from '../services/supabase';

export default function AuthScreen() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [isSignUp, setIsSignUp] = useState(false);

  async function handleAuth() {
    if (!email || !password) { Alert.alert("Error", "Enter email and password."); return; }
    setLoading(true);
    let error;
    if (isSignUp) {
      const { error: signUpError } = await supabase.auth.signUp({ email, password });
      error = signUpError;
      if (!error) Alert.alert("Success", "Account created! You can now log in.");
    } else {
      const { error: signInError } = await supabase.auth.signInWithPassword({ email, password });
      error = signInError;
    }
    if (error) Alert.alert("Authentication Failed", error.message);
    setLoading(false);
  }

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.container}>
      <View style={styles.content}>
        <Text style={styles.logo}>RunTheWorld</Text>
        <Text style={styles.subtitle}>24,901 miles to go.</Text>

        <View style={styles.formContainer}>
          <Text style={styles.label}>Email</Text>
          <TextInput style={styles.input} placeholder="runner@example.com" value={email} onChangeText={setEmail} autoCapitalize="none" keyboardType="email-address" />
          <Text style={styles.label}>Password</Text>
          <TextInput style={styles.input} placeholder="••••••••" value={password} onChangeText={setPassword} secureTextEntry />

          <Pressable style={[styles.button, loading && styles.buttonDisabled]} onPress={handleAuth} disabled={loading}>
            {loading ? <ActivityIndicator color="#FFF" /> : <Text style={styles.buttonText}>{isSignUp ? "Create Account" : "Sign In"}</Text>}
          </Pressable>

          <Pressable onPress={() => setIsSignUp(!isSignUp)} style={styles.toggleContainer}>
            <Text style={styles.toggleText}>{isSignUp ? "Already have an account? Log In" : "Don't have an account? Sign Up"}</Text>
          </Pressable>
        </View>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FFFFFF' },
  content: { flex: 1, justifyContent: 'center', padding: 30 },
  logo: { fontSize: 32, fontWeight: '900', color: '#000', textAlign: 'center', marginBottom: 5 },
  subtitle: { fontSize: 16, fontWeight: '700', color: '#007AFF', textAlign: 'center', marginBottom: 40 },
  formContainer: { backgroundColor: '#F8F8F8', padding: 25, borderRadius: 16, borderWidth: 1, borderColor: '#E0E0E0' },
  label: { fontSize: 14, color: '#333', marginBottom: 8, fontWeight: '700' },
  input: { backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#E0E0E0', color: '#000', padding: 14, borderRadius: 12, fontSize: 16, marginBottom: 20 },
  button: { backgroundColor: '#28A745', padding: 16, borderRadius: 12, alignItems: 'center', marginTop: 10 },
  buttonDisabled: { opacity: 0.6 },
  buttonText: { color: '#FFF', fontSize: 16, fontWeight: 'bold' },
  toggleContainer: { marginTop: 25, alignItems: 'center' },
  toggleText: { color: '#007AFF', fontSize: 14, fontWeight: '600' },
});