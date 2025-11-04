import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Alert,
} from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { deviceAPI } from '../config/api';

export default function QRScannerScreen({ navigation }) {
  const [permission, requestPermission] = useCameraPermissions();
  const [scanned, setScanned] = useState(false);
  const [processing, setProcessing] = useState(false);

  useEffect(() => {
    if (!permission?.granted) {
      requestPermission();
    }
  }, [permission]);

  const handleBarCodeScanned = async ({ type, data }) => {
    if (scanned || processing) return;
    
    setScanned(true);
    setProcessing(true);

    try {
      // Parse QR code data
      const qrData = JSON.parse(data);
      
      Alert.alert(
        'Confirm Activation',
        `Activate device with:\n\nKey: ${qrData.keyId}\nCustomer: ${qrData.customerName}\nProduct: ${qrData.productName}\nEMI: ₹${qrData.emiAmount} × ${qrData.emiDuration} months`,
        [
          {
            text: 'Cancel',
            onPress: () => {
              setScanned(false);
              setProcessing(false);
            },
            style: 'cancel',
          },
          {
            text: 'Activate',
            onPress: () => activateDevice(qrData),
          },
        ]
      );
    } catch (error) {
      Alert.alert('Error', 'Invalid QR code. Please scan a valid activation QR.');
      setScanned(false);
      setProcessing(false);
    }
  };

  const activateDevice = async (qrData) => {
    try {
      // Get device info
      const deviceId = await AsyncStorage.getItem('deviceId');
      
      if (!deviceId) {
        Alert.alert('Error', 'Device ID not found. Please restart the app.');
        return;
      }

      // Activate device
      const response = await deviceAPI.activate({
        key: qrData.keyId,
        deviceId: deviceId,
      });

      if (response.data.success) {
        // Store activation key
        await AsyncStorage.setItem('activationKey', qrData.keyId);
        await AsyncStorage.setItem('deviceInfo', JSON.stringify({
          customerName: qrData.customerName,
          productName: qrData.productName,
          emiProvider: qrData.emiProvider,
          emiDuration: qrData.emiDuration,
          emiAmount: qrData.emiAmount,
        }));

        Alert.alert(
          'Success! 🎉',
          'Your device has been activated successfully.',
          [
            {
              text: 'OK',
              onPress: () => {
                // Navigate to home or reload app
                navigation.replace('Home');
              },
            },
          ]
        );
      }
    } catch (error) {
      Alert.alert(
        'Activation Failed',
        error.response?.data?.message || 'Failed to activate device. Please try again.'
      );
      setScanned(false);
      setProcessing(false);
    }
  };

  if (!permission) {
    return (
      <View style={styles.container}>
        <Text>Requesting camera permission...</Text>
      </View>
    );
  }

  if (!permission.granted) {
    return (
      <View style={styles.container}>
        <Text style={styles.errorText}>No access to camera</Text>
        <TouchableOpacity style={styles.button} onPress={requestPermission}>
          <Text style={styles.buttonText}>Grant Permission</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <CameraView
        style={styles.camera}
        onBarcodeScanned={scanned ? undefined : handleBarCodeScanned}
        barcodeScannerSettings={{
          barcodeTypes: ['qr'],
        }}
      >
        <View style={styles.overlay}>
          <View style={styles.header}>
            <Text style={styles.title}>Scan Activation QR</Text>
            <Text style={styles.subtitle}>
              Point your camera at the QR code shown by the seller
            </Text>
          </View>

          <View style={styles.scanArea}>
            <View style={[styles.corner, styles.topLeft]} />
            <View style={[styles.corner, styles.topRight]} />
            <View style={[styles.corner, styles.bottomLeft]} />
            <View style={[styles.corner, styles.bottomRight]} />
          </View>

          <View style={styles.footer}>
            {processing && (
              <Text style={styles.processingText}>Processing...</Text>
            )}
            <TouchableOpacity
              style={styles.cancelButton}
              onPress={() => navigation.goBack()}
            >
              <Text style={styles.cancelButtonText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      </CameraView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
    justifyContent: 'center',
    alignItems: 'center',
  },
  camera: {
    flex: 1,
    width: '100%',
  },
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  header: {
    padding: 20,
    paddingTop: 60,
    alignItems: 'center',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#FFFFFF',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 14,
    color: '#D1D5DB',
    textAlign: 'center',
  },
  scanArea: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
  },
  corner: {
    position: 'absolute',
    width: 60,
    height: 60,
    borderColor: '#3B82F6',
    borderWidth: 4,
  },
  topLeft: {
    top: -120,
    left: -120,
    borderRightWidth: 0,
    borderBottomWidth: 0,
  },
  topRight: {
    top: -120,
    right: -120,
    borderLeftWidth: 0,
    borderBottomWidth: 0,
  },
  bottomLeft: {
    bottom: -120,
    left: -120,
    borderRightWidth: 0,
    borderTopWidth: 0,
  },
  bottomRight: {
    bottom: -120,
    right: -120,
    borderLeftWidth: 0,
    borderTopWidth: 0,
  },
  footer: {
    padding: 20,
    paddingBottom: 40,
    alignItems: 'center',
  },
  processingText: {
    color: '#FFFFFF',
    fontSize: 16,
    marginBottom: 16,
  },
  cancelButton: {
    backgroundColor: 'rgba(255,255,255,0.2)',
    paddingHorizontal: 32,
    paddingVertical: 12,
    borderRadius: 8,
  },
  cancelButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  errorText: {
    color: '#FFFFFF',
    fontSize: 16,
    marginBottom: 20,
  },
  button: {
    backgroundColor: '#3B82F6',
    paddingHorizontal: 32,
    paddingVertical: 12,
    borderRadius: 8,
  },
  buttonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: 'bold',
  },
});
