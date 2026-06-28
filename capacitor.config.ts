import type { CapacitorConfig } from "@capacitor/cli";

const config: CapacitorConfig = {
  appId: "app.ciclaqui",
  appName: "Cicla Qui",
  webDir: "dist",
  ios: {
    contentInset: "always",
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
    Geolocation: {
      // iOS Info.plist & Android manifest sono gestiti dai plugin Capacitor
    },
  },
};

export default config;
