import React, { useEffect, useRef, useState } from 'react';
import { View, Image, Dimensions, Animated, Easing } from 'react-native';

const { width, height } = Dimensions.get('window');

interface OnboardingImagesProps {
  currentIndex: number;
  isVisible: boolean;
}

const OnboardingImages: React.FC<OnboardingImagesProps> = ({ currentIndex, isVisible }) => {
  // Use running/jogging image for all onboarding pages
  const runningImage = require('../../assets/images/running.png');
  
  // Fade transition animation for smooth page changes
  const fadeAnim = useRef(new Animated.Value(1)).current;
  
  // Floating animation
  const floatingAnim = useRef(new Animated.Value(0)).current;
  
  // State to track when images are properly loaded
  const [imagesLoaded, setImagesLoaded] = useState(false);
  
  useEffect(() => {
    const timer = setTimeout(() => {
      setImagesLoaded(true);
    }, 50);
    
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    // Create floating animation
    const createFloatingAnimation = (animValue: Animated.Value) => {
      Animated.loop(
        Animated.sequence([
          Animated.timing(animValue, {
            toValue: 1,
            duration: 2000,
            useNativeDriver: true,
          }),
          Animated.timing(animValue, {
            toValue: 0,
            duration: 2000,
            useNativeDriver: true,
          }),
        ])
      ).start();
    };

    createFloatingAnimation(floatingAnim);
  }, []);

  // Fade transition when currentIndex changes
  useEffect(() => {
    Animated.timing(fadeAnim, {
      toValue: 0,
      duration: 50,
      useNativeDriver: true,
      easing: Easing.out(Easing.quad),
    }).start(() => {
      setTimeout(() => {
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: 200,
          useNativeDriver: true,
          easing: Easing.in(Easing.quad),
        }).start();
      }, 100);
    });
  }, [currentIndex]);

  if (!imagesLoaded) {
    return null;
  }

  // Show running image on all onboarding pages
  return (
    <Animated.View style={{
      position: 'absolute',
      top: -(height * 0.2), // Move up by 20% of screen height
      left: 0,
      right: 0,
      bottom: 0,
      zIndex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      opacity: fadeAnim,
    }}>
      <Animated.View style={{
        transform: [{
          translateY: floatingAnim.interpolate({
            inputRange: [0, 1],
            outputRange: [0, -20],
          })
        }]
      }}>
        <Image 
          source={runningImage} 
          style={{ 
            width: width * 0.9,
            height: height * 0.6,
            resizeMode: 'contain',
            shadowColor: '#000',
            shadowOffset: { width: 0, height: 4 },
            shadowOpacity: 0.3,
            shadowRadius: 12,
          }} 
        />
      </Animated.View>
    </Animated.View>
  );
};

export default OnboardingImages;
