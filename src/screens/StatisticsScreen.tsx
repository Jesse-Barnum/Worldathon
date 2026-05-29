import React, { useState, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, ActivityIndicator } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { supabase } from '../services/supabase';

const formatPace = (totalSeconds: number) => {
  if (!totalSeconds) return '--:--';
  const hrs = Math.floor(totalSeconds / 3600);
  const mins = Math.floor((totalSeconds % 3600) / 60);
  const secs = Math.floor(totalSeconds % 60);
  if (hrs > 0) return `${hrs}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  return `${mins}:${secs.toString().padStart(2, '0')}`;
};

export default function StatisticsScreen() {
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState<any>(null);

  useFocusEffect(
    useCallback(() => {
      const fetchAndCalculateStats = async () => {
        try {
          setLoading(true);
          const { data: { user } } = await supabase.auth.getUser();
          if (!user) return;

          const { data: userData, error: userError } = await supabase.from('users').select('lifetime_distance_miles, lifetime_duration_seconds, weight_lbs').eq('id', user.id).single();
          if (userError) throw userError;

          const { data: runs, error: runsError } = await supabase.from('runs').select('*').eq('user_id', user.id).order('created_at', { ascending: true });
          if (runsError) throw runsError;

          if (!userData || !runs || runs.length === 0) { setStats(null); return; }

          const totalMiles = userData.lifetime_distance_miles || 0;
          const totalSeconds = userData.lifetime_duration_seconds || 0;
          const avgPaceSeconds = totalMiles > 0 ? Math.floor(totalSeconds / totalMiles) : 0;
          
          let totalCalories = runs.reduce((sum, run) => sum + (run.calories || 0), 0);
          if (totalCalories === 0 && totalMiles > 0) totalCalories = Math.round((userData.weight_lbs || 150) * 0.75 * totalMiles);

          const elephants = Math.floor((totalMiles * 5280) / 22);
          const dailyTotals: Record<string, number> = {};
          const weeklyTotals: Record<string, number> = {};
          const monthlyTotals: Record<string, number> = {};

          const getWeekStart = (date: Date) => {
            const d = new Date(date);
            const diff = d.getDate() - d.getDay();
            return new Date(d.setDate(diff)).toISOString().split('T')[0];
          };

          const monthNames = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

          runs.forEach(run => {
            const runDate = new Date(run.created_at);
            const dayKey = runDate.toISOString().split('T')[0];
            const weekKey = getWeekStart(runDate);
            const monthKey = monthNames[runDate.getMonth()];
            dailyTotals[dayKey] = (dailyTotals[dayKey] || 0) + run.distance_miles;
            weeklyTotals[weekKey] = (weeklyTotals[weekKey] || 0) + run.distance_miles;
            monthlyTotals[monthKey] = (monthlyTotals[monthKey] || 0) + run.distance_miles;
          });

          const maxDay = Math.max(...Object.values(dailyTotals), 0);
          const maxWeek = Math.max(...Object.values(weeklyTotals), 0);
          
          let bestMonth = "None", maxMonthMiles = 0;
          for (const [month, miles] of Object.entries(monthlyTotals)) {
            if ((miles as number) > maxMonthMiles) { maxMonthMiles = miles as number; bestMonth = month; }
          }

          let best1MileSeconds = Infinity;
          runs.forEach(run => {
            if (run.splits && Array.isArray(run.splits)) {
              run.splits.forEach(split => {
                if (split.mile === Math.floor(split.mile) && split.time < best1MileSeconds) best1MileSeconds = split.time;
              });
            }
          });

          const getPRForDistance = (targetMiles: number) => {
            const qualifyingRuns = runs.filter(r => r.distance_miles >= targetMiles);
            if (qualifyingRuns.length === 0) return 0;
            const bestRun = qualifyingRuns.reduce((prev, current) => (prev.pace_seconds < current.pace_seconds) ? prev : current);
            return bestRun.pace_seconds * targetMiles;
          };

          const prs = { mile: best1MileSeconds === Infinity ? 0 : best1MileSeconds, fiveK: getPRForDistance(3.11), tenK: getPRForDistance(6.21), halfMarathon: getPRForDistance(13.11), marathon: getPRForDistance(26.22) };
          const remainingDistance = Math.max(0, 24901 - totalMiles);
          const averageMilesPerRun = totalMiles / runs.length;
          const runsLeft = averageMilesPerRun > 0 ? Math.ceil(remainingDistance / averageMilesPerRun) : 0;

          setStats({ avgPace: formatPace(avgPaceSeconds), calories: totalCalories.toLocaleString(), elephants: elephants.toLocaleString(), maxDay: maxDay.toFixed(2), maxWeek: maxWeek.toFixed(2), bestMonth, runsLeft: runsLeft.toLocaleString(), prs });
        } catch (error) { console.error("Error loading stats: ", error); } finally { setLoading(false); }
      };
      fetchAndCalculateStats();
    }, [])
  );

  if (loading) return <View style={[styles.container, { justifyContent: 'center' }]}><ActivityIndicator size="large" color="#007AFF" /></View>;
  if (!stats) return <View style={[styles.container, { justifyContent: 'center', alignItems: 'center' }]}><Text style={styles.emptyText}>Complete a workout to see your statistics!</Text></View>;

  return (
    <ScrollView style={styles.container} contentContainerStyle={{ paddingBottom: 60 }}>
      <Text style={styles.sectionTitle}>Personal Records</Text>
      <View style={styles.prGrid}>
        <View style={styles.prBox}><Text style={styles.prDistance}>1 Mile</Text><Text style={styles.prTime}>{formatPace(stats.prs.mile)}</Text></View>
        <View style={styles.prBox}><Text style={styles.prDistance}>5K</Text><Text style={styles.prTime}>{formatPace(stats.prs.fiveK)}</Text></View>
        <View style={styles.prBox}><Text style={styles.prDistance}>10K</Text><Text style={styles.prTime}>{formatPace(stats.prs.tenK)}</Text></View>
        <View style={styles.prBox}><Text style={styles.prDistance}>Half Marathon</Text><Text style={styles.prTime}>{formatPace(stats.prs.halfMarathon)}</Text></View>
        <View style={[styles.prBox, { width: '100%', backgroundColor: '#007AFF', borderColor: '#007AFF' }]}>
          <Text style={[styles.prDistance, { color: '#FFF' }]}>Marathon</Text>
          <Text style={[styles.prTime, { color: '#FFF', fontSize: 24 }]}>{formatPace(stats.prs.marathon)}</Text>
        </View>
      </View>

      <Text style={styles.sectionTitle}>Lifetime Analytics</Text>
      <View style={[styles.card, { backgroundColor: '#007AFF', borderColor: '#007AFF' }]}>
        <Text style={styles.cardLabelWhite}>You have run the length of</Text>
        <Text style={styles.cardValueWhite}>{stats.elephants}</Text>
        <Text style={styles.cardLabelWhite}>Elephants (22ft each) 🐘</Text>
      </View>

      <View style={styles.grid}>
        <View style={styles.halfCard}><Text style={styles.cardValue}>{stats.avgPace}</Text><Text style={styles.cardLabel}>Avg Pace (/mi)</Text></View>
        <View style={styles.halfCard}><Text style={styles.cardValue}>{stats.calories}</Text><Text style={styles.cardLabel}>Total Calories</Text></View>
      </View>

      <Text style={styles.sectionTitle}>Volume Records</Text>
      <View style={styles.rowCard}><Text style={styles.rowLabel}>Best Single Day</Text><Text style={styles.rowValue}>{stats.maxDay} mi</Text></View>
      <View style={styles.rowCard}><Text style={styles.rowLabel}>Best Week</Text><Text style={styles.rowValue}>{stats.maxWeek} mi</Text></View>
      <View style={styles.rowCard}><Text style={styles.rowLabel}>Most Active Month</Text><Text style={styles.rowValue}>{stats.bestMonth}</Text></View>

      <Text style={styles.sectionTitle}>The Road Ahead</Text>
      <View style={[styles.card, { marginTop: 10 }]}>
        <Text style={styles.cardLabel}>At your current pace, you have</Text>
        <Text style={[styles.cardValue, { color: '#28A745', fontSize: 36, marginVertical: 10 }]}>{stats.runsLeft}</Text>
        <Text style={styles.cardLabel}>workouts left to circle the globe.</Text>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FFFFFF', padding: 20 },
  sectionTitle: { fontSize: 20, fontWeight: 'bold', color: '#000000', marginTop: 10, marginBottom: 15 },
  emptyText: { fontSize: 16, color: '#666666', fontWeight: '500' },
  
  prGrid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', marginBottom: 20 },
  prBox: { width: '48%', backgroundColor: '#F8F8F8', padding: 15, borderRadius: 12, borderWidth: 1, borderColor: '#E0E0E0', marginBottom: 10, alignItems: 'center' },
  prDistance: { fontSize: 14, fontWeight: '700', color: '#666', textTransform: 'uppercase', marginBottom: 5 },
  prTime: { fontSize: 22, fontWeight: '900', color: '#000', fontFamily: 'Courier' },

  card: { backgroundColor: '#F8F8F8', padding: 20, borderRadius: 16, borderWidth: 1, borderColor: '#E0E0E0', alignItems: 'center', marginBottom: 20 },
  cardValueWhite: { fontSize: 48, fontWeight: '900', color: '#FFFFFF', marginVertical: 5 },
  cardLabelWhite: { fontSize: 16, fontWeight: '600', color: '#FFFFFF', opacity: 0.9 },
  
  grid: { flexDirection: 'row', justifyContent: 'space-between' },
  halfCard: { width: '48%', backgroundColor: '#F8F8F8', padding: 20, borderRadius: 16, borderWidth: 1, borderColor: '#E0E0E0', alignItems: 'center' },
  cardValue: { fontSize: 24, fontWeight: '900', color: '#007AFF', fontFamily: 'Courier' },
  cardLabel: { fontSize: 12, fontWeight: '800', color: '#666', marginTop: 8 },

  rowCard: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#F8F8F8', padding: 16, borderRadius: 12, borderWidth: 1, borderColor: '#E0E0E0', marginBottom: 10 },
  rowLabel: { fontSize: 16, fontWeight: '600', color: '#333333' },
  rowValue: { fontSize: 18, fontWeight: '800', color: '#007AFF' },
  cardLabel: { fontSize: 14, fontWeight: '600', color: '#333', textAlign: 'center' },
});