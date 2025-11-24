import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'co.za.vmgsoftware.frontman',
  appName: 'VMG FRONTMAN',
  webDir: 'www',
  // ADD THIS BLOCK FOR ANDROID NETWORK SETTINGS
  server: {
    // This allows the app to communicate with your non-HTTPS local server.
    cleartext: true
  }
};

export default config;
