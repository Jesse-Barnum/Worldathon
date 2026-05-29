import React, { useState, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Pressable, Alert, Modal, TextInput } from 'react-native';
import MapView, { Polyline, Marker } from 'react-native-maps';
import { Ionicons, FontAwesome5 } from '@expo/vector-icons';
import { captureRef } from 'react-native-view-shot';
import * as Sharing from 'expo-sharing';
import * as Location from 'expo-location';
import AsyncStorage from '@react-native-async-storage/async-storage';

interface Props {
  lifetimeMiles: number;
  lifetimeSeconds?: number;
  journeyHeading?: number;
  onStartRun: () => void;
  onHeadingChange: (newHeading: number) => void;
}

export default function MapDashboard({ lifetimeMiles, lifetimeSeconds = 0, journeyHeading = 90, onStartRun, onHeadingChange }: Props) {
  const goal = 24901;
  const cappedMiles = Math.min(lifetimeMiles, goal);
  const percentage = (cappedMiles / goal * 100).toFixed(2);
  const remainingMiles = Math.max(0, goal - lifetimeMiles).toFixed(1);
  
  const [startCoords, setStartCoords] = useState({ latitude: 39.4267, longitude: -104.7589 });
  const [addressModalVisible, setAddressModalVisible] = useState(false);
  const [manualAddress, setManualAddress] = useState('');
  
  const dashboardViewRef = useRef<View>(null);

  useEffect(() => {
    const initLocation = async () => {
      try {
        const savedCoords = await AsyncStorage.getItem('customStartCoords');
        if (savedCoords) {
          setStartCoords(JSON.parse(savedCoords));
          return;
        }
        
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status === 'granted') {
          const loc = await Location.getCurrentPositionAsync({});
          const newCoords = { latitude: loc.coords.latitude, longitude: loc.coords.longitude };
          setStartCoords(newCoords);
        }
      } catch (e) { 
        console.error(e); 
      }
    };
    initLocation();
  }, []);

  const handleSetManualAddress = async () => {
    if (!manualAddress) {
      setAddressModalVisible(false);
      return;
    }
    
    try {
      const geocoded = await Location.geocodeAsync(manualAddress);
      if (geocoded.length > 0) {
        const newCoords = { latitude: geocoded[0].latitude, longitude: geocoded[0].longitude };
        setStartCoords(newCoords);
        await AsyncStorage.setItem('customStartCoords', JSON.stringify(newCoords));
        setAddressModalVisible(false);
        setManualAddress('');
      } else {
        Alert.alert("Not Found", "Could not find coordinates for that address.");
      }
    } catch (e) {
      Alert.alert("Error", "Geocoding failed. Please try again.");
    }
  };

  const getDestinationPoint = (lat: number, lon: number, distanceMiles: number, bearingDegrees: number) => {
    const R = 3958.8; 
    const brng = bearingDegrees * (Math.PI / 180);
    const lat1 = lat * (Math.PI / 180);
    const lon1 = lon * (Math.PI / 180);
    const d = distanceMiles / R;
    let lat2 = Math.asin(Math.sin(lat1) * Math.cos(d) + Math.cos(lat1) * Math.sin(d) * Math.cos(brng));
    let lon2 = lon1 + Math.atan2(Math.sin(brng) * Math.sin(d) * Math.cos(lat1), Math.cos(d) - Math.sin(lat1) * Math.sin(lat2));
    lon2 = ((lon2 * 180 / Math.PI) + 540) % 360 - 180; 
    return { latitude: lat2 * (180 / Math.PI), longitude: lon2 };
  };

  const calculateBearing = (lat1: number, lon1: number, lat2: number, lon2: number) => {
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const rLat1 = lat1 * Math.PI / 180;
    const rLat2 = lat2 * Math.PI / 180;
    const y = Math.sin(dLon) * Math.cos(rLat2);
    const x = Math.cos(rLat1) * Math.sin(rLat2) - Math.sin(rLat1) * Math.cos(rLat2) * Math.cos(dLon);
    let brng = Math.atan2(y, x) * 180 / Math.PI;
    return (brng + 360) % 360; 
  };

  const generateRoute = () => {
    const lines: {latitude: number, longitude: number}[][] = [];
    let currentLine: {latitude: number, longitude: number}[] = [];
    for (let i = 0; i <= 200; i++) {
      const segmentDistance = (cappedMiles / 200) * i;
      const newPoint = getDestinationPoint(startCoords.latitude, startCoords.longitude, segmentDistance, journeyHeading);
      if (currentLine.length > 0 && Math.abs(newPoint.longitude - currentLine[currentLine.length - 1].longitude) > 180) {
        lines.push(currentLine);
        currentLine = [];
      }
      currentLine.push(newPoint);
    }
    if (currentLine.length > 0) lines.push(currentLine);
    return lines;
  };

  const routeSegments = generateRoute();
  const lastSegment = routeSegments[routeSegments.length - 1];
  const currentProgressCoords = lastSegment ? lastSegment[lastSegment.length - 1] : startCoords;

  const formatTime = (totalSeconds: number) => {
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    return `${hours}h ${minutes}m`;
  };

  const isWestward = journeyHeading > 180 && journeyHeading < 360;
  const rotationAngle = isWestward ? (journeyHeading - 270) : (journeyHeading - 90);

  const handleShareProgress = async () => {
    try {
      if (dashboardViewRef.current) {
        const uri = await captureRef(dashboardViewRef, { format: 'png', quality: 1 });
        const isAvailable = await Sharing.isAvailableAsync();
        if (isAvailable) {
          await Sharing.shareAsync(uri, { dialogTitle: 'My Journey Around the World' });
        }
      }
    } catch (error: any) { 
      Alert.alert("Error generating image", error.message); 
    }
  };

  return (
    <View style={styles.container} ref={dashboardViewRef} collapsable={false}>
      <MapView style={styles.map} initialRegion={{ latitude: startCoords.latitude, longitude: startCoords.longitude, latitudeDelta: 60.0, longitudeDelta: 60.0 }}>
        <Marker 
          coordinate={startCoords} 
          title="The Journey Begins" 
          description="Click here to change origin"
          onCalloutPress={() => setAddressModalVisible(true)}
          onLongPress={() => setAddressModalVisible(true)}
        >
          <View style={styles.iconContainerHome}><Ionicons name="home" size={16} color="#FFF" /></View>
        </Marker>
        {cappedMiles < goal && (
          <Marker coordinate={currentProgressCoords} title="Current Progress" draggable onDragEnd={(e) => onHeadingChange(calculateBearing(startCoords.latitude, startCoords.longitude, e.nativeEvent.coordinate.latitude, e.nativeEvent.coordinate.longitude))}>
            <View style={[styles.iconContainerRunner, { transform: [{ scaleX: isWestward ? -1 : 1 }, { rotate: `${rotationAngle}deg` }] }]}>
              <FontAwesome5 name="running" size={16} color="#FFF" />
            </View>
          </Marker>
        )}
        {routeSegments.map((segment, index) => (
          <Polyline key={`route-segment-${index}`} coordinates={segment} strokeColor="#007AFF" strokeWidth={5} geodesic={false} />
        ))}
      </MapView>

      <View style={styles.card}>
        <View style={styles.cardHeader}>
          <Text style={styles.title}>Lifetime Progress</Text>
          <Pressable onPress={handleShareProgress} style={styles.shareButton}><Ionicons name="share-outline" size={24} color="#007AFF" /></Pressable>
        </View>
        <View style={styles.statsRow}>
          <Text style={styles.bigNumber}>{lifetimeMiles.toFixed(1)}</Text>
          <Text style={styles.subText}> / 24,901 mi</Text>
        </View>
        <Text style={styles.timeText}>Total Time: {formatTime(lifetimeSeconds)} | Remaining: {remainingMiles} mi</Text>
        <View style={styles.progressBarBackground}><View style={[styles.progressBarFill, { width: `${percentage}%` }]} /></View>
        <Text style={styles.percentageText}>{percentage}% of Earth completed</Text>
        <Pressable style={styles.button} onPress={onStartRun}><Text style={styles.buttonText}>Start Workout</Text></Pressable>
      </View>

      <Modal visible={addressModalVisible} transparent={true} animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Set Starting Location</Text>
            <TextInput 
              style={styles.modalInput} 
              placeholder="Enter full address or city" 
              value={manualAddress} 
              onChangeText={setManualAddress} 
              autoFocus
            />
            <View style={styles.modalButtons}>
              <Pressable style={styles.modalButtonCancel} onPress={() => setAddressModalVisible(false)}>
                <Text style={styles.modalButtonText}>Cancel</Text>
              </Pressable>
              <Pressable style={styles.modalButtonSave} onPress={handleSetManualAddress}>
                <Text style={styles.modalButtonText}>Save</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FFFFFF' },
  map: { width: '100%', height: '100%' },
  iconContainerHome: { backgroundColor: '#333333', padding: 8, borderRadius: 20, borderWidth: 2, borderColor: '#FFF', shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.4, shadowRadius: 3, elevation: 5 },
  iconContainerRunner: { width: 36, height: 36, backgroundColor: '#007AFF', borderRadius: 18, borderWidth: 2, borderColor: '#FFF', alignItems: 'center', justifyContent: 'center', shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.4, shadowRadius: 3, elevation: 5 },
  card: { position: 'absolute', bottom: 40, left: 20, right: 20, backgroundColor: 'rgba(255, 255, 255, 0.95)', borderRadius: 20, padding: 20, shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 5, elevation: 8 },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  shareButton: { padding: 4 },
  title: { fontSize: 16, fontWeight: 'bold', color: '#666' },
  statsRow: { flexDirection: 'row', alignItems: 'baseline' },
  bigNumber: { fontSize: 40, fontWeight: '800', color: '#007AFF' },
  subText: { fontSize: 18, color: '#007AFF', fontWeight: 'bold' },
  timeText: { fontSize: 14, color: '#333333', fontWeight: '600', marginTop: 4, marginBottom: 8 },
  progressBarBackground: { height: 8, backgroundColor: '#E0E0E0', borderRadius: 4, marginVertical: 12 },
  progressBarFill: { height: '100%', backgroundColor: '#007AFF', borderRadius: 4 },
  percentageText: { fontSize: 14, color: '#007AFF', fontWeight: '600', marginBottom: 16 },
  button: { backgroundColor: '#28A745', padding: 16, borderRadius: 12, alignItems: 'center' },
  buttonText: { color: '#FFF', fontSize: 18, fontWeight: 'bold' },

  // Modal Styles
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center' },
  modalContent: { width: '85%', backgroundColor: '#FFF', padding: 25, borderRadius: 16, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.25, shadowRadius: 4, elevation: 5 },
  modalTitle: { fontSize: 20, fontWeight: 'bold', marginBottom: 15, textAlign: 'center', color: '#333' },
  modalInput: { borderWidth: 1, borderColor: '#E0E0E0', borderRadius: 10, padding: 15, marginBottom: 20, fontSize: 16, backgroundColor: '#F8F8F8' },
  modalButtons: { flexDirection: 'row', justifyContent: 'space-between' },
  modalButtonCancel: { backgroundColor: '#FF3B30', padding: 15, borderRadius: 10, flex: 1, marginRight: 8, alignItems: 'center' },
  modalButtonSave: { backgroundColor: '#28A745', padding: 15, borderRadius: 10, flex: 1, marginLeft: 8, alignItems: 'center' },
  modalButtonText: { color: '#FFF', fontSize: 16, fontWeight: 'bold' }
});