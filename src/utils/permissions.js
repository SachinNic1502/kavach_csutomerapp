import { Camera } from 'expo-camera';
import * as Location from 'expo-location';
import * as Notifications from 'expo-notifications';
import { Alert, Platform, Linking } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

const PERMISSIONS_KEY = 'permissions_requested';

/**
 * Request all necessary permissions at once for customer app
 * Returns true if all critical permissions granted
 */
export async function requestAllPermissions() {
  try {
    // Check if already requested
    const alreadyRequested = await AsyncStorage.getItem(PERMISSIONS_KEY);
    
    if (!alreadyRequested) {
      // Show explanation dialog
      await showPermissionsExplanation();
    }

    const results = {
      camera: false,
      location: false,
      locationBackground: false,
      notifications: false,
    };

    // 1. Camera Permission (for QR scanning)
    try {
      const cameraStatus = await Camera.requestCameraPermissionsAsync();
      results.camera = cameraStatus.status === 'granted';
    } catch (e) {
      console.warn('Camera permission request failed:', e);
      results.camera = false;
    }

    // 2. Location Permission (foreground)
    const locationForeground = await Location.requestForegroundPermissionsAsync();
    results.location = locationForeground.status === 'granted';

    // 3. Background Location Permission (critical for tracking)
    if (results.location) {
      const locationBackground = await Location.requestBackgroundPermissionsAsync();
      results.locationBackground = locationBackground.status === 'granted';
      
      if (!results.locationBackground) {
        await showBackgroundLocationImportance();
      }
    }

    // 4. Notification Permission (critical for lock/unlock commands)
    const notificationStatus = await Notifications.requestPermissionsAsync();
    results.notifications = notificationStatus.status === 'granted';

    // Android-specific: Request battery optimization exemption
    if (Platform.OS === 'android') {
      await requestBatteryOptimizationExemption();
    }

    // Mark as requested
    await AsyncStorage.setItem(PERMISSIONS_KEY, 'true');
    await AsyncStorage.setItem('permissions_status', JSON.stringify(results));

    // Check if all critical permissions granted
    const allGranted = results.camera && results.location && results.locationBackground && results.notifications;

    if (!allGranted) {
      showPermissionsDeniedAlert(results);
    }

    return { granted: allGranted, results };
  } catch (error) {
    console.error('Error requesting permissions:', error);
    return { granted: false, results: {} };
  }
}

/**
 * Show explanation dialog before requesting permissions
 */
function showPermissionsExplanation() {
  return new Promise((resolve) => {
    Alert.alert(
      '🔐 Security Permissions Required',
      'DeviceLock Customer needs these permissions to protect your device:\n\n' +
      '📷 Camera - Scan QR code for device activation\n' +
      '📍 Location (Always) - Track device location for security and EMI compliance\n' +
      '🔔 Notifications - Receive lock/unlock commands instantly\n' +
      '🔋 Battery - Run in background for real-time protection\n\n' +
      '⚠️ These permissions are required for the device lock system to work properly.',
      [
        {
          text: 'I Understand',
          onPress: resolve,
        },
      ],
      { cancelable: false }
    );
  });
}

/**
 * Explain importance of background location
 */
function showBackgroundLocationImportance() {
  return new Promise((resolve) => {
    Alert.alert(
      '📍 Background Location Required',
      'Background location access is critical for:\n\n' +
      '• Device tracking for security\n' +
      '• EMI compliance monitoring\n' +
      '• Anti-theft protection\n\n' +
      'Please select "Allow all the time" in the next screen.',
      [
        {
          text: 'OK',
          onPress: resolve,
        },
      ]
    );
  });
}

/**
 * Request battery optimization exemption (Android)
 */
async function requestBatteryOptimizationExemption() {
  if (Platform.OS !== 'android') return;

  try {
    Alert.alert(
      '🔋 Battery Optimization',
      'To ensure DeviceLock works properly in the background, please disable battery optimization.\n\n' +
      'This allows the app to:\n' +
      '• Receive lock/unlock commands instantly\n' +
      '• Track device location continuously\n' +
      '• Run background security checks',
      [
        { text: 'Later', style: 'cancel' },
        {
          text: 'Open Settings',
          onPress: () => {
            // Note: This requires native module or expo-intent-launcher
            Linking.openSettings();
          },
        },
      ]
    );
  } catch (error) {
    console.error('Error requesting battery optimization:', error);
  }
}

/**
 * Show alert when permissions are denied
 */
function showPermissionsDeniedAlert(results) {
  const denied = [];
  if (!results.camera) denied.push('Camera');
  if (!results.location) denied.push('Location');
  if (!results.locationBackground) denied.push('Background Location');
  if (!results.notifications) denied.push('Notifications');

  if (denied.length > 0) {
    Alert.alert(
      '⚠️ Critical Permissions Missing',
      `The following permissions are required:\n\n${denied.join(', ')}\n\n` +
      '❌ DeviceLock cannot function without these permissions.\n\n' +
      'Please enable them in Settings to activate your device.',
      [
        { text: 'Exit', style: 'cancel' },
        {
          text: 'Open Settings',
          onPress: () => Linking.openSettings(),
        },
      ]
    );
  }
}

/**
 * Check current permission status
 */
export async function checkPermissionStatus() {
  try {
    const [camera, location, locationBackground, notifications] = await Promise.all([
      Camera.getCameraPermissionsAsync().catch(() => ({ status: 'denied' })),
      Location.getForegroundPermissionsAsync(),
      Location.getBackgroundPermissionsAsync(),
      Notifications.getPermissionsAsync(),
    ]);

    return {
      camera: camera.status === 'granted',
      location: location.status === 'granted',
      locationBackground: locationBackground.status === 'granted',
      notifications: notifications.status === 'granted',
    };
  } catch (error) {
    console.error('Error checking permissions:', error);
    return {
      camera: false,
      location: false,
      locationBackground: false,
      notifications: false,
    };
  }
}

/**
 * Verify all critical permissions are granted
 */
export async function verifyCriticalPermissions() {
  const status = await checkPermissionStatus();
  const allGranted = status.camera && status.location && status.locationBackground && status.notifications;
  
  if (!allGranted) {
    Alert.alert(
      '⚠️ Permissions Required',
      'DeviceLock requires all permissions to function. Please grant all permissions in Settings.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Open Settings',
          onPress: () => Linking.openSettings(),
        },
      ]
    );
  }
  
  return allGranted;
}

/**
 * Request specific permission if needed
 */
export async function ensurePermission(type) {
  try {
    switch (type) {
      case 'camera':
        try {
          const camera = await Camera.requestCameraPermissionsAsync();
          return camera.status === 'granted';
        } catch (e) {
          console.warn('Camera permission request failed:', e);
          return false;
        }
      
      case 'location':
        const location = await Location.requestForegroundPermissionsAsync();
        return location.status === 'granted';
      
      case 'locationBackground':
        const bgLocation = await Location.requestBackgroundPermissionsAsync();
        return bgLocation.status === 'granted';
      
      case 'notifications':
        const notif = await Notifications.requestPermissionsAsync();
        return notif.status === 'granted';
      
      default:
        return false;
    }
  } catch (error) {
    console.error(`Error requesting ${type} permission:`, error);
    return false;
  }
}
