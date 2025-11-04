import * as TaskManager from 'expo-task-manager';
import * as BackgroundFetch from 'expo-background-fetch';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { deviceAPI } from '../config/api';
import * as Notifications from 'expo-notifications';
import { Vibration, Platform } from 'react-native';

const BACKGROUND_FETCH_TASK = 'device-status-check';

// Configure notifications
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

// Define the background task
TaskManager.defineTask(BACKGROUND_FETCH_TASK, async () => {
  const startTime = Date.now();
  console.log('🔄 Background task started at:', new Date().toISOString());
  
  try {
    const key = await AsyncStorage.getItem('activationKey');
    if (!key) {
      console.log('⚠️ No activation key found');
      return BackgroundFetch.BackgroundFetchResult.NoData;
    }

    // Check device status with timeout
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 25000); // 25 second timeout

    try {
      const response = await deviceAPI.getDeviceStatus(key);
      clearTimeout(timeoutId);
      
      const status = response.data.data;
      console.log('✅ Status received:', status.status, 'Command:', status.command);

      // Handle different commands
      if (status.command && status.command !== 'none') {
        console.log('🎯 Executing command:', status.command);
        await handleCommand(status.command, status);
        
        // Acknowledge command
        try {
          await deviceAPI.acknowledgeCommand({
            keyId: key, // Changed from 'key' to 'keyId'
            command: status.command,
          });
          console.log('✅ Command acknowledged');
        } catch (ackError) {
          console.error('⚠️ Failed to acknowledge command:', ackError);
        }
      }

      // Update device status
      await AsyncStorage.setItem('deviceStatus', JSON.stringify(status));
      await AsyncStorage.setItem('lastSyncTime', Date.now().toString());

      const duration = Date.now() - startTime;
      console.log(`✅ Background task completed in ${duration}ms`);
      
      return BackgroundFetch.BackgroundFetchResult.NewData;
    } catch (fetchError) {
      clearTimeout(timeoutId);
      throw fetchError;
    }
  } catch (error) {
    const duration = Date.now() - startTime;
    console.error(`❌ Background fetch error after ${duration}ms:`, error.message);
    
    // Store error for debugging
    await AsyncStorage.setItem('lastSyncError', JSON.stringify({
      error: error.message,
      timestamp: Date.now(),
    }));
    
    return BackgroundFetch.BackgroundFetchResult.Failed;
  }
});

// Handle different commands
async function handleCommand(command, status) {
  switch (command) {
    case 'lock':
      await AsyncStorage.setItem('isLocked', 'true');
      await AsyncStorage.setItem('lockMessage', status.lockMessage || '');
      await sendLocalNotification(
        'Device Locked',
        status.lockMessage || 'Your device has been locked'
      );
      break;

    case 'unlock':
      await AsyncStorage.setItem('isLocked', 'false');
      await AsyncStorage.removeItem('lockMessage');
      await sendLocalNotification(
        'Device Unlocked',
        'Your device has been unlocked'
      );
      break;

    case 'reminder':
      await sendLocalNotification(
        'EMI Payment Reminder',
        `Your EMI payment is due. Please pay to avoid device lock.`
      );
      break;

    case 'find':
    case 'ring':
      // Ring device - play sound and vibrate
      await ringDevice();
      await sendLocalNotification(
        'Find Device',
        'Your device is ringing. Tap to stop.'
      );
      break;

    case 'expired':
      await AsyncStorage.setItem('isLocked', 'false');
      await AsyncStorage.removeItem('lockMessage');
      await sendLocalNotification(
        'EMI Completed',
        'Congratulations! Your EMI is complete. The device lock will be removed automatically.'
      );
      break;

    case 'reset':
      // Factory reset device - WARNING: This will erase all data!
      await sendLocalNotification(
        'Device Reset Initiated',
        'Your device will be reset in 10 seconds. All data will be erased.'
      );
      // Wait 10 seconds before reset
      setTimeout(async () => {
        await performFactoryReset();
      }, 10000);
      break;

    default:
      break;
  }
}

// Perform factory reset
async function performFactoryReset() {
  try {
    // Clear all app data
    await AsyncStorage.clear();
    
    // On Android, this would trigger a factory reset
    // Requires device admin permissions
    if (Platform.OS === 'android') {
      // Note: Actual factory reset requires native module
      // This is a placeholder for the reset logic
      console.log('Factory reset initiated');
      
      // In production, you would use a native module like:
      // NativeModules.DeviceAdmin.factoryReset();
    }
    
    // On iOS, factory reset is not possible from app
    // Can only clear app data
    if (Platform.OS === 'ios') {
      console.log('App data cleared (iOS)');
    }
  } catch (error) {
    console.error('Factory reset error:', error);
  }
}

// Ring device function
async function ringDevice() {
  try {
    const { Vibration } = require('react-native');
    Vibration.vibrate([0, 500, 200, 500, 200, 500, 200, 500], false);
    setTimeout(() => {
      Vibration.cancel();
    }, 10000);
    console.log('🔔 Device is ringing (vibration)');
  } catch (error) {
    console.error('Error ringing device:', error);
  }
}

// Send notification with Android channel
async function sendLocalNotification(title, body) {
  await Notifications.scheduleNotificationAsync({
    content: {
      title,
      body,
      sound: true,
      priority: Notifications.AndroidNotificationPriority.MAX,
      ...(Platform.OS === 'android' && { channelId: 'devicelock-critical' }),
    },
    trigger: null,
  });
}

// Register background fetch
export async function registerBackgroundFetch() {
  try {
    // Check if running in Expo Go
    const isExpoGo = Platform.OS === 'android' && !__DEV__;
    if (isExpoGo) {
      console.log('⚠️ Background tasks not available in Expo Go. Use a development build for full functionality.');
      return;
    }

    // Unregister first to avoid duplicates
    const isRegistered = await TaskManager.isTaskRegisteredAsync(BACKGROUND_FETCH_TASK);
    if (isRegistered) {
      await BackgroundFetch.unregisterTaskAsync(BACKGROUND_FETCH_TASK);
      console.log('Unregistered existing background task');
    }

    // Register with improved settings
    await BackgroundFetch.registerTaskAsync(BACKGROUND_FETCH_TASK, {
      minimumInterval: 15 * 60, // 15 minutes (more reliable than 5)
      stopOnTerminate: false,
      startOnBoot: true,
    });
    
    console.log('✅ Background fetch registered successfully');
    console.log('⏰ Will check every 15 minutes');
    
    // Store registration time
    await AsyncStorage.setItem('backgroundTaskRegistered', Date.now().toString());
  } catch (error) {
    // Suppress warning for Expo Go limitation
    if (error.message?.includes('TaskManager') || error.message?.includes('Expo Go')) {
      console.log('ℹ️ Background tasks require a development build');
    } else {
      console.error('❌ Failed to register background fetch:', error);
    }
  }
}

// Unregister background fetch
export async function unregisterBackgroundFetch() {
  try {
    await BackgroundFetch.unregisterTaskAsync(BACKGROUND_FETCH_TASK);
    console.log('Background fetch unregistered');
  } catch (error) {
    console.error('Failed to unregister background fetch:', error);
  }
}

// Check if device is locked
export async function isDeviceLocked() {
  const locked = await AsyncStorage.getItem('isLocked');
  return locked === 'true';
}

// Request notification permissions
export async function requestNotificationPermissions() {
  const { status } = await Notifications.requestPermissionsAsync();
  return status === 'granted';
}

// Setup FCM push notification listener
export function setupPushNotificationListener(onCommandReceived) {
  // Listener for notifications received while app is in foreground
  const foregroundSubscription = Notifications.addNotificationReceivedListener(async (notification) => {
    console.log('📨 Notification received (foreground):', notification);
    
    const { command, lockMessage, keyId } = notification.request.content.data;
    
    if (command) {
      console.log('🎯 Executing command from push:', command);
      
      // Execute command immediately
      await handleCommand(command, { lockMessage, keyId });
      
      // Callback for UI updates
      if (onCommandReceived) {
        onCommandReceived(command, { lockMessage, keyId });
      }
      
      // Acknowledge command
      try {
        const keyId = await AsyncStorage.getItem('keyId') || await AsyncStorage.getItem('activationKey');
        if (keyId) {
          const { deviceAPI } = require('../config/api');
          await deviceAPI.acknowledgeCommand({ keyId, command }); // Changed from 'key' to 'keyId'
          console.log('✅ Command acknowledged via push');
        }
      } catch (error) {
        console.error('⚠️ Failed to acknowledge push command:', error);
      }
    }
  });

  // Listener for notifications that opened the app
  const responseSubscription = Notifications.addNotificationResponseReceivedListener(async (response) => {
    console.log('📨 Notification response:', response);
    
    const { command, lockMessage, keyId } = response.notification.request.content.data;
    
    if (command) {
      await handleCommand(command, { lockMessage, keyId });
      
      if (onCommandReceived) {
        onCommandReceived(command, { lockMessage, keyId });
      }
    }
  });

  // Return cleanup function
  return () => {
    foregroundSubscription.remove();
    responseSubscription.remove();
  };
}

// Get FCM token (device push token, not Expo token)
export async function getFCMToken() {
  try {
    // Get device-specific push token (FCM for Android, APNs for iOS)
    const token = await Notifications.getDevicePushTokenAsync();
    console.log('📱 FCM Token:', token.data);
    return token.data;
  } catch (error) {
    console.error('❌ Failed to get FCM token:', error);
    return null;
  }
}

// Update FCM token on backend
export async function updateFCMToken(keyId, fcmToken) {
  try {
    const { deviceAPI } = require('../config/api');
    const deviceId = await AsyncStorage.getItem('deviceId');
    
    if (!deviceId) {
      console.warn('⚠️ No deviceId found, skipping FCM token update');
      return;
    }
    
    await deviceAPI.updateDeviceInfo({
      deviceId,
      fcmToken,
    });
    console.log('✅ FCM token updated on backend');
  } catch (error) {
    console.error('❌ Failed to update FCM token:', error.response?.data?.message || error.message);
  }
}
