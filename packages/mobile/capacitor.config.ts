import type { CapacitorConfig } from "@capacitor/cli";

const config: CapacitorConfig = {
  appId: "com.bumpbuddies.app",
  appName: "Bump Buddies",
  /**
   * Points to the Vite build output of the client package.
   * Run `pnpm --filter @bumpbuddies/client build` before syncing.
   */
  webDir: "../client/dist",
  plugins: {
    SplashScreen: {
      launchShowDuration: 2000,
      backgroundColor: "#1a1a2e",
      androidSplashResourceName: "splash",
      showSpinner: false,
    },
    StatusBar: {
      style: "dark",
      backgroundColor: "#1a1a2e",
    },
  },
  server: {
    androidScheme: "https",
  },
};

export default config;
