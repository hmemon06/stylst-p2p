import React from 'react';
import { StyleSheet, View } from 'react-native';

interface ProgressBarProps {
  progress: number; // 0-100
}

export function ProgressBar({ progress }: ProgressBarProps) {
  return (
    <View style={styles.progressWrap}>
      <View style={styles.progressBg} />
      <View style={[styles.progressFill, { width: `${Math.min(100, Math.max(0, progress))}%` }]} />
    </View>
  );
}

const styles = StyleSheet.create({
  progressWrap: {
    position: 'relative',
    height: 24,
    justifyContent: 'center',
    marginBottom: 20,
    marginTop: 20,
    marginHorizontal: 24,
  },
  progressBg: {
    position: 'absolute',
    left: 0,
    right: 0,
    height: 4,
    borderRadius: 2,
    backgroundColor: 'rgba(255,255,255,0.15)',
  },
  progressFill: {
    position: 'absolute',
    left: 0,
    height: 4,
    borderRadius: 2,
    backgroundColor: 'rgba(255,255,255,0.8)',
  },
});
