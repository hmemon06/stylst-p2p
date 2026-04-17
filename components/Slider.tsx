import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

interface SliderProps {
  value: number; // 0.0 to 1.0
  onValueChange: (value: number) => void;
  leftLabel: string;
  rightLabel: string;
}

export function Slider({ value, onValueChange, leftLabel, rightLabel }: SliderProps) {
  const handlePress = (newValue: number) => {
    onValueChange(newValue);
  };

  return (
    <View style={styles.container}>
      <View style={styles.sliderContainer}>
        <Text style={styles.label}>{leftLabel}</Text>
        <View style={styles.sliderTrack}>
          <View style={[styles.sliderFill, { width: `${value * 100}%` }]} />
          <View style={[styles.sliderThumb, { left: `${value * 100}%` }]} />
        </View>
        <Text style={styles.label}>{rightLabel}</Text>
      </View>
      
      <View style={styles.buttonContainer}>
        <Pressable style={styles.button} onPress={() => handlePress(0)}>
          <Text style={styles.buttonText}>0%</Text>
        </Pressable>
        <Pressable style={styles.button} onPress={() => handlePress(0.25)}>
          <Text style={styles.buttonText}>25%</Text>
        </Pressable>
        <Pressable style={styles.button} onPress={() => handlePress(0.5)}>
          <Text style={styles.buttonText}>50%</Text>
        </Pressable>
        <Pressable style={styles.button} onPress={() => handlePress(0.75)}>
          <Text style={styles.buttonText}>75%</Text>
        </Pressable>
        <Pressable style={styles.button} onPress={() => handlePress(1)}>
          <Text style={styles.buttonText}>100%</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: '100%',
  },
  sliderContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
  },
  label: {
    fontSize: 14,
    fontFamily: 'Satoshi',
    color: 'rgba(255,255,255,0.7)',
    fontWeight: '600',
  },
  sliderTrack: {
    height: 6,
    backgroundColor: 'rgba(255,255,255,0.15)',
    borderRadius: 3,
    flex: 1,
    marginHorizontal: 20,
    position: 'relative',
  },
  sliderFill: {
    height: '100%',
    borderRadius: 3,
    backgroundColor: 'rgba(255,255,255,0.8)',
  },
  sliderThumb: {
    position: 'absolute',
    width: 24,
    height: 24,
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.3)',
    top: -9,
    marginLeft: -12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 4,
  },
  buttonContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 20,
    paddingHorizontal: 20,
  },
  button: {
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
    borderRadius: 16,
    paddingVertical: 8,
    paddingHorizontal: 12,
  },
  buttonText: {
    fontSize: 12,
    fontFamily: 'Satoshi',
    color: 'rgba(255,255,255,0.8)',
    fontWeight: '600',
  },
});
