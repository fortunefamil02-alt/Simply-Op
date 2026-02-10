import "@/global.css";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Stack, useRouter, useSegments } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useCallback, useEffect, useMemo, useState } from "react";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import "react-native-reanimated";
import { Platform } from "react-native";
import "@/lib/_core/nativewind-pressable";
import { ThemeProvider } from "@/lib/theme-provider";
import {
  SafeAreaFrameContext,
  SafeAreaInsetsContext,
  SafeAreaProvider,
  initialWindowMetrics,
} from "react-native-safe-area-context";
import type { EdgeInsets, Metrics, Rect } from "react-native-safe-area-context";

import { trpc, createTRPCClient } from "@/lib/trpc";
import { initManusRuntime, subscribeSafeAreaInsets } from "@/lib/_core/manus-runtime";
import { AuthProvider, useAuth } from "@/lib/auth-context";
import { AuthLoadingScreen } from "@/components/auth-loading-screen";
import { PendingActivationScreen } from "@/components/pending-activation-screen";
import { SuspendedAccountScreen } from "@/components/suspended-account-screen";

const DEFAULT_WEB_INSETS: EdgeInsets = { top: 0, right: 0, bottom: 0, left: 0 };
const DEFAULT_WEB_FRAME: Rect = { x: 0, y: 0, width: 0, height: 0 };

export const unstable_settings = {
  anchor: "(tabs)",
};

/**
 * Root layout wrapper that handles authentication state and routing
 */
function RootLayoutNav() {
  const { user, isInitialized, isLoading } = useAuth();
  const segments = useSegments();
  const router = useRouter();
  const [businessStatus, setBusinessStatus] = useState<string | null>(null);
  const [suspensionReason, setSuspensionReason] = useState<string | null>(null);
  const [statusLoaded, setStatusLoaded] = useState(false);

  // Check business status on app launch
  const { data: statusData, isLoading: statusLoading } = trpc.business.getStatus.useQuery(
    { businessId: user?.companyId || "" },
    { enabled: !!user && !!user.companyId && (user.role as string) !== "founder" }
  );

  useEffect(() => {
    if (statusData) {
      setBusinessStatus(statusData.status);
      setSuspensionReason(statusData.reason);
    }
    if (!statusLoading) {
      setStatusLoaded(true);
    }
  }, [statusData, statusLoading]);

  useEffect(() => {
    if (isInitialized && (!user || (user.role as string) === "founder" || !user.companyId)) {
      setStatusLoaded(true);
    }
  }, [isInitialized, user]);

  useEffect(() => {
    if (!isInitialized || !statusLoaded) return;

    const inAuthGroup = segments[0] === "login";

    if (!user && !inAuthGroup) {
      // User is not signed in, redirect to login
      router.replace("/login");
    } else if (user && inAuthGroup) {
      // User is signed in, redirect to appropriate dashboard based on role
      if ((user.role as string) === "founder") {
        router.replace("/ops");
      } else if (user.role === "cleaner") {
        router.replace("/(cleaner)/jobs");
      } else {
        // manager or super_manager
        router.replace("/(tabs)");
      }
    }
  }, [user, isInitialized, segments, statusLoaded, businessStatus]);

  // Show loading screen while auth is initializing or business status is loading
  if (!isInitialized || isLoading || !statusLoaded) {
    return <AuthLoadingScreen />;
  }

  // Show pending activation screen if business is pending
  if (user && (user.role as string) !== "founder" && businessStatus === "pending") {
    return <PendingActivationScreen />;
  }

  // Show suspended account screen if business is suspended
  if (user && (user.role as string) !== "founder" && businessStatus === "suspended") {
    return <SuspendedAccountScreen reason={suspensionReason || undefined} />;
  }

  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="login" options={{ headerShown: false }} />
      <Stack.Screen name="(tabs)" />
      <Stack.Screen name="(cleaner)" />
      <Stack.Screen name="ops" options={{ headerShown: false }} />
      <Stack.Screen name="oauth/callback" />
    </Stack>
  );
}

export default function RootLayout() {
  const initialInsets = initialWindowMetrics?.insets ?? DEFAULT_WEB_INSETS;
  const initialFrame = initialWindowMetrics?.frame ?? DEFAULT_WEB_FRAME;

  const [insets, setInsets] = useState<EdgeInsets>(initialInsets);
  const [frame, setFrame] = useState<Rect>(initialFrame);

  // Initialize Manus runtime for cookie injection from parent container
  useEffect(() => {
    initManusRuntime();
  }, []);

  const handleSafeAreaUpdate = useCallback((metrics: Metrics) => {
    setInsets(metrics.insets);
    setFrame(metrics.frame);
  }, []);

  useEffect(() => {
    if (Platform.OS !== "web") return;
    const unsubscribe = subscribeSafeAreaInsets(handleSafeAreaUpdate);
    return () => unsubscribe();
  }, [handleSafeAreaUpdate]);

  // Create clients once and reuse them
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            // Disable automatic refetching on window focus for mobile
            refetchOnWindowFocus: false,
            // Retry failed requests once
            retry: 1,
          },
        },
      }),
  );
  const [trpcClient] = useState(() => createTRPCClient());

  // Ensure minimum 8px padding for top and bottom on mobile
  const providerInitialMetrics = useMemo(() => {
    const metrics = initialWindowMetrics ?? { insets: initialInsets, frame: initialFrame };
    return {
      ...metrics,
      insets: {
        ...metrics.insets,
        top: Math.max(metrics.insets.top, 16),
        bottom: Math.max(metrics.insets.bottom, 12),
      },
    };
  }, [initialInsets, initialFrame]);

  const content = (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <trpc.Provider client={trpcClient} queryClient={queryClient}>
        <QueryClientProvider client={queryClient}>
          <AuthProvider>
            <RootLayoutNav />
            <StatusBar style="auto" />
          </AuthProvider>
        </QueryClientProvider>
      </trpc.Provider>
    </GestureHandlerRootView>
  );

  const shouldOverrideSafeArea = Platform.OS === "web";

  if (shouldOverrideSafeArea) {
    return (
      <ThemeProvider>
        <SafeAreaProvider initialMetrics={providerInitialMetrics}>
          <SafeAreaFrameContext.Provider value={frame}>
            <SafeAreaInsetsContext.Provider value={insets}>
              {content}
            </SafeAreaInsetsContext.Provider>
          </SafeAreaFrameContext.Provider>
        </SafeAreaProvider>
      </ThemeProvider>
    );
  }

  return (
    <ThemeProvider>
      <SafeAreaProvider initialMetrics={providerInitialMetrics}>{content}</SafeAreaProvider>
    </ThemeProvider>
  );
}
