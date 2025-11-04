import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  RefreshControl,
  TouchableOpacity,
  Alert,
  BackHandler,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { deviceAPI } from '../config/api';
import * as Device from 'expo-device';
import * as Battery from 'expo-battery';
import * as Network from 'expo-network';
import { isDeviceLocked } from '../services/deviceService';

export default function HomeScreen({ navigation }) {
  const [deviceInfo, setDeviceInfo] = useState(null);
  const [status, setStatus] = useState(null);
  const [refreshing, setRefreshing] = useState(false);
  const [batteryLevel, setBatteryLevel] = useState(null);
  const [networkType, setNetworkType] = useState(null);

  useEffect(() => {
    loadDeviceInfo();
    checkStatus();
    loadDeviceStats();
    
    // Continuously check if device gets locked
    const lockCheckInterval = setInterval(async () => {
      const locked = await isDeviceLocked();
      if (locked) {
        // Device was locked, App.js will handle navigation
        console.log('🔒 Device locked - HomeScreen will be replaced');
      }
    }, 1000);
    
    // Prevent back button from exiting app
    const backHandler = BackHandler.addEventListener(
      'hardwareBackPress',
      () => {
        Alert.alert(
          'Exit App',
          'Are you sure you want to exit?',
          [
            { text: 'Cancel', style: 'cancel' },
            { text: 'Exit', onPress: () => BackHandler.exitApp() },
          ]
        );
        return true;
      }
    );

    return () => {
      clearInterval(lockCheckInterval);
      backHandler.remove();
    };
  }, []);

  const loadDeviceInfo = async () => {
    const info = await AsyncStorage.getItem('deviceInfo');
    if (info) {
      setDeviceInfo(JSON.parse(info));
    }
  };

  const loadDeviceStats = async () => {
    try {
      const battery = await Battery.getBatteryLevelAsync();
      setBatteryLevel(Math.round(battery * 100));

      const network = await Network.getNetworkStateAsync();
      setNetworkType(network.type);
    } catch (error) {
      console.log('Failed to load device stats');
    }
  };

  const checkStatus = async () => {
    try {
      const key = await AsyncStorage.getItem('activationKey');
      if (!key) return;

      const response = await deviceAPI.getDeviceStatus(key);
      setStatus(response.data.data);

      // Send device update
      await deviceAPI.updateDeviceInfo({
        key,
        batteryLevel: batteryLevel,
        networkType: networkType,
        lastSync: new Date().toISOString(),
      });
    } catch (error) {
      console.log('Failed to check status');
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await checkStatus();
    await loadDeviceStats();
    setRefreshing(false);
  };

  const handleDeactivate = () => {
    Alert.alert(
      'Deactivate Device',
      'Are you sure you want to deactivate this device? You will need a new activation key.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Deactivate',
          style: 'destructive',
          onPress: async () => {
            await AsyncStorage.removeItem('activationKey');
            await AsyncStorage.removeItem('deviceInfo');
            Alert.alert('Success', 'Device deactivated. Please close and reopen the app.');
          },
        },
      ]
    );
  };

  return (
    <ScrollView
      style={styles.container}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
      }
    >
      <View style={styles.header}>
        <Text style={styles.title}>DeviceLock</Text>
        <View style={[styles.statusBadge, status?.status === 'locked' && styles.lockedBadge]}>
          <Text style={styles.statusText}>
            {status?.status === 'locked' ? '🔒 Locked' : '✅ Active'}
          </Text>
        </View>
      </View>

      {status?.status === 'locked' && (
        <View style={styles.alertCard}>
          <Text style={styles.alertIcon}>⚠️</Text>
          <View style={styles.alertContent}>
            <Text style={styles.alertTitle}>Device Locked</Text>
            <Text style={styles.alertText}>
              {status.lockMessage || 'Please contact your seller'}
            </Text>
          </View>
        </View>
      )}

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Device Information</Text>
        
        <View style={styles.infoRow}>
          <Text style={styles.label}>Device Name:</Text>
          <Text style={styles.value}>{Device.deviceName || 'Unknown'}</Text>
        </View>

        <View style={styles.infoRow}>
          <Text style={styles.label}>OS Version:</Text>
          <Text style={styles.value}>{Device.osVersion || 'Unknown'}</Text>
        </View>

        <View style={styles.infoRow}>
          <Text style={styles.label}>Battery:</Text>
          <Text style={styles.value}>{batteryLevel ? `${batteryLevel}%` : 'Unknown'}</Text>
        </View>

        <View style={styles.infoRow}>
          <Text style={styles.label}>Network:</Text>
          <Text style={styles.value}>{networkType || 'Unknown'}</Text>
        </View>
      </View>

      {deviceInfo && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Activation Details</Text>
          
          <View style={styles.infoRow}>
            <Text style={styles.label}>Status:</Text>
            <Text style={[styles.value, styles.activeText]}>Activated</Text>
          </View>

          {deviceInfo.sellerName && (
            <View style={styles.infoRow}>
              <Text style={styles.label}>Seller:</Text>
              <Text style={styles.value}>{deviceInfo.sellerName}</Text>
            </View>
          )}

          {deviceInfo.sellerPhone && (
            <View style={styles.infoRow}>
              <Text style={styles.label}>Contact:</Text>
              <Text style={styles.value}>{deviceInfo.sellerPhone}</Text>
            </View>
          )}
        </View>
      )}

      <TouchableOpacity style={styles.deactivateButton} onPress={handleDeactivate}>
        <Text style={styles.deactivateButtonText}>Deactivate Device</Text>
      </TouchableOpacity>

      <Text style={styles.footer}>
        DeviceLock v1.0.0 {'\n'}
        Background service running
      </Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F3F4F6',
  },
  header: {
    backgroundColor: '#FFFFFF',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#1F2937',
    marginBottom: 12,
  },
  statusBadge: {
    backgroundColor: '#10B981',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
    alignSelf: 'flex-start',
  },
  lockedBadge: {
    backgroundColor: '#EF4444',
  },
  statusText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
  },
  alertCard: {
    flexDirection: 'row',
    margin: 16,
    padding: 16,
    backgroundColor: '#FEE2E2',
    borderRadius: 12,
    borderLeftWidth: 4,
    borderLeftColor: '#EF4444',
  },
  alertIcon: {
    fontSize: 24,
    marginRight: 12,
  },
  alertContent: {
    flex: 1,
  },
  alertTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#991B1B',
    marginBottom: 4,
  },
  alertText: {
    fontSize: 14,
    color: '#991B1B',
  },
  section: {
    backgroundColor: '#FFFFFF',
    margin: 16,
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#1F2937',
    marginBottom: 16,
  },
  infoRow: {
    flexDirection: 'row',
    marginBottom: 12,
  },
  label: {
    fontSize: 14,
    color: '#6B7280',
    width: 120,
  },
  value: {
    fontSize: 14,
    color: '#1F2937',
    flex: 1,
    fontWeight: '500',
  },
  activeText: {
    color: '#10B981',
    fontWeight: '600',
  },
  deactivateButton: {
    backgroundColor: '#EF4444',
    margin: 16,
    padding: 16,
    borderRadius: 8,
    alignItems: 'center',
  },
  deactivateButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  footer: {
    textAlign: 'center',
    fontSize: 12,
    color: '#6B7280',
    padding: 20,
  },
});
