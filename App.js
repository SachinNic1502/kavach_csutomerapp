import React, { useEffect, useState } from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { StatusBar } from 'expo-status-bar';
import { Platform, AppState, BackHandler } from 'react-native';
import * as Notifications from 'expo-notifications';

// Screens
import ActivationScreen from './src/screens/ActivationScreen';
import HomeScreen from './src/screens/HomeScreen';
import LockScreen from './src/screens/LockScreen';

// Services
import {
  registerBackgroundFetch,
  isDeviceLocked,
  requestNotificationPermissions,
  setupPushNotificationListener,
  getFCMToken,
  updateFCMToken,
} from './src/services/deviceService';
import {
  isDeviceAdmin,
  requestDeviceAdmin,
  hideAppFromLauncher,
  enableFullLockdown,
  disableFullLockdown,
} from './src/services/kioskService';
import { requestAllPermissions, verifyCriticalPermissions } from './src/utils/permissions';

const Stack = createNativeStackNavigator();

export default function App() {
  const [isActivated, setIsActivated] = useState(false);
  const [isLocked, setIsLocked] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    initializeApp();
    
    // Monitor lock status continuously
    const lockCheckInterval = setInterval(async () => {
      const locked = await isDeviceLocked();
      if (locked !== isLocked) {
        setIsLocked(locked);
      }
    }, 1000); // Check every second

    // Prevent back button when locked
    const backHandler = BackHandler.addEventListener(
      'hardwareBackPress',
      () => {
        if (isLocked) {
          return true; // Block back button when locked
        }
        return false;
      }
    );

    return () => {
      clearInterval(lockCheckInterval);
      backHandler.remove();
    };
  }, [isLocked]);

  const initializeApp = async () => {
    try {
      // Request all permissions first
      const permissionsResult = await requestAllPermissions();
      
      if (!permissionsResult.granted) {
        console.warn('Not all permissions granted');
      }

      // Setup Android notification channel for high-priority notifications
      if (Platform.OS === 'android') {
        await Notifications.setNotificationChannelAsync('devicelock-critical', {
          name: 'Device Lock & Ring',
          importance: Notifications.AndroidImportance.MAX,
          vibrationPattern: [0, 250, 250, 250],
          sound: 'default',
          enableVibrate: true,
          enableLights: true,
          lightColor: '#FF0000',
          lockscreenVisibility: Notifications.AndroidNotificationVisibility.PUBLIC,
          bypassDnd: true,
        });
        console.log('✅ Android notification channel created');
      }

      // Request notification permissions
      await requestNotificationPermissions();

      // Check activation status
      const key = await AsyncStorage.getItem('activationKey');
      setIsActivated(!!key);

      // If activated, check and request device admin if needed
      if (key) {
        const isAdmin = await isDeviceAdmin();
        if (!isAdmin) {
          console.log('⚠️ Device admin not enabled. Requesting...');
          await requestDeviceAdmin();
        }
        
        // Hide app from launcher after activation
        const appHidden = await AsyncStorage.getItem('appHidden');
        if (appHidden !== 'true') {
          await hideAppFromLauncher();
        }
      }

      // Check lock status
      if (key) {
        const locked = await isDeviceLocked();
        setIsLocked(locked);
        
        // Enable full lockdown if device is locked
        if (locked) {
          await enableFullLockdown();
        }

        // Setup FCM push notification listener
        const unsubscribe = setupPushNotificationListener(async (command, data) => {
          console.log('📨 Command received via push:', command);
          
          // Update UI immediately based on command
          if (command === 'lock') {
            setIsLocked(true);
            await enableFullLockdown();
          } else if (command === 'unlock') {
            setIsLocked(false);
            await disableFullLockdown();
          }
        });

        // Get and update FCM token
        const fcmToken = await getFCMToken();
        if (fcmToken) {
          await updateFCMToken(key, fcmToken);
        }

        // Register background service
        await registerBackgroundFetch();

        // Cleanup on unmount
        return () => {
          if (unsubscribe) unsubscribe();
        };
      }
    } catch (error) {
      console.error('Initialization error:', error);
    } finally {
      setIsLoading(false);
    }
  };

  if (isLoading) {
    return null;
  }

  // If device is locked, ONLY show lock screen - no navigation possible
  if (isLocked) {
    return <LockScreen />;
  }

  return (
    <>
      <StatusBar style="auto" />
      <NavigationContainer>
        <Stack.Navigator screenOptions={{ headerShown: false }}>
          {!isActivated ? (
            <Stack.Screen 
              name="Activation" 
              component={ActivationScreen}
              options={{ gestureEnabled: false }}
            />
          ) : (
            <Stack.Screen 
              name="Home" 
              component={HomeScreen}
              options={{ 
                headerShown: true, 
                title: 'DeviceLock',
                gestureEnabled: false 
              }}
            />
          )}
        </Stack.Navigator>
      </NavigationContainer>
    </>
  );
}
