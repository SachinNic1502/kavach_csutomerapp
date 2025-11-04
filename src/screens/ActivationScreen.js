import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Alert,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { deviceAPI } from '../config/api';

export default function ActivationScreen({ navigation }) {
  const [activationKey, setActivationKey] = useState('');
  const [loading, setLoading] = useState(false);
  const [showScanner, setShowScanner] = useState(false);
  const [permission, requestPermission] = useCameraPermissions();
  const [scanning, setScanning] = useState(false);

  useEffect(() => {
    if (showScanner && !permission?.granted) {
      requestPermission();
    }
  }, [showScanner, permission]);

  const handleBarCodeScanned = ({ type, data }) => {
    if (scanning) return;
    setScanning(true);
    try {
      let key = data;
      try {
        const parsed = JSON.parse(data);
        key = parsed.keyId || parsed.key || data;
      } catch (_) {}
      if (typeof key === 'string' && key.length > 0) {
        setActivationKey(key.toUpperCase());
        Alert.alert('QR Scanned', `Activation Key: ${key}`);
      } else {
        Alert.alert('Scan Failed', 'Invalid QR code content');
      }
    } finally {
      setShowScanner(false);
      setScanning(false);
    }
  };

  const handleActivate = async () => {
    if (!activationKey.trim()) {
      Alert.alert('Error', 'Please enter activation key');
      return;
    }

    setLoading(true);
    try {
      // Get push token for notifications (prefer device FCM/APNs, fallback to Expo token in Expo Go)
      let fcmToken = null;
      try {
        const { status } = await Notifications.requestPermissionsAsync();
        if (status === 'granted') {
          try {
            const deviceToken = await Notifications.getDevicePushTokenAsync();
            fcmToken = deviceToken?.data || null;
            if (fcmToken) {
              console.log('📱 Device push token obtained');
            }
          } catch (deviceTokenErr) {
            console.warn('ℹ️ Device push token not available (likely Expo Go). Falling back to Expo push token.');
          }
          // Fallback: Expo push token for development in Expo Go
          if (!fcmToken) {
            try {
              const expoToken = await Notifications.getExpoPushTokenAsync();
              fcmToken = expoToken?.data || null;
              if (fcmToken) {
                console.log('📨 Expo push token obtained (development)');
              }
            } catch (expoTokenErr) {
              console.warn('⚠️ Failed to get Expo push token:', expoTokenErr);
            }
          }
        }
      } catch (tokenError) {
        console.warn('⚠️ Push permission/token error:', tokenError);
      }

      const deviceInfo = {
        keyId: activationKey.trim(), // Changed from 'key' to 'keyId'
        deviceId: Device.osInternalBuildId || 'unknown',
        model: Device.modelName || Device.deviceName || 'Unknown Device', // Changed from deviceName
        manufacturer: Device.manufacturer || 'Unknown',
        osVersion: Device.osVersion || 'Unknown',
        appVersion: '1.0.0', // Add app version
        fcmToken: fcmToken, // Add FCM token
      };

      console.log('🚀 Activating device with:', { ...deviceInfo, fcmToken: fcmToken ? '***' : null });

      const response = await deviceAPI.activateDevice(deviceInfo);
      
      // Store keyId (not 'key')
      await AsyncStorage.setItem('keyId', activationKey.trim());
      await AsyncStorage.setItem('activationKey', activationKey.trim()); // Keep for backward compatibility
      await AsyncStorage.setItem('deviceId', deviceInfo.deviceId); // Store deviceId for FCM updates
      await AsyncStorage.setItem('deviceInfo', JSON.stringify(response.data.data));
      
      if (fcmToken) {
        await AsyncStorage.setItem('fcmToken', fcmToken);
      }

      Alert.alert(
        'Success',
        'Device activated successfully!',
        [
          {
            text: 'OK',
            onPress: () => {
              Alert.alert('Info', 'Please close and reopen the app to continue.');
            },
          },
        ]
      );
    } catch (error) {
      console.error('❌ Activation error:', error);
      Alert.alert(
        'Activation Failed',
        error.response?.data?.message || 'Invalid activation key'
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={styles.container}
    >
      <View style={styles.content}>
        <Text style={styles.logo}>🔒</Text>
        <Text style={styles.title}>DeviceLock</Text>
        <Text style={styles.subtitle}>Enter your activation key to get started</Text>

        <View style={styles.form}>
          {showScanner && (
            <View style={styles.scannerWrapper}>
              {!permission && (
                <View style={styles.scannerStatus}><Text>Requesting camera permission...</Text></View>
              )}
              {permission && !permission.granted && (
                <View style={styles.scannerStatus}>
                  <Text style={styles.errorText}>Camera permission is required</Text>
                  <TouchableOpacity style={styles.secondaryButton} onPress={requestPermission}>
                    <Text style={styles.secondaryButtonText}>Grant Permission</Text>
                  </TouchableOpacity>
                </View>
              )}
              {permission?.granted && (
                <View style={styles.scannerBox}>
                  <CameraView
                    style={styles.scanner}
                    onBarcodeScanned={scanning ? undefined : handleBarCodeScanned}
                    barcodeScannerSettings={{ barcodeTypes: ['qr'] }}
                  />
                </View>
              )}
            </View>
          )}

          <TouchableOpacity
            style={styles.secondaryButton}
            onPress={() => setShowScanner((v) => !v)}
          >
            <Text style={styles.secondaryButtonText}>{showScanner ? 'Close Scanner' : 'Scan QR Code'}</Text>
          </TouchableOpacity>

          <TextInput
            style={styles.input}
            placeholder="Enter Activation Key"
            value={activationKey}
            onChangeText={setActivationKey}
            autoCapitalize="characters"
            autoCorrect={false}
          />

          <TouchableOpacity
            style={[styles.button, loading && styles.buttonDisabled]}
            onPress={handleActivate}
            disabled={loading}
          >
            <Text style={styles.buttonText}>
              {loading ? 'Activating...' : 'Activate Device'}
            </Text>
          </TouchableOpacity>

          <Text style={styles.helpText}>
            Contact your seller to get the activation key
          </Text>
        </View>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F3F4F6',
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  logo: {
    fontSize: 80,
    marginBottom: 20,
  },
  title: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#1F2937',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: '#6B7280',
    marginBottom: 40,
    textAlign: 'center',
  },
  form: {
    width: '100%',
    maxWidth: 400,
  },
  input: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#D1D5DB',
    borderRadius: 8,
    padding: 16,
    fontSize: 16,
    marginBottom: 16,
    textAlign: 'center',
    fontWeight: '600',
  },
  button: {
    backgroundColor: '#3B82F6',
    borderRadius: 8,
    padding: 16,
    alignItems: 'center',
    marginTop: 8,
  },
  buttonDisabled: {
    opacity: 0.5,
  },
  buttonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  helpText: {
    fontSize: 14,
    color: '#6B7280',
    textAlign: 'center',
    marginTop: 20,
  },
  scannerWrapper: {
    width: '100%',
    alignItems: 'center',
    marginBottom: 16,
  },
  scannerBox: {
    width: '100%',
    maxWidth: 400,
    height: 240,
    overflow: 'hidden',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#D1D5DB',
    backgroundColor: '#000',
  },
  scanner: {
    width: '100%',
    height: '100%',
  },
  scannerStatus: {
    width: '100%',
    maxWidth: 400,
    height: 240,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#D1D5DB',
    backgroundColor: '#FFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  secondaryButton: {
    backgroundColor: '#E5E7EB',
    borderRadius: 8,
    padding: 12,
    alignItems: 'center',
    marginBottom: 12,
  },
  secondaryButtonText: {
    color: '#111827',
    fontSize: 14,
    fontWeight: '600',
  },
  errorText: {
    color: '#DC2626',
    fontSize: 14,
    marginBottom: 8,
  },
});
