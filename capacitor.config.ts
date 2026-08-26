import type { CapacitorConfig } from "@capacitor/cli";

const config: CapacitorConfig = {
  appId: "app.ciclaqui",
  appName: "Cicla Qui",
  webDir: "dist/client",
  // L'app usa rendering lato server (viaggi, punti, premi): il guscio nativo
  // carica il sito pubblicato mantenendo tutti i plugin nativi (GPS background,
  // push, motion). Per testare in locale sostituisci con http://192.168.x.x:8080.
  server: {
    url: "https://ciclaqui.it",
    androidScheme: "https",
    iosScheme: "https",
    cleartext: false,
  },
  ios: {
    contentInset: "always",
    limitsNavigationsToAppBoundDomains: false,
  },
  android: {
    allowMixedContent: false,
  },
  plugins: {
    SplashScreen: {
      launchShowDuration: 1500,
      backgroundColor: "#0a0f0d",
      showSpinner: false,
    },
    PushNotifications: {
      presentationOptions: ["badge", "sound", "alert"],
    },
    Geolocation: {
      // iOS Info.plist & Android manifest sono gestiti dai plugin Capacitor
    },
  },
};

export default config;
