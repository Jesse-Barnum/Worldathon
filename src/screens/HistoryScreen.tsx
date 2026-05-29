import React, { useState, useCallback } from 'react';
import { View, Text, StyleSheet, FlatList, ActivityIndicator, Pressable, Alert } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '../services/supabase';

const formatPace = (totalSeconds: number) => {
  if (!totalSeconds) return '--:--';
  const mins = Math.floor(totalSeconds / 60);
  const secs = Math.floor(totalSeconds % 60);
  return `${mins}:${secs.toString().padStart(2, '0')}`;
};

const formatTime = (totalSeconds: number) => {
  const hrs = Math.floor(totalSeconds / 3600);
  const mins = Math.floor((totalSeconds % 3600) / 60);
  const secs = totalSeconds % 60;
  if (hrs > 0) return `${hrs}h ${mins}m ${secs}s`;
  return `${mins}m ${secs}s`;
};

export default function HistoryScreen() {
  const [runs, setRuns] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useFocusEffect(
    useCallback(() => {
      const fetchHistory = async () => {
        try {
          setLoading(true);
          const { data: { user } } = await supabase.auth.getUser();
          if (!user) return;
          
          const { data, error } = await supabase.from('runs').select('*').eq('user_id', user.id).order('created_at', { ascending: false });
          if (error) throw error;
          if (data) setRuns(data);
        } catch (error) { console.error("Error loading history: ", error); } finally { setLoading(false); }
      };
      fetchHistory();
    }, [])
  );

  const confirmDelete = (runId: number, distance: number, duration: number) => {
    Alert.alert("Delete Run", "Are you sure you want to delete this run? This will remove the mileage from your global journey.", [
      { text: "Cancel", style: "cancel" },
      { text: "Delete", style: "destructive", onPress: () => deleteRun(runId, distance, duration) }
    ]);
  };

  const deleteRun = async (runId: number, distance: number, duration: number) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { error: deleteError } = await supabase.from('runs').delete().eq('id', runId);
      if (deleteError) throw deleteError;

      const { data: userData } = await supabase.from('users').select('lifetime_distance_miles, lifetime_duration_seconds').eq('id', user.id).single();
      if (userData) {
        await supabase.from('users').update({
          lifetime_distance_miles: Math.max(0, (userData.lifetime_distance_miles || 0) - distance),
          lifetime_duration_seconds: Math.max(0, (userData.lifetime_duration_seconds || 0) - duration)
        }).eq('id', user.id);
      }
      setRuns(prevRuns => prevRuns.filter(run => run.id !== runId));
    } catch (error: any) { Alert.alert("Error deleting run", error.message); }
  };

  if (loading) return <View style={[styles.container, { justifyContent: 'center' }]}><ActivityIndicator size="large" color="#007AFF" /></View>;

  return (
    <View style={styles.container}>
      <Text style={styles.headerTitle}>Activity Log</Text>
      {runs.length === 0 ? (
        <View style={styles.emptyState}><Text style={styles.emptyText}>No runs logged yet. Time to hit the road!</Text></View>
      ) : (
        <FlatList
          data={runs}
          keyExtractor={(item) => item.id.toString()}
          contentContainerStyle={{ paddingBottom: 40 }}
          renderItem={({ item }) => {
            const dateString = new Date(item.created_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
            return (
              <View style={styles.card}>
                <View style={styles.cardHeader}>
                  <Text style={styles.dateText}>{dateString}</Text>
                  <View style={styles.headerRight}>
                    {item.elevation_gain_ft > 0 && <Text style={styles.elevationText}>+{item.elevation_gain_ft} ft</Text>}
                    <Pressable onPress={() => confirmDelete(item.id, item.distance_miles, item.duration_seconds)} style={styles.deleteButton}>
                      <Ionicons name="trash-outline" size={20} color="#FF3B30" />
                    </Pressable>
                  </View>
                </View>
                <View style={styles.mainStatsRow}>
                  <View>
                    <Text style={styles.distanceValue}>{item.distance_miles.toFixed(2)}</Text>
                    <Text style={styles.distanceLabel}>Miles</Text>
                  </View>
                  <View style={styles.secondaryStats}>
                    <Text style={styles.statLine}>Pace: <Text style={styles.statValue}>{formatPace(item.pace_seconds)} /mi</Text></Text>
                    <Text style={styles.statLine}>Time: <Text style={styles.statValue}>{formatTime(item.duration_seconds)}</Text></Text>
                    <Text style={styles.statLine}>Kcal: <Text style={styles.statValue}>{item.calories || 0}</Text></Text>
                  </View>
                </View>
              </View>
            );
          }}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FFFFFF', paddingHorizontal: 20 },
  headerTitle: { fontSize: 24, fontWeight: '900', color: '#000000', marginTop: 60, marginBottom: 20 },
  emptyState: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  emptyText: { color: '#666', fontSize: 16, fontWeight: '600' },
  card: { backgroundColor: '#F8F8F8', padding: 20, borderRadius: 16, borderWidth: 1, borderColor: '#E0E0E0', marginBottom: 15 },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 15, paddingBottom: 10, borderBottomWidth: 1, borderBottomColor: '#E0E0E0' },
  dateText: { color: '#666', fontSize: 14, fontWeight: '700' },
  headerRight: { flexDirection: 'row', alignItems: 'center' },
  elevationText: { color: '#007AFF', fontSize: 14, fontWeight: 'bold', marginRight: 15 },
  deleteButton: { padding: 4 },
  mainStatsRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  distanceValue: { color: '#000', fontSize: 40, fontWeight: '900', fontFamily: 'Courier' },
  distanceLabel: { color: '#666', fontSize: 14, fontWeight: '700', marginTop: -5, textTransform: 'uppercase' },
  secondaryStats: { alignItems: 'flex-end', justifyContent: 'center' },
  statLine: { color: '#666', fontSize: 12, fontWeight: '700', marginBottom: 4 },
  statValue: { color: '#000', fontSize: 16, fontFamily: 'Courier' },
});