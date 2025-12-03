import React, { useState, useEffect } from 'react';
import { View, ScrollView, StyleSheet, Dimensions, TouchableOpacity, ActivityIndicator, Alert, Modal, TextInput } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Feather, Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import CustomText from '../../components/CustomText';
import { auth, db } from '../../firebase/config';
import { collection, query, where, getDocs, orderBy, limit, Timestamp, getDoc, doc, deleteDoc, addDoc } from 'firebase/firestore';
import { getAIInsights, getMentalNotesInsights } from '../../utils/geminiApi';
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

export default function HomeScreen() {
  const router = useRouter();
  const [name, setName] = useState('');
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({
    totalWorkouts: 0,
    personalRecords: 0,
    thisWeekWorkouts: 0,
    bestEvent: null as string | null,
  });
  const [recentWorkouts, setRecentWorkouts] = useState<any[]>([]);
  const [selectedWorkoutId, setSelectedWorkoutId] = useState<string | null>(null);
  const [upcomingEvents, setUpcomingEvents] = useState<any[]>([]);
  const [aiInsights, setAiInsights] = useState<string>('');
  const [parsedInsights, setParsedInsights] = useState<string[]>([]);
  const [loadingInsights, setLoadingInsights] = useState(false);
  const [showInsightsDetail, setShowInsightsDetail] = useState(false);
  const [showMentalNotesModal, setShowMentalNotesModal] = useState(false);
  const [mentalNoteText, setMentalNoteText] = useState('');
  const [savingNote, setSavingNote] = useState(false);
  const [mentalNotes, setMentalNotes] = useState<any[]>([]);
  const [mentalClarityInsights, setMentalClarityInsights] = useState<string>('');
  const [parsedMentalInsights, setParsedMentalInsights] = useState<string[]>([]);
  const [loadingMentalInsights, setLoadingMentalInsights] = useState(false);
  const [showMentalClarityDetail, setShowMentalClarityDetail] = useState(false);
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
    loadUserData();
    loadDashboardData();
    loadMentalNotes();
  }, []);

  const loadUserData = async () => {
    const user = auth.currentUser;
    if (!user) return;

    try {
      const userDoc = await getDoc(doc(db, 'users', user.uid));
      if (userDoc.exists()) {
        const userData = userDoc.data();
        setName(userData.name || 'Athlete');
      }
    } catch (error) {
      console.error('Error loading user data:', error);
    }
  };

  const loadDashboardData = async () => {
    const user = auth.currentUser;
    if (!user) {
      setLoading(false);
      return;
    }

    try {
      // Load all workouts
      const workoutsQuery = query(
        collection(db, 'workouts'),
        where('userId', '==', user.uid)
      );
      const workoutsSnapshot = await getDocs(workoutsQuery);
      const allWorkouts = workoutsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

      // Calculate stats
      const totalWorkouts = allWorkouts.length;
      
      // Find personal records (best performance per event)
      const prsByEvent: { [key: string]: any } = {};
      allWorkouts.forEach(workout => {
        const eventId = workout.eventId;
        if (!prsByEvent[eventId] || workout.result < prsByEvent[eventId].result) {
          prsByEvent[eventId] = workout;
        }
      });
      const personalRecords = Object.keys(prsByEvent).length;

      // This week's workouts
      const oneWeekAgo = new Date();
      oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);
      const thisWeekWorkouts = allWorkouts.filter(w => {
        const workoutDate = w.timestamp?.toDate() || new Date(0);
        return workoutDate >= oneWeekAgo;
      }).length;

      // Find best event (most workouts)
      const eventCounts: { [key: string]: number } = {};
      allWorkouts.forEach(workout => {
        const eventId = workout.eventId || 'unknown';
        eventCounts[eventId] = (eventCounts[eventId] || 0) + 1;
      });
      const bestEvent = Object.keys(eventCounts).reduce((a, b) => 
        eventCounts[a] > eventCounts[b] ? a : b, Object.keys(eventCounts)[0] || null
      );

      setStats({
        totalWorkouts,
        personalRecords,
        thisWeekWorkouts,
        bestEvent,
      });

      // Load recent workouts - sort in memory to avoid index requirement
      const recent = allWorkouts
        .sort((a, b) => {
          const aTime = a.timestamp?.toDate()?.getTime() || 0;
          const bTime = b.timestamp?.toDate()?.getTime() || 0;
          return bTime - aTime; // Descending order
        })
        .slice(0, 5);
      setRecentWorkouts(recent);

      // Load AI insights if there are workouts
      if (allWorkouts.length > 0) {
        loadAIInsights(allWorkouts, {
          totalWorkouts,
          personalRecords,
          thisWeekWorkouts,
          bestEvent,
        });
      }

    } catch (error) {
      console.error('Error loading dashboard data:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadAIInsights = async (workouts: any[], stats: any) => {
    setLoadingInsights(true);
    try {
      const insights = await getAIInsights(workouts, stats);
      setAiInsights(insights);
      // Parse insights into individual items (split by numbered list)
      const parsed = insights
        .split(/\d+\.\s*/)
        .filter(item => item.trim().length > 0)
        .map(item => item.trim());
      setParsedInsights(parsed);
    } catch (error) {
      console.error('Error loading AI insights:', error);
      setAiInsights('');
      setParsedInsights([]);
    } finally {
      setLoadingInsights(false);
    }
  };

  const loadMentalNotes = async () => {
    const user = auth.currentUser;
    if (!user) return;

    try {
      // Query without orderBy to avoid index requirement, sort in memory instead
      const notesQuery = query(
        collection(db, 'mentalNotes'),
        where('userId', '==', user.uid)
      );
      
      const notesSnapshot = await getDocs(notesQuery);
      let notes = notesSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      
      // Sort in memory by timestamp (descending - most recent first)
      notes = notes.sort((a, b) => {
        const aTime = a.timestamp?.toDate()?.getTime() || 0;
        const bTime = b.timestamp?.toDate()?.getTime() || 0;
        return bTime - aTime; // Descending order
      });
      
      setMentalNotes(notes);
      
      // Load mental clarity insights if there are notes
      if (notes.length > 0) {
        loadMentalClarityInsights(notes);
      } else {
        setParsedMentalInsights([]);
        setMentalClarityInsights('');
      }
    } catch (error) {
      console.error('Error loading mental notes:', error);
      setMentalNotes([]);
    }
  };

  const loadMentalClarityInsights = async (notes: any[]) => {
    setLoadingMentalInsights(true);
    try {
      const insights = await getMentalNotesInsights(notes);
      setMentalClarityInsights(insights);
      // Parse insights into individual items (split by numbered list)
      const parsed = insights
        .split(/\d+\.\s*/)
        .filter(item => item.trim().length > 0)
        .map(item => item.trim());
      setParsedMentalInsights(parsed);
    } catch (error) {
      console.error('Error loading mental clarity insights:', error);
      setMentalClarityInsights('');
      setParsedMentalInsights([]);
    } finally {
      setLoadingMentalInsights(false);
    }
  };

  const handleSaveMentalNote = async () => {
    if (!mentalNoteText.trim()) {
      Alert.alert('Empty Note', 'Please enter some thoughts before saving.');
      return;
    }

    const user = auth.currentUser;
    if (!user) return;

    setSavingNote(true);
    try {
      await addDoc(collection(db, 'mentalNotes'), {
        userId: user.uid,
        note: mentalNoteText.trim(),
        timestamp: Timestamp.now(),
        createdAt: Timestamp.now(),
      });

      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setMentalNoteText('');
      setShowMentalNotesModal(false);
      
      // Reload mental notes and refresh insights
      await loadMentalNotes();
    } catch (error) {
      console.error('Error saving mental note:', error);
      Alert.alert('Error', 'Failed to save mental note. Please try again.');
    } finally {
      setSavingNote(false);
    }
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
                // Reload dashboard data to update stats
                loadDashboardData();
              }
              setSelectedWorkoutId(null);
            } catch (error) {
              console.error('Error deleting workout:', error);
              Alert.alert('Error', 'Failed to delete workout. Please try again.');
            }
          },
        },
      ]
    );
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
            <View>
              <CustomText variant="title" weight="bold" fontFamily="figtree" style={styles.greeting}>
                Welcome back, {name || 'Athlete'}!
              </CustomText>
              <CustomText variant="body" weight="normal" fontFamily="figtree" style={styles.subtitle}>
                Track your performance and improve
              </CustomText>
            </View>
          </View>

          {/* Quick Stats */}
          <View style={styles.statsGrid}>
            <TouchableOpacity 
              style={styles.statCard}
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                router.push('/authenticated_tabs/workouts');
              }}
              activeOpacity={0.8}
            >
              <View style={[styles.statIconContainer, { backgroundColor: 'rgba(255, 107, 53, 0.2)' }]}>
                <Feather name="activity" size={24} color="#FF6B35" />
              </View>
              <CustomText variant="title" weight="bold" fontFamily="figtree" style={styles.statValue}>
                {stats.totalWorkouts}
              </CustomText>
              <CustomText variant="caption" weight="normal" fontFamily="figtree" style={styles.statLabel}>
                Total Workouts
              </CustomText>
            </TouchableOpacity>

            <TouchableOpacity 
              style={styles.statCard}
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                router.push('/authenticated_tabs/stats');
              }}
              activeOpacity={0.8}
            >
              <View style={[styles.statIconContainer, { backgroundColor: 'rgba(255, 107, 53, 0.2)' }]}>
                <Feather name="award" size={24} color="#FF6B35" />
              </View>
              <CustomText variant="title" weight="bold" fontFamily="figtree" style={styles.statValue}>
                {stats.personalRecords}
              </CustomText>
              <CustomText variant="caption" weight="normal" fontFamily="figtree" style={styles.statLabel}>
                Personal Records
              </CustomText>
            </TouchableOpacity>

            <TouchableOpacity 
              style={styles.statCard}
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                router.push('/authenticated_tabs/workouts');
              }}
              activeOpacity={0.8}
            >
              <View style={[styles.statIconContainer, { backgroundColor: 'rgba(255, 107, 53, 0.2)' }]}>
                <Feather name="calendar" size={24} color="#FF6B35" />
              </View>
              <CustomText variant="title" weight="bold" fontFamily="figtree" style={styles.statValue}>
                {stats.thisWeekWorkouts}
              </CustomText>
              <CustomText variant="caption" weight="normal" fontFamily="figtree" style={styles.statLabel}>
                This Week
              </CustomText>
            </TouchableOpacity>
          </View>

          {/* Quick Actions */}
          <View style={[styles.section, styles.quickActionsSection]}>
            <CustomText variant="subtitle" weight="bold" fontFamily="figtree" style={styles.sectionTitle}>
              Quick Actions
            </CustomText>
            <View style={styles.quickActions}>
              <TouchableOpacity 
                style={styles.quickActionCard}
                onPress={() => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                  router.push('/authenticated_tabs/workouts');
                }}
                activeOpacity={0.8}
              >
                <LinearGradient
                  colors={['#FF6B35', '#FF8C5A']}
                  style={styles.quickActionGradient}
                >
                  <Feather name="plus-circle" size={32} color="white" />
                  <CustomText variant="body" weight="bold" fontFamily="figtree" style={styles.quickActionText}>
                    Start Workout
                  </CustomText>
                </LinearGradient>
              </TouchableOpacity>

              <TouchableOpacity 
                style={styles.quickActionCard}
                onPress={() => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                  setShowMentalNotesModal(true);
                }}
                activeOpacity={0.8}
              >
                <View style={styles.quickActionSecondary}>
                  <Feather name="edit-3" size={32} color="#FF6B35" />
                  <CustomText variant="body" weight="bold" fontFamily="figtree" style={styles.quickActionTextSecondary}>
                    Record Mental Notes
                  </CustomText>
                </View>
              </TouchableOpacity>
            </View>
          </View>

          {/* Mental Clarity Insights */}
          {mentalNotes.length > 0 && (
            <View style={styles.section}>
              <View style={styles.sectionHeader}>
                <Ionicons name="brain" size={24} color="#FF6B35" />
                <CustomText variant="subtitle" weight="bold" fontFamily="figtree" style={styles.sectionTitle}>
                  Mental Clarity
                </CustomText>
              </View>
              {loadingMentalInsights ? (
                <View style={styles.insightsCard}>
                  <View style={styles.insightsLoading}>
                    <ActivityIndicator size="small" color="#FF6B35" />
                    <CustomText variant="caption" weight="normal" fontFamily="figtree" style={styles.insightsLoadingText}>
                      Reflecting on your thoughts...
                    </CustomText>
                  </View>
                </View>
              ) : parsedMentalInsights.length > 0 ? (
                <View style={styles.insightsContainer}>
                  {parsedMentalInsights.slice(0, 3).map((insight, index) => (
                    <TouchableOpacity
                      key={index}
                      style={styles.insightCard}
                      onPress={() => setShowMentalClarityDetail(true)}
                      activeOpacity={0.8}
                    >
                      <View style={styles.insightHeader}>
                        <View style={styles.insightIconContainer}>
                          <Feather 
                            name={index === 0 ? "heart" : index === 1 ? "sun" : "sparkles"} 
                            size={20} 
                            color="#FF6B35" 
                          />
                        </View>
                        <View style={styles.insightContent}>
                          <CustomText variant="body" weight="semibold" fontFamily="figtree" style={styles.insightText} numberOfLines={2}>
                            {insight}
                          </CustomText>
                        </View>
                        <Feather name="chevron-right" size={20} color="#9BA1A6" />
                      </View>
                    </TouchableOpacity>
                  ))}
                </View>
              ) : (
                <View style={styles.insightsCard}>
                  <CustomText variant="body" weight="normal" fontFamily="figtree" style={styles.insightsText}>
                    Record more mental notes to get personalized insights!
                  </CustomText>
                </View>
              )}
            </View>
          )}

          {/* AI Insights */}
          {recentWorkouts.length > 0 && (
            <View style={styles.section}>
              <View style={styles.sectionHeader}>
                <Feather name="cpu" size={24} color="#FF6B35" />
                <CustomText variant="subtitle" weight="bold" fontFamily="figtree" style={styles.sectionTitle}>
                  AI Insights
                </CustomText>
              </View>
              {loadingInsights ? (
                <View style={styles.insightsCard}>
                  <View style={styles.insightsLoading}>
                    <ActivityIndicator size="small" color="#FF6B35" />
                    <CustomText variant="caption" weight="normal" fontFamily="figtree" style={styles.insightsLoadingText}>
                      Analyzing your performance...
                    </CustomText>
                  </View>
                </View>
              ) : parsedInsights.length > 0 ? (
                <View style={styles.insightsContainer}>
                  {parsedInsights.slice(0, 3).map((insight, index) => (
                    <TouchableOpacity
                      key={index}
                      style={styles.insightCard}
                      onPress={() => setShowInsightsDetail(true)}
                      activeOpacity={0.8}
                    >
                      <View style={styles.insightHeader}>
                        <View style={styles.insightIconContainer}>
                          <Feather 
                            name={index === 0 ? "trending-up" : index === 1 ? "target" : "zap"} 
                            size={20} 
                            color="#FF6B35" 
                          />
                        </View>
                        <View style={styles.insightContent}>
                          <CustomText variant="body" weight="semibold" fontFamily="figtree" style={styles.insightText} numberOfLines={2}>
                            {insight}
                          </CustomText>
                        </View>
                        <Feather name="chevron-right" size={20} color="#9BA1A6" />
                      </View>
                    </TouchableOpacity>
                  ))}
                </View>
              ) : (
                <View style={styles.insightsCard}>
                  <CustomText variant="body" weight="normal" fontFamily="figtree" style={styles.insightsText}>
                    Complete more workouts to get personalized insights!
                  </CustomText>
                </View>
              )}
            </View>
          )}

          {/* Mental Notes Modal */}
          <Modal
            visible={showMentalNotesModal}
            animationType="slide"
            transparent={true}
            onRequestClose={() => {
              setShowMentalNotesModal(false);
              setMentalNoteText('');
            }}
          >
            <SafeAreaView style={styles.modalOverlay}>
              <View style={styles.modalContent}>
                <View style={styles.modalHeader}>
                  <CustomText variant="title" weight="bold" fontFamily="figtree" style={styles.modalTitle}>
                    Record Mental Notes
                  </CustomText>
                  <TouchableOpacity
                    onPress={() => {
                      setShowMentalNotesModal(false);
                      setMentalNoteText('');
                    }}
                    style={styles.modalCloseButton}
                  >
                    <Feather name="x" size={24} color="#ECEDEE" />
                  </TouchableOpacity>
                </View>
                
                <View style={styles.mentalNotesInputContainer}>
                  <TextInput
                    style={styles.mentalNotesInput}
                    placeholder="How are you feeling? What's on your mind? Reflect on your training, goals, or anything that matters to you..."
                    placeholderTextColor="#9BA1A6"
                    multiline
                    numberOfLines={8}
                    value={mentalNoteText}
                    onChangeText={setMentalNoteText}
                    textAlignVertical="top"
                  />
                </View>

                <View style={styles.modalActions}>
                  <TouchableOpacity
                    style={[styles.saveButton, savingNote && styles.saveButtonDisabled]}
                    onPress={handleSaveMentalNote}
                    disabled={savingNote}
                  >
                    {savingNote ? (
                      <ActivityIndicator size="small" color="white" />
                    ) : (
                      <>
                        <Feather name="save" size={20} color="white" />
                        <CustomText variant="body" weight="bold" fontFamily="figtree" style={styles.saveButtonText}>
                          Save Note
                        </CustomText>
                      </>
                    )}
                  </TouchableOpacity>
                </View>
              </View>
            </SafeAreaView>
          </Modal>

          {/* Mental Clarity Detail Modal */}
          <Modal
            visible={showMentalClarityDetail}
            animationType="slide"
            transparent={true}
            onRequestClose={() => setShowMentalClarityDetail(false)}
          >
            <SafeAreaView style={styles.modalOverlay}>
              <View style={styles.modalContent}>
                <View style={styles.modalHeader}>
                  <CustomText variant="title" weight="bold" fontFamily="figtree" style={styles.modalTitle}>
                    Mental Clarity Insights
                  </CustomText>
                  <TouchableOpacity
                    onPress={() => setShowMentalClarityDetail(false)}
                    style={styles.modalCloseButton}
                  >
                    <Feather name="x" size={24} color="#ECEDEE" />
                  </TouchableOpacity>
                </View>
                
                <ScrollView 
                  style={styles.modalScrollView} 
                  contentContainerStyle={styles.modalScrollContent}
                  showsVerticalScrollIndicator={false}
                >
                  {/* Mental Notes Summary */}
                  <View style={styles.statsSummaryCard}>
                    <CustomText variant="subtitle" weight="bold" fontFamily="figtree" style={styles.statsSummaryTitle}>
                      Your Mental Notes
                    </CustomText>
                    <View style={styles.statItem}>
                      <CustomText variant="title" weight="bold" fontFamily="figtree" style={styles.statValue}>
                        {mentalNotes.length}
                      </CustomText>
                      <CustomText variant="caption" weight="normal" fontFamily="figtree" style={styles.statLabel}>
                        Total Notes
                      </CustomText>
                    </View>
                  </View>

                  {/* Detailed Mental Clarity Insights */}
                  <View style={styles.detailedInsightsCard}>
                    <CustomText variant="subtitle" weight="bold" fontFamily="figtree" style={styles.detailedInsightsTitle}>
                      AI Mental Clarity Analysis
                    </CustomText>
                    {parsedMentalInsights.map((insight, index) => (
                      <View key={index} style={styles.detailedInsightItem}>
                        <View style={styles.detailedInsightNumber}>
                          <Feather 
                            name={index === 0 ? "heart" : index === 1 ? "sun" : "sparkles"} 
                            size={16} 
                            color="#FF6B35" 
                          />
                        </View>
                        <CustomText variant="body" weight="normal" fontFamily="figtree" style={styles.detailedInsightText}>
                          {insight}
                        </CustomText>
                      </View>
                    ))}
                  </View>

                  {/* Recent Mental Notes */}
                  {mentalNotes.length > 0 && (
                    <View style={styles.recentPerformanceCard}>
                      <CustomText variant="subtitle" weight="bold" fontFamily="figtree" style={styles.recentPerformanceTitle}>
                        Recent Mental Notes
                      </CustomText>
                      {mentalNotes.slice(0, 5).map((note, index) => (
                        <View key={note.id || index} style={styles.recentPerformanceItem}>
                          <View style={styles.recentPerformanceInfo}>
                            <CustomText variant="body" weight="normal" fontFamily="figtree" style={styles.recentPerformanceEvent} numberOfLines={3}>
                              {note.note}
                            </CustomText>
                            {note.timestamp && (
                              <CustomText variant="caption" weight="normal" fontFamily="figtree" style={styles.recentPerformanceDate}>
                                {note.timestamp.toDate().toLocaleDateString()}
                              </CustomText>
                            )}
                          </View>
                        </View>
                      ))}
                    </View>
                  )}
                </ScrollView>
              </View>
            </SafeAreaView>
          </Modal>

          {/* Insights Detail Modal */}
          <Modal
            visible={showInsightsDetail}
            animationType="slide"
            transparent={true}
            onRequestClose={() => setShowInsightsDetail(false)}
          >
            <SafeAreaView style={styles.modalOverlay}>
              <View style={styles.modalContent}>
                <View style={styles.modalHeader}>
                  <CustomText variant="title" weight="bold" fontFamily="figtree" style={styles.modalTitle}>
                    Performance Insights
                  </CustomText>
                  <TouchableOpacity
                    onPress={() => setShowInsightsDetail(false)}
                    style={styles.modalCloseButton}
                  >
                    <Feather name="x" size={24} color="#ECEDEE" />
                  </TouchableOpacity>
                </View>
                
                <ScrollView 
                  style={styles.modalScrollView} 
                  contentContainerStyle={styles.modalScrollContent}
                  showsVerticalScrollIndicator={false}
                >
                  {/* Stats Summary */}
                  <View style={styles.statsSummaryCard}>
                    <CustomText variant="subtitle" weight="bold" fontFamily="figtree" style={styles.statsSummaryTitle}>
                      Your Performance Stats
                    </CustomText>
                    <View style={styles.statsGrid}>
                      <View style={styles.statItem}>
                        <CustomText variant="title" weight="bold" fontFamily="figtree" style={styles.statValue}>
                          {stats.totalWorkouts}
                        </CustomText>
                        <CustomText variant="caption" weight="normal" fontFamily="figtree" style={styles.statLabel}>
                          Total Workouts
                        </CustomText>
                      </View>
                      <View style={styles.statItem}>
                        <CustomText variant="title" weight="bold" fontFamily="figtree" style={styles.statValue}>
                          {stats.personalRecords}
                        </CustomText>
                        <CustomText variant="caption" weight="normal" fontFamily="figtree" style={styles.statLabel}>
                          Personal Records
                        </CustomText>
                      </View>
                      <View style={styles.statItem}>
                        <CustomText variant="title" weight="bold" fontFamily="figtree" style={styles.statValue}>
                          {stats.thisWeekWorkouts}
                        </CustomText>
                        <CustomText variant="caption" weight="normal" fontFamily="figtree" style={styles.statLabel}>
                          This Week
                        </CustomText>
                      </View>
                    </View>
                  </View>

                  {/* Detailed Insights */}
                  <View style={styles.detailedInsightsCard}>
                    <CustomText variant="subtitle" weight="bold" fontFamily="figtree" style={styles.detailedInsightsTitle}>
                      AI Analysis
                    </CustomText>
                    {parsedInsights.map((insight, index) => (
                      <View key={index} style={styles.detailedInsightItem}>
                        <View style={styles.detailedInsightNumber}>
                          <CustomText variant="body" weight="bold" fontFamily="figtree" style={styles.detailedInsightNumberText}>
                            {index + 1}
                          </CustomText>
                        </View>
                        <CustomText variant="body" weight="normal" fontFamily="figtree" style={styles.detailedInsightText}>
                          {insight}
                        </CustomText>
                      </View>
                    ))}
                  </View>

                  {/* Recent Performance */}
                  {recentWorkouts.length > 0 && (
                    <View style={styles.recentPerformanceCard}>
                      <CustomText variant="subtitle" weight="bold" fontFamily="figtree" style={styles.recentPerformanceTitle}>
                        Recent Performance
                      </CustomText>
                      {recentWorkouts.slice(0, 5).map((workout, index) => (
                        <View key={workout.id || index} style={styles.recentPerformanceItem}>
                          <View style={styles.recentPerformanceInfo}>
                            <CustomText variant="body" weight="semibold" fontFamily="figtree" style={styles.recentPerformanceEvent}>
                              {workout.eventName || workout.eventId}
                            </CustomText>
                            {workout.timestamp && (
                              <CustomText variant="caption" weight="normal" fontFamily="figtree" style={styles.recentPerformanceDate}>
                                {workout.timestamp.toDate().toLocaleDateString()}
                              </CustomText>
                            )}
                          </View>
                          <CustomText variant="body" weight="bold" fontFamily="figtree" style={styles.recentPerformanceResult}>
                            {workout.eventId?.includes('field') || workout.eventId?.includes('jump') || workout.eventId?.includes('put') || workout.eventId?.includes('discus')
                              ? formatDistance(workout.result)
                              : formatTime(workout.result)}
                          </CustomText>
                        </View>
                      ))}
                    </View>
                  )}
                </ScrollView>
              </View>
            </SafeAreaView>
          </Modal>

          {/* Recent Workouts */}
          {recentWorkouts.length > 0 && (
            <View style={styles.section}>
              <View style={styles.sectionHeader}>
                <CustomText variant="subtitle" weight="bold" fontFamily="figtree" style={styles.sectionTitle}>
                  Recent Workouts
                </CustomText>
                <TouchableOpacity onPress={() => router.push('/authenticated_tabs/stats')}>
                  <CustomText variant="caption" weight="medium" fontFamily="figtree" style={styles.seeAllText}>
                    See All
                  </CustomText>
                </TouchableOpacity>
              </View>
              {recentWorkouts.map((workout, index) => (
                <TouchableOpacity
                  key={workout.id || index}
                  style={styles.workoutCard}
                  onPress={() => router.push('/authenticated_tabs/stats')}
                  onLongPress={() => setSelectedWorkoutId(workout.id || index.toString())}
                  activeOpacity={0.8}
                >
                  {selectedWorkoutId === (workout.id || index.toString()) && (
                    <TouchableOpacity
                      style={styles.deleteButton}
                      onPress={() => handleDeleteWorkout(workout)}
                    >
                      <Feather name="x" size={16} color="white" />
                    </TouchableOpacity>
                  )}
                  <View style={styles.workoutHeader}>
                    <View style={styles.workoutIconContainer}>
                      <Feather name="activity" size={20} color="#FF6B35" />
                    </View>
                    <View style={styles.workoutInfo}>
                      <CustomText variant="body" weight="bold" fontFamily="figtree" style={styles.workoutEvent}>
                        {workout.eventName || workout.eventId}
                      </CustomText>
                      {workout.timestamp && (
                        <CustomText variant="caption" weight="normal" fontFamily="figtree" style={styles.workoutDate}>
                          {workout.timestamp.toDate().toLocaleDateString()}
                        </CustomText>
                      )}
                    </View>
                  </View>
                  <CustomText variant="title" weight="bold" fontFamily="figtree" style={styles.workoutResult}>
                    {workout.eventId?.includes('field') || workout.eventId?.includes('jump') || workout.eventId?.includes('put') || workout.eventId?.includes('discus')
                      ? formatDistance(workout.result)
                      : formatTime(workout.result)}
                  </CustomText>
                </TouchableOpacity>
              ))}
            </View>
          )}

          {loading && (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color="#FF6B35" />
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
    paddingBottom: 150,
  },
  header: {
    marginBottom: 32,
    marginTop: 20,
  },
  greeting: {
    color: '#ECEDEE',
    fontSize: 32,
    marginBottom: 8,
  },
  subtitle: {
    color: '#9BA1A6',
    fontSize: 16,
  },
  statsGrid: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 32,
  },
  statCard: {
    flex: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderRadius: 16,
    padding: 16,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  statIconContainer: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
  },
  statValue: {
    color: '#ECEDEE',
    fontSize: 24,
    marginBottom: 4,
  },
  statLabel: {
    color: '#9BA1A6',
    fontSize: 12,
    textAlign: 'center',
  },
  section: {
    marginBottom: 32,
  },
  quickActionsSection: {
    marginTop: 24,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  sectionTitle: {
    color: '#ECEDEE',
    fontSize: 20,
  },
  seeAllText: {
    color: '#FF6B35',
    fontSize: 14,
  },
  quickActions: {
    flexDirection: 'row',
    gap: 12,
  },
  quickActionCard: {
    flex: 1,
    borderRadius: 16,
    overflow: 'hidden',
  },
  quickActionGradient: {
    padding: 20,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 120,
  },
  quickActionText: {
    color: 'white',
    fontSize: 16,
    marginTop: 12,
  },
  quickActionSecondary: {
    backgroundColor: 'rgba(255, 107, 53, 0.1)',
    padding: 20,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 120,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(255, 107, 53, 0.3)',
  },
  quickActionTextSecondary: {
    color: '#FF6B35',
    fontSize: 16,
    marginTop: 12,
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
  workoutCard: {
    position: 'relative',
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderLeftWidth: 3,
    borderLeftColor: '#FF6B35',
  },
  workoutHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  workoutIconContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255, 107, 53, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  workoutInfo: {
    flex: 1,
  },
  workoutEvent: {
    color: '#ECEDEE',
    fontSize: 16,
    marginBottom: 4,
  },
  workoutDate: {
    color: '#9BA1A6',
    fontSize: 12,
  },
  workoutResult: {
    color: '#FF6B35',
    fontSize: 24,
  },
  loadingContainer: {
    padding: 40,
    alignItems: 'center',
  },
  insightsContainer: {
    gap: 12,
  },
  insightCard: {
    backgroundColor: 'rgba(255, 107, 53, 0.1)',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: 'rgba(255, 107, 53, 0.2)',
  },
  insightHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  insightIconContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255, 107, 53, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  insightContent: {
    flex: 1,
  },
  insightText: {
    color: '#ECEDEE',
    fontSize: 14,
    lineHeight: 20,
  },
  insightsCard: {
    backgroundColor: 'rgba(255, 107, 53, 0.1)',
    borderRadius: 16,
    padding: 20,
    borderWidth: 1,
    borderColor: 'rgba(255, 107, 53, 0.2)',
  },
  insightsText: {
    color: '#ECEDEE',
    fontSize: 14,
    lineHeight: 22,
  },
  insightsLoading: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  insightsLoadingText: {
    color: '#9BA1A6',
    fontSize: 12,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#1A1A1A',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    height: Dimensions.get('window').height * 0.85,
    paddingTop: 20,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingBottom: 20,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.1)',
  },
  modalTitle: {
    color: '#ECEDEE',
    fontSize: 24,
  },
  modalCloseButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalScrollView: {
    flex: 1,
  },
  modalScrollContent: {
    paddingBottom: 40,
  },
  statsSummaryCard: {
    backgroundColor: 'rgba(255, 107, 53, 0.1)',
    borderRadius: 16,
    padding: 20,
    margin: 20,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: 'rgba(255, 107, 53, 0.2)',
  },
  statsSummaryTitle: {
    color: '#ECEDEE',
    fontSize: 18,
    marginBottom: 16,
  },
  statsGrid: {
    flexDirection: 'row',
    gap: 12,
  },
  statItem: {
    flex: 1,
    alignItems: 'center',
  },
  statValue: {
    color: '#FF6B35',
    fontSize: 28,
    marginBottom: 4,
  },
  statLabel: {
    color: '#9BA1A6',
    fontSize: 12,
    textAlign: 'center',
  },
  detailedInsightsCard: {
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderRadius: 16,
    padding: 20,
    margin: 20,
    marginTop: 0,
    marginBottom: 12,
  },
  detailedInsightsTitle: {
    color: '#ECEDEE',
    fontSize: 18,
    marginBottom: 16,
  },
  detailedInsightItem: {
    flexDirection: 'row',
    marginBottom: 16,
    gap: 12,
  },
  detailedInsightNumber: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(255, 107, 53, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  detailedInsightNumberText: {
    color: '#FF6B35',
    fontSize: 16,
  },
  detailedInsightText: {
    flex: 1,
    color: '#ECEDEE',
    fontSize: 14,
    lineHeight: 22,
  },
  recentPerformanceCard: {
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderRadius: 16,
    padding: 20,
    margin: 20,
    marginTop: 0,
    marginBottom: 20,
  },
  recentPerformanceTitle: {
    color: '#ECEDEE',
    fontSize: 18,
    marginBottom: 16,
  },
  recentPerformanceItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.05)',
  },
  recentPerformanceInfo: {
    flex: 1,
  },
  recentPerformanceEvent: {
    color: '#ECEDEE',
    fontSize: 14,
    marginBottom: 4,
  },
  recentPerformanceDate: {
    color: '#9BA1A6',
    fontSize: 12,
  },
  recentPerformanceResult: {
    color: '#FF6B35',
    fontSize: 16,
  },
  mentalNotesInputContainer: {
    padding: 20,
    flex: 1,
  },
  mentalNotesInput: {
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderRadius: 12,
    padding: 16,
    color: '#ECEDEE',
    fontSize: 16,
    fontFamily: 'Figtree_400Regular',
    minHeight: 200,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  modalActions: {
    padding: 20,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.1)',
  },
  saveButton: {
    backgroundColor: '#FF6B35',
    borderRadius: 12,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  saveButtonDisabled: {
    opacity: 0.6,
  },
  saveButtonText: {
    color: 'white',
    fontSize: 16,
  },
});
