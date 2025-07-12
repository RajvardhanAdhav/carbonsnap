import { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'app.lovable.4df440c13fed47ca8ad4ae0049a8c5d6',
  appName: 'carbonsnap',
  webDir: 'dist',
  server: {
    url: 'https://4df440c1-3fed-47ca-8ad4-ae0049a8c5d6.lovableproject.com?forceHideBadge=true',
    cleartext: true
  },
  plugins: {
    Camera: {
      permissions: ['camera', 'photos']
    }
  }
};

export default config;