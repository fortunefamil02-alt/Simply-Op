import { ScrollView, Text, View, TextInput, TouchableOpacity, Alert } from "react-native";
import { useRouter } from "expo-router";
import { useState } from "react";
import { useAuth } from "@/lib/auth-context";
import { ScreenContainer } from "@/components/screen-container";

/**
 * Simply Ops Founder Login
 * Founder-only access to control plane
 */
export default function OpsLoginScreen() {
  const router = useRouter();
  const { login } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  const handleLogin = async () => {
    if (!email || !password) {
      Alert.alert("Error", "Please enter email and password");
      return;
    }

    setLoading(true);
    try {
      await login(email, password);
      // Navigation will be handled by auth context
      router.replace("/ops");
    } catch (error) {
      const message = error instanceof Error ? error.message : "Login failed";
      Alert.alert("Login Failed", message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <ScreenContainer>
      <ScrollView contentContainerStyle={{ flexGrow: 1 }}>
        <View className="flex-1 justify-center px-6 gap-6">
          {/* Header */}
          <View className="items-center gap-2 mb-4">
            <Text className="text-3xl font-bold text-foreground">Simply Ops</Text>
            <Text className="text-sm text-muted">Founder Control Plane</Text>
          </View>

          {/* Login Form */}
          <View className="gap-4">
            <View>
              <Text className="text-sm font-semibold text-foreground mb-2">Email</Text>
              <TextInput
                className="border border-border rounded-lg px-4 py-3 bg-surface text-foreground"
                placeholder="founder@example.com"
                placeholderTextColor="#9BA1A6"
                value={email}
                onChangeText={setEmail}
                editable={!loading}
                keyboardType="email-address"
                autoCapitalize="none"
              />
            </View>

            <View>
              <Text className="text-sm font-semibold text-foreground mb-2">Password</Text>
              <TextInput
                className="border border-border rounded-lg px-4 py-3 bg-surface text-foreground"
                placeholder="••••••••"
                placeholderTextColor="#9BA1A6"
                value={password}
                onChangeText={setPassword}
                editable={!loading}
                secureTextEntry
              />
            </View>

            <TouchableOpacity
              onPress={handleLogin}
              disabled={loading}
              className="bg-primary rounded-lg py-3 items-center"
              style={{
                opacity: loading ? 0.6 : 1,
              }}
            >
              <Text className="text-white font-semibold">
                {loading ? "Logging in..." : "Login"}
              </Text>
            </TouchableOpacity>
          </View>

          {/* Demo Credentials */}
          <View className="bg-surface border border-border rounded-lg p-4 mt-6">
            <Text className="text-xs font-semibold text-foreground mb-2">Demo Credentials</Text>
            <Text className="text-xs text-muted mb-1">Email: founder@example.com</Text>
            <Text className="text-xs text-muted">Password: password123</Text>
            <Text className="text-xs text-muted mt-2 italic">
              (For testing purposes. Replace with real authentication in production.)
            </Text>
          </View>
        </View>
      </ScrollView>
    </ScreenContainer>
  );
}
