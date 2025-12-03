import React, { useState, useEffect } from 'react';
import { View, ScrollView, StyleSheet, TouchableOpacity, Image, Alert, ActivityIndicator, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Feather } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { signOut } from 'firebase/auth';
import CustomText from '../../components/CustomText';
import { auth, db } from '../../firebase/config';
import { doc, getDoc, updateDoc } from 'firebase/firestore';
import { pickProfilePicture, uploadProfilePicture } from '../../utils/profilePictureUtils';
import * as Haptics from 'expo-haptics';
import AppleWatchConnection from '../components/AppleWatchConnection';
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

export default function ProfileScreen() {
  const router = useRouter();
  const [userData, setUserData] = useState<any>({});
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
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
  }, []);

  const loadUserData = async () => {
    const user = auth.currentUser;
    if (!user) {
      setLoading(false);
      return;
    }

    try {
      const userDoc = await getDoc(doc(db, 'users', user.uid));
      if (userDoc.exists()) {
        setUserData(userDoc.data());
      }
    } catch (error) {
      console.error('Error loading user data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleProfilePictureUpdate = async () => {
    const user = auth.currentUser;
    if (!user) return;

    try {
      setUploading(true);
      const result = await pickProfilePicture();
      if (result && result.uri) {
        const url = await uploadProfilePicture(user.uid, result.uri);
        if (url) {
          await updateDoc(doc(db, 'users', user.uid), {
            profilePictureUrl: url,
          });
          setUserData({ ...userData, profilePictureUrl: url });
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        }
      }
    } catch (error) {
      console.error('Error updating profile picture:', error);
      Alert.alert('Error', 'Failed to update profile picture');
    } finally {
      setUploading(false);
    }
  };

  const handleLogout = async () => {
    Alert.alert(
      'Logout',
      'Are you sure you want to logout?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Logout',
          style: 'destructive',
          onPress: async () => {
            try {
              await signOut(auth);
              router.replace('/unauthenticated_tabs/login');
            } catch (error) {
              console.error('Error signing out:', error);
            }
          },
        },
      ]
    );
  };

  if (!fontsLoaded || loading) {
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
              Profile
            </CustomText>
          </View>

          {/* Profile Picture */}
          <View style={styles.profileSection}>
            <TouchableOpacity
              style={styles.profilePictureContainer}
              onPress={handleProfilePictureUpdate}
              disabled={uploading}
            >
              {userData.profilePictureUrl ? (
                <Image
                  source={{ uri: userData.profilePictureUrl }}
                  style={styles.profilePicture}
                />
              ) : (
                <View style={styles.profilePicturePlaceholder}>
                  <Feather name="user" size={48} color="#9BA1A6" />
                </View>
              )}
              {uploading && (
                <View style={styles.uploadingOverlay}>
                  <ActivityIndicator size="small" color="white" />
                </View>
              )}
              <View style={styles.editIconContainer}>
                <Feather name="camera" size={16} color="white" />
              </View>
            </TouchableOpacity>
            <CustomText variant="title" weight="bold" fontFamily="figtree" style={styles.name}>
              {userData.name || 'Track Athlete'}
            </CustomText>
            {userData.bio && (
              <CustomText variant="body" weight="normal" fontFamily="figtree" style={styles.bio}>
                {userData.bio}
              </CustomText>
            )}
          </View>

          {/* Stats */}
          <View style={styles.statsSection}>
            <View style={styles.statItem}>
              <CustomText variant="title" weight="bold" fontFamily="figtree" style={styles.statValue}>
                {userData.totalWorkouts || 0}
              </CustomText>
              <CustomText variant="caption" weight="normal" fontFamily="figtree" style={styles.statLabel}>
                Workouts
              </CustomText>
            </View>
            <View style={styles.statDivider} />
            <View style={styles.statItem}>
              <CustomText variant="title" weight="bold" fontFamily="figtree" style={styles.statValue}>
                {userData.personalRecords || 0}
              </CustomText>
              <CustomText variant="caption" weight="normal" fontFamily="figtree" style={styles.statLabel}>
                PRs
              </CustomText>
            </View>
            <View style={styles.statDivider} />
            <View style={styles.statItem}>
              <CustomText variant="title" weight="bold" fontFamily="figtree" style={styles.statValue}>
                {userData.followersCount || 0}
              </CustomText>
              <CustomText variant="caption" weight="normal" fontFamily="figtree" style={styles.statLabel}>
                Followers
              </CustomText>
            </View>
          </View>

          {/* Apple Watch Connection */}
          {Platform.OS === 'ios' && (
            <View style={styles.watchSection}>
              <AppleWatchConnection />
            </View>
          )}

          {/* Menu Items */}
          <View style={styles.menuSection}>
            <TouchableOpacity
              style={styles.menuItem}
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                router.push('/authenticated_tabs/stats');
              }}
            >
              <View style={styles.menuItemLeft}>
                <View style={[styles.menuIconContainer, { backgroundColor: 'rgba(255, 107, 53, 0.2)' }]}>
                  <Feather name="bar-chart-2" size={20} color="#FF6B35" />
                </View>
                <CustomText variant="body" weight="medium" fontFamily="figtree" style={styles.menuItemText}>
                  Performance Stats
                </CustomText>
              </View>
              <Feather name="chevron-right" size={20} color="#9BA1A6" />
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.menuItem}
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                router.push('/authenticated_tabs/workouts');
              }}
            >
              <View style={styles.menuItemLeft}>
                <View style={[styles.menuIconContainer, { backgroundColor: 'rgba(255, 107, 53, 0.2)' }]}>
                  <Feather name="activity" size={20} color="#FF6B35" />
                </View>
                <CustomText variant="body" weight="medium" fontFamily="figtree" style={styles.menuItemText}>
                  Workout History
                </CustomText>
              </View>
              <Feather name="chevron-right" size={20} color="#9BA1A6" />
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.menuItem}
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                Alert.alert('Settings', 'Settings coming soon!');
              }}
            >
              <View style={styles.menuItemLeft}>
                <View style={[styles.menuIconContainer, { backgroundColor: 'rgba(255, 107, 53, 0.2)' }]}>
                  <Feather name="settings" size={20} color="#FF6B35" />
                </View>
                <CustomText variant="body" weight="medium" fontFamily="figtree" style={styles.menuItemText}>
                  Settings
                </CustomText>
              </View>
              <Feather name="chevron-right" size={20} color="#9BA1A6" />
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.menuItem}
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                Alert.alert('Help', 'Help & Support coming soon!');
              }}
            >
              <View style={styles.menuItemLeft}>
                <View style={[styles.menuIconContainer, { backgroundColor: 'rgba(255, 107, 53, 0.2)' }]}>
                  <Feather name="help-circle" size={20} color="#FF6B35" />
                </View>
                <CustomText variant="body" weight="medium" fontFamily="figtree" style={styles.menuItemText}>
                  Help & Support
                </CustomText>
              </View>
              <Feather name="chevron-right" size={20} color="#9BA1A6" />
            </TouchableOpacity>
          </View>

          {/* Logout Button */}
          <TouchableOpacity
            style={styles.logoutButton}
            onPress={handleLogout}
          >
            <CustomText variant="body" weight="bold" fontFamily="figtree" style={styles.logoutText}>
              Logout
            </CustomText>
          </TouchableOpacity>
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
  },
  profileSection: {
    alignItems: 'center',
    marginBottom: 32,
  },
  profilePictureContainer: {
    position: 'relative',
    marginBottom: 16,
  },
  profilePicture: {
    width: 120,
    height: 120,
    borderRadius: 60,
    borderWidth: 3,
    borderColor: '#FF6B35',
  },
  profilePicturePlaceholder: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 3,
    borderColor: '#FF6B35',
  },
  uploadingOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    borderRadius: 60,
    justifyContent: 'center',
    alignItems: 'center',
  },
  editIconContainer: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#FF6B35',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 3,
    borderColor: '#0A0A0A',
  },
  name: {
    color: '#ECEDEE',
    fontSize: 24,
    marginBottom: 8,
  },
  bio: {
    color: '#9BA1A6',
    fontSize: 16,
    textAlign: 'center',
    paddingHorizontal: 20,
  },
  statsSection: {
    flexDirection: 'row',
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderRadius: 16,
    padding: 20,
    marginBottom: 32,
  },
  statItem: {
    flex: 1,
    alignItems: 'center',
  },
  statDivider: {
    width: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    marginHorizontal: 20,
  },
  statValue: {
    color: '#FF6B35',
    fontSize: 24,
    marginBottom: 4,
  },
  statLabel: {
    color: '#9BA1A6',
    fontSize: 12,
  },
  watchSection: {
    marginBottom: 24,
  },
  menuSection: {
    marginBottom: 32,
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
  },
  menuItemLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  menuIconContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  menuItemText: {
    color: '#ECEDEE',
    fontSize: 16,
  },
  logoutButton: {
    backgroundColor: 'rgba(255, 107, 53, 0.2)',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#FF6B35',
  },
  logoutText: {
    color: '#FF6B35',
    fontSize: 16,
  },
});
