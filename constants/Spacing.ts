import { Dimensions, PixelRatio } from 'react-native';

const { width: screenWidth, height: screenHeight } = Dimensions.get('window');

// Define base dimensions (iPhone 15 Pro as reference)
const BASE_WIDTH = 393;
const BASE_HEIGHT = 852;

// Get device pixel ratio
const pixelRatio = PixelRatio.get();

// Device size categories
export const getDeviceType = () => {
  if (screenWidth < 480) return 'small'; // iPhone SE, small Android phones
  if (screenWidth < 768) return 'medium'; // Most phones
  if (screenWidth < 1024) return 'large'; // Large phones, small tablets
  return 'tablet'; // iPads, large tablets
};

// Responsive scaling functions
export const scaleSize = (size: number): number => {
  const scale = screenWidth / BASE_WIDTH;
  return Math.round(PixelRatio.roundToNearestPixel(size * scale));
};

export const scaleFont = (size: number): number => {
  const scale = screenWidth / BASE_WIDTH;
  const newSize = size * scale;
  // Ensure minimum readability
  return Math.max(newSize, size * 0.85);
};

export const scaleHeight = (height: number): number => {
  const scale = screenHeight / BASE_HEIGHT;
  return Math.round(PixelRatio.roundToNearestPixel(height * scale));
};

// Responsive spacing values
export const Spacing = {
  // Base spacing units
  xs: scaleSize(4),
  sm: scaleSize(8),
  md: scaleSize(16),
  lg: scaleSize(24),
  xl: scaleSize(32),
  xxl: scaleSize(48),
  
  // Contextual spacing
  screenPadding: scaleSize(20),
  cardPadding: scaleSize(16),
  buttonPadding: scaleSize(12),
  
  // Device-specific adjustments
  get adaptive() {
    const deviceType = getDeviceType();
    switch (deviceType) {
      case 'small':
        return {
          screenPadding: scaleSize(16),
          cardPadding: scaleSize(12),
          buttonHeight: scaleSize(44),
        };
      case 'medium':
        return {
          screenPadding: scaleSize(20),
          cardPadding: scaleSize(16),
          buttonHeight: scaleSize(48),
        };
      case 'large':
        return {
          screenPadding: scaleSize(24),
          cardPadding: scaleSize(20),
          buttonHeight: scaleSize(52),
        };
      case 'tablet':
        return {
          screenPadding: scaleSize(32),
          cardPadding: scaleSize(24),
          buttonHeight: scaleSize(56),
        };
      default:
        return {
          screenPadding: scaleSize(20),
          cardPadding: scaleSize(16),
          buttonHeight: scaleSize(48),
        };
    }
  }
};

// Typography scaling
export const Typography = {
  xs: scaleFont(12),
  sm: scaleFont(14),
  base: scaleFont(16),
  lg: scaleFont(18),
  xl: scaleFont(20),
  xxl: scaleFont(24),
  title: scaleFont(32),
  
  // Line heights
  lineHeight: {
    tight: 1.2,
    normal: 1.4,
    relaxed: 1.6,
  }
};

// Device dimensions
export const Layout = {
  window: {
    width: screenWidth,
    height: screenHeight,
  },
  isSmallDevice: screenWidth < 480,
  isTablet: screenWidth >= 768,
  deviceType: getDeviceType(),
};


