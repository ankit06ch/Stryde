import React, { useState, useEffect } from 'react';
import { View, TouchableOpacity, StyleSheet, Alert, Platform } from 'react-native';
import { Feather } from '@expo/vector-icons';
import CustomText from '../../components/CustomText';
import {
  initHealthKit,
  isHealthKitAvailable,
  getTodayStats,
} from '../../utils/healthKitUtils';
import * as Haptics from 'expo-haptics';
import AsyncStorage from '@react-native-async-storage/async-storage';

const HEALTHKIT_AUTHORIZED_KEY = '@healthkit_authorized';

interface AppleWatchConnectionProps {
  onStatsUpdate?: (stats: {
    steps: number;
    distance: number;
    energy: number;
    avgHeartRate: number;
  }) => void;
}

export default function AppleWatchConnection({
  onStatsUpdate,
}: AppleWatchConnectionProps) {
  const [isConnected, setIsConnected] = useState(false);
  const [isAvailable, setIsAvailable] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [stats, setStats] = useState({
    steps: 0,
    distance: 0,
    energy: 0,
    avgHeartRate: 0,
  });

  useEffect(() => {
    checkAvailability();
    checkStoredConnection();
  }, []);

  const checkStoredConnection = async () => {
    try {
      const stored = await AsyncStorage.getItem(HEALTHKIT_AUTHORIZED_KEY);
      if (stored === 'true') {
        // Verify it's actually authorized by trying to get stats
        try {
          const stats = await getTodayStats();
          // If we can get stats, it's really connected
          setIsConnected(true);
          setStats(stats);
        } catch (error) {
          // If we can't get stats, it's not really connected
          console.log('HealthKit not actually authorized, clearing stored status');
          await AsyncStorage.removeItem(HEALTHKIT_AUTHORIZED_KEY);
          setIsConnected(false);
        }
      }
    } catch (error) {
      console.error('Error checking stored connection:', error);
      setIsConnected(false);
    }
  };

  useEffect(() => {
    if (isConnected) {
      loadStats();
      // Refresh stats every 30 seconds
      const interval = setInterval(loadStats, 30000);
      return () => clearInterval(interval);
    }
  }, [isConnected]);

  const checkAvailability = async () => {
    if (Platform.OS !== 'ios') {
      setIsAvailable(false);
      return;
    }

    try {
      const available = await isHealthKitAvailable();
      setIsAvailable(available);
    } catch (error) {
      console.error('Error checking HealthKit availability:', error);
      setIsAvailable(false);
    }
  };

  const handleConnect = async () => {
    if (!isAvailable) {
      Alert.alert(
        'Not Available',
        'HealthKit is only available on iOS devices with an Apple Watch.'
      );
      return;
    }

    setIsConnecting(true);
    try {
      const success = await initHealthKit();
      if (success) {
        setIsConnected(true);
        // Store authorization status
        await AsyncStorage.setItem(HEALTHKIT_AUTHORIZED_KEY, 'true');
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        await loadStats();
        // Trigger a refresh of stats page if it's mounted
        // This will be handled by the stats page checking HealthKit availability
      } else {
        Alert.alert(
          'Permission Denied',
          'Please enable HealthKit permissions in Settings > Privacy & Security > Health > Stryde'
        );
      }
    } catch (error: any) {
      console.error('Error connecting to HealthKit:', error);
      const errorMessage = error?.message || error?.toString() || 'Unknown error';
      Alert.alert(
        'Connection Failed',
        `Unable to connect to HealthKit. ${errorMessage}\n\nPlease ensure:\n1. HealthKit capability is enabled in Xcode\n2. App is rebuilt after adding HealthKit\n3. HealthKit permissions are granted in Settings`
      );
    } finally {
      setIsConnecting(false);
    }
  };

  const loadStats = async () => {
    try {
      const todayStats = await getTodayStats();
      setStats(todayStats);
      if (onStatsUpdate) {
        onStatsUpdate(todayStats);
      }
    } catch (error) {
      console.error('Error loading stats:', error);
    }
  };

  if (!isAvailable) {
    return null; // Don't show on non-iOS devices
  }

  return (
    <View style={styles.container}>
      {!isConnected ? (
        <TouchableOpacity
          style={styles.connectButton}
          onPress={handleConnect}
          disabled={isConnecting}
        >
          <View style={styles.connectButtonContent}>
            <Feather
              name="activity"
              size={20}
              color="#FF6B35"
              style={styles.icon}
            />
            <CustomText
              variant="body"
              weight="medium"
              fontFamily="figtree"
              style={styles.connectButtonText}
            >
              {isConnecting ? 'Connecting...' : 'Connect Apple Watch'}
            </CustomText>
          </View>
          <Feather name="chevron-right" size={20} color="#9BA1A6" />
        </TouchableOpacity>
      ) : (
        <View style={styles.connectedContainer}>
          <View style={styles.connectedHeader}>
            <View style={styles.connectedHeaderLeft}>
              <Feather name="watch" size={20} color="#4CAF50" />
              <CustomText
                variant="body"
                weight="medium"
                fontFamily="figtree"
                style={styles.connectedText}
              >
                Apple Watch Connected
              </CustomText>
            </View>
            <View style={styles.statusIndicator} />
          </View>
          <View style={styles.statsGrid}>
            <View style={styles.statItem}>
              <CustomText
                variant="caption"
                weight="normal"
                fontFamily="figtree"
                style={styles.statLabel}
              >
                Steps
              </CustomText>
              <CustomText
                variant="title"
                weight="bold"
                fontFamily="figtree"
                style={styles.statValue}
              >
                {Math.round(stats.steps).toLocaleString()}
              </CustomText>
            </View>
            <View style={styles.statItem}>
              <CustomText
                variant="caption"
                weight="normal"
                fontFamily="figtree"
                style={styles.statLabel}
              >
                Distance
              </CustomText>
              <CustomText
                variant="title"
                weight="bold"
                fontFamily="figtree"
                style={styles.statValue}
              >
                {(stats.distance / 1000).toFixed(2)} km
              </CustomText>
            </View>
            <View style={styles.statItem}>
              <CustomText
                variant="caption"
                weight="normal"
                fontFamily="figtree"
                style={styles.statLabel}
              >
                Calories
              </CustomText>
              <CustomText
                variant="title"
                weight="bold"
                fontFamily="figtree"
                style={styles.statValue}
              >
                {Math.round(stats.energy)}
              </CustomText>
            </View>
            {stats.avgHeartRate > 0 && (
              <View style={styles.statItem}>
                <CustomText
                  variant="caption"
                  weight="normal"
                  fontFamily="figtree"
                  style={styles.statLabel}
                >
                  Avg HR
                </CustomText>
                <CustomText
                  variant="title"
                  weight="bold"
                  fontFamily="figtree"
                  style={styles.statValue}
                >
                  {Math.round(stats.avgHeartRate)} bpm
                </CustomText>
              </View>
            )}
          </View>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginBottom: 20,
  },
  connectButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: 'rgba(255, 107, 53, 0.3)',
  },
  connectButtonContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  icon: {
    marginRight: 12,
  },
  connectButtonText: {
    color: '#ECEDEE',
    fontSize: 16,
  },
  connectedContainer: {
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: 'rgba(76, 175, 80, 0.3)',
  },
  connectedHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  connectedHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  connectedText: {
    color: '#4CAF50',
    fontSize: 16,
    marginLeft: 8,
  },
  statusIndicator: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#4CAF50',
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  statItem: {
    flex: 1,
    minWidth: '45%',
  },
  statLabel: {
    color: '#9BA1A6',
    fontSize: 12,
    marginBottom: 4,
  },
  statValue: {
    color: '#ECEDEE',
    fontSize: 18,
  },
});

