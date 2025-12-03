import React, { useState, useEffect } from 'react';
import { View, ScrollView, TouchableOpacity, StyleSheet, Dimensions, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Feather } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import CustomText from '../../components/CustomText';
import { auth, db } from '../../firebase/config';
import { collection, query, where, getDocs, addDoc, Timestamp, deleteDoc, doc } from 'firebase/firestore';
import * as Haptics from 'expo-haptics';

const { width } = Dimensions.get('window');

const TRACK_EVENTS = [
  { id: 'sprint-100m', name: '100m Sprint', icon: 'zap', color: '#FF6B35' },
  { id: 'sprint-200m', name: '200m Sprint', icon: 'zap', color: '#FF6B35' },
  { id: 'sprint-400m', name: '400m Sprint', icon: 'zap', color: '#FF6B35' },
  { id: 'distance-800m', name: '800m', icon: 'trending-up', color: '#4ECDC4' },
  { id: 'distance-1500m', name: '1500m', icon: 'trending-up', color: '#4ECDC4' },
  { id: 'distance-5000m', name: '5000m', icon: 'trending-up', color: '#4ECDC4' },
  { id: 'hurdles-110m', name: '110m Hurdles', icon: 'activity', color: '#95E1D3' },
  { id: 'hurdles-400m', name: '400m Hurdles', icon: 'activity', color: '#95E1D3' },
  { id: 'field-long-jump', name: 'Long Jump', icon: 'arrow-right', color: '#F38181' },
  { id: 'field-high-jump', name: 'High Jump', icon: 'arrow-up', color: '#F38181' },
  { id: 'field-shot-put', name: 'Shot Put', icon: 'circle', color: '#AA96DA' },
  { id: 'field-discus', name: 'Discus', icon: 'disc', color: '#AA96DA' },
];

export default function WorkoutsScreen() {
  const router = useRouter();
  const [selectedEvent, setSelectedEvent] = useState<string | null>(null);
  const [recentWorkouts, setRecentWorkouts] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedWorkoutId, setSelectedWorkoutId] = useState<string | null>(null);

  useEffect(() => {
    loadRecentWorkouts();
  }, []);

  const loadRecentWorkouts = async () => {
    const user = auth.currentUser;
    if (!user) return;

    try {
      const workoutsQuery = query(
        collection(db, 'workouts'),
        where('userId', '==', user.uid)
      );
      const snapshot = await getDocs(workoutsQuery);
      const workouts = snapshot.docs
        .map(doc => ({ id: doc.id, ...doc.data() }))
        .sort((a, b) => {
          const aTime = a.timestamp?.toMillis() || 0;
          const bTime = b.timestamp?.toMillis() || 0;
          return bTime - aTime;
        })
        .slice(0, 5);
      setRecentWorkouts(workouts);
    } catch (error) {
      console.error('Error loading workouts:', error);
    }
  };

  const handleEventSelect = (eventId: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setSelectedEvent(eventId);
    // Navigate to workout tracking screen
    router.push(`/screens/track-workout?event=${eventId}`);
  };

  const handleDeleteWorkout = async (workout: any) => {
    Alert.alert(
      'Delete Workout',
      'Are you sure you want to delete this workout?',
      [
        { text: 'Cancel', style: 'cancel', onPress: () => setSelectedWorkoutId(null) },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              if (workout.id) {
                await deleteDoc(doc(db, 'workouts', workout.id));
                setRecentWorkouts(prev => prev.filter(w => w.id !== workout.id));
                setSelectedWorkoutId(null);
                // Reload workouts to refresh the list
                await loadRecentWorkouts();
              }
            } catch (error) {
              console.error('Error deleting workout:', error);
              Alert.alert('Error', 'Failed to delete workout. Please try again.');
            }
          },
        },
      ]
    );
  };

  return (
    <View style={styles.container}>
      <LinearGradient
        colors={['#0A0A0A', '#1A1A1A', '#0A0A0A']}
        style={StyleSheet.absoluteFill}
      />
      <SafeAreaView style={styles.safeArea}>
        <ScrollView 
          style={styles.scrollView}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          {/* Header */}
          <View style={styles.header}>
            <CustomText variant="title" weight="bold" fontFamily="figtree" style={styles.title}>
              Track Workouts
            </CustomText>
            <CustomText variant="body" weight="normal" fontFamily="figtree" style={styles.subtitle}>
              Select an event to start tracking
            </CustomText>
          </View>

          {/* Event Categories */}
          <View style={styles.section}>
            <CustomText variant="subtitle" weight="bold" fontFamily="figtree" style={styles.sectionTitle}>
              Sprint Events
            </CustomText>
            <View style={styles.eventGrid}>
              {TRACK_EVENTS.filter(e => e.id.startsWith('sprint')).map(event => (
                <TouchableOpacity
                  key={event.id}
                  style={[styles.eventCard, { borderColor: event.color }]}
                  onPress={() => handleEventSelect(event.id)}
                  activeOpacity={0.8}
                >
                  <View style={[styles.eventIconContainer, { backgroundColor: `${event.color}20` }]}>
                    <Feather name={event.icon as any} size={24} color={event.color} />
                  </View>
                  <CustomText variant="body" weight="semibold" fontFamily="figtree" style={styles.eventName}>
                    {event.name}
                  </CustomText>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          <View style={styles.section}>
            <CustomText variant="subtitle" weight="bold" fontFamily="figtree" style={styles.sectionTitle}>
              Distance Events
            </CustomText>
            <View style={styles.eventGrid}>
              {TRACK_EVENTS.filter(e => e.id.startsWith('distance')).map(event => (
                <TouchableOpacity
                  key={event.id}
                  style={[styles.eventCard, { borderColor: event.color }]}
                  onPress={() => handleEventSelect(event.id)}
                  activeOpacity={0.8}
                >
                  <View style={[styles.eventIconContainer, { backgroundColor: `${event.color}20` }]}>
                    <Feather name={event.icon as any} size={24} color={event.color} />
                  </View>
                  <CustomText variant="body" weight="semibold" fontFamily="figtree" style={styles.eventName}>
                    {event.name}
                  </CustomText>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          <View style={styles.section}>
            <CustomText variant="subtitle" weight="bold" fontFamily="figtree" style={styles.sectionTitle}>
              Hurdles
            </CustomText>
            <View style={styles.eventGrid}>
              {TRACK_EVENTS.filter(e => e.id.startsWith('hurdles')).map(event => (
                <TouchableOpacity
                  key={event.id}
                  style={[styles.eventCard, { borderColor: event.color }]}
                  onPress={() => handleEventSelect(event.id)}
                  activeOpacity={0.8}
                >
                  <View style={[styles.eventIconContainer, { backgroundColor: `${event.color}20` }]}>
                    <Feather name={event.icon as any} size={24} color={event.color} />
                  </View>
                  <CustomText variant="body" weight="semibold" fontFamily="figtree" style={styles.eventName}>
                    {event.name}
                  </CustomText>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          <View style={styles.section}>
            <CustomText variant="subtitle" weight="bold" fontFamily="figtree" style={styles.sectionTitle}>
              Field Events
            </CustomText>
            <View style={styles.eventGrid}>
              {TRACK_EVENTS.filter(e => e.id.startsWith('field')).map(event => (
                <TouchableOpacity
                  key={event.id}
                  style={[styles.eventCard, { borderColor: event.color }]}
                  onPress={() => handleEventSelect(event.id)}
                  activeOpacity={0.8}
                >
                  <View style={[styles.eventIconContainer, { backgroundColor: `${event.color}20` }]}>
                    <Feather name={event.icon as any} size={24} color={event.color} />
                  </View>
                  <CustomText variant="body" weight="semibold" fontFamily="figtree" style={styles.eventName}>
                    {event.name}
                  </CustomText>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          {/* Recent Workouts */}
          {recentWorkouts.length > 0 && (
            <View style={styles.section}>
              <CustomText variant="subtitle" weight="bold" fontFamily="figtree" style={styles.sectionTitle}>
                Recent Workouts
              </CustomText>
              {recentWorkouts.map(workout => (
                <TouchableOpacity
                  key={workout.id}
                  style={styles.recentWorkoutCard}
                  onLongPress={() => setSelectedWorkoutId(workout.id)}
                  activeOpacity={0.8}
                >
                  {selectedWorkoutId === workout.id && (
                    <TouchableOpacity
                      style={styles.deleteButton}
                      onPress={() => handleDeleteWorkout(workout)}
                    >
                      <Feather name="x" size={16} color="white" />
                    </TouchableOpacity>
                  )}
                  <View style={styles.recentWorkoutHeader}>
                    <CustomText variant="body" weight="bold" fontFamily="figtree" style={styles.recentWorkoutEvent}>
                      {workout.eventName}
                    </CustomText>
                    <CustomText variant="caption" weight="normal" fontFamily="figtree" style={styles.recentWorkoutDate}>
                      {workout.timestamp?.toDate().toLocaleDateString()}
                    </CustomText>
                  </View>
                  <CustomText variant="body" weight="semibold" fontFamily="figtree" style={styles.recentWorkoutResult}>
                    {workout.result}
                  </CustomText>
                </TouchableOpacity>
              ))}
            </View>
          )}
        </ScrollView>
      </SafeAreaView>
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
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 20,
    paddingBottom: 100,
  },
  header: {
    marginBottom: 32,
    marginTop: 20,
  },
  title: {
    color: '#ECEDEE',
    fontSize: 32,
    marginBottom: 8,
  },
  subtitle: {
    color: '#9BA1A6',
    fontSize: 16,
  },
  section: {
    marginBottom: 32,
  },
  sectionTitle: {
    color: '#ECEDEE',
    fontSize: 20,
    marginBottom: 16,
  },
  eventGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  eventCard: {
    width: (width - 52) / 2, // 2 columns with gaps
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    alignItems: 'center',
  },
  eventIconContainer: {
    width: 56,
    height: 56,
    borderRadius: 28,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
  },
  eventName: {
    color: '#ECEDEE',
    fontSize: 14,
    textAlign: 'center',
  },
  recentWorkoutCard: {
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderLeftWidth: 3,
    borderLeftColor: '#FF6B35',
    position: 'relative',
  },
  deleteButton: {
    position: 'absolute',
    top: 8,
    right: 8,
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#E74C3C',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 10,
  },
  recentWorkoutHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  recentWorkoutEvent: {
    color: '#ECEDEE',
    fontSize: 16,
  },
  recentWorkoutDate: {
    color: '#9BA1A6',
    fontSize: 12,
  },
  recentWorkoutResult: {
    color: '#FF6B35',
    fontSize: 18,
  },
});

