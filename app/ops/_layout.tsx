import { Stack, useRouter } from "expo-router";
import { useEffect } from "react";
import { useAuth } from "@/lib/auth-context";
import { AuthLoadingScreen } from "@/components/auth-loading-screen";

/**
 * Simply Ops - Founder-only control plane
 * Separate route namespace from Simply Organized
 * Requires founder role to access
 */
export default function OpsLayout() {
  const { user, isInitialized } = useAuth();
  const router = useRouter();

  useEffect(() => {
    // Wait for auth to initialize
    if (!isInitialized) {
      return;
    }

    // Redirect non-founders to login
    if (!user || (user.role as string) !== "founder") {
      router.replace("/ops/login");
    }
  }, [user, isInitialized, router]);

  // Show loading screen while auth is initializing
  if (!isInitialized) {
    return <AuthLoadingScreen />;
  }

  // Show loading screen for non-founders (they'll be redirected)
  if (!user || (user.role as string) !== "founder") {
    return <AuthLoadingScreen />;
  }

  return (
    <Stack
      screenOptions={{
        headerShown: true,
        headerTintColor: "#0a7ea4",
        headerTitleStyle: {
          fontWeight: "600",
        },
      }}
    >
      <Stack.Screen
        name="index"
        options={{
          title: "Simply Ops - Founder Dashboard",
          headerBackVisible: false,
        }}
      />
      <Stack.Screen
        name="business/[id]"
        options={{
          title: "Business Details",
        }}
      />
      <Stack.Screen
        name="audit-log"
        options={{
          title: "Audit Log",
        }}
      />
      <Stack.Screen
        name="login"
        options={{
          title: "Founder Login",
          headerBackVisible: false,
        }}
      />
    </Stack>
  );
}
