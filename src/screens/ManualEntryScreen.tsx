import React, { useState } from 'react';
import { View, Text, StyleSheet, TextInput, Pressable, Alert, ScrollView, Platform } from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import { supabase } from '../services/supabase';

export default function ManualEntryScreen({ navigation }: any) {
  const [distance, setDistance] = useState('');
  const [hours, setHours] = useState('');
  const [minutes, setMinutes] = useState('');
  const [seconds, setSeconds] = useState('');
  const [date, setDate] = useState(new Date());
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async () => {
    const distNum = parseFloat(distance);
    const totalSeconds = ((parseInt(hours) || 0) * 3600) + ((parseInt(minutes) || 0) * 60) + (parseInt(seconds) || 0);

    if (isNaN(distNum) || distNum <= 0) { Alert.alert("Error", "Enter valid distance."); return; }
    if (totalSeconds <= 0) { Alert.alert("Error", "Enter valid duration."); return; }

    setIsSubmitting(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not logged in");

      const { data: userData } = await supabase.from('users').select('weight_lbs, lifetime_distance_miles, lifetime_duration_seconds').eq('id', user.id).single();
      const caloriesBurned = Math.round((userData?.weight_lbs || 150) * 0.75 * distNum);

      await supabase.from('runs').insert({
        user_id: user.id, distance_miles: distNum, duration_seconds: totalSeconds, calories: caloriesBurned, pace_seconds: Math.floor(totalSeconds / distNum), created_at: date.toISOString()
      });
      await supabase.from('users').update({ 
        lifetime_distance_miles: (userData?.lifetime_distance_miles || 0) + distNum, lifetime_duration_seconds: (userData?.lifetime_duration_seconds || 0) + totalSeconds
      }).eq('id', user.id);

      Alert.alert("Success! 🏆", "Workout logged.", [{ text: "Awesome", onPress: () => { setDistance(''); setHours(''); setMinutes(''); setSeconds(''); navigation.navigate('Home'); } }]);
    } catch (error: any) { Alert.alert("Error", error.message); } finally { setIsSubmitting(false); }
  };

  return (
    <ScrollView style={styles.container} keyboardShouldPersistTaps="handled">
      <Text style={styles.headerTitle}>Log Workout</Text>

      <View style={styles.card}>
        <View style={styles.inputGroup}>
          <Text style={styles.label}>Distance (Miles)</Text>
          <TextInput style={styles.input} value={distance} onChangeText={setDistance} keyboardType="numeric" placeholder="e.g. 3.1" />
        </View>

        <Text style={styles.label}>Duration</Text>
        <View style={styles.timeRow}>
          <View style={styles.timeInputBox}><TextInput style={styles.input} value={hours} onChangeText={setHours} keyboardType="numeric" placeholder="Hrs" /></View>
          <View style={styles.timeInputBox}><TextInput style={styles.input} value={minutes} onChangeText={setMinutes} keyboardType="numeric" placeholder="Min" /></View>
          <View style={styles.timeInputBox}><TextInput style={styles.input} value={seconds} onChangeText={setSeconds} keyboardType="numeric" placeholder="Sec" /></View>
        </View>

        <View style={styles.inputGroup}>
          <Text style={styles.label}>Date</Text>
          {Platform.OS === 'ios' ? (
            <DateTimePicker value={date} mode="date" display="default" onChange={(e, d) => d && setDate(d)} style={{ alignSelf: 'flex-start' }} />
          ) : (
            <><Pressable style={styles.input} onPress={() => setShowDatePicker(true)}><Text style={{ fontSize: 16 }}>{date.toLocaleDateString()}</Text></Pressable>
            {showDatePicker && <DateTimePicker value={date} mode="date" onChange={(e, d) => { setShowDatePicker(false); if (d) setDate(d); }} />}</>
          )}
        </View>
      </View>

      <Pressable style={styles.button} onPress={handleSubmit} disabled={isSubmitting}>
        <Text style={styles.buttonText}>{isSubmitting ? "Saving..." : "Save Workout"}</Text>
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FFFFFF', padding: 20 },
  headerTitle: { fontSize: 24, fontWeight: '900', color: '#000', marginTop: 40, marginBottom: 20 },
  card: { backgroundColor: '#F8F8F8', padding: 20, borderRadius: 16, borderWidth: 1, borderColor: '#E0E0E0', marginBottom: 30 },
  inputGroup: { marginBottom: 20 },
  label: { fontSize: 14, color: '#333', marginBottom: 8, fontWeight: '700' },
  input: { backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#E0E0E0', color: '#000', padding: 16, borderRadius: 12, fontSize: 16 },
  timeRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 20 },
  timeInputBox: { width: '31%' },
  button: { backgroundColor: '#28A745', padding: 18, borderRadius: 12, alignItems: 'center' },
  buttonText: { color: '#FFF', fontSize: 18, fontWeight: 'bold' },
});