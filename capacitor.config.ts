import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.apexsinc.mobile',
  appName: 'APEXS Mobile',
  webDir: 'www',
  server: {
    // The app is a thin native wrapper around the live Odoo instance -
    // there is no bundled UI to keep in sync, it always shows the current
    // production site. /odoo is Odoo's unified backend entry point, so
    // employees land on login / the app switcher rather than the public
    // marketing site.
    url: 'https://apexsinc.com/odoo',
    androidScheme: 'https',
    cleartext: false,
  },
  plugins: {
    SplashScreen: {
      launchAutoHide: true,
      backgroundColor: '#1b2a2f',
      androidSplashResourceName: 'splash',
      showSpinner: false,
    },
    PushNotifications: {
      presentationOptions: ['badge', 'sound', 'alert'],
    },
    // StatusBar configured for native Edge-to-Edge overlay layout.
    // Web content handles safe area insets via env(safe-area-inset-top)
    // in mobile_safe_area.css.
    StatusBar: {
      overlaysWebView: true,
      style: 'DARK',
      backgroundColor: '#1b2a2f',
    },
  },
};

export default config;
