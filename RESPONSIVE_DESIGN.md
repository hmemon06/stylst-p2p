# Responsive Design Guide

This guide explains how to ensure proper formatting and spacing across different mobile devices in your React Native app.

## Key Features Implemented

### 1. **Responsive Spacing System** (`constants/Spacing.ts`)

- Automatically scales spacing based on device size
- Provides consistent spacing units across all screen sizes
- Includes device-specific adaptations for small phones, regular phones, large phones, and tablets

```typescript
import { Spacing, Typography } from '@/constants/Spacing';

// Use responsive spacing
const styles = StyleSheet.create({
  container: {
    padding: Spacing.adaptive.screenPadding, // Adapts to device size
    gap: Spacing.md, // Scales appropriately
  },
  text: {
    fontSize: Typography.base, // Responsive font size
  }
});
```

### 2. **Responsive Components**

#### `ResponsiveContainer`
A container component that automatically applies appropriate spacing:

```typescript
<ResponsiveContainer variant="screen" useSafeArea>
  {/* Your content */}
</ResponsiveContainer>
```

Variants:
- `screen`: Full screen container with safe area support
- `card`: Card-like container with padding and border radius
- `section`: Section container with minimal padding

#### `ResponsiveButton`
A button component that scales appropriately across devices:

```typescript
<ResponsiveButton 
  title="Get Started" 
  variant="primary" 
  size="large"
  fullWidth
  onPress={handlePress}
/>
```

Variants: `primary`, `secondary`, `outline`
Sizes: `small`, `medium`, `large`

### 3. **Responsive Layout Hook** (`hooks/useResponsiveLayout.ts`)

Get real-time device information and layout details:

```typescript
const { width, height, deviceType, orientation, isTablet } = useResponsiveLayout();

const columnCount = useResponsiveValue({
  small: 1,
  medium: 2,
  large: 2,
  tablet: 3,
  default: 2
});
```

### 4. **Enhanced Typography**

The `ThemedText` component now uses responsive font sizes:

```typescript
<ThemedText type="title">Scales appropriately</ThemedText>
<ThemedText type="subtitle">Also responsive</ThemedText>
```

## Device Size Categories

1. **Small** (< 480px): iPhone SE, small Android phones
2. **Medium** (480-768px): Most standard phones
3. **Large** (768-1024px): Large phones, small tablets
4. **Tablet** (>= 1024px): iPads, large tablets

## Best Practices

### 1. **Use Responsive Spacing**
Always use the spacing constants instead of hardcoded values:

```typescript
// ✅ Good
paddingHorizontal: Spacing.adaptive.screenPadding

// ❌ Avoid
paddingHorizontal: 20
```

### 2. **Test Across Device Sizes**
Use the `DeviceInfoDebug` component during development:

```typescript
import { DeviceInfoDebug } from '@/components/DeviceInfoDebug';

// Add to your screen for testing
<DeviceInfoDebug />
```

### 3. **Consider Touch Targets**
Minimum touch target size is automatically handled by `ResponsiveButton`, but for custom touchable elements:

```typescript
minHeight: Spacing.adaptive.buttonHeight, // At least 44pt on iOS
minWidth: Spacing.adaptive.buttonHeight,
```

### 4. **Use Responsive Values**
For conditional layouts based on device size:

```typescript
const columns = useResponsiveValue({
  small: 1,
  medium: 2,
  tablet: 3,
  default: 2
});
```

### 5. **Handle Safe Areas**
Use `ResponsiveContainer` with `useSafeArea` prop for full-screen layouts:

```typescript
<ResponsiveContainer useSafeArea variant="screen">
  {/* Content automatically avoids notches and home indicators */}
</ResponsiveContainer>
```

## Testing Your Responsive Design

1. **iOS Simulator**: Test on iPhone SE, iPhone 15, iPhone 15 Plus, and iPad
2. **Android Emulator**: Test on different screen sizes and densities
3. **Physical Devices**: Test on actual devices when possible
4. **DeviceInfoDebug**: Use the debug component to verify scaling

## Configuration Options

### App.json Settings
Your app is already configured for optimal responsiveness:

```json
{
  "orientation": "portrait",
  "ios": {
    "supportsTablet": true
  },
  "android": {
    "edgeToEdgeEnabled": true
  }
}
```

### Key Dependencies
- `react-native-safe-area-context`: Safe area handling
- `expo-constants`: Device information
- `react-native-reanimated`: Smooth animations

## Troubleshooting

### Common Issues

1. **Text too small on small devices**: Use `Typography` constants instead of fixed font sizes
2. **Buttons too small**: Use `ResponsiveButton` with appropriate size prop
3. **Inconsistent spacing**: Use `Spacing` constants throughout your app
4. **Layout breaks on tablets**: Test with `useResponsiveLayout` hook and adjust accordingly

### Debug Tips

1. Add `<DeviceInfoDebug />` to your screens during development
2. Use the responsive values to understand how scaling works
3. Test orientation changes
4. Verify safe area handling on devices with notches

## Migration Guide

To update existing components:

1. Replace hardcoded spacing with `Spacing` constants
2. Replace hardcoded font sizes with `Typography` constants
3. Wrap content in `ResponsiveContainer` where appropriate
4. Replace custom buttons with `ResponsiveButton`
5. Use responsive hooks for conditional logic

This responsive design system ensures your app looks great and functions properly across all iOS and Android devices!









