import React, { useState, useCallback } from 'react';
import { View, Text, StyleSheet, TextInput, Pressable, Alert, ScrollView, Platform } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import DateTimePicker from '@react-native-community/datetimepicker';
import { supabase } from '../services/supabase';

export default function ProfileScreen({ navigation }: any) {
  const [name, setName] = useState('');
  const [miles, setMiles] = useState(0);
  const [birthday, setBirthday] = useState(new Date(2004, 3, 17)); 
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [targetAge, setTargetAge] = useState('65');
  const [daysPerWeek, setDaysPerWeek] = useState('5');
  const [height, setHeight] = useState('71');
  const [weight, setWeight] = useState('185');
  const [isUpdating, setIsUpdating] = useState(false);

  useFocusEffect(
    useCallback(() => {
      const fetchProfile = async () => {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;
        const { data } = await supabase.from('users').select('*').eq('id', user.id).single();
        if (data) {
          setName(data.name || 'Runner'); setMiles(data.lifetime_distance_miles || 0);
          if (data.birthday) setBirthday(new Date(data.birthday));
          if (data.target_age) setTargetAge(data.target_age.toString());
          if (data.running_days_per_week) setDaysPerWeek(data.running_days_per_week.toString());
          if (data.height_inches) setHeight(data.height_inches.toString());
          if (data.weight_lbs) setWeight(data.weight_lbs.toString());
        }
      };
      fetchProfile();
    }, [])
  );

  const calculateGoals = () => {
    const age = parseInt(targetAge), dpw = parseInt(daysPerWeek);
    if (isNaN(age) || isNaN(dpw) || dpw <= 0 || dpw > 7) return null;
    const targetDate = new Date(birthday.getFullYear() + age, birthday.getMonth(), birthday.getDate());
    const daysRemaining = (targetDate.getTime() - new Date().getTime()) / (1000 * 3600 * 24);
    if (daysRemaining <= 0) return { error: "Target date has passed!" };
    const totalRunDays = (daysRemaining / 7) * dpw;
    const milesRemaining = Math.max(0, 24901 - miles);
    return { milesPerDay: milesRemaining / totalRunDays, milesPerWeek: (milesRemaining / totalRunDays) * dpw, targetDate };
  };

  const handleUpdateProfile = async () => {
    setIsUpdating(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      const { error } = await supabase.from('users').update({ name, birthday: birthday.toISOString().split('T')[0], target_age: parseInt(targetAge), running_days_per_week: parseInt(daysPerWeek), height_inches: parseInt(height) || 0, weight_lbs: parseInt(weight) || 0 }).eq('id', user.id);
      if (error) Alert.alert("Error", error.message); else Alert.alert("Success", "Profile saved!");
    }
    setIsUpdating(false);
  };

  const confirmDeleteAccount = () => {
    Alert.alert(
      "Delete Account",
      "Are you sure you want to completely delete your account? This will permanently erase your profile, login credentials, and all of your logged runs. This action cannot be undone.",
      [
        { text: "Cancel", style: "cancel" },
        { text: "Delete Everything", style: "destructive", onPress: executeDeleteAccount }
      ]
    );
  };

  const executeDeleteAccount = async () => {
    setIsUpdating(true);
    try {
      // Trigger the secure backend function to wipe the user's data and auth credentials
      const { error: rpcError } = await supabase.rpc('delete_user_account');
      if (rpcError) throw rpcError;

      // Clear the local session (server session is already dead)
      await supabase.auth.signOut();

    } catch (error: any) {
      Alert.alert("Error deleting account", error.message);
    } finally {
      setIsUpdating(false);
    }
  };

  const goals = calculateGoals();

  return (
    <ScrollView style={styles.container} keyboardShouldPersistTaps="handled" contentContainerStyle={{ paddingBottom: 60 }}>
      <View style={styles.avatarPlaceholder}><Text style={styles.avatarText}>{name ? name.charAt(0).toUpperCase() : '?'}</Text></View>
      
      <Text style={styles.sectionTitle}>Account</Text>
      <View style={styles.inputGroup}>
        <Text style={styles.label}>Display Name</Text>
        <TextInput style={styles.input} value={name} onChangeText={setName} />
      </View>

      <Text style={styles.sectionTitle}>Physical Profile</Text>
      <View style={styles.row}>
        <View style={[styles.inputGroup, { flex: 1, marginRight: 10 }]}><Text style={styles.label}>Height (Inches)</Text><TextInput style={styles.input} value={height} onChangeText={setHeight} keyboardType="numeric" /></View>
        <View style={[styles.inputGroup, { flex: 1 }]}><Text style={styles.label}>Weight (lbs)</Text><TextInput style={styles.input} value={weight} onChangeText={setWeight} keyboardType="numeric" /></View>
      </View>

      <Text style={styles.sectionTitle}>Goal Settings</Text>
      <View style={styles.inputGroup}>
        <Text style={styles.label}>Birthday</Text>
        {Platform.OS === 'ios' ? (
          <DateTimePicker value={birthday} mode="date" display="default" onChange={(e, d) => d && setBirthday(d)} style={{ alignSelf: 'flex-start' }} />
        ) : (
          <><Pressable style={styles.input} onPress={() => setShowDatePicker(true)}><Text style={{ fontSize: 16 }}>{birthday.toLocaleDateString()}</Text></Pressable>
          {showDatePicker && <DateTimePicker value={birthday} mode="date" onChange={(e, d) => { setShowDatePicker(false); if (d) setBirthday(d); }} />}</>
        )}
      </View>

      <View style={styles.row}>
        <View style={[styles.inputGroup, { flex: 1, marginRight: 10 }]}><Text style={styles.label}>Target Age</Text><TextInput style={styles.input} value={targetAge} onChangeText={setTargetAge} keyboardType="numeric" /></View>
        <View style={[styles.inputGroup, { flex: 1 }]}><Text style={styles.label}>Days / Week</Text><TextInput style={styles.input} value={daysPerWeek} onChangeText={setDaysPerWeek} keyboardType="numeric" /></View>
      </View>

      <View style={styles.goalCard}>
        {goals?.error ? <Text style={styles.goalData}>{goals.error}</Text> : goals ? (
          <><Text style={styles.goalSubtext}>To finish by {goals.targetDate.toLocaleDateString()}, average:</Text><Text style={styles.goalData}>{goals.milesPerDay.toFixed(2)} mi / run</Text><Text style={styles.goalData}>{goals.milesPerWeek.toFixed(2)} mi / week</Text></>
        ) : <Text style={styles.goalSubtext}>Enter valid settings.</Text>}
      </View>

      <Pressable style={styles.updateButton} onPress={handleUpdateProfile} disabled={isUpdating}>
        <Text style={styles.updateButtonText}>{isUpdating ? "Processing..." : "Save Settings"}</Text>
      </Pressable>
      
      <Pressable style={styles.statsButton} onPress={() => navigation.navigate('Statistics')}>
        <Text style={styles.statsButtonText}>View Detailed Statistics</Text>
      </Pressable>
      
      <Pressable style={styles.logoutButton} onPress={() => supabase.auth.signOut()}>
        <Text style={styles.logoutButtonText}>Log Out</Text>
      </Pressable>

      <View style={styles.dangerZone}>
        <Text style={styles.dangerTitle}>Danger Zone</Text>
        <Pressable style={styles.deleteAccountButton} onPress={confirmDeleteAccount} disabled={isUpdating}>
          <Text style={styles.deleteAccountButtonText}>Delete Account</Text>
        </Pressable>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 20, backgroundColor: '#FFFFFF' },
  avatarPlaceholder: { width: 100, height: 100, backgroundColor: '#28A745', borderRadius: 50, justifyContent: 'center', alignItems: 'center', alignSelf: 'center', marginTop: 10, marginBottom: 20 },
  avatarText: { color: '#FFF', fontSize: 32, fontWeight: 'bold' },
  sectionTitle: { fontSize: 18, fontWeight: 'bold', color: '#000', marginTop: 20, marginBottom: 10 },
  inputGroup: { width: '100%', marginBottom: 15 },
  row: { flexDirection: 'row', width: '100%' },
  label: { fontSize: 14, color: '#333', marginBottom: 5, fontWeight: '600' },
  input: { backgroundColor: '#F8F8F8', borderWidth: 1, borderColor: '#E0E0E0', width: '100%', padding: 14, borderRadius: 12, fontSize: 16, color: '#000' },
  goalCard: { backgroundColor: '#F8F8F8', padding: 20, borderRadius: 12, borderWidth: 1, borderColor: '#E0E0E0', marginBottom: 25 },
  goalSubtext: { color: '#333', fontSize: 14, fontWeight: '500', marginBottom: 10 },
  goalData: { color: '#000', fontSize: 22, fontWeight: '800', marginBottom: 5 },
  updateButton: { backgroundColor: '#28A745', padding: 16, borderRadius: 12, alignItems: 'center', width: '100%', marginBottom: 15 },
  updateButtonText: { color: '#FFF', fontSize: 18, fontWeight: 'bold' },
  statsButton: { backgroundColor: '#007AFF', padding: 16, borderRadius: 12, alignItems: 'center', width: '100%', marginBottom: 10 },
  statsButtonText: { color: '#FFF', fontSize: 18, fontWeight: 'bold' },
  logoutButton: { padding: 16, alignItems: 'center', width: '100%' },
  logoutButtonText: { color: '#666', fontSize: 16, fontWeight: 'bold' },
  
  dangerZone: { marginTop: 30, paddingTop: 20, borderTopWidth: 1, borderTopColor: '#E0E0E0', alignItems: 'center' },
  dangerTitle: { fontSize: 14, fontWeight: '700', color: '#999', textTransform: 'uppercase', marginBottom: 10 },
  deleteAccountButton: { backgroundColor: '#FFF', borderWidth: 2, borderColor: '#FF3B30', padding: 16, borderRadius: 12, alignItems: 'center', width: '100%', marginBottom: 20 },
  deleteAccountButtonText: { color: '#FF3B30', fontSize: 16, fontWeight: 'bold' },
});