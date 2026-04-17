/**
 * Modern minimal color palette inspired by SSense and Fetch
 * Clean, sophisticated, and premium aesthetic
 */

const tintColorLight = '#000000';
const tintColorDark = '#ffffff';

export const Colors = {
  light: {
    text: '#000000',
    background: '#ffffff',
    tint: tintColorLight,
    icon: '#666666',
    tabIconDefault: '#999999',
    tabIconSelected: tintColorLight,
    // Premium accent colors
    accent: '#000000',
    surface: '#f8f8f8',
    border: '#e5e5e5',
    muted: '#666666',
    // Status colors
    success: '#000000',
    error: '#ff0000',
    warning: '#ffaa00',
  },
  dark: {
    text: '#ffffff',
    background: '#000000',
    tint: tintColorDark,
    icon: '#999999',
    tabIconDefault: '#666666',
    tabIconSelected: tintColorDark,
    // Premium accent colors
    accent: '#ffffff',
    surface: '#111111',
    border: '#333333',
    muted: '#999999',
    // Status colors
    success: '#ffffff',
    error: '#ff0000',
    warning: '#ffaa00',
  },
};
