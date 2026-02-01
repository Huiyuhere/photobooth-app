import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.cybershotbooth.app',
  appName: 'Cyber-shot Booth',
  webDir: 'dist/public',
  server: {
    androidScheme: 'https'
  },
  plugins: {
    Camera: {
      // iOS specific settings
      presentationStyle: 'fullScreen'
    }
  },
  ios: {
    // iOS specific configuration
    contentInset: 'automatic',
    allowsLinkPreview: false,
    backgroundColor: '#1a2a3a'
  }
};

export default config;
