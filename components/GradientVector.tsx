import React from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import Svg, { Defs, LinearGradient as SvgLinearGradient, Stop, Rect } from 'react-native-svg';

export interface GradientVectorProps {
  style?: StyleProp<ViewStyle>;
  testID?: string;
}

export function GradientVector(props: GradientVectorProps) {
  return (
    <View testID={props.testID ?? 'gradient-bg'} style={[styles.root, props.style]}>
      <Svg
        width="100%"
        height="100%"
        viewBox="0 0 393 857"
        preserveAspectRatio="xMidYMid slice"
      >
        <Defs>
          <SvgLinearGradient id="bg" x1="58.5" y1="857" x2="486.5" y2="67.5" gradientUnits="userSpaceOnUse">
            <Stop offset="0" stopColor="white" stopOpacity={0.27} />
            <Stop offset="1" stopColor="#57AB92" stopOpacity={0.690196} />
          </SvgLinearGradient>
        </Defs>
        <Rect x="0" y="0" width="393" height="857" fill="url(#bg)" />
      </Svg>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    width: '100%',
    height: '100%',
  },
});



