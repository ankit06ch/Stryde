import React, { useState, useEffect, useRef } from 'react';
import { View, ScrollView, StyleSheet, Dimensions, TouchableOpacity, Platform, Modal, Alert, Pressable } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Feather } from '@expo/vector-icons';
import Svg, { Path, Circle, Line, G, Text as SvgText } from 'react-native-svg';
import CustomText from '../../components/CustomText';
import { auth, db } from '../../firebase/config';
import { collection, query, where, getDocs, orderBy, limit, deleteDoc, doc } from 'firebase/firestore';
import { 
  getWorkouts, 
  isHealthKitAvailable,
  getStepCount,
  getHeartRateData,
  getDistanceWalkingRunning,
  getActiveEnergyBurned,
} from '../../utils/healthKitUtils';
import AsyncStorage from '@react-native-async-storage/async-storage';

const HEALTHKIT_AUTHORIZED_KEY = '@healthkit_authorized';

const { width } = Dimensions.get('window');

export default function StatsScreen() {
  const [personalRecords, setPersonalRecords] = useState<any[]>([]);
  const [recentPerformances, setRecentPerformances] = useState<any[]>([]);
  const [healthKitWorkouts, setHealthKitWorkouts] = useState<any[]>([]);
  const [healthKitPRs, setHealthKitPRs] = useState<any[]>([]);
  const [healthKitAvailable, setHealthKitAvailable] = useState(false);
  const [healthKitStats, setHealthKitStats] = useState({
    totalSteps: 0,
    totalDistance: 0,
    totalCalories: 0,
    totalActiveCalories: 0,
    totalRestingCalories: 0,
    avgHeartRate: 0,
    maxHeartRate: 0,
    minHeartRate: 0,
    totalWorkouts: 0,
    totalWorkoutMinutes: 0,
  });
  const [chartData, setChartData] = useState({
    steps: [] as number[],
    distance: [] as number[],
    calories: [] as number[],
    heartRate: [] as number[],
    labels: [] as string[],
  });
  const [isHealthKitAuthorized, setIsHealthKitAuthorized] = useState(false);
  const [loading, setLoading] = useState(true);
  const [selectedPeriod, setSelectedPeriod] = useState<'day' | 'week' | 'month' | 'year' | 'all'>('month');
  const [showGraphView, setShowGraphView] = useState(false);
  const [selectedPerformanceId, setSelectedPerformanceId] = useState<string | null>(null);
  const [todayWorkouts, setTodayWorkouts] = useState<any[]>([]);
  const [performanceScore, setPerformanceScore] = useState<{
    overall: number;
    breakdown: {
      volume: number;
      intensity: number;
      consistency: number;
      efficiency: number;
      variety: number;
    };
    details: {
      totalWorkouts: number;
      totalDistance: number;
      totalTime: number;
      avgPace: number;
      totalSteps: number;
      eventTypes: number;
      prCount: number;
    };
  } | null>(null);

  // Load Firebase stats when period changes
  useEffect(() => {
    loadStats();
  }, [selectedPeriod]);

  // Load today's workouts and calculate performance score
  useEffect(() => {
    loadTodayWorkouts();
  }, []);

  // Check HealthKit availability on mount
  useEffect(() => {
    if (Platform.OS === 'ios') {
      checkHealthKitAndLoad();
    }
  }, []);
  
  // Check authorization status on mount and periodically
  useEffect(() => {
    const checkAuth = async () => {
      const authStatus = await AsyncStorage.getItem(HEALTHKIT_AUTHORIZED_KEY);
      setIsHealthKitAuthorized(authStatus === 'true');
    };
    checkAuth();
    
    // Check every 3 seconds for authorization changes
    const interval = setInterval(checkAuth, 3000);
    return () => clearInterval(interval);
  }, []);
  
  // Load HealthKit data when authorized and period changes - use ref to prevent loops
  const loadingRef = useRef(false);
  useEffect(() => {
    if (isHealthKitAuthorized && healthKitAvailable && !loadingRef.current) {
      loadingRef.current = true;
      loadHealthKitData().finally(() => {
        loadingRef.current = false;
      });
    }
  }, [selectedPeriod, isHealthKitAuthorized, healthKitAvailable]);

  const checkHealthKitAndLoad = async () => {
    try {
      const available = await isHealthKitAvailable();
      setHealthKitAvailable(available);
      
      // Check authorization status
      const isAuthorized = await AsyncStorage.getItem(HEALTHKIT_AUTHORIZED_KEY);
      setIsHealthKitAuthorized(isAuthorized === 'true');
    } catch (error) {
      console.error('Error checking HealthKit:', error);
      setHealthKitAvailable(false);
      setIsHealthKitAuthorized(false);
    }
  };

  const loadHealthKitData = async () => {
    // Double-check authorization before loading
    const isAuthorized = await AsyncStorage.getItem(HEALTHKIT_AUTHORIZED_KEY);
    if (isAuthorized !== 'true') {
      console.log('HealthKit not authorized, skipping data load');
      setHealthKitStats({
        totalSteps: 0,
        totalDistance: 0,
        totalCalories: 0,
        avgHeartRate: 0,
        maxHeartRate: 0,
      });
      setHealthKitWorkouts([]);
      setHealthKitPRs([]);
      return;
    }
    
    try {
      const now = new Date();
      let startDate: Date;
      let endDate: Date = now;
      
      switch (selectedPeriod) {
        case 'day':
          // Today: midnight to now (like Apple Fitness)
          startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);
          break;
        case 'week':
          // Start of week (Sunday) to now
          const dayOfWeek = now.getDay();
          startDate = new Date(now);
          startDate.setDate(now.getDate() - dayOfWeek);
          startDate.setHours(0, 0, 0, 0);
          break;
        case 'month':
          // Start of month to now
          startDate = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0);
          break;
        case 'year':
          // Start of year to now
          startDate = new Date(now.getFullYear(), 0, 1, 0, 0, 0, 0);
          break;
        default:
          // All time: from a reasonable start date (e.g., 2 years ago)
          startDate = new Date(now.getFullYear() - 2, 0, 1, 0, 0, 0, 0);
      }

      // Load workouts and health metrics in parallel - catch errors to prevent crashes
      console.log(`[HealthKit] Fetching data from ${startDate.toISOString()} to ${endDate.toISOString()}`);
      
      const [workouts, steps, heartRate, distance, calories] = await Promise.all([
        getWorkouts(startDate, endDate).catch((err) => {
          console.error('[HealthKit] Error fetching workouts:', err);
          return [];
        }),
        getStepCount(startDate, endDate).catch((err) => {
          console.error('[HealthKit] Error fetching steps:', err);
          return [];
        }),
        getHeartRateData(startDate, endDate).catch((err) => {
          console.error('[HealthKit] Error fetching heart rate:', err);
          return [];
        }),
        getDistanceWalkingRunning(startDate, endDate).catch((err) => {
          console.error('[HealthKit] Error fetching distance:', err);
          return [];
        }),
        getActiveEnergyBurned(startDate, endDate).catch((err) => {
          console.error('[HealthKit] Error fetching calories:', err);
          return [];
        }),
      ]);

      // Log all fetched data
      console.log('[HealthKit] ===== FETCHED DATA SUMMARY =====');
      console.log(`[HealthKit] Workouts: ${workouts?.length || 0} found`);
      if (workouts && workouts.length > 0) {
        console.log('[HealthKit] Workout details:', JSON.stringify(workouts.slice(0, 3), null, 2));
      }
      console.log(`[HealthKit] Step samples: ${steps?.length || 0} found`);
      if (steps && steps.length > 0) {
        console.log('[HealthKit] Step samples (first 3):', JSON.stringify(steps.slice(0, 3), null, 2));
      }
      console.log(`[HealthKit] Heart rate samples: ${heartRate?.length || 0} found`);
      if (heartRate && heartRate.length > 0) {
        console.log('[HealthKit] Heart rate samples (first 3):', JSON.stringify(heartRate.slice(0, 3), null, 2));
      }
      console.log(`[HealthKit] Distance samples: ${distance?.length || 0} found`);
      if (distance && distance.length > 0) {
        console.log('[HealthKit] Distance samples (first 3):', JSON.stringify(distance.slice(0, 3), null, 2));
      }
      console.log(`[HealthKit] Calorie samples: ${calories?.length || 0} found`);
      if (calories && calories.length > 0) {
        console.log('[HealthKit] Calorie samples (first 3):', JSON.stringify(calories.slice(0, 3), null, 2));
      }
      console.log('[HealthKit] ===== END DATA SUMMARY =====');

      // Calculate health stats - handle different data formats
      // Steps and distance might be aggregated differently in HealthKit
      console.log('[HealthKit] Processing steps data:', steps?.length || 0, 'samples');
      console.log('[HealthKit] Processing distance data:', distance?.length || 0, 'samples');
      
      // Calculate totals - handle both daily aggregated samples and individual samples
      // Daily samples already contain daily totals, so we sum them directly
      const totalSteps = steps?.reduce((sum, sample) => {
        // Handle both daily aggregated samples and individual samples
        const value = sample?.value ?? sample?.count ?? sample?.quantity ?? sample?.steps ?? 
                     (typeof sample === 'number' ? sample : 0);
        const numValue = typeof value === 'number' ? value : parseFloat(value) || 0;
        return sum + numValue;
      }, 0) || 0;
      
      const totalDistance = distance?.reduce((sum, sample) => {
        // Distance in meters - daily samples are already daily totals
        const value = sample?.value ?? sample?.distance ?? sample?.quantity ?? sample?.meters ??
                     (typeof sample === 'number' ? sample : 0);
        const numValue = typeof value === 'number' ? value : parseFloat(value) || 0;
        return sum + numValue;
      }, 0) || 0;
      
      const totalCalories = calories?.reduce((sum, sample) => {
        // Calories - daily samples are already daily totals
        const value = sample?.value ?? sample?.energy ?? sample?.quantity ?? sample?.calories ?? 0;
        return sum + (typeof value === 'number' ? value : parseFloat(value) || 0);
      }, 0) || 0;
      
      const heartRateValues = heartRate?.map(s => s?.value || 0).filter(v => v > 0) || [];
      const avgHeartRate = heartRateValues.length > 0
        ? heartRateValues.reduce((sum, v) => sum + v, 0) / heartRateValues.length
        : 0;
      const maxHeartRate = heartRateValues.length > 0
        ? Math.max(...heartRateValues)
        : 0;

      // Calculate workout statistics
      const totalWorkouts = workouts?.length || 0;
      const totalWorkoutMinutes = workouts?.reduce((sum, workout) => {
        const duration = workout.duration || workout.totalDuration || 0;
        return sum + (duration / 60); // Convert seconds to minutes
      }, 0) || 0;
      
      const minHeartRate = heartRateValues.length > 0
        ? Math.min(...heartRateValues)
        : 0;

      console.log('[HealthKit] Calculated Stats:', {
        totalSteps,
        totalDistance: `${(totalDistance / 1609.34).toFixed(2)} mi`,
        totalActiveCalories: totalCalories,
        avgHeartRate: `${avgHeartRate.toFixed(0)} bpm`,
        maxHeartRate: `${maxHeartRate} bpm`,
        minHeartRate: minHeartRate > 0 ? `${minHeartRate} bpm` : 'N/A',
        totalWorkouts,
        totalWorkoutMinutes: `${Math.round(totalWorkoutMinutes)} min`,
      });

      setHealthKitStats({
        totalSteps,
        totalDistance,
        totalCalories,
        totalActiveCalories: totalCalories, // Active calories (we're already fetching active energy)
        totalRestingCalories: 0, // Would need to fetch basal energy separately
        avgHeartRate,
        maxHeartRate,
        minHeartRate,
        totalWorkouts,
        totalWorkoutMinutes,
      });

      // Process samples into time-series data for charts
      const processChartData = () => {
        const now = new Date();
        let periodCount = 0;
        let periodLabel = '';
        
        switch (selectedPeriod) {
          case 'day':
            periodCount = 24; // Hours
            periodLabel = 'hour';
            break;
          case 'week':
            periodCount = 7; // Days
            periodLabel = 'day';
            break;
          case 'month':
            periodCount = 30; // Days
            periodLabel = 'day';
            break;
          case 'year':
            periodCount = 12; // Months
            periodLabel = 'month';
            break;
          default:
            periodCount = 12; // Months
            periodLabel = 'month';
        }

        // Create time buckets
        const buckets: { [key: string]: { steps: number, distance: number, calories: number, heartRate: number[] } } = {};
        const labels: string[] = [];
        
        for (let i = periodCount - 1; i >= 0; i--) {
          const bucketDate = new Date(now);
          let bucketKey = '';
          
          if (selectedPeriod === 'day') {
            bucketDate.setHours(now.getHours() - i, 0, 0, 0);
            labels.push(`${bucketDate.getHours()}:00`);
            bucketKey = `${bucketDate.getFullYear()}-${String(bucketDate.getMonth() + 1).padStart(2, '0')}-${String(bucketDate.getDate()).padStart(2, '0')}-${String(bucketDate.getHours()).padStart(2, '0')}`;
          } else if (selectedPeriod === 'week' || selectedPeriod === 'month') {
            bucketDate.setDate(now.getDate() - i);
            bucketDate.setHours(0, 0, 0, 0);
            labels.push(bucketDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }));
            bucketKey = bucketDate.toISOString().split('T')[0];
          } else {
            bucketDate.setMonth(now.getMonth() - i, 1);
            bucketDate.setHours(0, 0, 0, 0);
            labels.push(bucketDate.toLocaleDateString('en-US', { month: 'short' }));
            bucketKey = `${bucketDate.getFullYear()}-${String(bucketDate.getMonth() + 1).padStart(2, '0')}`;
          }
          buckets[bucketKey] = { steps: 0, distance: 0, calories: 0, heartRate: [] };
        }

        // Aggregate steps by time bucket
        steps?.forEach((sample: any) => {
          const value = sample?.value ?? sample?.count ?? sample?.quantity ?? sample?.steps ?? 0;
          const numValue = typeof value === 'number' ? value : parseFloat(value) || 0;
          if (numValue > 0) {
            const sampleDate = sample?.startDate ? new Date(sample.startDate) : 
                              sample?.date ? new Date(sample.date) : new Date();
            let bucketKey = '';
            if (selectedPeriod === 'day') {
              bucketKey = `${sampleDate.getFullYear()}-${String(sampleDate.getMonth() + 1).padStart(2, '0')}-${String(sampleDate.getDate()).padStart(2, '0')}-${String(sampleDate.getHours()).padStart(2, '0')}`;
            } else if (selectedPeriod === 'week' || selectedPeriod === 'month') {
              bucketKey = sampleDate.toISOString().split('T')[0];
            } else {
              bucketKey = `${sampleDate.getFullYear()}-${String(sampleDate.getMonth() + 1).padStart(2, '0')}`;
            }
            if (buckets[bucketKey]) {
              buckets[bucketKey].steps += numValue;
            }
          }
        });

        // Aggregate distance by time bucket
        distance?.forEach((sample: any) => {
          const value = sample?.value ?? sample?.distance ?? sample?.quantity ?? sample?.meters ?? 0;
          const numValue = typeof value === 'number' ? value : parseFloat(value) || 0;
          if (numValue > 0) {
            const sampleDate = sample?.startDate ? new Date(sample.startDate) : 
                              sample?.date ? new Date(sample.date) : new Date();
            let bucketKey = '';
            if (selectedPeriod === 'day') {
              bucketKey = `${sampleDate.getFullYear()}-${String(sampleDate.getMonth() + 1).padStart(2, '0')}-${String(sampleDate.getDate()).padStart(2, '0')}-${String(sampleDate.getHours()).padStart(2, '0')}`;
            } else if (selectedPeriod === 'week' || selectedPeriod === 'month') {
              bucketKey = sampleDate.toISOString().split('T')[0];
            } else {
              bucketKey = `${sampleDate.getFullYear()}-${String(sampleDate.getMonth() + 1).padStart(2, '0')}`;
            }
            if (buckets[bucketKey]) {
              buckets[bucketKey].distance += numValue;
            }
          }
        });

        // Aggregate calories by time bucket
        calories?.forEach((sample: any) => {
          const value = sample?.value ?? sample?.energy ?? sample?.quantity ?? sample?.calories ?? 0;
          const numValue = typeof value === 'number' ? value : parseFloat(value) || 0;
          if (numValue > 0) {
            const sampleDate = sample?.startDate ? new Date(sample.startDate) : 
                              sample?.date ? new Date(sample.date) : new Date();
            let bucketKey = '';
            if (selectedPeriod === 'day') {
              bucketKey = `${sampleDate.getFullYear()}-${String(sampleDate.getMonth() + 1).padStart(2, '0')}-${String(sampleDate.getDate()).padStart(2, '0')}-${String(sampleDate.getHours()).padStart(2, '0')}`;
            } else if (selectedPeriod === 'week' || selectedPeriod === 'month') {
              bucketKey = sampleDate.toISOString().split('T')[0];
            } else {
              bucketKey = `${sampleDate.getFullYear()}-${String(sampleDate.getMonth() + 1).padStart(2, '0')}`;
            }
            if (buckets[bucketKey]) {
              buckets[bucketKey].calories += numValue;
            }
          }
        });

        // Aggregate heart rate by time bucket (use average per period)
        heartRate?.forEach((sample: any) => {
          const value = sample?.value || 0;
          if (value > 0) {
            const sampleDate = sample?.startDate ? new Date(sample.startDate) : 
                              sample?.date ? new Date(sample.date) : new Date();
            let bucketKey = '';
            if (selectedPeriod === 'day') {
              bucketKey = `${sampleDate.getFullYear()}-${String(sampleDate.getMonth() + 1).padStart(2, '0')}-${String(sampleDate.getDate()).padStart(2, '0')}-${String(sampleDate.getHours()).padStart(2, '0')}`;
            } else if (selectedPeriod === 'week' || selectedPeriod === 'month') {
              bucketKey = sampleDate.toISOString().split('T')[0];
            } else {
              bucketKey = `${sampleDate.getFullYear()}-${String(sampleDate.getMonth() + 1).padStart(2, '0')}`;
            }
            if (buckets[bucketKey]) {
              buckets[bucketKey].heartRate.push(value);
            }
          }
        });

        // Convert buckets to arrays, filtering out zero values
        const stepsData: number[] = [];
        const distanceData: number[] = [];
        const caloriesData: number[] = [];
        const heartRateData: number[] = [];
        const stepsLabels: string[] = [];
        const distanceLabels: string[] = [];
        const caloriesLabels: string[] = [];
        const heartRateLabels: string[] = [];

        Object.keys(buckets).sort().forEach((key, index) => {
          const bucket = buckets[key];
          const steps = bucket.steps;
          const dist = bucket.distance / 1609.34; // Convert to miles
          const cals = bucket.calories;
          // Average heart rate for this period
          const avgHR = bucket.heartRate.length > 0
            ? bucket.heartRate.reduce((sum, v) => sum + v, 0) / bucket.heartRate.length
            : 0;
          
          // Only add non-zero values with their corresponding labels
          if (steps > 0) {
            stepsData.push(steps);
            stepsLabels.push(labels[index] || '');
          }
          if (dist > 0) {
            distanceData.push(dist);
            distanceLabels.push(labels[index] || '');
          }
          if (cals > 0) {
            caloriesData.push(cals);
            caloriesLabels.push(labels[index] || '');
          }
          if (avgHR > 0) {
            heartRateData.push(avgHR);
            heartRateLabels.push(labels[index] || '');
          }
        });

        setChartData({
          steps: stepsData,
          distance: distanceData,
          calories: caloriesData,
          heartRate: heartRateData,
          labels: labels, // Keep original labels for fallback
        });
      };

      processChartData();
      
      if (!workouts || workouts.length === 0) {
        setHealthKitPRs([]);
        setHealthKitWorkouts([]);
        return;
      }
      
      // Process workouts to find PRs and recent performances
      const workoutsByType: { [key: string]: any[] } = {};
      workouts.forEach((workout: any) => {
        const workoutType = workout.activityType || workout.type || 'Workout';
        if (!workoutsByType[workoutType]) {
          workoutsByType[workoutType] = [];
        }
        workoutsByType[workoutType].push(workout);
      });

      // Find personal records (best performance per workout type)
      const prs: any[] = [];
      Object.keys(workoutsByType).forEach(type => {
        const typeWorkouts = workoutsByType[type];
        if (typeWorkouts.length === 0) return;
        
        // For running, find longest distance
        // For other workouts, find longest duration or highest calories
        const best = typeWorkouts.reduce((best, current) => {
          if (type.includes('Running') || type.includes('Walking')) {
            // For running, prefer longer distance
            const currentDistance = current.totalDistance || 0;
            const bestDistance = best.totalDistance || 0;
            return currentDistance > bestDistance ? current : best;
          } else {
            // For other workouts, prefer longer duration or more calories
            const currentDuration = current.duration || 0;
            const bestDuration = best.duration || 0;
            return currentDuration > bestDuration ? current : best;
          }
        });
        prs.push({
          ...best,
          eventName: type,
          source: 'Apple Watch',
        });
      });

      // Sort workouts by date (most recent first)
      const sortedWorkouts = workouts
        .sort((a: any, b: any) => {
          const aDate = a.startDate ? new Date(a.startDate).getTime() : 0;
          const bDate = b.startDate ? new Date(b.startDate).getTime() : 0;
          return bDate - aDate;
        })
        .slice(0, 20)
        .map((workout: any) => ({
          ...workout,
          eventName: workout.activityType || workout.type || 'Workout',
          source: 'Apple Watch',
          timestamp: workout.startDate ? { toDate: () => new Date(workout.startDate) } : null,
        }));

      setHealthKitPRs(prs);
      setHealthKitWorkouts(sortedWorkouts);
      
      // Merge with existing Firebase data
      mergeHealthKitData(prs, sortedWorkouts);
    } catch (error: any) {
      console.error('Error loading HealthKit data:', error);
      // If authorization error, clear the stored status
      if (error?.message?.includes('Authorization') || error?.message?.includes('Code=5')) {
        await AsyncStorage.removeItem(HEALTHKIT_AUTHORIZED_KEY);
        setIsHealthKitAuthorized(false);
      }
      setHealthKitPRs([]);
      setHealthKitWorkouts([]);
      setHealthKitStats({
        totalSteps: 0,
        totalDistance: 0,
        totalCalories: 0,
        totalActiveCalories: 0,
        totalRestingCalories: 0,
        avgHeartRate: 0,
        maxHeartRate: 0,
        minHeartRate: 0,
        totalWorkouts: 0,
        totalWorkoutMinutes: 0,
      });
    }
  };

  const mergeHealthKitData = (prs: any[], workouts: any[]) => {
    // Merge PRs with existing Firebase PRs
    setPersonalRecords(prev => {
      const merged = [...prev, ...prs];
      // Remove duplicates and keep best performance per event
      const unique: { [key: string]: any } = {};
      merged.forEach(pr => {
        const key = pr.eventName || pr.eventId || 'unknown';
        if (!unique[key] || (pr.source === 'Apple Watch' && !unique[key].source)) {
          unique[key] = pr;
        }
      });
      return Object.values(unique);
    });
    
    // Merge recent performances with existing Firebase performances
    setRecentPerformances(prev => {
      const merged = [...prev, ...workouts];
      return merged
        .sort((a, b) => {
          const aTime = a.timestamp?.toDate?.()?.getTime() || (a.startDate ? new Date(a.startDate).getTime() : 0);
          const bTime = b.timestamp?.toDate?.()?.getTime() || (b.startDate ? new Date(b.startDate).getTime() : 0);
          return bTime - aTime;
        })
        .slice(0, 20);
    });
  };

  const loadTodayWorkouts = async () => {
    const user = auth.currentUser;
    if (!user) return;

    try {
      const now = new Date();
      const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);
      const endOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);

      // Load all workouts and filter today's in memory
      const workoutsQuery = query(
        collection(db, 'workouts'),
        where('userId', '==', user.uid)
      );
      const workoutsSnapshot = await getDocs(workoutsQuery);
      const allWorkouts = workoutsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

      // Filter today's workouts
      const today = allWorkouts.filter(workout => {
        const workoutDate = workout.timestamp?.toDate() || new Date(0);
        return workoutDate >= startOfDay && workoutDate <= endOfDay;
      });

      setTodayWorkouts(today);
      calculatePerformanceScore(today, allWorkouts);
    } catch (error) {
      console.error('Error loading today workouts:', error);
    }
  };

  const calculatePerformanceScore = (todayWorkouts: any[], allWorkouts: any[]) => {
    if (todayWorkouts.length === 0) {
      setPerformanceScore(null);
      return;
    }

    // Calculate details
    const totalWorkouts = todayWorkouts.length;
    const totalDistance = todayWorkouts.reduce((sum, w) => sum + (w.distance || 0), 0);
    const totalTime = todayWorkouts.reduce((sum, w) => sum + (w.duration || 0), 0);
    const totalSteps = todayWorkouts.reduce((sum, w) => sum + (w.steps || 0), 0);
    const eventTypes = new Set(todayWorkouts.map(w => w.eventId || w.eventName)).size;
    
    // Calculate average pace (seconds per meter)
    const avgPace = totalDistance > 0 ? totalTime / totalDistance : 0;

    // Find PRs from all workouts to compare
    const prsByEvent: { [key: string]: any } = {};
    allWorkouts.forEach(workout => {
      const eventId = workout.eventId;
      if (!prsByEvent[eventId] || workout.result < prsByEvent[eventId].result) {
        prsByEvent[eventId] = workout;
      }
    });

    // Count how many of today's workouts are PRs
    const prCount = todayWorkouts.filter(w => {
      const pr = prsByEvent[w.eventId];
      return pr && Math.abs(w.result - pr.result) < 0.01; // Within 0.01 tolerance
    }).length;

    // Calculate score components (0-100 each)
    
    // 1. Volume Score (based on number of workouts, distance, time)
    const volumeScore = Math.min(100, 
      (totalWorkouts * 20) + // 5 workouts = 100
      Math.min(40, (totalDistance / 1000) * 10) + // 4km = 40 points
      Math.min(40, (totalTime / 3600) * 20) // 2 hours = 40 points
    );

    // 2. Intensity Score (based on pace, steps per workout, PRs)
    const avgStepsPerWorkout = totalWorkouts > 0 ? totalSteps / totalWorkouts : 0;
    const intensityFromPace = avgPace > 0 ? Math.min(40, (1 / avgPace) * 100) : 0; // Faster pace = higher score
    const intensityFromSteps = Math.min(30, (avgStepsPerWorkout / 200) * 30); // 200 steps/workout = 30 points
    const intensityFromPRs = Math.min(30, (prCount / totalWorkouts) * 30); // All PRs = 30 points
    const intensityScore = intensityFromPace + intensityFromSteps + intensityFromPRs;

    // 3. Consistency Score (based on workout distribution throughout day)
    const workoutTimes = todayWorkouts
      .map(w => w.timestamp?.toDate()?.getHours() || 12)
      .sort((a, b) => a - b);
    let consistencyScore = 50; // Base score
    if (workoutTimes.length > 1) {
      const timeSpread = workoutTimes[workoutTimes.length - 1] - workoutTimes[0];
      consistencyScore += Math.min(30, timeSpread * 2); // More spread = better
    }
    if (totalWorkouts >= 2) {
      consistencyScore += 20; // Bonus for multiple workouts
    }

    // 4. Efficiency Score (based on pace consistency, optimal workout duration)
    let efficiencyScore = 50;
    if (totalWorkouts > 1) {
      const paces = todayWorkouts
        .filter(w => w.distance > 0 && w.duration > 0)
        .map(w => w.duration / w.distance);
      if (paces.length > 1) {
        const avgPace = paces.reduce((a, b) => a + b, 0) / paces.length;
        const variance = paces.reduce((sum, p) => sum + Math.pow(p - avgPace, 2), 0) / paces.length;
        const consistency = Math.max(0, 50 - (variance * 100)); // Lower variance = higher score
        efficiencyScore = 30 + consistency;
      }
    }
    // Bonus for optimal workout duration (15-60 minutes)
    const avgDuration = totalWorkouts > 0 ? totalTime / totalWorkouts : 0;
    if (avgDuration >= 900 && avgDuration <= 3600) {
      efficiencyScore += 20;
    }

    // 5. Variety Score (based on different event types)
    const varietyScore = Math.min(100, eventTypes * 20); // 5 different events = 100

    // Calculate overall score (weighted average)
    const overall = Math.round(
      volumeScore * 0.25 +
      intensityScore * 0.30 +
      consistencyScore * 0.20 +
      efficiencyScore * 0.15 +
      varietyScore * 0.10
    );

    setPerformanceScore({
      overall: Math.min(100, overall),
      breakdown: {
        volume: Math.round(volumeScore),
        intensity: Math.round(intensityScore),
        consistency: Math.round(consistencyScore),
        efficiency: Math.round(efficiencyScore),
        variety: Math.round(varietyScore),
      },
      details: {
        totalWorkouts,
        totalDistance,
        totalTime,
        avgPace,
        totalSteps,
        eventTypes,
        prCount,
      },
    });
  };

  const loadStats = async () => {
    const user = auth.currentUser;
    if (!user) {
      setLoading(false);
      return;
    }

    try {
      // Load all workouts and process in memory to avoid index requirement
      const workoutsQuery = query(
        collection(db, 'workouts'),
        where('userId', '==', user.uid)
      );
      const workoutsSnapshot = await getDocs(workoutsQuery);
      const allWorkouts = workoutsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      
      // Group by event to find best performance (personal records)
      const prsByEvent: { [key: string]: any } = {};
      allWorkouts.forEach(workout => {
        const eventId = workout.eventId;
        if (!prsByEvent[eventId] || workout.result < prsByEvent[eventId].result) {
          prsByEvent[eventId] = workout;
        }
      });

      // Load recent performances - sort by timestamp descending
      const recent = allWorkouts
        .sort((a, b) => {
          const aTime = a.timestamp?.toDate()?.getTime() || 0;
          const bTime = b.timestamp?.toDate()?.getTime() || 0;
          return bTime - aTime; // Descending order
        })
        .slice(0, 20);
      
      // Set Firebase data first, then merge with HealthKit data if available
      setRecentPerformances(recent);
      setPersonalRecords(Object.values(prsByEvent));
      
      // Reload today's workouts to recalculate score
      await loadTodayWorkouts();
      
      // If HealthKit data is already loaded, merge it
      if (healthKitWorkouts.length > 0 || healthKitPRs.length > 0) {
        mergeHealthKitData(healthKitPRs, healthKitWorkouts);
      }
    } catch (error) {
      console.error('Error loading stats:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleDeletePerformance = async (performance: any) => {
    Alert.alert(
      'Delete Performance',
      'Are you sure you want to delete this performance?',
      [
        { text: 'Cancel', style: 'cancel', onPress: () => setSelectedPerformanceId(null) },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              // Only delete if it's from Firebase (has an id and is not from HealthKit)
              if (performance.id && !performance.source) {
                await deleteDoc(doc(db, 'workouts', performance.id));
              }
              // Remove from local state
              setRecentPerformances(prev => prev.filter(p => p.id !== performance.id && p !== performance));
              setSelectedPerformanceId(null);
              // Reload stats to update personal records
              await loadStats();
            } catch (error) {
              console.error('Error deleting performance:', error);
              Alert.alert('Error', 'Failed to delete performance. Please try again.');
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

  return (
    <View style={styles.container}>
      <LinearGradient
        colors={['#0A0A0A', '#1A1A1A', '#0A0A0A']}
        style={StyleSheet.absoluteFill}
      />
      <SafeAreaView style={styles.safeArea}>
        <Pressable onPress={() => setSelectedPerformanceId(null)} style={{ flex: 1 }}>
          <ScrollView 
            style={styles.scrollView}
            contentContainerStyle={styles.scrollContent}
            showsVerticalScrollIndicator={false}
            onScrollBeginDrag={() => setSelectedPerformanceId(null)}
            scrollEventThrottle={16}
          >
            {/* Header */}
            <View style={styles.header}>
            <CustomText variant="title" weight="bold" fontFamily="figtree" style={styles.title}>
              Performance Stats
            </CustomText>
            <CustomText variant="body" weight="normal" fontFamily="figtree" style={styles.subtitle}>
              Track your progress and personal records
            </CustomText>
          </View>

          {/* Period Selector */}
          <View style={styles.periodSelector}>
            {(['day', 'week', 'month', 'year', 'all'] as const).map(period => (
              <TouchableOpacity
                key={period}
                style={[
                  styles.periodButton,
                  selectedPeriod === period && styles.periodButtonActive
                ]}
                onPress={() => setSelectedPeriod(period)}
              >
                <CustomText 
                  variant="caption" 
                  weight={selectedPeriod === period ? 'bold' : 'medium'} 
                  fontFamily="figtree"
                  style={[
                    styles.periodButtonText,
                    selectedPeriod === period && styles.periodButtonTextActive
                  ]}
                >
                  {period.charAt(0).toUpperCase() + period.slice(1)}
                </CustomText>
              </TouchableOpacity>
            ))}
          </View>

          {/* Performance Score Section */}
          {performanceScore && (
            <View style={styles.section}>
              <View style={styles.sectionHeader}>
                <Feather name="award" size={24} color="#FF6B35" />
                <CustomText variant="subtitle" weight="bold" fontFamily="figtree" style={styles.sectionTitle}>
                  Today's Performance Score
                </CustomText>
              </View>

              <View style={styles.performanceScoreCard}>
                {/* Overall Score */}
                <View style={styles.overallScoreContainer}>
                  <View style={styles.scoreCircle}>
                    <CustomText variant="title" weight="bold" fontFamily="figtree" style={styles.overallScore}>
                      {performanceScore.overall}
                    </CustomText>
                    <CustomText variant="caption" weight="normal" fontFamily="figtree" style={styles.scoreLabel}>
                      / 100
                    </CustomText>
                  </View>
                  <View style={styles.scoreDescription}>
                    <CustomText variant="body" weight="semibold" fontFamily="figtree" style={styles.scoreTitle}>
                      {performanceScore.overall >= 90 ? 'Elite Performance' :
                       performanceScore.overall >= 75 ? 'Excellent' :
                       performanceScore.overall >= 60 ? 'Good' :
                       performanceScore.overall >= 45 ? 'Average' : 'Needs Improvement'}
                    </CustomText>
                    <CustomText variant="caption" weight="normal" fontFamily="figtree" style={styles.scoreSubtitle}>
                      Based on {performanceScore.details.totalWorkouts} workout{performanceScore.details.totalWorkouts !== 1 ? 's' : ''} today
                    </CustomText>
                  </View>
                </View>

                {/* Score Breakdown */}
                <View style={styles.breakdownContainer}>
                  <CustomText variant="body" weight="bold" fontFamily="figtree" style={styles.breakdownTitle}>
                    Score Breakdown
                  </CustomText>
                  
                  {[
                    { label: 'Volume', value: performanceScore.breakdown.volume, icon: 'activity', color: '#4CAF50' },
                    { label: 'Intensity', value: performanceScore.breakdown.intensity, icon: 'zap', color: '#FF6B35' },
                    { label: 'Consistency', value: performanceScore.breakdown.consistency, icon: 'repeat', color: '#2196F3' },
                    { label: 'Efficiency', value: performanceScore.breakdown.efficiency, icon: 'target', color: '#9C27B0' },
                    { label: 'Variety', value: performanceScore.breakdown.variety, icon: 'layers', color: '#FF9800' },
                  ].map((metric, index) => (
                    <View key={index} style={styles.breakdownItem}>
                      <View style={styles.breakdownHeader}>
                        <View style={styles.breakdownIconContainer}>
                          <Feather name={metric.icon as any} size={16} color={metric.color} />
                        </View>
                        <CustomText variant="caption" weight="medium" fontFamily="figtree" style={styles.breakdownLabel}>
                          {metric.label}
                        </CustomText>
                        <CustomText variant="caption" weight="bold" fontFamily="figtree" style={styles.breakdownValue}>
                          {metric.value}
                        </CustomText>
                      </View>
                      <View style={styles.progressBarContainer}>
                        <View style={[styles.progressBar, { width: `${metric.value}%`, backgroundColor: metric.color }]} />
                      </View>
                    </View>
                  ))}
                </View>
              </View>
            </View>
          )}

          {/* Apple Health/Apple Watch Section */}
          {healthKitAvailable && (
            <View style={styles.section}>
              <View style={styles.sectionHeader}>
                <Feather name="activity" size={24} color="#4CAF50" />
                <CustomText variant="subtitle" weight="bold" fontFamily="figtree" style={styles.sectionTitle}>
                  Apple Watch Health Data
                </CustomText>
                {isHealthKitAuthorized && (
                  <TouchableOpacity
                    style={styles.graphButton}
                    onPress={() => setShowGraphView(true)}
                  >
                    <Feather name="bar-chart-2" size={20} color="#4CAF50" />
                    <CustomText variant="caption" weight="medium" fontFamily="figtree" style={styles.graphButtonText}>
                      Graph
                    </CustomText>
                  </TouchableOpacity>
                )}
              </View>
              
              {/* Check if authorized */}
              {!isHealthKitAuthorized ? (
                <View style={[styles.healthKitInfo, { alignItems: 'center', padding: 20 }]}>
                  <Feather name="info" size={24} color="#4CAF50" style={{ marginBottom: 12 }} />
                  <CustomText variant="body" weight="bold" fontFamily="figtree" style={[styles.healthKitText, { marginBottom: 8 }]}>
                    Connect Apple Watch to see your health data
                  </CustomText>
                  <CustomText variant="caption" weight="normal" fontFamily="figtree" style={[styles.healthKitText, { fontSize: 12, textAlign: 'center' }]}>
                    Go to Profile tab → Tap "Connect Apple Watch" button
                  </CustomText>
                </View>
              ) : (
                <>
                  {/* Health Metrics Grid */}
                  <View style={styles.healthMetricsGrid}>
                    <View style={styles.healthMetricCard}>
                      <Feather name="activity" size={20} color="#4CAF50" />
                      <CustomText variant="title" weight="bold" fontFamily="figtree" style={styles.healthMetricValue}>
                        {Math.round(healthKitStats.totalSteps).toLocaleString()}
                      </CustomText>
                      <CustomText variant="caption" weight="normal" fontFamily="figtree" style={styles.healthMetricLabel}>
                        Steps
                      </CustomText>
                    </View>
                    
                    <View style={styles.healthMetricCard}>
                      <Feather name="map" size={20} color="#4CAF50" />
                      <CustomText variant="title" weight="bold" fontFamily="figtree" style={styles.healthMetricValue}>
                        {(healthKitStats.totalDistance / 1609.34).toFixed(2)}
                      </CustomText>
                      <CustomText variant="caption" weight="normal" fontFamily="figtree" style={styles.healthMetricLabel}>
                        mi
                      </CustomText>
                    </View>
                    
                    <View style={styles.healthMetricCard}>
                      <Feather name="zap" size={20} color="#4CAF50" />
                      <CustomText variant="title" weight="bold" fontFamily="figtree" style={styles.healthMetricValue}>
                        {healthKitStats.totalActiveCalories > 0 ? Math.round(healthKitStats.totalActiveCalories).toLocaleString() : '---'}
                      </CustomText>
                      <CustomText variant="caption" weight="normal" fontFamily="figtree" style={styles.healthMetricLabel}>
                        Active Calories
                      </CustomText>
                    </View>
                    
                    <View style={styles.healthMetricCard}>
                      <Feather name="heart" size={20} color="#FF6B6B" />
                      <CustomText variant="title" weight="bold" fontFamily="figtree" style={styles.healthMetricValue}>
                        {healthKitStats.avgHeartRate > 0 ? Math.round(healthKitStats.avgHeartRate) : '---'}
                      </CustomText>
                      <CustomText variant="caption" weight="normal" fontFamily="figtree" style={styles.healthMetricLabel}>
                        Avg BPM
                      </CustomText>
                    </View>
                    
                    <View style={styles.healthMetricCard}>
                      <Feather name="trending-up" size={20} color="#FF6B6B" />
                      <CustomText variant="title" weight="bold" fontFamily="figtree" style={styles.healthMetricValue}>
                        {healthKitStats.maxHeartRate > 0 ? Math.round(healthKitStats.maxHeartRate) : '---'}
                      </CustomText>
                      <CustomText variant="caption" weight="normal" fontFamily="figtree" style={styles.healthMetricLabel}>
                        Max BPM
                      </CustomText>
                    </View>
                    
                    {healthKitStats.totalWorkouts > 0 && (
                      <View style={styles.healthMetricCard}>
                        <Feather name="activity" size={20} color="#FF6B35" />
                        <CustomText variant="title" weight="bold" fontFamily="figtree" style={styles.healthMetricValue}>
                          {healthKitStats.totalWorkouts}
                        </CustomText>
                        <CustomText variant="caption" weight="normal" fontFamily="figtree" style={styles.healthMetricLabel}>
                          Workouts
                        </CustomText>
                      </View>
                    )}
                    
                    {healthKitStats.totalWorkoutMinutes > 0 && (
                      <View style={styles.healthMetricCard}>
                        <Feather name="clock" size={20} color="#FF6B35" />
                        <CustomText variant="title" weight="bold" fontFamily="figtree" style={styles.healthMetricValue}>
                          {Math.round(healthKitStats.totalWorkoutMinutes)}
                        </CustomText>
                        <CustomText variant="caption" weight="normal" fontFamily="figtree" style={styles.healthMetricLabel}>
                          Workout Min
                        </CustomText>
                      </View>
                    )}
                  </View>

                  {healthKitWorkouts.length > 0 && (
                    <View style={styles.healthKitInfo}>
                      <CustomText variant="caption" weight="normal" fontFamily="figtree" style={styles.healthKitText}>
                        {healthKitWorkouts.length} workouts from Apple Health
                      </CustomText>
                    </View>
                  )}
                </>
              )}
            </View>
          )}

          {/* Personal Records */}
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Feather name="award" size={24} color="#FF6B35" />
              <CustomText variant="subtitle" weight="bold" fontFamily="figtree" style={styles.sectionTitle}>
                Personal Records
              </CustomText>
            </View>
            {personalRecords.length === 0 ? (
              <View style={styles.emptyState}>
                <Feather name="bar-chart-2" size={48} color="#9BA1A6" />
                <CustomText variant="body" weight="medium" fontFamily="figtree" style={styles.emptyText}>
                  No personal records yet
                </CustomText>
                <CustomText variant="caption" weight="normal" fontFamily="figtree" style={styles.emptySubtext}>
                  Start tracking workouts to see your PRs
                </CustomText>
              </View>
            ) : (
              personalRecords.map((pr, index) => (
                <View key={pr.id || index} style={styles.prCard}>
                  <View style={styles.prHeader}>
                    <View style={{ flex: 1 }}>
                      <CustomText variant="body" weight="bold" fontFamily="figtree" style={styles.prEvent}>
                        {pr.eventName || pr.eventId}
                      </CustomText>
                      {pr.source && (
                        <CustomText variant="caption" weight="normal" fontFamily="figtree" style={styles.prSource}>
                          {pr.source}
                        </CustomText>
                      )}
                    </View>
                    <View style={styles.prBadge}>
                      <Feather name="award" size={16} color="#FF6B35" />
                    </View>
                  </View>
                  <CustomText variant="title" weight="bold" fontFamily="figtree" style={styles.prResult}>
                    {pr.result 
                      ? (pr.eventId?.includes('field') || pr.eventId?.includes('jump') || pr.eventId?.includes('put') || pr.eventId?.includes('discus')
                          ? formatDistance(pr.result)
                          : formatTime(pr.result))
                      : pr.totalDistance 
                        ? `${(pr.totalDistance / 1609.34).toFixed(2)} mi`
                        : pr.duration 
                          ? formatTime(pr.duration)
                          : 'N/A'}
                  </CustomText>
                  {(pr.timestamp || pr.startDate) && (
                    <CustomText variant="caption" weight="normal" fontFamily="figtree" style={styles.prDate}>
                      {pr.timestamp 
                        ? pr.timestamp.toDate().toLocaleDateString()
                        : pr.startDate 
                          ? new Date(pr.startDate).toLocaleDateString()
                          : ''}
                    </CustomText>
                  )}
                </View>
              ))
            )}
          </View>

          {/* Recent Performances */}
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Feather name="clock" size={24} color="#FF6B35" />
              <CustomText variant="subtitle" weight="bold" fontFamily="figtree" style={styles.sectionTitle}>
                Recent Performances
              </CustomText>
            </View>
            {recentPerformances.length === 0 ? (
              <View style={styles.emptyState}>
                <Feather name="activity" size={48} color="#9BA1A6" />
                <CustomText variant="body" weight="medium" fontFamily="figtree" style={styles.emptyText}>
                  No performances yet
                </CustomText>
                <CustomText variant="caption" weight="normal" fontFamily="figtree" style={styles.emptySubtext}>
                  Track your first workout to see stats
                </CustomText>
              </View>
            ) : (
              recentPerformances.map((performance, index) => {
                const performanceId = performance.id || index.toString();
                const isSelected = selectedPerformanceId === performanceId;
                return (
                <TouchableOpacity
                  key={performance.id || index}
                  style={styles.performanceCard}
                  onLongPress={() => setSelectedPerformanceId(performanceId)}
                  onPress={() => {
                    if (isSelected) {
                      setSelectedPerformanceId(null);
                    }
                  }}
                  activeOpacity={0.8}
                >
                  {isSelected && (
                    <TouchableOpacity
                      style={styles.deleteButton}
                      onPress={() => handleDeletePerformance(performance)}
                    >
                      <Feather name="x" size={16} color="white" />
                    </TouchableOpacity>
                  )}
                  <View style={styles.performanceHeader}>
                    <View style={{ flex: 1 }}>
                      <CustomText variant="body" weight="bold" fontFamily="figtree" style={styles.performanceEvent}>
                        {performance.eventName || performance.eventId}
                      </CustomText>
                      {performance.source && (
                        <CustomText variant="caption" weight="normal" fontFamily="figtree" style={styles.performanceSource}>
                          {performance.source}
                        </CustomText>
                      )}
                    </View>
                    {(performance.timestamp || performance.startDate) && (
                      <CustomText variant="caption" weight="normal" fontFamily="figtree" style={styles.performanceDate}>
                        {performance.timestamp 
                          ? performance.timestamp.toDate().toLocaleDateString()
                          : performance.startDate 
                            ? new Date(performance.startDate).toLocaleDateString()
                            : ''}
                      </CustomText>
                    )}
                  </View>
                  <CustomText variant="body" weight="semibold" fontFamily="figtree" style={styles.performanceResult}>
                    {performance.result 
                      ? (performance.eventId?.includes('field') || performance.eventId?.includes('jump') || performance.eventId?.includes('put') || performance.eventId?.includes('discus')
                          ? formatDistance(performance.result)
                          : formatTime(performance.result))
                      : performance.totalDistance 
                        ? `${(performance.totalDistance / 1609.34).toFixed(2)} mi`
                        : performance.duration 
                          ? formatTime(performance.duration)
                          : performance.totalEnergyBurned
                            ? `${Math.round(performance.totalEnergyBurned)} cal`
                            : 'N/A'}
                  </CustomText>
                </TouchableOpacity>
                );
              })
            )}
          </View>
        </ScrollView>
        </Pressable>
      </SafeAreaView>

      {/* Graph View Modal */}
      <Modal
        visible={showGraphView}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setShowGraphView(false)}
      >
        <View style={styles.graphModalContainer}>
          <LinearGradient
            colors={['#0A0A0A', '#1A1A1A', '#0A0A0A']}
            style={StyleSheet.absoluteFill}
          />
          <SafeAreaView style={styles.graphModalSafeArea}>
            <View style={styles.graphModalHeader}>
              <CustomText variant="title" weight="bold" fontFamily="figtree" style={styles.graphModalTitle}>
                Health Data Graph
              </CustomText>
              <TouchableOpacity
                onPress={() => setShowGraphView(false)}
                style={styles.closeButton}
              >
                <Feather name="x" size={24} color="#ECEDEE" />
              </TouchableOpacity>
            </View>
            <ScrollView style={styles.graphScrollView} contentContainerStyle={styles.graphScrollContent}>
              {/* Steps Chart */}
              <View style={styles.chartContainer}>
                <CustomText variant="subtitle" weight="bold" fontFamily="figtree" style={styles.chartTitle}>
                  Steps
                </CustomText>
                <SimpleLineChart
                  data={chartData.steps.length > 0 ? chartData.steps.filter(v => v > 0) : (healthKitStats.totalSteps > 0 ? [healthKitStats.totalSteps] : [])}
                  labels={chartData.steps.length > 0 ? chartData.labels.slice(-chartData.steps.length).filter((_, i) => chartData.steps[i] > 0) : (healthKitStats.totalSteps > 0 ? [selectedPeriod] : [])}
                  color="#4CAF50"
                  height={200}
                />
              </View>

              {/* Distance Chart */}
              <View style={styles.chartContainer}>
                <CustomText variant="subtitle" weight="bold" fontFamily="figtree" style={styles.chartTitle}>
                  Distance (mi)
                </CustomText>
                <SimpleLineChart
                  data={chartData.distance.length > 0 ? chartData.distance.filter(v => v > 0) : ((healthKitStats.totalDistance / 1609.34) > 0 ? [healthKitStats.totalDistance / 1609.34] : [])}
                  labels={chartData.distance.length > 0 ? chartData.labels.slice(-chartData.distance.length).filter((_, i) => chartData.distance[i] > 0) : ((healthKitStats.totalDistance / 1609.34) > 0 ? [selectedPeriod] : [])}
                  color="#4CAF50"
                  height={200}
                />
              </View>

              {/* Calories Chart */}
              <View style={styles.chartContainer}>
                <CustomText variant="subtitle" weight="bold" fontFamily="figtree" style={styles.chartTitle}>
                  Active Calories
                </CustomText>
                <SimpleLineChart
                  data={chartData.calories.length > 0 ? chartData.calories.filter(v => v > 0) : (healthKitStats.totalActiveCalories > 0 ? [healthKitStats.totalActiveCalories] : [])}
                  labels={chartData.calories.length > 0 ? chartData.labels.slice(-chartData.calories.length).filter((_, i) => chartData.calories[i] > 0) : (healthKitStats.totalActiveCalories > 0 ? [selectedPeriod] : [])}
                  color="#FF6B35"
                  height={200}
                />
              </View>

              {/* Heart Rate Chart */}
              {(healthKitStats.avgHeartRate > 0 || healthKitStats.maxHeartRate > 0) && (
                <View style={styles.chartContainer}>
                  <CustomText variant="subtitle" weight="bold" fontFamily="figtree" style={styles.chartTitle}>
                    Heart Rate (BPM)
                  </CustomText>
                  <SimpleLineChart
                    data={chartData.heartRate.length > 0 ? chartData.heartRate.filter(v => v > 0) : [healthKitStats.avgHeartRate, healthKitStats.maxHeartRate].filter(v => v > 0)}
                    labels={chartData.heartRate.length > 0 ? chartData.labels.slice(-chartData.heartRate.length).filter((_, i) => chartData.heartRate[i] > 0) : [healthKitStats.avgHeartRate, healthKitStats.maxHeartRate].filter(v => v > 0).map((_, i) => i === 0 ? 'Avg' : 'Max')}
                    color="#FF6B6B"
                    height={200}
                  />
                </View>
              )}
            </ScrollView>
          </SafeAreaView>
        </View>
      </Modal>
    </View>
  );
}

// Simple Line Chart Component
const SimpleLineChart = ({ data, labels, color, height }: { data: number[], labels: string[], color: string, height: number }) => {
  const chartWidth = width - 80;
  const chartHeight = height;
  const padding = 40;
  const innerWidth = chartWidth - padding * 2;
  const innerHeight = chartHeight - padding * 2;

  const maxValue = Math.max(...data, 1);
  const minValue = Math.min(...data, 0);
  const range = maxValue - minValue || 1;

  const points = data.map((value, index) => {
    const x = padding + (index / (data.length - 1 || 1)) * innerWidth;
    const y = padding + innerHeight - ((value - minValue) / range) * innerHeight;
    return { x, y, value };
  });

  const path = points.length > 1
    ? points.reduce((acc, point, index) => {
        if (index === 0) {
          return `M ${point.x} ${point.y}`;
        }
        return `${acc} L ${point.x} ${point.y}`;
      }, '')
    : `M ${points[0]?.x || padding} ${points[0]?.y || padding + innerHeight}`;

  return (
    <View style={styles.chartWrapper}>
      <Svg width={chartWidth} height={chartHeight}>
        {/* Grid lines */}
        <G>
          {[0, 0.25, 0.5, 0.75, 1].map((ratio) => {
            const y = padding + innerHeight - (ratio * innerHeight);
            return (
              <Line
                key={ratio}
                x1={padding}
                y1={y}
                x2={padding + innerWidth}
                y2={y}
                stroke="rgba(255, 255, 255, 0.1)"
                strokeWidth="1"
              />
            );
          })}
        </G>

        {/* Chart line */}
        <Path
          d={path}
          fill="none"
          stroke={color}
          strokeWidth="3"
        />

        {/* Data points */}
        {points.map((point, index) => (
          <G key={index}>
            <Circle
              cx={point.x}
              cy={point.y}
              r="6"
              fill={color}
            />
            <Circle
              cx={point.x}
              cy={point.y}
              r="10"
              fill={color}
              opacity="0.2"
            />
            {/* Value label */}
            <SvgText
              x={point.x}
              y={point.y - 15}
              fontSize="12"
              fill={color}
              textAnchor="middle"
            >
              {point.value.toFixed(0)}
            </SvgText>
            {/* X-axis label */}
            {labels[index] && (
              <SvgText
                x={point.x}
                y={chartHeight - 10}
                fontSize="10"
                fill="#9BA1A6"
                textAnchor="middle"
              >
                {labels[index]}
              </SvgText>
            )}
          </G>
        ))}

        {/* Y-axis labels */}
        {[0, 0.25, 0.5, 0.75, 1].map((ratio) => {
          const value = minValue + (ratio * range);
          const y = padding + innerHeight - (ratio * innerHeight);
          return (
            <SvgText
              key={ratio}
              x={padding - 10}
              y={y + 4}
              fontSize="10"
              fill="#9BA1A6"
              textAnchor="end"
            >
              {value.toFixed(0)}
            </SvgText>
          );
        })}
      </Svg>
    </View>
  );
};

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
    marginBottom: 24,
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
  periodSelector: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 24,
  },
  periodButton: {
    flex: 1,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 8,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderWidth: 1,
    borderColor: 'transparent',
  },
  periodButtonActive: {
    backgroundColor: 'rgba(255, 107, 53, 0.2)',
    borderColor: '#FF6B35',
  },
  periodButtonText: {
    color: '#9BA1A6',
    fontSize: 12,
    textAlign: 'center',
  },
  periodButtonTextActive: {
    color: '#FF6B35',
  },
  section: {
    marginBottom: 32,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 16,
  },
  sectionTitle: {
    color: '#ECEDEE',
    fontSize: 20,
  },
  prCard: {
    backgroundColor: 'rgba(255, 107, 53, 0.1)',
    borderRadius: 16,
    padding: 20,
    marginBottom: 12,
    borderLeftWidth: 4,
    borderLeftColor: '#FF6B35',
  },
  prHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  prEvent: {
    color: '#ECEDEE',
    fontSize: 16,
  },
  prBadge: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(255, 107, 53, 0.3)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  prResult: {
    color: '#FF6B35',
    fontSize: 28,
    marginBottom: 4,
  },
  prDate: {
    color: '#9BA1A6',
    fontSize: 12,
  },
  performanceCard: {
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
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
  performanceHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  performanceEvent: {
    color: '#ECEDEE',
    fontSize: 16,
  },
  performanceDate: {
    color: '#9BA1A6',
    fontSize: 12,
  },
  performanceResult: {
    color: '#FF6B35',
    fontSize: 20,
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 48,
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
  },
  healthKitInfo: {
    backgroundColor: 'rgba(76, 175, 80, 0.1)',
    borderRadius: 12,
    padding: 12,
    marginBottom: 16,
    borderLeftWidth: 4,
    borderLeftColor: '#4CAF50',
  },
  healthKitText: {
    color: '#4CAF50',
    fontSize: 14,
  },
  prSource: {
    color: '#9BA1A6',
    fontSize: 11,
    marginTop: 2,
  },
  performanceSource: {
    color: '#9BA1A6',
    fontSize: 11,
    marginTop: 2,
  },
  healthMetricsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginBottom: 16,
  },
  healthMetricCard: {
    flex: 1,
    minWidth: '45%',
    backgroundColor: 'rgba(76, 175, 80, 0.1)',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(76, 175, 80, 0.3)',
  },
  healthMetricValue: {
    color: '#4CAF50',
    fontSize: 24,
    marginTop: 8,
    marginBottom: 4,
  },
  healthMetricLabel: {
    color: '#9BA1A6',
    fontSize: 12,
  },
  graphButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: 'rgba(76, 175, 80, 0.2)',
    borderWidth: 1,
    borderColor: '#4CAF50',
  },
  graphButtonText: {
    color: '#4CAF50',
    fontSize: 12,
  },
  graphModalContainer: {
    flex: 1,
  },
  graphModalSafeArea: {
    flex: 1,
  },
  graphModalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    paddingTop: 10,
  },
  graphModalTitle: {
    color: '#ECEDEE',
    fontSize: 24,
  },
  closeButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  graphScrollView: {
    flex: 1,
  },
  graphScrollContent: {
    padding: 20,
    paddingBottom: 40,
  },
  chartContainer: {
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderRadius: 16,
    padding: 20,
    marginBottom: 24,
  },
  chartTitle: {
    color: '#ECEDEE',
    fontSize: 18,
    marginBottom: 16,
  },
  chartWrapper: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  performanceScoreCard: {
    backgroundColor: 'rgba(255, 107, 53, 0.1)',
    borderRadius: 16,
    padding: 20,
    borderWidth: 1,
    borderColor: 'rgba(255, 107, 53, 0.3)',
  },
  overallScoreContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 24,
    gap: 16,
  },
  scoreCircle: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: 'rgba(255, 107, 53, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 3,
    borderColor: '#FF6B35',
  },
  overallScore: {
    color: '#FF6B35',
    fontSize: 36,
    lineHeight: 40,
  },
  scoreLabel: {
    color: '#9BA1A6',
    fontSize: 14,
    marginTop: -4,
  },
  scoreDescription: {
    flex: 1,
  },
  scoreTitle: {
    color: '#ECEDEE',
    fontSize: 18,
    marginBottom: 4,
  },
  scoreSubtitle: {
    color: '#9BA1A6',
    fontSize: 12,
  },
  breakdownContainer: {
    marginBottom: 24,
  },
  breakdownTitle: {
    color: '#ECEDEE',
    fontSize: 16,
    marginBottom: 16,
  },
  breakdownItem: {
    marginBottom: 12,
  },
  breakdownHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 6,
    gap: 8,
  },
  breakdownIconContainer: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  breakdownLabel: {
    flex: 1,
    color: '#9BA1A6',
    fontSize: 12,
  },
  breakdownValue: {
    color: '#ECEDEE',
    fontSize: 14,
    minWidth: 40,
    textAlign: 'right',
  },
  progressBarContainer: {
    height: 6,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 3,
    overflow: 'hidden',
  },
  progressBar: {
    height: '100%',
    borderRadius: 3,
  },
  detailsContainer: {
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderRadius: 12,
    padding: 16,
  },
  detailsTitle: {
    color: '#ECEDEE',
    fontSize: 16,
    marginBottom: 16,
  },
  detailsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  detailItem: {
    width: '48%',
    backgroundColor: 'rgba(255, 255, 255, 0.03)',
    borderRadius: 8,
    padding: 12,
  },
  detailLabel: {
    color: '#9BA1A6',
    fontSize: 11,
    marginBottom: 4,
  },
  detailValue: {
    color: '#ECEDEE',
    fontSize: 14,
  },
});

