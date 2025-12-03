import { useEffect, useState } from 'react';
import { View, ActivityIndicator, StatusBar } from 'react-native';
import { onAuthStateChanged } from 'firebase/auth';
import { auth } from '../firebase/config';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';

export default function Index() {
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    // Timeout fallback in case Firebase takes too long
    const timeout = setTimeout(() => {
      if (loading) {
        console.log("Auth check timeout, navigating to splash");
        router.replace('/unauthenticated_tabs/splash');
        setLoading(false);
      }
    }, 5000); // 5 second timeout

    const unsubscribe = onAuthStateChanged(auth, (user) => {
      clearTimeout(timeout);
      console.log("AUTH STATE CHANGED:", user);
      try {
        if (user) {
          router.replace('/authenticated_tabs/home');
        } else {
          router.replace('/unauthenticated_tabs/splash');
        }
      } catch (error) {
        console.error("Navigation error:", error);
        // Fallback to splash screen if navigation fails
        router.replace('/unauthenticated_tabs/splash');
      } finally {
        setLoading(false);
      }
    });
    
    return () => {
      clearTimeout(timeout);
      unsubscribe();
    };
  }, [router, loading]);

  if (loading) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: 'white' }}>
        <StatusBar translucent backgroundColor="transparent" barStyle="dark-content" />
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
          <ActivityIndicator size="large" />
        </View>
      </SafeAreaView>
    );
  }

  return null;
}