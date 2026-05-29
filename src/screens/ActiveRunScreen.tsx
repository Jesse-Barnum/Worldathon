import React, { useState, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Pressable, Alert, AppState, Modal, ScrollView } from 'react-native';
import * as Location from 'expo-location';
import * as TaskManager from 'expo-task-manager';
import AsyncStorage from '@react-native-async-storage/async-storage';
import MapView, { Polyline } from 'react-native-maps';
import NetInfo from '@react-native-community/netinfo';
import { supabase } from '../services/supabase';
import { captureRef } from 'react-native-view-shot';
import * as Sharing from 'expo-sharing';

const BACKGROUND_LOCATION_TASK = 'background-location-task';

const calculateDistance = (lat1: number, lon1: number, lat2: number, lon2: number) => {
  const R = 3958.8; 
  const dLat = (lat2 - lat1) * (Math.PI / 180);
  const dLon = (lon2 - lon1) * (Math.PI / 180);
  const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) + Math.cos(lat1 * (Math.PI / 180)) * Math.cos(lat2 * (Math.PI / 180)) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
};

TaskManager.defineTask(BACKGROUND_LOCATION_TASK, async ({ data, error }: any) => {
  if (error) return;
  if (data) {
    try {
      const storedPoints = await AsyncStorage.getItem('bg_locations');
      const pointsArray = storedPoints ? JSON.parse(storedPoints) : [];
      data.locations.forEach((loc: any) => {
        pointsArray.push({ latitude: loc.coords.latitude, longitude: loc.coords.longitude, altitude: loc.coords.altitude || 0 });
      });
      await AsyncStorage.setItem('bg_locations', JSON.stringify(pointsArray));
    } catch (e) { console.error(e); }
  }
});

export default function ActiveRunScreen({ navigation }: any) {
  const [isRunning, setIsRunning] = useState(false);
  const [distance, setDistance] = useState(0);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [splits, setSplits] = useState<{mile: number, time: number}[]>([]);
  const [elevationGainMeters, setElevationGainMeters] = useState(0);
  const [userWeight, setUserWeight] = useState(150); 
  
  const [showSummary, setShowSummary] = useState(false);
  const [finalStats, setFinalStats] = useState<any>(null);
  
  const mapRef = useRef<MapView>(null);
  const viewShotRef = useRef<View>(null); 
  
  const distanceRef = useRef(0);
  const elapsedSecondsRef = useRef(0);
  const elevationGainMetersRef = useRef(0);
  const splitsRef = useRef<{mile: number, time: number}[]>([]);
  const fullRoute = useRef<{latitude: number, longitude: number}[]>([]);
  
  const lastLoc = useRef<{latitude: number, longitude: number, altitude: number} | null>(null);
  const startTimeRef = useRef<number | null>(null);
  const fgSubRef = useRef<any>(null); 
  const nextSplitTarget = useRef(1);
  const lastSplitTimeRef = useRef(0);

  useEffect(() => {
    const fetchUserData = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const { data } = await supabase.from('users').select('weight_lbs').eq('id', user.id).single();
        if (data?.weight_lbs) setUserWeight(data.weight_lbs);
      }
    };
    fetchUserData();
    Location.requestForegroundPermissionsAsync().then(({ status }) => {
      if (status === 'granted') Location.requestBackgroundPermissionsAsync();
    });
    
    // Process background points when app resumes
    const subscription = AppState.addEventListener('change', async (nextAppState) => {
      if (nextAppState === 'active' && isRunning) {
        processBackgroundQueue();
      }
    });
    return () => subscription.remove();
  }, [isRunning]);

  // The absolute-time stopwatch interval
  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (isRunning) {
      interval = setInterval(() => {
        if (startTimeRef.current) {
          // Calculate exact seconds passed since we pressed start
          const secondsPassed = Math.floor((Date.now() - startTimeRef.current) / 1000);
          
          // Update both the ref (for math) and the state (for UI)
          elapsedSecondsRef.current = secondsPassed;
          setElapsedSeconds(secondsPassed);
        }
      }, 1000);
    }
    return () => { if (interval) clearInterval(interval); };
  }, [isRunning]);

  const handleDistanceUpdate = (extraDist: number, extraElev: number) => {
    distanceRef.current += extraDist;
    setDistance(distanceRef.current);
    if (extraElev > 0) {
      elevationGainMetersRef.current += extraElev;
      setElevationGainMeters(elevationGainMetersRef.current);
    }
    if (distanceRef.current >= nextSplitTarget.current) {
      const currentElapsed = elapsedSecondsRef.current;
      splitsRef.current = [...splitsRef.current, { mile: nextSplitTarget.current, time: currentElapsed - lastSplitTimeRef.current }];
      setSplits(splitsRef.current);
      lastSplitTimeRef.current = currentElapsed;
      nextSplitTarget.current += 1;
    }
  };

  const processBackgroundQueue = async () => {
    try {
      const storedPoints = await AsyncStorage.getItem('bg_locations');
      if (storedPoints) {
        const pointsArray = JSON.parse(storedPoints);
        let extraDistance = 0, extraElevation = 0, currentLastLoc = lastLoc.current;
        pointsArray.forEach((point: any) => {
          fullRoute.current.push({ latitude: point.latitude, longitude: point.longitude });
          if (currentLastLoc) {
            extraDistance += calculateDistance(currentLastLoc.latitude, currentLastLoc.longitude, point.latitude, point.longitude);
            if (point.altitude > currentLastLoc.altitude) extraElevation += (point.altitude - currentLastLoc.altitude);
          }
          currentLastLoc = point;
        });
        if (extraDistance > 0 || extraElevation > 0) handleDistanceUpdate(extraDistance, extraElevation);
        lastLoc.current = currentLastLoc;
        await AsyncStorage.removeItem('bg_locations');
      }
    } catch (e) { console.error(e); }
  };

  const startRun = async () => {
    const { status: fgStatus } = await Location.getForegroundPermissionsAsync();
    if (fgStatus !== 'granted') { Alert.alert("Permission Required"); return; }

    setDistance(0); setElapsedSeconds(0); setElevationGainMeters(0); setSplits([]);
    distanceRef.current = 0; elapsedSecondsRef.current = 0; elevationGainMetersRef.current = 0; splitsRef.current = []; fullRoute.current = [];
    lastLoc.current = null; nextSplitTarget.current = 1; lastSplitTimeRef.current = 0;
    
    // Set the absolute start time right here
    startTimeRef.current = Date.now();
    await AsyncStorage.removeItem('bg_locations');
    setIsRunning(true);

    const { status: bgStatus } = await Location.getBackgroundPermissionsAsync();
    if (bgStatus === 'granted') {
      await Location.startLocationUpdatesAsync(BACKGROUND_LOCATION_TASK, { accuracy: Location.Accuracy.Highest, timeInterval: 5000, distanceInterval: 5, showsBackgroundLocationIndicator: true });
    } else {
      fgSubRef.current = await Location.watchPositionAsync(
        { accuracy: Location.Accuracy.Highest, timeInterval: 5000, distanceInterval: 5 },
        (loc) => {
          fullRoute.current.push({ latitude: loc.coords.latitude, longitude: loc.coords.longitude });
          if (lastLoc.current) {
            const extraDist = calculateDistance(lastLoc.current.latitude, lastLoc.current.longitude, loc.coords.latitude, loc.coords.longitude);
            let extraElev = 0;
            if (loc.coords.altitude && loc.coords.altitude > lastLoc.current.altitude) extraElev = loc.coords.altitude - lastLoc.current.altitude;
            if (extraDist > 0 || extraElev > 0) handleDistanceUpdate(extraDist, extraElev);
          }
          lastLoc.current = { latitude: loc.coords.latitude, longitude: loc.coords.longitude, altitude: loc.coords.altitude || 0 };
        }
      );
    }
  };

  const stopRun = async () => {
    setIsRunning(false);
    if (fgSubRef.current) { fgSubRef.current.remove(); fgSubRef.current = null; }
    const isRegistered = await TaskManager.isTaskRegisteredAsync(BACKGROUND_LOCATION_TASK);
    if (isRegistered) await Location.stopLocationUpdatesAsync(BACKGROUND_LOCATION_TASK);
    await processBackgroundQueue();

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const caloriesBurned = Math.round(userWeight * 0.75 * distanceRef.current);
      const elevationGainFt = Math.round(elevationGainMetersRef.current * 3.28084);
      const paceSeconds = distanceRef.current > 0 ? Math.floor(elapsedSecondsRef.current / distanceRef.current) : 0;

      let finalSplits = [...splitsRef.current];
      if (distanceRef.current > splitsRef.current.length) {
        finalSplits.push({ mile: parseFloat(distanceRef.current.toFixed(2)), time: elapsedSecondsRef.current - lastSplitTimeRef.current });
      }

      setFinalStats({ distance: distanceRef.current, paceSeconds, caloriesBurned, elevationGainFt, finalSplits });
      setShowSummary(true);
      
      setTimeout(() => { if (mapRef.current && fullRoute.current.length > 0) mapRef.current.fitToCoordinates(fullRoute.current, { edgePadding: { top: 50, right: 50, bottom: 50, left: 50 }, animated: true }); }, 500);

      (async () => {
        try {
          const runData = { user_id: user.id, distance_miles: distanceRef.current, duration_seconds: elapsedSecondsRef.current, calories: caloriesBurned, pace_seconds: paceSeconds, elevation_gain_ft: elevationGainFt, route: fullRoute.current, splits: finalSplits, created_at: new Date().toISOString() };
          const networkState = await NetInfo.fetch();
          if (networkState.isConnected) {
            await supabase.from('runs').insert(runData);
            const { data: userData } = await supabase.from('users').select('lifetime_distance_miles, lifetime_duration_seconds').eq('id', user.id).single();
            await supabase.from('users').update({ lifetime_distance_miles: (userData?.lifetime_distance_miles || 0) + distanceRef.current, lifetime_duration_seconds: (userData?.lifetime_duration_seconds || 0) + elapsedSecondsRef.current }).eq('id', user.id);
          } else {
            const storedQueue = await AsyncStorage.getItem('offline_runs_queue');
            const offlineQueue = storedQueue ? JSON.parse(storedQueue) : [];
            offlineQueue.push(runData);
            await AsyncStorage.setItem('offline_runs_queue', JSON.stringify(offlineQueue));
          }
        } catch (dbError) { console.error("Background save failed: ", dbError); }
      })();
    } catch (error: any) { Alert.alert("Error stopping workout", error.message); }
  };

  const handleShareRun = async () => {
    try {
      if (viewShotRef.current) {
        const uri = await captureRef(viewShotRef, { format: 'png', quality: 1 });
        const isAvailable = await Sharing.isAvailableAsync();
        if (isAvailable) await Sharing.shareAsync(uri, { dialogTitle: 'Share your run!' });
      }
    } catch (error: any) { Alert.alert("Error generating image", error.message); }
  };

  const formatPace = (totalSeconds: number) => {
    if (!totalSeconds) return '0:00';
    const mins = Math.floor(totalSeconds / 60);
    const secs = Math.floor(totalSeconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const formatTime = (totalSeconds: number) => {
    const hrs = Math.floor(totalSeconds / 3600);
    const mins = Math.floor((totalSeconds % 3600) / 60);
    const secs = totalSeconds % 60;
    return `${hrs > 0 ? hrs + ':' : ''}${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Current Workout</Text>
        <Text style={styles.distance}>{distance.toFixed(2)}</Text>
        <Text style={styles.label}>Miles</Text>

        <View style={styles.liveStatsRow}>
          <View style={styles.liveStatBlock}>
            <Text style={styles.liveStatValue}>{formatTime(elapsedSeconds)}</Text>
            <Text style={styles.liveStatLabel}>Time</Text>
          </View>
          <View style={styles.divider} />
          <View style={styles.liveStatBlock}>
            <Text style={styles.liveStatValue}>{Math.round(userWeight * 0.75 * distance)}</Text>
            <Text style={styles.liveStatLabel}>Calories</Text>
          </View>
        </View>
      </View>

      <Pressable style={[styles.button, isRunning ? styles.stopButton : styles.startButton]} onPress={isRunning ? stopRun : startRun}>
        <Text style={styles.buttonText}>{isRunning ? "End Workout" : "Start Run"}</Text>
      </Pressable>

      <Modal visible={showSummary} animationType="slide" presentationStyle="pageSheet">
        <ScrollView style={styles.modalScroll} bounces={false}>
          <View ref={viewShotRef} collapsable={false} style={styles.shareableArea}>
            <Text style={styles.modalTitle}>Workout Complete! 🏆</Text>
            <View style={styles.mapContainer}>
              <MapView ref={mapRef} style={styles.map} scrollEnabled={false} pitchEnabled={false} rotateEnabled={false}>
                {fullRoute.current.length > 0 && <Polyline coordinates={fullRoute.current} strokeColor="#FC4C02" strokeWidth={6} lineJoin="round" lineCap="round" />}
              </MapView>
            </View>

            <View style={styles.statsGrid}>
              <View style={styles.statBox}><Text style={styles.statBoxValue}>{finalStats?.distance.toFixed(2)}</Text><Text style={styles.statBoxLabel}>Miles</Text></View>
              <View style={styles.statBox}><Text style={styles.statBoxValue}>{finalStats ? formatPace(finalStats.paceSeconds) : '0:00'}</Text><Text style={styles.statBoxLabel}>/mi Pace</Text></View>
              <View style={styles.statBox}><Text style={styles.statBoxValue}>{finalStats?.elevationGainFt || 0} ft</Text><Text style={styles.statBoxLabel}>Elevation</Text></View>
              <View style={styles.statBox}><Text style={styles.statBoxValue}>{finalStats?.caloriesBurned}</Text><Text style={styles.statBoxLabel}>Calories</Text></View>
            </View>

            {finalStats?.finalSplits && finalStats.finalSplits.length > 0 && (
              <View style={styles.splitsContainer}>
                <Text style={styles.splitsTitle}>Pace Splits</Text>
                {finalStats.finalSplits.map((split: any, index: number) => (
                  <View key={index} style={styles.splitRow}>
                    <Text style={styles.splitMileText}>Mile {split.mile}</Text>
                    <View style={styles.splitPaceBar}><Text style={styles.splitPaceText}>{formatPace(split.time)}</Text></View>
                  </View>
                ))}
              </View>
            )}
          </View>

          <View style={styles.modalActions}>
            <Pressable style={styles.shareRunButton} onPress={handleShareRun}><Text style={styles.shareRunButtonText}>Share Run</Text></Pressable>
            <Pressable style={styles.doneButton} onPress={() => { setShowSummary(false); navigation.goBack(); }}><Text style={styles.doneButtonText}>Done</Text></Pressable>
          </View>
        </ScrollView>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FFFFFF', justifyContent: 'space-between', padding: 20 },
  header: { marginTop: 60, alignItems: 'center' },
  title: { color: '#28A745', fontSize: 20, fontWeight: 'bold' }, 
  distance: { color: '#000000', fontSize: 84, fontWeight: '900', marginTop: 10, letterSpacing: -2 },
  label: { color: '#666666', fontSize: 20, fontWeight: 'bold', marginTop: -15, marginBottom: 40 },
  liveStatsRow: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', width: '100%', paddingHorizontal: 20 },
  liveStatBlock: { flex: 1, alignItems: 'center' },
  liveStatValue: { color: '#000000', fontSize: 32, fontWeight: '700', fontFamily: 'Courier' },
  liveStatLabel: { color: '#888888', fontSize: 14, fontWeight: '600', marginTop: 4, textTransform: 'uppercase', letterSpacing: 1 },
  divider: { width: 2, height: 40, backgroundColor: '#EEEEEE', marginHorizontal: 20 },
  button: { padding: 20, borderRadius: 100, alignItems: 'center', marginBottom: 40 },
  startButton: { backgroundColor: '#28A745' },
  stopButton: { backgroundColor: '#FF3B30' },
  buttonText: { color: '#FFFFFF', fontSize: 24, fontWeight: 'bold' },

  modalScroll: { flex: 1, backgroundColor: '#F8F8F8' },
  shareableArea: { backgroundColor: '#F8F8F8', padding: 20, paddingTop: 40 },
  modalTitle: { fontSize: 28, fontWeight: '900', textAlign: 'center', marginBottom: 20, color: '#000' },
  mapContainer: { width: '100%', height: 300, borderRadius: 16, overflow: 'hidden', marginBottom: 20, borderWidth: 1, borderColor: '#E0E0E0' },
  map: { width: '100%', height: '100%' },
  statsGrid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', marginBottom: 20 },
  statBox: { width: '48%', backgroundColor: '#FFFFFF', padding: 15, borderRadius: 12, marginBottom: 10, borderWidth: 1, borderColor: '#E0E0E0', alignItems: 'center' },
  statBoxValue: { fontSize: 22, fontWeight: '800', color: '#000' },
  statBoxLabel: { fontSize: 12, fontWeight: '600', color: '#666', marginTop: 4, textTransform: 'uppercase' },
  
  splitsContainer: { backgroundColor: '#FFFFFF', padding: 15, borderRadius: 12, borderWidth: 1, borderColor: '#E0E0E0', marginBottom: 10 },
  splitsTitle: { fontSize: 18, fontWeight: 'bold', color: '#000', marginBottom: 10 },
  splitRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: '#F0F0F0' },
  splitMileText: { fontSize: 16, fontWeight: '600', color: '#333' },
  splitPaceBar: { backgroundColor: '#007AFF', paddingHorizontal: 12, paddingVertical: 4, borderRadius: 8 },
  splitPaceText: { fontSize: 16, fontWeight: 'bold', color: '#FFF' },

  modalActions: { padding: 20, paddingTop: 0 },
  shareRunButton: { backgroundColor: '#007AFF', padding: 16, borderRadius: 12, alignItems: 'center', marginBottom: 10 },
  shareRunButtonText: { color: '#FFFFFF', fontSize: 18, fontWeight: 'bold' },
  doneButton: { backgroundColor: '#E0E0E0', padding: 16, borderRadius: 12, alignItems: 'center', marginBottom: 40 },
  doneButtonText: { color: '#333333', fontSize: 18, fontWeight: 'bold' },
});