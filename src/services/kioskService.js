import { NativeModules, Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

const { DeviceAdminModule } = NativeModules;

/**
 * Kiosk Mode Service
 * Handles device lockdown, app hiding, and kiosk mode operations
 */

// Check if device admin is enabled
export const isDeviceAdmin = async () => {
  if (Platform.OS !== 'android' || !DeviceAdminModule) {
    return false;
  }
  try {
    return await DeviceAdminModule.isDeviceAdmin();
  } catch (error) {
    console.error('Error checking device admin:', error);
    return false;
  }
};

// Request device admin privileges
export const requestDeviceAdmin = async () => {
  if (Platform.OS !== 'android' || !DeviceAdminModule) {
    console.warn('Device admin only available on Android native builds');
    return false;
  }
  try {
    return await DeviceAdminModule.requestDeviceAdmin();
  } catch (error) {
    console.error('Error requesting device admin:', error);
    return false;
  }
};

// Start lock task mode (kiosk mode)
export const startLockTaskMode = async () => {
  if (Platform.OS !== 'android' || !DeviceAdminModule) {
    console.warn('Lock task mode only available on Android native builds');
    return false;
  }
  try {
    await DeviceAdminModule.startLockTaskMode();
    await AsyncStorage.setItem('kioskModeActive', 'true');
    console.log('✅ Kiosk mode started');
    return true;
  } catch (error) {
    console.error('Error starting lock task mode:', error);
    return false;
  }
};

// Stop lock task mode
export const stopLockTaskMode = async () => {
  if (Platform.OS !== 'android' || !DeviceAdminModule) {
    return false;
  }
  try {
    await DeviceAdminModule.stopLockTaskMode();
    await AsyncStorage.setItem('kioskModeActive', 'false');
    console.log('✅ Kiosk mode stopped');
    return true;
  } catch (error) {
    console.error('Error stopping lock task mode:', error);
    return false;
  }
};

// Hide app from launcher
export const hideAppFromLauncher = async () => {
  if (Platform.OS !== 'android' || !DeviceAdminModule) {
    console.warn('Hide app only available on Android native builds');
    return false;
  }
  try {
    await DeviceAdminModule.hideAppFromLauncher();
    await AsyncStorage.setItem('appHidden', 'true');
    console.log('✅ App hidden from launcher');
    return true;
  } catch (error) {
    console.error('Error hiding app:', error);
    return false;
  }
};

// Show app in launcher
export const showAppInLauncher = async () => {
  if (Platform.OS !== 'android' || !DeviceAdminModule) {
    return false;
  }
  try {
    await DeviceAdminModule.showAppInLauncher();
    await AsyncStorage.setItem('appHidden', 'false');
    console.log('✅ App shown in launcher');
    return true;
  } catch (error) {
    console.error('Error showing app:', error);
    return false;
  }
};

// Disable status bar
export const disableStatusBar = async () => {
  if (Platform.OS !== 'android' || !DeviceAdminModule) {
    return false;
  }
  try {
    await DeviceAdminModule.disableStatusBar();
    console.log('✅ Status bar disabled');
    return true;
  } catch (error) {
    console.error('Error disabling status bar:', error);
    return false;
  }
};

// Enable status bar
export const enableStatusBar = async () => {
  if (Platform.OS !== 'android' || !DeviceAdminModule) {
    return false;
  }
  try {
    await DeviceAdminModule.enableStatusBar();
    console.log('✅ Status bar enabled');
    return true;
  } catch (error) {
    console.error('Error enabling status bar:', error);
    return false;
  }
};

// Block user restrictions (factory reset, etc.)
export const setUserRestrictions = async (enable = true) => {
  if (Platform.OS !== 'android' || !DeviceAdminModule) {
    return false;
  }
  try {
    await DeviceAdminModule.setUserRestrictions(enable);
    console.log(`✅ User restrictions ${enable ? 'enabled' : 'disabled'}`);
    return true;
  } catch (error) {
    console.error('Error setting user restrictions:', error);
    return false;
  }
};

// Full lockdown (kiosk + hide + restrictions)
export const enableFullLockdown = async () => {
  console.log('🔒 Enabling full lockdown...');
  
  const results = {
    deviceAdmin: await isDeviceAdmin(),
    kioskMode: false,
    appHidden: false,
    statusBarDisabled: false,
    restrictionsSet: false,
  };

  if (!results.deviceAdmin) {
    console.warn('⚠️ Device admin not enabled. Request it first.');
    return results;
  }

  results.kioskMode = await startLockTaskMode();
  results.appHidden = await hideAppFromLauncher();
  results.statusBarDisabled = await disableStatusBar();
  results.restrictionsSet = await setUserRestrictions(true);

  console.log('🔒 Full lockdown results:', results);
  return results;
};

// Disable full lockdown
export const disableFullLockdown = async () => {
  console.log('🔓 Disabling full lockdown...');
  
  await stopLockTaskMode();
  await showAppInLauncher();
  await enableStatusBar();
  await setUserRestrictions(false);
  
  console.log('🔓 Full lockdown disabled');
};

export default {
  isDeviceAdmin,
  requestDeviceAdmin,
  startLockTaskMode,
  stopLockTaskMode,
  hideAppFromLauncher,
  showAppInLauncher,
  disableStatusBar,
  enableStatusBar,
  setUserRestrictions,
  enableFullLockdown,
  disableFullLockdown,
};
