// Conditionally import react-native-health to avoid errors if not properly linked
let AppleHealthKit: any = null;
let NativeModules: any = null;
let Platform: any = null;

try {
  const ReactNative = require('react-native');
  Platform = ReactNative.Platform;
  NativeModules = ReactNative.NativeModules;
  
  // Only try to load HealthKit on iOS
  if (Platform && Platform.OS === 'ios') {
    // Try to get the module directly from NativeModules (works better with newer RN versions)
    if (NativeModules && NativeModules.AppleHealthKit) {
      AppleHealthKit = NativeModules.AppleHealthKit;
    } else {
      // Fallback to default import - try both default and named exports
      try {
        const healthModule = require('react-native-health');
        // Check if it's a default export or named export
        AppleHealthKit = healthModule.default || healthModule;
        
        // If Constants are missing, try to get them from the module
        if (AppleHealthKit && !AppleHealthKit.Constants) {
          // Try to access Constants from the original module
          if (healthModule.Constants) {
            AppleHealthKit.Constants = healthModule.Constants;
          }
        }
      } catch (e) {
        console.warn('react-native-health module not found:', e);
      }
    }
  }
} catch (error) {
  console.warn('react-native-health not available:', error);
}

type HealthKitPermissions = any;
type HealthValue = any;
type HealthInputOptions = any;

/* Permission options */
const getPermissions = () => {
  if (!AppleHealthKit) {
    return { permissions: { read: [], write: [] } };
  }
  
  // Check if Constants exists
  if (!AppleHealthKit.Constants || !AppleHealthKit.Constants.Permissions) {
    console.warn('HealthKit Constants.Permissions not available, using string values');
    // Fallback to string values if Constants are not available
    return {
      permissions: {
        read: [
          'HeartRate',
          'Steps',
          'DistanceWalkingRunning',
          'ActiveEnergyBurned',
          'WorkoutType',
          'DistanceCycling',
          'RunningSpeed',
        ],
        write: [
          'WorkoutType',
        ],
      },
    } as HealthKitPermissions;
  }
  
  return {
    permissions: {
      read: [
        AppleHealthKit.Constants.Permissions.HeartRate,
        AppleHealthKit.Constants.Permissions.Steps,
        AppleHealthKit.Constants.Permissions.DistanceWalkingRunning,
        AppleHealthKit.Constants.Permissions.ActiveEnergyBurned,
        AppleHealthKit.Constants.Permissions.BasalEnergyBurned,
        AppleHealthKit.Constants.Permissions.WorkoutType,
        AppleHealthKit.Constants.Permissions.DistanceCycling,
        AppleHealthKit.Constants.Permissions.RunningSpeed,
      ],
      write: [
        AppleHealthKit.Constants.Permissions.WorkoutType,
      ],
    },
  } as HealthKitPermissions;
};

/**
 * Initialize HealthKit and request permissions
 */
export const initHealthKit = (): Promise<boolean> => {
  if (!AppleHealthKit) {
    console.error('[HealthKit] HealthKit module not available');
    return Promise.reject('HealthKit not available');
  }
  
  // Check if initHealthKit exists and is a function
  if (!AppleHealthKit.initHealthKit || typeof AppleHealthKit.initHealthKit !== 'function') {
    console.warn('[HealthKit] initHealthKit method not found, HealthKit may not be properly linked');
    return Promise.reject('HealthKit not properly linked');
  }
  
  return new Promise((resolve, reject) => {
    try {
      const permissions = getPermissions();
      console.log('[HealthKit] Requesting permissions:', JSON.stringify(permissions, null, 2));
      AppleHealthKit.initHealthKit(permissions, (error: string) => {
        if (error) {
          console.error('[HealthKit] Cannot grant permissions!', error);
          reject(false);
        } else {
          console.log('[HealthKit] ✅ Permissions granted successfully!');
          resolve(true);
        }
      });
    } catch (error) {
      console.error('[HealthKit] Exception initializing HealthKit:', error);
      reject(false);
    }
  });
};

/**
 * Check if HealthKit is available
 */
export const isHealthKitAvailable = (): Promise<boolean> => {
  if (!AppleHealthKit) {
    return Promise.resolve(false);
  }
  
  // Check if isAvailable exists and is a function
  if (!AppleHealthKit.isAvailable || typeof AppleHealthKit.isAvailable !== 'function') {
    console.warn('HealthKit isAvailable method not found, HealthKit may not be properly linked');
    return Promise.resolve(false);
  }
  
  return new Promise((resolve) => {
    try {
      AppleHealthKit.isAvailable((err: string, available: boolean) => {
        if (err) {
          console.error('Error checking HealthKit availability:', err);
          resolve(false);
        } else {
          resolve(available);
        }
      });
    } catch (error) {
      console.error('Exception checking HealthKit availability:', error);
      resolve(false);
    }
  });
};

/**
 * Get heart rate data
 */
export const getHeartRateData = (
  startDate: Date,
  endDate: Date
): Promise<HealthValue[]> => {
  if (!AppleHealthKit) {
    return Promise.resolve([]);
  }
  
  if (!AppleHealthKit.getHeartRateSamples || typeof AppleHealthKit.getHeartRateSamples !== 'function') {
    console.warn('getHeartRateSamples method not available');
    return Promise.resolve([]);
  }
  
  return new Promise((resolve, reject) => {
    try {
      const options: HealthInputOptions = {
        startDate: startDate.toISOString(),
        endDate: endDate.toISOString(),
        unit: 'bpm',
      };

      console.log('[HealthKit] Fetching heart rate data:', { startDate: options.startDate, endDate: options.endDate });
      AppleHealthKit.getHeartRateSamples(
        options,
        (err: string, results: HealthValue[]) => {
          if (err) {
            console.error('[HealthKit] Error getting heart rate:', err);
            resolve([]); // Return empty array instead of rejecting
          } else {
            const data = Array.isArray(results) ? results : [];
            console.log(`[HealthKit] Heart rate: ${data.length} samples fetched`);
            if (data.length > 0) {
              console.log('[HealthKit] Heart rate sample (first):', JSON.stringify(data[0], null, 2));
            }
            resolve(data);
          }
        }
      );
    } catch (error) {
      console.error('Exception getting heart rate:', error);
      resolve([]); // Return empty array on error
    }
  });
};

/**
 * Get step count
 */
export const getStepCount = (
  startDate: Date,
  endDate: Date
): Promise<HealthValue[]> => {
  if (!AppleHealthKit) {
    return Promise.resolve([]);
  }
  
  // Try getDailyStepCountSamples first (for date ranges), fallback to getStepCount
  const hasDailySamples = AppleHealthKit.getDailyStepCountSamples && typeof AppleHealthKit.getDailyStepCountSamples === 'function';
  const hasStepCount = AppleHealthKit.getStepCount && typeof AppleHealthKit.getStepCount === 'function';
  
  if (!hasDailySamples && !hasStepCount) {
    console.warn('[HealthKit] getStepCount methods not available');
    return Promise.resolve([]);
  }
  
  const tryGetStepCount = (options: HealthInputOptions, resolve: (value: HealthValue[]) => void) => {
    AppleHealthKit.getStepCount(
      options,
      (err: string, results: HealthValue[]) => {
        if (err) {
          console.error('[HealthKit] Error getting step count:', err);
          resolve([]);
        } else {
          // getStepCount might return a single value or array
          let data: HealthValue[] = [];
          if (Array.isArray(results)) {
            data = results;
          } else if (results && typeof results === 'object') {
            // Single aggregated value
            data = [results];
          }
          console.log(`[HealthKit] Steps: ${data.length} samples fetched`);
          if (data.length > 0) {
            console.log('[HealthKit] Step sample (first):', JSON.stringify(data[0], null, 2));
          }
          resolve(data);
        }
      }
    );
  };
  
  return new Promise((resolve, reject) => {
    try {
      const options: HealthInputOptions = {
        startDate: startDate.toISOString(),
        endDate: endDate.toISOString(),
        unit: 'count',
      };

      console.log('[HealthKit] Fetching step count:', { startDate: options.startDate, endDate: options.endDate });
      
      // Try getDailyStepCountSamples first (better for date ranges)
      if (hasDailySamples) {
        AppleHealthKit.getDailyStepCountSamples(
          options,
          (err: string, results: HealthValue[]) => {
            if (err) {
              console.error('[HealthKit] Error getting daily step count:', err);
              // Fallback to getStepCount if daily samples fails
              if (hasStepCount) {
                tryGetStepCount(options, resolve);
              } else {
                resolve([]);
              }
            } else {
              const data = Array.isArray(results) ? results : [];
              console.log(`[HealthKit] Steps (daily): ${data.length} samples fetched`);
              if (data.length > 0) {
                console.log('[HealthKit] Step sample (first):', JSON.stringify(data[0], null, 2));
              }
              resolve(data);
            }
          }
        );
      } else {
        tryGetStepCount(options, resolve);
      }
    } catch (error) {
      console.error('[HealthKit] Exception getting step count:', error);
      resolve([]); // Return empty array on error
    }
  });
};

/**
 * Get distance walked/running
 */
export const getDistanceWalkingRunning = (
  startDate: Date,
  endDate: Date
): Promise<HealthValue[]> => {
  if (!AppleHealthKit) {
    return Promise.resolve([]);
  }
  
  // Try getDailyDistanceWalkingRunningSamples first, fallback to getDistanceWalkingRunning
  const hasDailySamples = AppleHealthKit.getDailyDistanceWalkingRunningSamples && typeof AppleHealthKit.getDailyDistanceWalkingRunningSamples === 'function';
  const hasDistance = AppleHealthKit.getDistanceWalkingRunning && typeof AppleHealthKit.getDistanceWalkingRunning === 'function';
  
  if (!hasDailySamples && !hasDistance) {
    console.warn('[HealthKit] getDistanceWalkingRunning methods not available');
    return Promise.resolve([]);
  }
  
  const tryGetDistance = (options: HealthInputOptions, resolve: (value: HealthValue[]) => void) => {
    AppleHealthKit.getDistanceWalkingRunning(
      options,
      (err: string, results: HealthValue[]) => {
        if (err) {
          console.error('[HealthKit] Error getting distance:', err);
          resolve([]);
        } else {
          // getDistanceWalkingRunning might return a single value or array
          let data: HealthValue[] = [];
          if (Array.isArray(results)) {
            data = results;
          } else if (results && typeof results === 'object') {
            // Single aggregated value
            data = [results];
          }
          console.log(`[HealthKit] Distance: ${data.length} samples fetched`);
          if (data.length > 0) {
            console.log('[HealthKit] Distance sample (first):', JSON.stringify(data[0], null, 2));
          }
          resolve(data);
        }
      }
    );
  };
  
  return new Promise((resolve, reject) => {
    try {
      const options: HealthInputOptions = {
        startDate: startDate.toISOString(),
        endDate: endDate.toISOString(),
        unit: 'meter',
      };

      console.log('[HealthKit] Fetching distance:', { startDate: options.startDate, endDate: options.endDate });
      
      // Try getDailyDistanceWalkingRunningSamples first
      if (hasDailySamples) {
        AppleHealthKit.getDailyDistanceWalkingRunningSamples(
          options,
          (err: string, results: HealthValue[]) => {
            if (err) {
              console.error('[HealthKit] Error getting daily distance:', err);
              // Fallback to getDistanceWalkingRunning
              if (hasDistance) {
                tryGetDistance(options, resolve);
              } else {
                resolve([]);
              }
            } else {
              const data = Array.isArray(results) ? results : [];
              console.log(`[HealthKit] Distance (daily): ${data.length} samples fetched`);
              if (data.length > 0) {
                console.log('[HealthKit] Distance sample (first):', JSON.stringify(data[0], null, 2));
              }
              resolve(data);
            }
          }
        );
      } else {
        tryGetDistance(options, resolve);
      }
    } catch (error) {
      console.error('[HealthKit] Exception getting distance:', error);
      resolve([]); // Return empty array on error
    }
  });
};

/**
 * Get active energy burned
 */
export const getActiveEnergyBurned = (
  startDate: Date,
  endDate: Date
): Promise<HealthValue[]> => {
  if (!AppleHealthKit) {
    return Promise.resolve([]);
  }
  
  if (!AppleHealthKit.getActiveEnergyBurned || typeof AppleHealthKit.getActiveEnergyBurned !== 'function') {
    console.warn('getActiveEnergyBurned method not available');
    return Promise.resolve([]);
  }
  
  return new Promise((resolve, reject) => {
    try {
      const options: HealthInputOptions = {
        startDate: startDate.toISOString(),
        endDate: endDate.toISOString(),
        unit: 'kilocalorie',
      };

      console.log('[HealthKit] Fetching active energy:', { startDate: options.startDate, endDate: options.endDate });
      AppleHealthKit.getActiveEnergyBurned(
        options,
        (err: string, results: HealthValue[]) => {
          if (err) {
            console.error('[HealthKit] Error getting active energy:', err);
            resolve([]); // Return empty array instead of rejecting
          } else {
            const data = Array.isArray(results) ? results : [];
            console.log(`[HealthKit] Calories: ${data.length} samples fetched`);
            if (data.length > 0) {
              console.log('[HealthKit] Calorie sample (first):', JSON.stringify(data[0], null, 2));
            }
            resolve(data);
          }
        }
      );
    } catch (error) {
      console.error('Exception getting active energy:', error);
      resolve([]); // Return empty array on error
    }
  });
};

/**
 * Check if HealthKit is authorized (permissions granted)
 */
export const isHealthKitAuthorized = (): Promise<boolean> => {
  if (!AppleHealthKit) {
    return Promise.resolve(false);
  }
  
  // Try to check authorization status
  // Note: react-native-health doesn't have a direct authorization check
  // We'll need to try a simple query and see if it fails with authorization error
  return Promise.resolve(true); // Assume authorized if module is available
};

/**
 * Get workouts from HealthKit
 */
export const getWorkouts = (
  startDate: Date,
  endDate: Date
): Promise<any[]> => {
  if (!AppleHealthKit) {
    return Promise.resolve([]);
  }
  
  // Try getWorkoutSamples first (preferred method for workouts)
  const hasWorkoutSamples = AppleHealthKit.getWorkoutSamples && typeof AppleHealthKit.getWorkoutSamples === 'function';
  const hasSamples = AppleHealthKit.getSamples && typeof AppleHealthKit.getSamples === 'function';
  
  if (!hasWorkoutSamples && !hasSamples) {
    console.warn('[HealthKit] Workout methods not available');
    return Promise.resolve([]);
  }
  
  return new Promise((resolve) => {
    try {
      const options: HealthInputOptions = {
        startDate: startDate.toISOString(),
        endDate: endDate.toISOString(),
      };

      console.log('[HealthKit] Fetching workouts:', { startDate: options.startDate, endDate: options.endDate });
      
      // Try getWorkoutSamples first (more accurate for workouts)
      if (hasWorkoutSamples) {
        AppleHealthKit.getWorkoutSamples(
          options,
          (err: string | any, results: any[]) => {
            if (err) {
              const errString = typeof err === 'string' ? err : (err?.message || JSON.stringify(err) || '');
              if (errString.includes('Authorization not determined') || errString.includes('Code=5')) {
                console.warn('[HealthKit] Not authorized yet. Please connect Apple Watch from Profile screen.');
                resolve([]);
              } else {
                console.error('[HealthKit] Error getting workouts:', err);
                // Fallback to getSamples if getWorkoutSamples fails
                if (hasSamples) {
                  tryGetSamples(options, resolve);
                } else {
                  resolve([]);
                }
              }
            } else {
              const data = Array.isArray(results) ? results : [];
              console.log(`[HealthKit] Workouts (getWorkoutSamples): ${data.length} workouts fetched`);
              if (data.length > 0) {
                console.log('[HealthKit] Workout (first):', JSON.stringify(data[0], null, 2));
              }
              resolve(data);
            }
          }
        );
      } else {
        tryGetSamples(options, resolve);
      }
    } catch (error) {
      console.error('[HealthKit] Exception getting workouts:', error);
      resolve([]);
    }
  });
  
  function tryGetSamples(options: HealthInputOptions, resolve: (value: any[]) => void) {
    const workoutType = AppleHealthKit.Constants?.Permissions?.WorkoutType || 'WorkoutType';
    AppleHealthKit.getSamples(
      {
        ...options,
        type: workoutType,
      },
      (err: string | any, results: any[]) => {
        if (err) {
          const errString = typeof err === 'string' ? err : (err?.message || JSON.stringify(err) || '');
          if (errString.includes('Authorization not determined') || errString.includes('Code=5')) {
            console.warn('[HealthKit] Not authorized yet. Please connect Apple Watch from Profile screen.');
            resolve([]);
          } else {
            console.error('[HealthKit] Error getting workouts:', err);
            resolve([]);
          }
        } else {
          const data = Array.isArray(results) ? results : [];
          console.log(`[HealthKit] Workouts (getSamples): ${data.length} workouts fetched`);
          if (data.length > 0) {
            console.log('[HealthKit] Workout (first):', JSON.stringify(data[0], null, 2));
          }
          resolve(data);
        }
      }
    );
  }
};

/**
 * Get today's stats summary
 */
export const getTodayStats = async () => {
  const today = new Date();
  const startOfDay = new Date(today.setHours(0, 0, 0, 0));
  const endOfDay = new Date(today.setHours(23, 59, 59, 999));

  try {
    const [steps, distance, energy, heartRate] = await Promise.allSettled([
      getStepCount(startOfDay, endOfDay),
      getDistanceWalkingRunning(startOfDay, endOfDay),
      getActiveEnergyBurned(startOfDay, endOfDay),
      getHeartRateData(startOfDay, endOfDay),
    ]);

    // Helper function to safely extract array from Promise result
    const getArray = (result: PromiseSettledResult<any[]>): any[] => {
      if (result.status === 'fulfilled' && Array.isArray(result.value)) {
        return result.value;
      }
      return [];
    };

    const stepsArray = getArray(steps);
    const distanceArray = getArray(distance);
    const energyArray = getArray(energy);
    const heartRateArray = getArray(heartRate);

    return {
      steps: stepsArray.reduce((sum, sample) => sum + (sample?.value || 0), 0),
      distance: distanceArray.reduce((sum, sample) => sum + (sample?.value || 0), 0),
      energy: energyArray.reduce((sum, sample) => sum + (sample?.value || 0), 0),
      avgHeartRate:
        heartRateArray.length > 0
          ? heartRateArray.reduce((sum, sample) => sum + (sample?.value || 0), 0) /
            heartRateArray.length
          : 0,
    };
  } catch (error) {
    console.error('Error getting today stats:', error);
    return {
      steps: 0,
      distance: 0,
      energy: 0,
      avgHeartRate: 0,
    };
  }
};

