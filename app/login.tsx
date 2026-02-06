import React, { useState } from "react";
import { ScrollView, Text, View, TextInput, Pressable, ActivityIndicator, Alert } from "react-native";
import { useRouter } from "expo-router";
import { ScreenContainer } from "@/components/screen-container";
import { useAuth } from "@/lib/auth-context";
import { cn } from "@/lib/utils";

export default function LoginScreen() {
  const router = useRouter();
  const { login, isLoading, error, clearError } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const handleLogin = async () => {
    if (!email || !password) {
      Alert.alert("Error", "Please enter both email and password");
      return;
    }

    try {
      clearError();
      await login(email, password);
      // Navigation will be handled by the root layout based on auth state
    } catch (err) {
      // Error is already set in auth context
      console.error("[Login] Error:", err);
    }
  };

  return (
    <ScreenContainer edges={["top", "left", "right", "bottom"]} className="bg-background">
      <ScrollView contentContainerStyle={{ flexGrow: 1 }} className="flex-1">
        <View className="flex-1 justify-center px-6 py-8">
          {/* Header */}
          <View className="mb-8 items-center">
            <Text className="text-4xl font-bold text-foreground mb-2">Simply Organized</Text>
            <Text className="text-base text-muted text-center">
              Cleaning operations management for short-term rentals
            </Text>
          </View>

          {/* Error Message */}
          {error && (
            <View className="mb-6 bg-error/10 border border-error rounded-lg p-4">
              <Text className="text-error font-semibold">{error}</Text>
            </View>
          )}

          {/* Email Input */}
          <View className="mb-4">
            <Text className="text-sm font-semibold text-foreground mb-2">Email</Text>
            <TextInput
              className="bg-surface border border-border rounded-lg px-4 py-3 text-foreground"
              placeholder="you@example.com"
              placeholderTextColor="#9BA1A6"
              keyboardType="email-address"
              autoCapitalize="none"
              editable={!isLoading}
              value={email}
              onChangeText={setEmail}
            />
          </View>

          {/* Password Input */}
          <View className="mb-6">
            <Text className="text-sm font-semibold text-foreground mb-2">Password</Text>
            <TextInput
              className="bg-surface border border-border rounded-lg px-4 py-3 text-foreground"
              placeholder="••••••••"
              placeholderTextColor="#9BA1A6"
              secureTextEntry
              editable={!isLoading}
              value={password}
              onChangeText={setPassword}
            />
          </View>

          {/* Login Button */}
          <Pressable
            onPress={handleLogin}
            disabled={isLoading}
            style={({ pressed }) => [
              {
                backgroundColor: "#0a7ea4",
                paddingVertical: 12,
                borderRadius: 8,
                opacity: pressed || isLoading ? 0.8 : 1,
              },
            ]}
          >
            <View className="flex-row items-center justify-center">
              {isLoading ? (
                <>
                  <ActivityIndicator color="#ffffff" size="small" />
                  <Text className="text-white font-semibold ml-2">Logging in...</Text>
                </>
              ) : (
                <Text className="text-white font-semibold text-center">Login</Text>
              )}
            </View>
          </Pressable>

          {/* Demo Info */}
          <View className="mt-8 bg-surface border border-border rounded-lg p-4">
            <Text className="text-xs font-semibold text-foreground mb-2">Demo Credentials</Text>
            <Text className="text-xs text-muted mb-1">Email: cleaner@example.com</Text>
            <Text className="text-xs text-muted mb-3">Password: password123</Text>
            <Text className="text-xs text-muted italic">
              (For testing purposes. Replace with real authentication in production.)
            </Text>
          </View>
        </View>
      </ScrollView>
    </ScreenContainer>
  );
}
