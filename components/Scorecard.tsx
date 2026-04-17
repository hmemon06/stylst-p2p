import { LinearGradient } from 'expo-linear-gradient';
import React from 'react';
import { Image, StyleSheet, Text, View, ViewStyle, StyleProp } from 'react-native';
import Svg, { Circle, Defs, LinearGradient as SvgLinearGradient, Stop } from 'react-native-svg';

import { Spacing, scaleFont, scaleSize } from '@/constants/Spacing';
import { RatingResult } from '@/lib/rater';

const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value));

const subscoreOrder = ['colorCoordination', 'proportions', 'fit'] as const;

type ScorecardProps = {
  imageUri?: string | null;
  result: RatingResult;
  style?: StyleProp<ViewStyle>;
};

export function Scorecard({ imageUri, result, style }: ScorecardProps) {
  const getOrderIndex = (key: string) => {
    const index = subscoreOrder.indexOf(key as (typeof subscoreOrder)[number]);
    return index === -1 ? Number.MAX_SAFE_INTEGER : index;
  };

  const subscores = [...result.subscores].sort((a, b) => getOrderIndex(a.key) - getOrderIndex(b.key));

  return (
    <LinearGradient
      colors={['#FFFFFF', '#E6F5F1']}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={[styles.container, style]}
    >
      <View style={styles.inner}>
        <View style={styles.headerRow}>
          <View
            style={styles.overallBlock}
            accessible
            accessibilityLabel={`Overall style score ${Math.round(result.overall.score)} out of 100. ${result.overall.label}`}
          >
            <View style={styles.gaugeWrapper}>
              <ScoreGauge score={result.overall.score} />
              <Text style={styles.scoreValue}>{Math.round(result.overall.score)}</Text>
            </View>
            <Text style={styles.overallLabel}>Overall Score</Text>
            <Text style={styles.overallDescriptor}>{result.overall.label}</Text>
          </View>
          {imageUri ? (
            <Image
              source={{ uri: imageUri }}
              style={styles.photo}
              accessibilityRole="image"
              accessibilityLabel="Outfit photo used for scoring"
              resizeMode="cover"
            />
          ) : (
            <View style={styles.photoPlaceholder} />
          )}
        </View>

        <View style={styles.section}>
          {subscores.map(item => (
            <View
              key={item.key}
              style={styles.breakdownItem}
              accessible
              accessibilityLabel={`${item.label}: ${Math.round(item.score)} out of 100`}
            >
              <View style={styles.breakdownHeader}>
                <Text style={styles.breakdownLabel}>{item.label}</Text>
                <Text style={styles.breakdownScore}>{Math.round(item.score)}</Text>
              </View>
              <View style={styles.breakdownBarTrack}>
                <View style={[styles.breakdownBarFill, { width: `${clamp(item.score, 0, 100)}%` }]} />
              </View>
            </View>
          ))}
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>AI Feedback</Text>
          <Text style={styles.feedbackText}>{result.feedback}</Text>
        </View>

         {result.subscores && result.subscores.length > 0 && (
           <View style={styles.section}>
             <Text style={styles.sectionTitle}>Insights</Text>
             {result.subscores.map((subscore, index) => (
               <Text key={`${subscore.key}-${index}`} style={styles.suggestionItem}>
                 • {subscore.insight}
               </Text>
             ))}
           </View>
         )}
      </View>
    </LinearGradient>
  );
}

function ScoreGauge({ score }: { score: number }) {
  const radius = scaleSize(70);
  const strokeWidth = Math.max(scaleSize(12), 10);
  const normalizedRadius = radius - strokeWidth / 2;
  const circumference = 2 * Math.PI * normalizedRadius;
  const clampedScore = clamp(score, 0, 100);
  const progress = (clampedScore / 100) * circumference;

  return (
    <Svg width={radius * 2} height={radius * 2}>
      <Defs>
        <SvgLinearGradient id="gaugeGradient" x1="0" y1="1" x2="1" y2="0">
          <Stop offset="0%" stopColor="#C8E3DC" />
          <Stop offset="100%" stopColor="#3CBA9A" />
        </SvgLinearGradient>
      </Defs>
      <Circle
        cx={radius}
        cy={radius}
        r={normalizedRadius}
        stroke="#E1F1EB"
        strokeWidth={strokeWidth}
        fill="none"
      />
      <Circle
        cx={radius}
        cy={radius}
        r={normalizedRadius}
        stroke="url(#gaugeGradient)"
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        fill="none"
        strokeDasharray={`${circumference} ${circumference}`}
        strokeDashoffset={circumference - progress}
        rotation="-90"
        originX={radius}
        originY={radius}
      />
    </Svg>
  );
}

const styles = StyleSheet.create({
  container: {
    borderRadius: scaleSize(24),
    padding: Spacing.adaptive.cardPadding,
    width: '100%',
  },
  inner: {
    borderRadius: scaleSize(20),
    padding: Spacing.adaptive.cardPadding,
    backgroundColor: 'rgba(255,255,255,0.72)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.16,
    shadowRadius: 12,
    elevation: 6,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: Spacing.md,
  },
  overallBlock: {
    flex: 1,
    alignItems: 'center',
  },
  gaugeWrapper: {
    width: scaleSize(140),
    height: scaleSize(140),
    alignItems: 'center',
    justifyContent: 'center',
  },
  scoreValue: {
    position: 'absolute',
    fontFamily: 'Satoshi',
    fontSize: scaleFont(36),
    fontWeight: '700',
    color: '#2F8D73',
  },
  overallLabel: {
    marginTop: Spacing.sm,
    fontFamily: 'Satoshi',
    color: '#48675E',
    fontSize: scaleFont(16),
  },
  overallDescriptor: {
    marginTop: Spacing.xs,
    fontFamily: 'Satoshi',
    color: '#1F4034',
    fontSize: scaleFont(18),
    fontWeight: '700',
    textAlign: 'center',
  },
  photo: {
    width: scaleSize(140),
    height: scaleSize(180),
    borderRadius: scaleSize(18),
    borderWidth: 1,
    borderColor: '#FFFFFF',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.18,
    shadowRadius: 6,
    elevation: 5,
  },
  photoPlaceholder: {
    width: scaleSize(140),
    height: scaleSize(180),
    borderRadius: scaleSize(18),
    borderWidth: 1,
    borderColor: '#D6EAE3',
    backgroundColor: '#F0F8F5',
  },
  section: {
    marginTop: Spacing.sm,
  },
  sectionTitle: {
    fontFamily: 'Satoshi',
    fontSize: scaleFont(16),
    fontWeight: '700',
    color: '#2F5C4D',
    marginBottom: Spacing.xs,
  },
  breakdownItem: {
    marginBottom: Spacing.xs,
  },
  breakdownHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  breakdownLabel: {
    fontFamily: 'Satoshi',
    color: '#335E52',
    fontSize: scaleFont(14),
  },
  breakdownScore: {
    fontFamily: 'Satoshi',
    color: '#2F8D73',
    fontSize: scaleFont(14),
    fontWeight: '700',
  },
  breakdownBarTrack: {
    height: scaleSize(8),
    borderRadius: scaleSize(8),
    backgroundColor: '#DCEDE7',
    overflow: 'hidden',
    marginTop: Spacing.xs,
  },
  breakdownBarFill: {
    height: '100%',
    borderRadius: scaleSize(8),
    backgroundColor: '#3CBA9A',
  },
  breakdownInsight: {
    fontFamily: 'Satoshi',
    color: '#4A6A60',
    fontSize: scaleFont(13),
    marginTop: Spacing.xs,
  },
  feedbackText: {
    fontFamily: 'Satoshi',
    color: '#254336',
    fontSize: scaleFont(15),
    lineHeight: Math.round(scaleFont(15) * 1.35),
  },
  suggestionItem: {
    fontFamily: 'Satoshi',
    color: '#335E52',
    fontSize: scaleFont(14),
    lineHeight: Math.round(scaleFont(14) * 1.4),
  },
});
