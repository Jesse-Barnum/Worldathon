import React, { useState, useCallback } from 'react';
import { View, StyleSheet, Modal, Text, TextInput, Pressable, Alert } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import MapDashboard from '../components/MapDashboard';
import { supabase } from '../services/supabase';

export default function HomeScreen({ navigation }: any) {
  const [lifetimeMiles, setLifetimeMiles] = useState(0);
  const [lifetimeSeconds, setLifetimeSeconds] = useState(0);
  const [journeyHeading, setJourneyHeading] = useState(90);
  
  // New Onboarding States
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [previousMiles, setPreviousMiles] = useState('');
  const [userId, setUserId] = useState<string | null>(null);

  useFocusEffect(
    useCallback(() => {
      const fetchProgress = async () => {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return; 
        
        setUserId(user.id);

        const { data, error } = await supabase
          .from('users')
          .select('lifetime_distance_miles, lifetime_duration_seconds, journey_heading')
          .eq('id', user.id)
          .maybeSingle();

        let currentMiles = 0;

        if (data) {
          currentMiles = data.lifetime_distance_miles || 0;
          setLifetimeMiles(currentMiles);
          setLifetimeSeconds(data.lifetime_duration_seconds || 0);
          setJourneyHeading(data.journey_heading !== null ? data.journey_heading : 90);
        } else if (error) {
          console.error("Error fetching progress:", error.message);
        }

        // Check if this user has already seen the onboarding prompt
        const onboardedFlag = await AsyncStorage.getItem(`@onboarded_${user.id}`);
        
        // If they haven't been onboarded and their miles are 0, show the prompt
        if (!onboardedFlag && currentMiles === 0) {
          setShowOnboarding(true);
        }
      };

      fetchProgress();
    }, [])
  );

  const handleHeadingChange = async (newHeading: number) => {
    const roundedHeading = Math.round(newHeading);
    setJourneyHeading(roundedHeading); 

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    await supabase
      .from('users')
      .update({ journey_heading: roundedHeading })
      .eq('id', user.id);
  };

  const handleSaveOnboarding = async (isStartingFresh: boolean) => {
    if (!userId) return;

    let milesToSet = 0;

    if (!isStartingFresh) {
      const parsedMiles = parseFloat(previousMiles);
      if (isNaN(parsedMiles) || parsedMiles < 0) {
        Alert.alert("Invalid Input", "Please enter a valid number of miles.");
        return;
      }
      milesToSet = parsedMiles;
    }

    // Update the database if they have previous miles
    if (milesToSet > 0) {
      const { error } = await supabase
        .from('users')
        .update({ lifetime_distance_miles: milesToSet })
        .eq('id', userId);

      if (error) {
        Alert.alert("Error", "Could not save your starting miles. Please try again.");
        return;
      }
    }

    // Mark user as onboarded locally so they don't see this again
    await AsyncStorage.setItem(`@onboarded_${userId}`, 'true');
    setLifetimeMiles(milesToSet);
    setShowOnboarding(false);
  };

  return (
    <View style={styles.container}>
      <MapDashboard 
        lifetimeMiles={lifetimeMiles} 
        lifetimeSeconds={lifetimeSeconds}
        journeyHeading={journeyHeading}
        onHeadingChange={handleHeadingChange}
        onStartRun={() => navigation.navigate('Track')} 
      />

      {/* Onboarding Modal */}
      <Modal visible={showOnboarding} transparent={true} animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Welcome to RunTheWorld! 🌍</Text>
            <Text style={styles.modalBody}>
              Are you starting your global journey from scratch, or do you have previous running miles you would like to log?
            </Text>

            <TextInput 
              style={styles.modalInput} 
              placeholder="Enter previous miles (e.g. 150)" 
              value={previousMiles} 
              onChangeText={setPreviousMiles} 
              keyboardType="numeric"
            />

            <View style={styles.buttonStack}>
              <Pressable style={styles.saveButton} onPress={() => handleSaveOnboarding(false)}>
                <Text style={styles.saveButtonText}>Log Previous Miles</Text>
              </Pressable>

              <Pressable style={styles.freshButton} onPress={() => handleSaveOnboarding(true)}>
                <Text style={styles.freshButtonText}>Start Fresh (0 Miles)</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({ 
  container: { flex: 1 },
  
  // Modal Styles
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'center', alignItems: 'center' },
  modalContent: { width: '85%', backgroundColor: '#FFF', padding: 25, borderRadius: 20, shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 5, elevation: 8 },
  modalTitle: { fontSize: 22, fontWeight: '900', marginBottom: 15, textAlign: 'center', color: '#000' },
  modalBody: { fontSize: 16, color: '#444', textAlign: 'center', marginBottom: 20, lineHeight: 22 },
  modalInput: { borderWidth: 1, borderColor: '#E0E0E0', borderRadius: 12, padding: 15, marginBottom: 20, fontSize: 18, backgroundColor: '#F8F8F8', textAlign: 'center' },
  buttonStack: { gap: 12 },
  saveButton: { backgroundColor: '#007AFF', padding: 16, borderRadius: 12, alignItems: 'center' },
  saveButtonText: { color: '#FFF', fontSize: 16, fontWeight: 'bold' },
  freshButton: { backgroundColor: '#E0E0E0', padding: 16, borderRadius: 12, alignItems: 'center' },
  freshButtonText: { color: '#333', fontSize: 16, fontWeight: 'bold' }
});