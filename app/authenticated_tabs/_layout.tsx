import { Tabs, Stack } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import { View, TouchableOpacity, Image, Animated, Dimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { useState, useEffect, useRef } from 'react';
import * as Haptics from 'expo-haptics';
import tabBarStyles from '../styles/tabBarStyles';
import { useRouter } from 'expo-router';

export default function TabsLayout() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const screenWidth = Dimensions.get('window').width;
  
  // Animation value for the circle background
  const circlePosition = useRef(new Animated.Value(0)).current;
  
  // Animation value for gradient opacity
  const gradientOpacity = useRef(new Animated.Value(1)).current;
  
  // State to track the active tab
  const [activeTab, setActiveTab] = useState('home');
  
    // Calculate positions for each tab (excluding the center workouts button)
  const getTabPosition = (tab: string) => {
    const navBarWidth = screenWidth - 40; // 20px margin on each side
    const availableWidth = navBarWidth - 40; // 20px padding on each side
      const centerButtonWidth = 65;
      const remainingWidth = availableWidth - centerButtonWidth;
      const tabSpacing = remainingWidth / 4; // 4 tabs (2 on left, 2 on right of center button)
    const circleSize = 40;
    const iconSize = 24;
    const iconOffset = (circleSize - iconSize) / 2; // Center the circle on the icon
    
    // Calculate the center position of each icon
    const homeCenter = 20 + (tabSpacing / 2);
      const progressCenter = 20 + tabSpacing + (tabSpacing / 2);
      const statsCenter = 20 + (tabSpacing * 2) + centerButtonWidth + (tabSpacing / 2);
      const profileCenter = 20 + (tabSpacing * 3) + centerButtonWidth + (tabSpacing / 2);
    
    // Adjustments for different pages
      const homeAdjustment = 4;
      const progressAdjustment = 4;
      const statsAdjustment = 4;
      const profileAdjustment = 4;
    
    switch (tab) {
        case 'home': return homeCenter - (circleSize / 2) - homeAdjustment;
        case 'progress': return progressCenter - (circleSize / 2) - progressAdjustment;
        case 'workouts': return 20 + (tabSpacing * 2) + (centerButtonWidth / 2) - (circleSize / 2);
        case 'stats': return statsCenter - (circleSize / 2) + statsAdjustment;
        case 'profile': return profileCenter - (circleSize / 2) + profileAdjustment;
      default: return homeCenter - (circleSize / 2) - homeAdjustment;
    }
  };
  
  // Animate circle position and gradient when tab changes
  useEffect(() => {
    const targetPosition = getTabPosition(activeTab);
    
    // Animate circle position
    Animated.spring(circlePosition, {
      toValue: targetPosition,
      useNativeDriver: false,
      tension: 100,
      friction: 8,
    }).start();
    
    // Animate gradient transition smoothly
    Animated.sequence([
      Animated.timing(gradientOpacity, {
        toValue: 0.3,
        duration: 100,
        useNativeDriver: true,
      }),
      Animated.timing(gradientOpacity, {
        toValue: 1,
        duration: 200,
        useNativeDriver: true,
      }),
    ]).start();
  }, [activeTab]);
  
  const handleCenterButtonPress = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setActiveTab('workouts');
    // Navigate to workouts tab to start tracking
    router.push('/authenticated_tabs/workouts');
  };

  return (
    <View style={{ flex: 1, backgroundColor: 'transparent' }}>
      <Tabs
        screenOptions={{
          tabBarActiveTintColor: '#FF6B35',
                  tabBarStyle: {
          backgroundColor: 'transparent',
          height: 0,
          borderTopWidth: 0,
          borderWidth: 0,
          elevation: 0,
          shadowOpacity: 0,
          paddingHorizontal: 0,
          paddingTop: 0,
          paddingBottom: 0,
          marginHorizontal: 0,
          marginBottom: 0,
          position: 'absolute',
          bottom: -1000, // Move it way off-screen
          left: 0,
          right: 0,
          opacity: 0, // Make it completely invisible
        },
          tabBarShowLabel: false,
          headerShown: false,
          tabBarBackground: () => null, // Remove default tab bar background
        }}
      >
      <Tabs.Screen
        name="home"
        options={{
          tabBarIcon: ({ color }: { color: string }) => <Feather name="home" size={24} color={color} />, 
        }}
      />
      <Tabs.Screen
        name="progress"
        options={{
          tabBarIcon: ({ color }: { color: string }) => <Feather name="trending-up" size={24} color={color} />, 
        }}
      />
      <Tabs.Screen
        name="workouts"
        options={{
          tabBarButton: ({ style, onPress }: { style: any; onPress: () => void }) => (
            <View style={tabBarStyles.centerButtonWrapper}>
              <TouchableOpacity
                onPress={handleCenterButtonPress}
                style={tabBarStyles.centerButton}
              >
                <Feather name="activity" size={28} color="white" />
              </TouchableOpacity>
            </View>
          ),
        }}
      />
      <Tabs.Screen
        name="stats"
        options={{
          tabBarIcon: ({ color }: { color: string }) => <Feather name="bar-chart-2" size={24} color={color} />, 
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          tabBarIcon: ({ color }: { color: string }) => <Feather name="user" size={24} color={color} />, 
        }}
      />
      </Tabs>
      

      
      {/* Dark gradient shadow behind navigation bar */}
      <LinearGradient
        colors={['transparent', 'rgba(0, 0, 0, 0.1)', 'rgba(0, 0, 0, 0.3)', 'rgba(0, 0, 0, 0.5)', 'rgba(0, 0, 0, 0.7)', 'rgba(0, 0, 0, 0.9)']}
        locations={[0, 0.2, 0.4, 0.6, 0.8, 1]}
        style={{
          position: 'absolute',
          bottom: 0,
          left: 0,
          right: 0,
          height: Math.max(120, insets.bottom + 100),
          zIndex: 1,
        }}
      />

      {/* Shadow container for navigation bar */}
      <View style={{
        position: 'absolute',
        bottom: Math.max(10, insets.bottom + 5),
        left: 20,
        right: 20,
        height: 60,
        borderRadius: 30,
        elevation: 20,
        shadowColor: '#000',
        shadowOpacity: 0.3,
        shadowOffset: { width: 0, height: 8 },
        shadowRadius: 20,
        backgroundColor: 'transparent',
        zIndex: 2,
      }}>
        {/* Custom pill-shaped navigation bar */}
        <View style={{
          height: 60,
          backgroundColor: 'white',
          borderRadius: 30,
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-around',
          paddingHorizontal: 20,
        }}>
        {/* Animated circle background */}
        <Animated.View
          style={{
            position: 'absolute',
            left: circlePosition,
            width: 40,
            height: 40,
            borderRadius: 20,
            backgroundColor: 'rgba(255, 107, 53, 0.15)', // Light orange background
            top: 10, // Center vertically in the 60px height nav bar
          }}
        />
        
        <TouchableOpacity onPress={() => {
          setActiveTab('home');
          router.push('/authenticated_tabs/home');
        }}>
          <Feather name="home" size={24} color={activeTab === 'home' ? '#FF6B35' : '#666'} />
        </TouchableOpacity>
        <TouchableOpacity onPress={() => {
          setActiveTab('progress');
          router.push('/authenticated_tabs/progress');
        }}>
          <Feather name="trending-up" size={24} color={activeTab === 'progress' ? '#FF6B35' : '#666'} />
        </TouchableOpacity>
        <TouchableOpacity
          onPress={handleCenterButtonPress}
          style={{
            width: 65,
            height: 65,
            borderRadius: 32.5,
            backgroundColor: activeTab === 'workouts' ? '#FF6B35' : '#FF6B35', // Always orange
            justifyContent: 'center',
            alignItems: 'center',
            shadowColor: '#000',
            shadowOpacity: 0.25,
            shadowOffset: { width: 0, height: 6 },
            shadowRadius: 12,
            elevation: 12,
            borderWidth: 3,
            borderColor: 'white',
            marginTop: -2.5,
          }}
        >
          <Feather name="activity" size={32} color="white" />
        </TouchableOpacity>
        <TouchableOpacity onPress={() => {
          setActiveTab('stats');
          router.push('/authenticated_tabs/stats');
        }}>
          <Feather name="bar-chart-2" size={24} color={activeTab === 'stats' ? '#FF6B35' : '#666'} />
        </TouchableOpacity>
        <TouchableOpacity onPress={() => {
          setActiveTab('profile');
          router.push('/authenticated_tabs/profile');
        }}>
          <Feather name="user" size={24} color={activeTab === 'profile' ? '#FF6B35' : '#666'} />
        </TouchableOpacity>
        </View>
      </View>
    </View>
  );
}