import React, { useState, useEffect } from 'react';
import { View, ScrollView, StyleSheet, Dimensions, TouchableOpacity, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Feather } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import CustomText from '../../components/CustomText';
import { auth, db } from '../../firebase/config';
import { collection, query, where, getDocs, orderBy, limit } from 'firebase/firestore';
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

const { width } = Dimensions.get('window');

export default function ProgressScreen() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [weeklyProgress, setWeeklyProgress] = useState<any[]>([]);
  const [monthlyProgress, setMonthlyProgress] = useState<any[]>([]);
  const [goals, setGoals] = useState<any[]>([]);
  const [fontsLoaded] = useFonts({
    Figtree_300Light,
    Figtree_400Regular,
    Figtree_500Medium,
    Figtree_600SemiBold,
    Figtree_700Bold,
    Figtree_800ExtraBold,
    Figtree_900Black,
  });

  useEffect(() => {
    loadProgressData();
  }, []);

  const loadProgressData = async () => {
    const user = auth.currentUser;
    if (!user) {
      setLoading(false);
      return;
    }

    try {
      // Load recent workouts for progress tracking - sort in memory to avoid index requirement
      const workoutsQuery = query(
        collection(db, 'workouts'),
        where('userId', '==', user.uid)
      );
      const snapshot = await getDocs(workoutsQuery);
      const allWorkouts = snapshot.docs
        .map(doc => ({ id: doc.id, ...doc.data() }))
        .sort((a, b) => {
          const aTime = a.timestamp?.toDate()?.getTime() || 0;
          const bTime = b.timestamp?.toDate()?.getTime() || 0;
          return bTime - aTime; // Descending order
        })
        .slice(0, 20);

      // Group by week
      const weekly: { [key: string]: any[] } = {};
      const monthly: { [key: string]: any[] } = {};

      allWorkouts.forEach(workout => {
        if (workout.timestamp) {
          const date = workout.timestamp.toDate();
          const weekKey = `${date.getFullYear()}-W${Math.ceil(date.getDate() / 7)}`;
          const monthKey = `${date.getFullYear()}-${date.getMonth() + 1}`;

          if (!weekly[weekKey]) weekly[weekKey] = [];
          if (!monthly[monthKey]) monthly[monthKey] = [];

          weekly[weekKey].push(workout);
          monthly[monthKey].push(workout);
        }
      });

      setWeeklyProgress(Object.entries(weekly).slice(0, 4));
      setMonthlyProgress(Object.entries(monthly).slice(0, 3));
    } catch (error) {
      console.error('Error loading progress data:', error);
    } finally {
      setLoading(false);
    }
  };

  const formatTime = (seconds: number) => {
    if (seconds < 60) {
      return `${seconds.toFixed(2)}s`;
    }
    const mins = Math.floor(seconds / 60);
    const secs = (seconds % 60).toFixed(2);
    return `${mins}:${secs.padStart(5, '0')}`;
  };

  const formatDistance = (meters: number) => {
    if (meters < 1) {
      return `${(meters * 100).toFixed(0)}cm`;
    }
    return `${meters.toFixed(2)}m`;
  };

  if (!fontsLoaded) {
    return (
      <View style={styles.container}>
        <ActivityIndicator size="large" color="#FF6B35" />
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
        <ScrollView 
          style={styles.scrollView}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          {/* Header */}
          <View style={styles.header}>
            <CustomText variant="title" weight="bold" fontFamily="figtree" style={styles.title}>
              Progress
            </CustomText>
            <CustomText variant="body" weight="normal" fontFamily="figtree" style={styles.subtitle}>
              Track your training progress over time
            </CustomText>
          </View>

          {/* Quick Stats */}
          <View style={styles.statsRow}>
            <View style={styles.statCard}>
              <Feather name="trending-up" size={24} color="#FF6B35" />
              <CustomText variant="title" weight="bold" fontFamily="figtree" style={styles.statValue}>
                {weeklyProgress.reduce((sum, [, workouts]) => sum + workouts.length, 0)}
              </CustomText>
              <CustomText variant="caption" weight="normal" fontFamily="figtree" style={styles.statLabel}>
                This Week
              </CustomText>
            </View>
            <View style={styles.statCard}>
              <Feather name="calendar" size={24} color="#FF6B35" />
              <CustomText variant="title" weight="bold" fontFamily="figtree" style={styles.statValue}>
                {monthlyProgress.reduce((sum, [, workouts]) => sum + workouts.length, 0)}
              </CustomText>
              <CustomText variant="caption" weight="normal" fontFamily="figtree" style={styles.statLabel}>
                This Month
              </CustomText>
            </View>
          </View>

          {/* Weekly Progress */}
          {weeklyProgress.length > 0 && (
            <View style={styles.section}>
              <CustomText variant="subtitle" weight="bold" fontFamily="figtree" style={styles.sectionTitle}>
                Weekly Progress
              </CustomText>
              {weeklyProgress.map(([weekKey, workouts], index) => (
                <View key={weekKey} style={styles.progressCard}>
                  <View style={styles.progressHeader}>
                    <CustomText variant="body" weight="bold" fontFamily="figtree" style={styles.progressWeek}>
                      Week {index + 1}
                    </CustomText>
                    <CustomText variant="caption" weight="normal" fontFamily="figtree" style={styles.progressCount}>
                      {workouts.length} workouts
                    </CustomText>
                  </View>
                  <View style={styles.progressBar}>
                    <View 
                      style={[
                        styles.progressBarFill, 
                        { width: `${Math.min((workouts.length / 10) * 100, 100)}%` }
                      ]} 
                    />
                  </View>
                </View>
              ))}
            </View>
          )}

          {/* Monthly Progress */}
          {monthlyProgress.length > 0 && (
            <View style={styles.section}>
              <CustomText variant="subtitle" weight="bold" fontFamily="figtree" style={styles.sectionTitle}>
                Monthly Progress
              </CustomText>
              {monthlyProgress.map(([monthKey, workouts], index) => (
                <View key={monthKey} style={styles.progressCard}>
                  <View style={styles.progressHeader}>
                    <CustomText variant="body" weight="bold" fontFamily="figtree" style={styles.progressWeek}>
                      Month {index + 1}
                    </CustomText>
                    <CustomText variant="caption" weight="normal" fontFamily="figtree" style={styles.progressCount}>
                      {workouts.length} workouts
                    </CustomText>
                  </View>
                  <View style={styles.progressBar}>
                    <View 
                      style={[
                        styles.progressBarFill, 
                        { width: `${Math.min((workouts.length / 30) * 100, 100)}%` }
                      ]} 
                    />
                  </View>
                </View>
              ))}
            </View>
          )}

          {loading && (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color="#FF6B35" />
            </View>
          )}

          {!loading && weeklyProgress.length === 0 && monthlyProgress.length === 0 && (
            <View style={styles.emptyState}>
              <Feather name="trending-up" size={48} color="#9BA1A6" />
              <CustomText variant="body" weight="medium" fontFamily="figtree" style={styles.emptyText}>
                No progress data yet
              </CustomText>
              <CustomText variant="caption" weight="normal" fontFamily="figtree" style={styles.emptySubtext}>
                Start tracking workouts to see your progress
              </CustomText>
              <TouchableOpacity
                style={styles.startButton}
                onPress={() => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                  router.push('/authenticated_tabs/workouts');
                }}
              >
                <CustomText variant="body" weight="bold" fontFamily="figtree" style={styles.startButtonText}>
                  Start Tracking
                </CustomText>
              </TouchableOpacity>
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
  statsRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 32,
  },
  statCard: {
    flex: 1,
    backgroundColor: 'rgba(255, 107, 53, 0.1)',
    borderRadius: 16,
    padding: 20,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255, 107, 53, 0.3)',
  },
  statValue: {
    color: '#FF6B35',
    fontSize: 28,
    marginTop: 12,
    marginBottom: 4,
  },
  statLabel: {
    color: '#9BA1A6',
    fontSize: 12,
  },
  section: {
    marginBottom: 32,
  },
  sectionTitle: {
    color: '#ECEDEE',
    fontSize: 20,
    marginBottom: 16,
  },
  progressCard: {
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
  },
  progressHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  progressWeek: {
    color: '#ECEDEE',
    fontSize: 16,
  },
  progressCount: {
    color: '#9BA1A6',
    fontSize: 12,
  },
  progressBar: {
    height: 8,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 4,
    overflow: 'hidden',
  },
  progressBarFill: {
    height: '100%',
    backgroundColor: '#FF6B35',
    borderRadius: 4,
  },
  loadingContainer: {
    padding: 40,
    alignItems: 'center',
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
  },
  emptyText: {
    color: '#9BA1A6',
    marginTop: 16,
    marginBottom: 8,
  },
  emptySubtext: {
    color: '#9BA1A6',
    fontSize: 12,
    textAlign: 'center',
    marginBottom: 24,
  },
  startButton: {
    backgroundColor: '#FF6B35',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 12,
  },
  startButtonText: {
    color: 'white',
    fontSize: 16,
  },
});

