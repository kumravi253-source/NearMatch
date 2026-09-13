import { Platform } from 'react-native';
import { isRunningInExpoGo } from 'expo';
import {
  getTrackingPermissionsAsync,
  PermissionStatus,
  requestTrackingPermissionsAsync,
} from 'expo-tracking-transparency';

// Google sample App IDs are configured in app.json so native builds do not
// crash. Replace those App IDs in AdMob, then set the banner unit IDs below
// (EAS env or a local .env) before a store build that declares ads:
//   EXPO_PUBLIC_ADMOB_ANDROID_BANNER_ID=ca-app-pub-xxxx/yyyy
//   EXPO_PUBLIC_ADMOB_IOS_BANNER_ID=ca-app-pub-xxxx/yyyy
let adsModule = undefined;
let initPromise = null;

export function loadGoogleMobileAds() {
  if (adsModule !== undefined) return adsModule;
  if (isRunningInExpoGo()) {
    adsModule = null;
    return adsModule;
  }
  try {
    adsModule = require('react-native-google-mobile-ads');
  } catch (error) {
    console.error('Google Mobile Ads native module is unavailable', error);
    adsModule = null;
  }
  return adsModule;
}

export function getBannerUnitId() {
  const fromEnv = Platform.OS === 'ios'
    ? process.env.EXPO_PUBLIC_ADMOB_IOS_BANNER_ID
    : process.env.EXPO_PUBLIC_ADMOB_ANDROID_BANNER_ID;
  if (fromEnv) return fromEnv;
  return loadGoogleMobileAds()?.TestIds?.BANNER ?? null;
}

async function requestIosTrackingIfNeeded() {
  if (Platform.OS !== 'ios') return;
  const { status } = await getTrackingPermissionsAsync();
  if (status === PermissionStatus.UNDETERMINED) {
    await requestTrackingPermissionsAsync();
  }
}

async function doInitialize() {
  const ads = loadGoogleMobileAds();
  if (!ads) return;

  try {
    await requestIosTrackingIfNeeded();
  } catch (error) {
    console.error('Failed to request tracking permission', error);
  }

  try {
    await ads.AdsConsent.gatherConsent();
  } catch (error) {
    console.error('Failed to gather ads consent', error);
  }

  try {
    await ads.default().setRequestConfiguration({
      // Dating is 18+; keep ad creatives out of the mature/sexual bucket.
      maxAdContentRating: ads.MaxAdContentRating.T,
      tagForChildDirectedTreatment: false,
      tagForUnderAgeOfConsent: false,
      testDeviceIdentifiers: ['EMULATOR'],
    });
    await ads.default().initialize();
  } catch (error) {
    console.error('Failed to initialize Google Mobile Ads', error);
  }
}

export function initializeAds() {
  if (!initPromise) {
    initPromise = doInitialize();
  }
  return initPromise;
}
