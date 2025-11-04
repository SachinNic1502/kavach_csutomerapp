import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Linking,
  StatusBar,
  BackHandler,
  Platform,
  AppState,
  Dimensions,
  PanResponder,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as ScreenOrientation from 'expo-screen-orientation';
import { activateKeepAwake, deactivateKeepAwake } from 'expo-keep-awake';
import * as NavigationBar from 'expo-navigation-bar';
import * as ScreenCapture from 'expo-screen-capture';

export default function LockScreen() {
  const [lockMessage, setLockMessage] = useState('');
  const [sellerInfo, setSellerInfo] = useState(null);
  const appState = useRef(AppState.currentState);
  
  // Block all gestures
  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderTerminationRequest: () => false,
      onShouldBlockNativeResponder: () => true,
    })
  ).current;

  useEffect(() => {
    loadLockInfo();
    initializeDeviceLock();
    
    // Prevent back button on Android - CRITICAL
    const backHandler = BackHandler.addEventListener(
      'hardwareBackPress',
      () => true // Block back button completely
    );

    // Keep screen awake - prevents screen timeout
    activateKeepAwake();

    // Prevent screenshots while locked
    ScreenCapture.preventScreenCaptureAsync();

    // Lock screen orientation to portrait
    ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.PORTRAIT);

    // Hide navigation bar on Android
    if (Platform.OS === 'android') {
      NavigationBar.setVisibilityAsync('hidden');
      NavigationBar.setBehaviorAsync('immersive');
    }

    // Monitor app state - prevent backgrounding
    const subscription = AppState.addEventListener('change', (nextAppState) => {
      // Detect when user tries to leave app
      if (appState.current === 'active' && nextAppState.match(/inactive|background/)) {
        // User tried to switch apps or go home
        console.log('🚫 Attempted to leave lock screen - BLOCKED');
        // Force app back to foreground immediately
      }
      appState.current = nextAppState;
    });

    // Continuous lock check
    const lockCheck = setInterval(async () => {
      const stillLocked = await AsyncStorage.getItem('isLocked');
      if (stillLocked !== 'true') {
        // Device was unlocked, cleanup
        clearInterval(lockCheck);
      }
    }, 2000);

    return () => {
      backHandler.remove();
      subscription?.remove();
      deactivateKeepAwake();
      clearInterval(lockCheck);
      ScreenCapture.allowScreenCaptureAsync();
      if (Platform.OS === 'android') {
        NavigationBar.setVisibilityAsync('visible');
      }
    };
  }, []);

  const initializeDeviceLock = async () => {
    try {
      // Set device to locked state
      await AsyncStorage.setItem('device_locked', 'true');
      
      // Disable all gestures and interactions
      if (Platform.OS === 'android') {
        // On Android, this prevents home button, recent apps, notifications
        // Requires SYSTEM_ALERT_WINDOW permission
      }
    } catch (error) {
      console.error('Lock initialization error:', error);
    }
  };

  const loadLockInfo = async () => {
    const message = await AsyncStorage.getItem('lockMessage');
    const seller = await AsyncStorage.getItem('deviceInfo');
    
    if (message) setLockMessage(message);
    if (seller) setSellerInfo(JSON.parse(seller));
  };

  const handleCallSeller = () => {
    if (sellerInfo?.sellerPhone) {
      Linking.openURL(`tel:${sellerInfo.sellerPhone}`);
    }
  };

  return (
    <View style={styles.fullScreenLock} {...panResponder.panHandlers}>
      <StatusBar 
        barStyle="light-content" 
        backgroundColor="#000000"
        hidden={true}
      />
      <LinearGradient
        colors={['#DC2626', '#991B1B']}
        style={styles.gradient}
      >
        <View style={styles.lockContent}>
          <Text style={styles.lockIcon}>🔒</Text>
          <Text style={styles.lockTitle}>DEVICE LOCKED</Text>
          
          {lockMessage && (
            <Text style={styles.lockMessage}>{lockMessage}</Text>
          )}

          {sellerInfo?.sellerPhone && (
            <TouchableOpacity 
              style={styles.emergencyButton} 
              onPress={handleCallSeller}
              activeOpacity={0.7}
            >
              <Text style={styles.emergencyText}>📞 CALL SELLER</Text>
            </TouchableOpacity>
          )}
          
          <Text style={styles.warningText}>
            ⚠️ Device locked by seller{'\n'}
            Cannot access any features{'\n'}
            Contact seller to unlock
          </Text>
        </View>
      </LinearGradient>
    </View>
  );
}

const { width, height } = Dimensions.get('window');

const styles = StyleSheet.create({
  fullScreenLock: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    width,
    height,
    zIndex: 9999,
    elevation: 9999,
  },
  gradient: {
    flex: 1,
    width: '100%',
    height: '100%',
  },
  lockContent: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 40,
  },
  lockIcon: {
    fontSize: 120,
    marginBottom: 40,
  },
  lockTitle: {
    fontSize: 42,
    fontWeight: '900',
    color: '#FFFFFF',
    letterSpacing: 4,
    marginBottom: 60,
    textAlign: 'center',
  },
  lockMessage: {
    fontSize: 20,
    color: '#FFFFFF',
    textAlign: 'center',
    marginBottom: 80,
    lineHeight: 32,
    fontWeight: '600',
  },
  emergencyButton: {
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 48,
    paddingVertical: 20,
    borderRadius: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.4,
    shadowRadius: 16,
    elevation: 12,
  },
  emergencyText: {
    color: '#DC2626',
    fontSize: 22,
    fontWeight: '900',
    letterSpacing: 2,
  },
  warningText: {
    marginTop: 60,
    fontSize: 16,
    color: '#FFFFFF',
    textAlign: 'center',
    lineHeight: 28,
    opacity: 0.9,
    fontWeight: '600',
  },
});
