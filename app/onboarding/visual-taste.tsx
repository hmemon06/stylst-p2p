import { ProgressBar } from '@/components/ProgressBar';
import { useOnboarding } from '@/lib/onboardingContext';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import React, { useCallback, useMemo, useState } from 'react';
import { Dimensions, Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { Gesture, GestureDetector, GestureHandlerRootView } from 'react-native-gesture-handler';
import Animated, {
    Extrapolation,
    interpolate,
    runOnJS,
    useAnimatedStyle,
    useDerivedValue,
    useSharedValue,
    withSpring
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const SCREEN_WIDTH = Dimensions.get('window').width;
const SWIPE_THRESHOLD = SCREEN_WIDTH * 0.3;

const styleOptionsData = {
  default: [
    {
      id: 'y2k',
      name: 'Y2K',
      image: require('../../assets/images/womens/womens-y2k.jpg'),
      description: '2000s nostalgia, baby tees & bling'
    },
    {
      id: 'streetwear',
      name: 'Streetwear',
      image: require('../../assets/images/womens/womens-streetwear.jpg'),
      description: 'Oversized fits, sneakers & hype'
    },
    {
      id: 'old-money',
      name: 'Old Money',
      image: require('../../assets/images/womens/women-old-money.jpg'),
      description: 'Quiet luxury, linen & loafers'
    },
    {
      id: 'gorpcore',
      name: 'Gorpcore',
      image: require('../../assets/images/womens/womens-gorpcore.jpg'),
      description: 'Functional outdoor gear as fashion'
    },
    {
      id: 'coquette',
      name: 'Coquette',
      image: require('../../assets/images/womens/womens-coquette.jpg'),
      description: 'Bows, lace, pearls & soft pinks'
    },
    {
      id: 'grunge',
      name: 'Grunge',
      image: require('../../assets/images/womens/womens-grunge.jpg'),
      description: 'Flannel, distressed denim & boots'
    },
    {
      id: 'acubi',
      name: 'Acubi',
      image: require('../../assets/images/womens/womens-acubi.jpg'),
      description: 'Minimalist Y2K, subversive basics'
    },
    {
      id: 'opium',
      name: 'Opium',
      image: require('../../assets/images/womens/womens-opium.jpg'),
      description: 'Dark, avant-garde & leather'
    },
    {
      id: 'minimalist',
      name: 'Minimalist',
      image: require('../../assets/images/womens/womens-minimalist.jpg'),
      description: 'Clean lines, neutral tones & simplicity'
    },
  ],
  male: [
    {
      id: 'y2k',
      name: 'Y2K',
      image: require('../../assets/images/mens/mens-y2k.jpg'),
      description: '2000s nostalgia, baggy & retro'
    },
    {
      id: 'streetwear',
      name: 'Streetwear',
      image: require('../../assets/images/mens/mens-streetwear.jpg'),
      description: 'Oversized fits, sneakers & hype'
    },
    {
      id: 'old-money',
      name: 'Old Money',
      image: require('../../assets/images/mens/mens-old-money.jpg'),
      description: 'Quiet luxury, polos & loafers'
    },
    {
      id: 'gorpcore',
      name: 'Gorpcore',
      image: require('../../assets/images/mens/mens-gorpcore.jpg'),
      description: 'Functional outdoor gear as fashion'
    },
    {
      id: 'coquette',
      name: 'Soft Boy',
      image: require('../../assets/images/mens/mens-coquette-or-soft-boy.jpg'),
      description: 'Romantic, vintage & soft textures'
    },
    {
      id: 'grunge',
      name: 'Grunge',
      image: require('../../assets/images/mens/mens-grunge.jpg'),
      description: 'Flannel, distressed denim & boots'
    },
    {
      id: 'acubi',
      name: 'Acubi',
      image: require('../../assets/images/mens/mens-acubi.jpg'),
      description: 'Minimalist Y2K, subversive basics'
    },
    {
      id: 'opium',
      name: 'Opium',
      image: require('../../assets/images/mens/mens-opium.jpg'),
      description: 'Dark, avant-garde & leather'
    },
    {
      id: 'minimalist',
      name: 'Minimalist',
      image: require('../../assets/images/mens/mens-minimalist.jpg'),
      description: 'Clean lines, neutral tones & simplicity'
    },
  ]
};

interface SwipeableCardProps {
  styleOption: typeof styleOptionsData.default[0];
  onSwipe: (direction: 'left' | 'right') => void;
  index: number;
  totalCards: number;
}

const SwipeableCard = ({ styleOption, onSwipe, index, totalCards }: SwipeableCardProps) => {
  const translateX = useSharedValue(0);
  const translateY = useSharedValue(0);
  const rotate = useDerivedValue(() => {
    return interpolate(translateX.value, [-SCREEN_WIDTH, 0, SCREEN_WIDTH], [-15, 0, 15]);
  });

  const pan = Gesture.Pan()
    .onUpdate((event) => {
      translateX.value = event.translationX;
      translateY.value = event.translationY;
    })
    .onEnd((event) => {
      if (Math.abs(event.translationX) > SWIPE_THRESHOLD) {
        const direction = event.translationX > 0 ? 'right' : 'left';
        translateX.value = withSpring(direction === 'right' ? SCREEN_WIDTH * 1.5 : -SCREEN_WIDTH * 1.5);
        runOnJS(onSwipe)(direction);
      } else {
        translateX.value = withSpring(0);
        translateY.value = withSpring(0);
      }
    });

  const animatedStyle = useAnimatedStyle(() => {
    return {
      transform: [
        { translateX: translateX.value },
        { translateY: translateY.value },
        { rotate: `${rotate.value}deg` },
      ],
    };
  });

  const likeOpacity = useAnimatedStyle(() => {
    return {
      opacity: interpolate(translateX.value, [0, SCREEN_WIDTH / 4], [0, 1], Extrapolation.CLAMP),
    };
  });

  const nopeOpacity = useAnimatedStyle(() => {
    return {
      opacity: interpolate(translateX.value, [0, -SCREEN_WIDTH / 4], [0, 1], Extrapolation.CLAMP),
    };
  });

  return (
    <GestureDetector gesture={pan}>
      <Animated.View style={[styles.card, animatedStyle, { zIndex: totalCards - index }]}>
        <View style={styles.cardContent}>
          <Image
            source={styleOption.image}
            style={styles.cardImage}
            resizeMode="cover"
          />
          <LinearGradient
            colors={['transparent', 'rgba(0,0,0,0.8)']}
            style={StyleSheet.absoluteFillObject}
          />

          <View style={styles.cardTextContainer}>
            <Text style={styles.cardText}>{styleOption.name}</Text>
            <Text style={styles.cardDescription}>{styleOption.description}</Text>
          </View>

          <Animated.View style={[styles.overlayLabel, styles.likeLabel, likeOpacity]}>
            <Text style={styles.overlayLabelText}>LIKE</Text>
          </Animated.View>

          <Animated.View style={[styles.overlayLabel, styles.nopeLabel, nopeOpacity]}>
            <Text style={styles.overlayLabelText}>NOPE</Text>
          </Animated.View>
        </View>
      </Animated.View>
    </GestureDetector>
  );
};

export default function VisualTasteScreen() {
  const router = useRouter();
  const { data, updateData } = useOnboarding();
  const [selectedStyles, setSelectedStyles] = useState<string[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const insets = useSafeAreaInsets();

  const styleOptions = useMemo(() => {
    if (data.identity === 'Man') {
      return styleOptionsData.male;
    }
    return styleOptionsData.default;
  }, [data.identity]);

  const handleSwipe = useCallback((direction: 'left' | 'right') => {
    const currentStyle = styleOptions[currentIndex];

    if (direction === 'right') {
      setSelectedStyles(prev => [...prev, currentStyle.id]);
    }

    // Delay moving to next card slightly to allow animation to complete
    setTimeout(() => {
      setCurrentIndex(prev => prev + 1);
    }, 200);
  }, [currentIndex, styleOptions]);

  const canContinue = selectedStyles.length >= 2;
  const isFinished = currentIndex >= styleOptions.length;

  return (
    <GestureHandlerRootView style={styles.container}>
      <View style={styles.content}>
        <Pressable
          onPress={() => router.back()}
          style={[styles.backLink, { top: insets.top + 10 }]}
          accessibilityRole="button"
          accessibilityLabel="Go back"
        >
          <Text style={styles.backText}>{'← Back'}</Text>
        </Pressable>

        <ProgressBar progress={35} />

        <Text style={styles.title}>Tap the styles you like.</Text>
        <Text style={styles.subtitle}>Swipe right to like, left to pass.</Text>

        <View style={styles.cardContainer}>
          {styleOptions.map((style, index) => {
            if (index < currentIndex) return null;
            return (
              <SwipeableCard
                key={style.id}
                styleOption={style}
                onSwipe={handleSwipe}
                index={index}
                totalCards={styleOptions.length}
              />
            );
          }).reverse()}

          {isFinished && (
            <View style={styles.finishedContainer}>
              <Text style={styles.finishedText}>All done!</Text>
              <Text style={styles.finishedSubtext}>You selected {selectedStyles.length} styles.</Text>
            </View>
          )}
        </View>

        <Text style={styles.instruction}>
          {selectedStyles.length < 2
            ? `Select ${2 - selectedStyles.length} more style${2 - selectedStyles.length === 1 ? '' : 's'}`
            : `${selectedStyles.length} selected`
          }
        </Text>

        <Pressable
          style={[styles.cta, (!canContinue && !isFinished) && styles.ctaDisabled]}
          disabled={!canContinue && !isFinished}
          onPress={() => {
            updateData('visualTasteResults', selectedStyles);
            router.push('/onboarding/color-profile');
          }}
        >
          <BlurView intensity={40} tint="dark" style={styles.ctaBlur} pointerEvents="none">
            <View style={styles.ctaInner}>
              <Text style={styles.ctaText}>Continue</Text>
            </View>
          </BlurView>
        </Pressable>
      </View>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000000',
  },
  content: {
    flex: 1,
    paddingHorizontal: 24,
    paddingTop: 80,
  },
  backLink: {
    position: 'absolute',
    left: 16,
    paddingVertical: 8,
    paddingHorizontal: 8,
    zIndex: 10,
  },
  backText: {
    color: 'rgba(255,255,255,0.6)',
    fontFamily: 'Satoshi',
    fontSize: 16,
  },
  title: {
    color: '#FFFFFF',
    fontSize: 32,
    fontWeight: '700',
    fontFamily: 'BodoniModa',
    marginBottom: 8,
    textAlign: 'center',
  },
  subtitle: {
    color: 'rgba(255,255,255,0.6)',
    fontSize: 16,
    fontFamily: 'Satoshi',
    marginBottom: 32,
    textAlign: 'center',
  },
  cardContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
    minHeight: 400,
  },
  card: {
    position: 'absolute',
    width: '90%',
    height: '80%',
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.1)',
    shadowColor: "#000",
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
  },
  cardContent: {
    flex: 1,
    width: '100%',
    height: '100%',
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
    overflow: 'hidden',
    backgroundColor: 'rgba(255,255,255,0.05)',
  },
  cardImage: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    width: '100%',
    height: '100%',
    borderRadius: 20,
  },
  cardTextContainer: {
    position: 'absolute',
    bottom: 40,
    left: 20,
    right: 20,
  },
  cardText: {
    color: '#FFFFFF',
    fontSize: 36,
    fontFamily: 'BodoniModa',
    fontWeight: '700',
    marginBottom: 8,
    textShadowColor: 'rgba(0,0,0,0.5)',
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 4,
  },
  cardDescription: {
    color: 'rgba(255,255,255,0.8)',
    fontSize: 18,
    fontFamily: 'Satoshi',
    fontWeight: '500',
    textShadowColor: 'rgba(0,0,0,0.5)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
  overlayLabel: {
    position: 'absolute',
    top: 40,
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderWidth: 4,
    borderRadius: 10,
    transform: [{ rotate: '-15deg' }],
  },
  likeLabel: {
    left: 40,
    borderColor: '#4CD964',
  },
  nopeLabel: {
    right: 40,
    borderColor: '#FF3B30',
    transform: [{ rotate: '15deg' }],
  },
  overlayLabelText: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#FFFFFF',
  },
  finishedContainer: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  finishedText: {
    fontSize: 24,
    fontWeight: 'bold',
    fontFamily: 'BodoniModa',
    color: '#FFFFFF',
    marginBottom: 10,
  },
  finishedSubtext: {
    fontSize: 16,
    color: 'rgba(255,255,255,0.6)',
  },
  instruction: {
    color: 'rgba(255,255,255,0.6)',
    fontSize: 14,
    fontFamily: 'Satoshi',
    textAlign: 'center',
    marginBottom: 20,
    marginTop: 20,
  },
  cta: {
    height: 56,
    borderRadius: 28,
    overflow: 'hidden',
    marginTop: 'auto',
    marginBottom: 32,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
  },
  ctaDisabled: {
    opacity: 0.4,
  },
  ctaBlur: {
    flex: 1,
  },
  ctaInner: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.1)',
  },
  ctaText: {
    color: '#FFFFFF',
    fontFamily: 'Satoshi',
    fontSize: 18,
    fontWeight: '700',
  },
});
