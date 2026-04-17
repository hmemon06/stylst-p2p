import { useState, useEffect } from 'react';
import { Dimensions, ScaledSize } from 'react-native';
import { Layout, getDeviceType } from '@/constants/Spacing';

export interface ResponsiveLayout {
  width: number;
  height: number;
  isSmallDevice: boolean;
  isTablet: boolean;
  deviceType: 'small' | 'medium' | 'large' | 'tablet';
  orientation: 'portrait' | 'landscape';
}

export function useResponsiveLayout(): ResponsiveLayout {
  const [dimensions, setDimensions] = useState(() => {
    const { width, height } = Dimensions.get('window');
    return { width, height };
  });

  useEffect(() => {
    const subscription = Dimensions.addEventListener('change', ({ window }: { window: ScaledSize }) => {
      setDimensions({ width: window.width, height: window.height });
    });

    return () => subscription?.remove();
  }, []);

  const { width, height } = dimensions;
  const isLandscape = width > height;

  return {
    width,
    height,
    isSmallDevice: width < 480,
    isTablet: width >= 768,
    deviceType: getDeviceType(),
    orientation: isLandscape ? 'landscape' : 'portrait',
  };
}

export function useResponsiveValue<T>(values: {
  small?: T;
  medium?: T;
  large?: T;
  tablet?: T;
  default: T;
}): T {
  const { deviceType } = useResponsiveLayout();
  
  return values[deviceType] ?? values.default;
}









