import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.ssmart.pos',
  appName: 'SS Mart',
  webDir: 'frontend/.next',
  server: {
    androidScheme: 'https',
    url: 'http://localhost:1994',
    cleartext: true,
  },
  plugins: {
    SplashScreen: {
      launchAutoHide: false,
      backgroundColor: '#2563eb',
      showSpinner: true,
      spinnerColor: '#ffffff',
    },
    BarcodeScanner: {
      android: {
        cameraPermissionText: 'Allow SS Mart to access camera for barcode scanning',
      },
    },
    LocalNotifications: {
      smallIcon: 'ic_stat_icon_config_sample',
      iconColor: '#2563eb',
    },
    Keyboard: {
      resize: 'body',
      style: 'dark',
    },
  },
  android: {
    buildOptions: {
      keystorePath: undefined,
      keystoreAlias: undefined,
    },
  },
  ios: {
    contentInset: 'automatic',
    backgroundColor: '#ffffff',
  },
};

export default config;
