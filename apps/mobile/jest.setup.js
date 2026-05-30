// Mock NetInfo para testes
jest.mock('@react-native-community/netinfo', () => ({
  fetch: jest.fn().mockResolvedValue({ isConnected: true, isInternetReachable: true }),
  addEventListener: jest.fn(),
}));

// Mock expo-audio
jest.mock('expo-audio', () => ({
  useAudioRecorder: jest.fn(() => ({ record: jest.fn(), stop: jest.fn(), isRecording: false })),
  useAudioPlayer: jest.fn(() => ({
    addListener: jest.fn(() => ({ remove: jest.fn() })),
    play: jest.fn(),
    pause: jest.fn(),
    replace: jest.fn(),
  })),
  Audio: {
    requestRecordingPermissionsAsync: jest.fn().mockResolvedValue({ status: 'granted' }),
    RecordingPresets: {
      HIGH_QUALITY: { android: { audioEncoder: 1 }, ios: { audioQuality: 128 } },
    },
  },
}));

// Mock expo-file-system
jest.mock('expo-file-system', () => ({
  readAsStringAsync: jest.fn().mockResolvedValue('base64data'),
  EncodingType: {
    UTF8: 'utf8',
    Base64: 'base64',
  },
}));

// Mock expo-linear-gradient
jest.mock('expo-linear-gradient', () => ({
  LinearGradient: 'LinearGradient',
}));

// Mock expo-blur
jest.mock('expo-blur', () => ({
  BlurView: 'BlurView',
}));

// Mock @expo/vector-icons
jest.mock('@expo/vector-icons', () => ({
  Ionicons: 'Ionicons',
}));

// Mock expo-router
jest.mock('expo-router', () => ({
  useRouter: () => ({
    push: jest.fn(),
    replace: jest.fn(),
  }),
  useSegments: jest.fn(),
  Stack: 'Stack',
}));

// Mock zustand stores
jest.mock('./stores/authStore', () => ({
  useAuthStore: jest.fn(() => ({
    user: { id: 'test-user-id' },
    profile: { full_name: 'Test User', company_name: 'Test Company' },
    session: { id: 'test-session' },
    isLoading: false,
  })),
}));

// Mock expo-constants
jest.mock('expo-constants', () => ({
  default: {},
}));

// Mock expo-status-bar
jest.mock('expo-status-bar', () => ({
  StatusBar: 'StatusBar',
}));
