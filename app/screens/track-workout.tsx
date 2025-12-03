import React, { useState, useEffect, useRef } from 'react';
import { View, StyleSheet, Dimensions, TouchableOpacity, Animated, Alert, Modal, TextInput } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Feather } from '@expo/vector-icons';
import { useRouter, useLocalSearchParams } from 'expo-router';
import CustomText from '../../components/CustomText';
import { auth, db } from '../../firebase/config';
import { collection, addDoc, Timestamp } from 'firebase/firestore';
import * as Haptics from 'expo-haptics';
import {
  useFonts,
  Figtree_300Light,
  Figtree_400Regular,
  Figtree_500Medium,
  Figtree_600SemiBold,
  Figtree_700Bold,
  Figtree_800ExtraBold,
  Figtree_900Black,
} from '@expo-google-fonts/figtree';

const { width, height } = Dimensions.get('window');

const EVENT_NAMES: { [key: string]: string } = {
  'sprint-100m': '100m Sprint',
  'sprint-200m': '200m Sprint',
  'sprint-400m': '400m Sprint',
  'distance-800m': '800m',
  'distance-1500m': '1500m',
  'distance-5000m': '5000m',
  'hurdles-110m': '110m Hurdles',
  'hurdles-400m': '400m Hurdles',
  'field-long-jump': 'Long Jump',
  'field-high-jump': 'High Jump',
  'field-shot-put': 'Shot Put',
  'field-discus': 'Discus',
};

export default function TrackWorkoutScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const eventId = params.event as string;
  const eventName = EVENT_NAMES[eventId] || 'Workout';

  const [countdown, setCountdown] = useState<number | null>(null);
  const [isActive, setIsActive] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [elapsedTime, setElapsedTime] = useState(0); // in seconds with decimal precision
  const [steps, setSteps] = useState(0);
  const [distance, setDistance] = useState(0); // in meters
  const [pace, setPace] = useState(0); // seconds per meter
  const [showStepsInput, setShowStepsInput] = useState(false);
  const [stepsInput, setStepsInput] = useState('');
  const [isPredefinedRun, setIsPredefinedRun] = useState(false);
  const [fontsLoaded] = useFonts({
    Figtree_300Light,
    Figtree_400Regular,
    Figtree_500Medium,
    Figtree_600SemiBold,
    Figtree_700Bold,
    Figtree_800ExtraBold,
    Figtree_900Black,
  });

  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const startTimeRef = useRef<number>(0);
  const pausedTimeRef = useRef<number>(0);
  const countdownAnim = useRef(new Animated.Value(1)).current;
  const scaleAnim = useRef(new Animated.Value(1)).current;

  // Extract distance from eventId for predefined runs
  useEffect(() => {
    const distanceMatch = eventId.match(/(\d+)m/);
    if (distanceMatch) {
      const extractedDistance = parseFloat(distanceMatch[1]);
      setDistance(extractedDistance);
      setIsPredefinedRun(true);
    }
  }, [eventId]);

  useEffect(() => {
    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
    };
  }, []);

  useEffect(() => {
    if (isActive && !isPaused) {
      timerRef.current = setInterval(() => {
        const now = Date.now();
        const elapsed = (now - startTimeRef.current + pausedTimeRef.current) / 1000; // Keep decimal precision for milliseconds
        setElapsedTime(elapsed);
        
        // Calculate pace (seconds per meter) if distance > 0
        if (distance > 0) {
          setPace(elapsed / distance);
        }
      }, 10); // Update every 10ms for smoother millisecond display
    } else {
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
    }

    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
    };
  }, [isActive, isPaused, distance]);

  const startCountdown = () => {
    setCountdown(3);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    
    const countdownInterval = setInterval(() => {
      setCountdown((prev) => {
        if (prev === null) return null;
        if (prev === 1) {
          clearInterval(countdownInterval);
          startWorkout();
          return null;
        }
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
        
        // Animate countdown
        Animated.sequence([
          Animated.timing(scaleAnim, {
            toValue: 1.5,
            duration: 200,
            useNativeDriver: true,
          }),
          Animated.timing(scaleAnim, {
            toValue: 1,
            duration: 200,
            useNativeDriver: true,
          }),
        ]).start();
        
        return prev - 1;
      });
    }, 1000);
  };

  const startWorkout = () => {
    setIsActive(true);
    setIsPaused(false);
    startTimeRef.current = Date.now();
    pausedTimeRef.current = 0;
    setElapsedTime(0.0);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  };

  const pauseWorkout = () => {
    setIsPaused(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  };

  const resumeWorkout = () => {
    setIsPaused(false);
    startTimeRef.current = Date.now() - (elapsedTime * 1000) + pausedTimeRef.current;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  };

  const stopWorkout = () => {
    // Stop the timer immediately
    setIsActive(false);
    setIsPaused(false);
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    
    // Show steps input modal for running events
    if (eventId.includes('sprint') || eventId.includes('distance') || eventId.includes('hurdles')) {
      setShowStepsInput(true);
    } else {
      // For field events, just confirm
      Alert.alert(
        'End Workout',
        'Are you sure you want to end this workout?',
        [
          { text: 'Cancel', style: 'cancel', onPress: () => {
            // Resume timer if cancelled
            setIsActive(true);
            startTimeRef.current = Date.now() - (elapsedTime * 1000) + pausedTimeRef.current;
          }},
          {
            text: 'End',
            style: 'destructive',
            onPress: async () => {
              await saveWorkout();
              router.back();
            },
          },
        ]
      );
    }
  };

  const handleStepsInputConfirm = () => {
    const stepsValue = parseInt(stepsInput) || 0;
    setSteps(stepsValue);
    setShowStepsInput(false);
    
    // Save and navigate
    saveWorkout().then(() => {
      router.back();
    }).catch((error) => {
      console.error('Error saving workout:', error);
    });
  };

  const handleStepsInputCancel = () => {
    setShowStepsInput(false);
    // Resume timer if cancelled
    setIsActive(true);
    startTimeRef.current = Date.now() - (elapsedTime * 1000) + pausedTimeRef.current;
  };

  const saveWorkout = async () => {
    const user = auth.currentUser;
    if (!user) return;

    try {
      // Calculate result based on event type
      let result = 0;
      if (eventId.includes('sprint') || eventId.includes('distance') || eventId.includes('hurdles')) {
        // For running events, use elapsed time
        result = elapsedTime;
      } else if (eventId.includes('field') || eventId.includes('jump') || eventId.includes('put') || eventId.includes('discus')) {
        // For field events, use distance
        result = distance;
      }

      await addDoc(collection(db, 'workouts'), {
        userId: user.uid,
        eventId: eventId,
        eventName: eventName,
        result: result,
        duration: elapsedTime,
        steps: steps,
        distance: distance,
        pace: pace > 0 ? pace : null,
        timestamp: Timestamp.now(),
        createdAt: Timestamp.now(),
      });

      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (error) {
      console.error('Error saving workout:', error);
      Alert.alert('Error', 'Failed to save workout. Please try again.');
    }
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    const ms = Math.floor((seconds % 1) * 1000); // Get milliseconds (0-999)
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}.${ms.toString().padStart(3, '0')}`;
  };


  if (!fontsLoaded) {
    return null;
  }

  // Countdown screen
  if (countdown !== null) {
    return (
      <View style={styles.container}>
        <LinearGradient
          colors={['#0A0A0A', '#1A1A1A', '#0A0A0A']}
          style={StyleSheet.absoluteFill}
        />
        <SafeAreaView style={styles.safeArea}>
          <View style={styles.countdownContainer}>
            <Animated.View style={[styles.countdownCircle, { transform: [{ scale: scaleAnim }] }]}>
              <CustomText variant="title" weight="bold" fontFamily="figtree" style={styles.countdownText}>
                {countdown}
              </CustomText>
            </Animated.View>
            <CustomText variant="body" weight="medium" fontFamily="figtree" style={styles.countdownSubtext}>
              Get ready!
            </CustomText>
          </View>
        </SafeAreaView>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <LinearGradient
        colors={['#0A0A0A', '#1A1A1A', '#0A0A0A']}
        style={StyleSheet.absoluteFill}
      />
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.content}>
          {/* Header */}
          <View style={styles.header}>
            <TouchableOpacity
              style={styles.closeButton}
              onPress={stopWorkout}
            >
              <Feather name="x" size={24} color="#ECEDEE" />
            </TouchableOpacity>
            <CustomText variant="subtitle" weight="bold" fontFamily="figtree" style={styles.eventName}>
              {eventName}
            </CustomText>
            <View style={{ width: 24 }} />
          </View>

          {/* Timer */}
          <View style={styles.timerContainer}>
            <View style={styles.timerWrapper}>
              <CustomText variant="title" weight="bold" fontFamily="figtree" style={styles.timer}>
                {formatTime(elapsedTime)}
              </CustomText>
            </View>
            {isPaused && (
              <CustomText variant="body" weight="medium" fontFamily="figtree" style={styles.pausedText}>
                PAUSED
              </CustomText>
            )}
          </View>

          {/* Metrics */}
          <View style={styles.metricsContainer}>
            {/* Steps - Only show if already entered */}
            {steps > 0 && (
              <View style={styles.metricCard}>
                <View style={styles.metricHeader}>
                  <Feather name="activity" size={20} color="#FF6B35" />
                  <CustomText variant="caption" weight="medium" fontFamily="figtree" style={styles.metricLabel}>
                    Steps
                  </CustomText>
                </View>
                <View style={styles.metricValueContainer}>
                  <CustomText variant="title" weight="bold" fontFamily="figtree" style={styles.metricValue}>
                    {steps}
                  </CustomText>
                </View>
              </View>
            )}

            {/* Distance */}
            <View style={styles.metricCard}>
              <View style={styles.metricHeader}>
                <Feather name="navigation" size={20} color="#FF6B35" />
                <CustomText variant="caption" weight="medium" fontFamily="figtree" style={styles.metricLabel}>
                  Distance (m)
                </CustomText>
              </View>
              <View style={styles.metricValueContainer}>
                {isPredefinedRun ? (
                  <CustomText variant="title" weight="bold" fontFamily="figtree" style={styles.metricValue}>
                    {distance.toFixed(0)}
                  </CustomText>
                ) : (
                  <>
                    <TouchableOpacity
                      style={styles.metricButton}
                      onPress={() => setDistance(prev => Math.max(0, prev - 1))}
                      disabled={!isActive}
                    >
                      <Feather name="minus" size={20} color="#ECEDEE" />
                    </TouchableOpacity>
                    <CustomText variant="title" weight="bold" fontFamily="figtree" style={styles.metricValue}>
                      {distance.toFixed(1)}
                    </CustomText>
                    <TouchableOpacity
                      style={styles.metricButton}
                      onPress={() => setDistance(prev => prev + 0.1)}
                      disabled={!isActive}
                    >
                      <Feather name="plus" size={20} color="#ECEDEE" />
                    </TouchableOpacity>
                  </>
                )}
              </View>
            </View>

            {/* Pace */}
            {pace > 0 && (
              <View style={styles.metricCard}>
                <View style={styles.metricHeader}>
                  <Feather name="clock" size={20} color="#FF6B35" />
                  <CustomText variant="caption" weight="medium" fontFamily="figtree" style={styles.metricLabel}>
                    Pace (s/m)
                  </CustomText>
                </View>
                <CustomText variant="title" weight="bold" fontFamily="figtree" style={styles.metricValue}>
                  {pace.toFixed(2)}
                </CustomText>
              </View>
            )}
          </View>

          {/* Control Buttons */}
          <View style={styles.controlsContainer}>
            {!isActive ? (
              <TouchableOpacity
                style={styles.startButton}
                onPress={startCountdown}
              >
                <Feather name="play" size={32} color="white" />
                <CustomText variant="body" weight="bold" fontFamily="figtree" style={styles.startButtonText}>
                  Start Workout
                </CustomText>
              </TouchableOpacity>
            ) : (
              <View style={styles.controlButtons}>
                {isPaused ? (
                  <TouchableOpacity
                    style={styles.resumeButton}
                    onPress={resumeWorkout}
                  >
                    <Feather name="play" size={24} color="white" />
                    <CustomText variant="body" weight="bold" fontFamily="figtree" style={styles.controlButtonText}>
                      Resume
                    </CustomText>
                  </TouchableOpacity>
                ) : (
                  <TouchableOpacity
                    style={styles.pauseButton}
                    onPress={pauseWorkout}
                  >
                    <Feather name="pause" size={24} color="white" />
                    <CustomText variant="body" weight="bold" fontFamily="figtree" style={styles.controlButtonText}>
                      Pause
                    </CustomText>
                  </TouchableOpacity>
                )}
                <TouchableOpacity
                  style={styles.stopButton}
                  onPress={stopWorkout}
                >
                  <Feather name="square" size={24} color="white" />
                  <CustomText variant="body" weight="bold" fontFamily="figtree" style={styles.controlButtonText}>
                    Stop
                  </CustomText>
                </TouchableOpacity>
              </View>
            )}
          </View>
        </View>
      </SafeAreaView>

      {/* Steps Input Modal */}
      <Modal
        visible={showStepsInput}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setShowStepsInput(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <CustomText variant="title" weight="bold" fontFamily="figtree" style={styles.modalTitle}>
                Enter Steps
              </CustomText>
              <TouchableOpacity
                onPress={() => setShowStepsInput(false)}
                style={styles.modalCloseButton}
              >
                <Feather name="x" size={24} color="#ECEDEE" />
              </TouchableOpacity>
            </View>
            
            <View style={styles.modalBody}>
              <CustomText variant="body" weight="normal" fontFamily="figtree" style={styles.modalDescription}>
                How many steps did you take during this workout?
              </CustomText>
              <TextInput
                style={styles.stepsInput}
                placeholder="Enter number of steps"
                placeholderTextColor="#9BA1A6"
                value={stepsInput}
                onChangeText={setStepsInput}
                keyboardType="number-pad"
                autoFocus
              />
            </View>

            <View style={styles.modalActions}>
              <TouchableOpacity
                style={styles.modalCancelButton}
                onPress={handleStepsInputCancel}
              >
                <CustomText variant="body" weight="bold" fontFamily="figtree" style={styles.modalCancelText}>
                  Cancel
                </CustomText>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.modalConfirmButton}
                onPress={handleStepsInputConfirm}
              >
                <CustomText variant="body" weight="bold" fontFamily="figtree" style={styles.modalConfirmText}>
                  Confirm
                </CustomText>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0A0A0A',
  },
  safeArea: {
    flex: 1,
  },
  content: {
    flex: 1,
    padding: 20,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 24,
    marginTop: 10,
  },
  closeButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  eventName: {
    color: '#ECEDEE',
    fontSize: 18,
  },
  timerContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 40,
    paddingVertical: 20,
  },
  timerWrapper: {
    minHeight: 90,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 10,
  },
  timer: {
    color: '#FF6B35',
    fontSize: 64,
    lineHeight: 80,
    textAlign: 'center',
  },
  pausedText: {
    color: '#9BA1A6',
    fontSize: 14,
    letterSpacing: 2,
    marginTop: 8,
  },
  metricsContainer: {
    flex: 1,
    gap: 16,
    marginBottom: 20,
  },
  metricCard: {
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderRadius: 16,
    padding: 20,
    borderWidth: 1,
    borderColor: 'rgba(255, 107, 53, 0.2)',
  },
  metricHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 12,
  },
  metricLabel: {
    color: '#9BA1A6',
    fontSize: 12,
  },
  metricValueContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 20,
  },
  metricButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255, 107, 53, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  metricValue: {
    color: '#ECEDEE',
    fontSize: 32,
    minWidth: 100,
    textAlign: 'center',
  },
  controlsContainer: {
    marginTop: 32,
    marginBottom: 20,
  },
  startButton: {
    backgroundColor: '#FF6B35',
    borderRadius: 16,
    padding: 20,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
  },
  startButtonText: {
    color: 'white',
    fontSize: 18,
  },
  controlButtons: {
    flexDirection: 'row',
    gap: 12,
  },
  pauseButton: {
    flex: 1,
    backgroundColor: '#FF6B35',
    borderRadius: 16,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  resumeButton: {
    flex: 1,
    backgroundColor: '#4ECDC4',
    borderRadius: 16,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  stopButton: {
    flex: 1,
    backgroundColor: '#E74C3C',
    borderRadius: 16,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  controlButtonText: {
    color: 'white',
    fontSize: 16,
  },
  countdownContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  countdownCircle: {
    width: 200,
    height: 200,
    borderRadius: 100,
    backgroundColor: '#FF6B35',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#FF6B35',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.8,
    shadowRadius: 30,
    elevation: 20,
  },
  countdownText: {
    color: 'white',
    fontSize: 96,
  },
  countdownSubtext: {
    color: '#9BA1A6',
    fontSize: 18,
    marginTop: 24,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    backgroundColor: '#1A1A1A',
    borderRadius: 24,
    width: width * 0.85,
    maxWidth: 400,
    padding: 0,
    overflow: 'hidden',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.1)',
  },
  modalTitle: {
    color: '#ECEDEE',
    fontSize: 20,
  },
  modalCloseButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalBody: {
    padding: 20,
  },
  modalDescription: {
    color: '#9BA1A6',
    fontSize: 14,
    marginBottom: 16,
    lineHeight: 20,
  },
  stepsInput: {
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderRadius: 12,
    padding: 16,
    color: '#ECEDEE',
    fontSize: 18,
    fontFamily: 'Figtree_400Regular',
    borderWidth: 1,
    borderColor: 'rgba(255, 107, 53, 0.3)',
    textAlign: 'center',
  },
  modalActions: {
    flexDirection: 'row',
    padding: 20,
    gap: 12,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.1)',
  },
  modalCancelButton: {
    flex: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
  },
  modalCancelText: {
    color: '#ECEDEE',
    fontSize: 16,
  },
  modalConfirmButton: {
    flex: 1,
    backgroundColor: '#FF6B35',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
  },
  modalConfirmText: {
    color: 'white',
    fontSize: 16,
  },
});

