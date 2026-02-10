import { View, Text, TouchableOpacity } from "react-native";
import { ScreenContainer } from "./screen-container";
import { useRouter } from "expo-router";

interface AuthErrorScreenProps {
  error?: string;
  onRetry?: () => void;
}

export function AuthErrorScreen({ error, onRetry }: AuthErrorScreenProps) {
  const router = useRouter();

  const handleRetry = () => {
    if (onRetry) {
      onRetry();
    } else {
      router.replace("/login");
    }
  };

  return (
    <ScreenContainer edges={["top", "left", "right", "bottom"]} className="bg-background">
      <View className="flex-1 items-center justify-center gap-6 px-6">
        <View className="gap-4 items-center">
          <Text className="text-4xl">⚠️</Text>
          <Text className="text-2xl font-bold text-foreground text-center">
            Authentication Error
          </Text>
          <Text className="text-base text-muted text-center">
            {error || "We encountered an issue verifying your session. Please try again."}
          </Text>
        </View>

        <View className="w-full gap-3">
          <TouchableOpacity
            onPress={handleRetry}
            style={{
              backgroundColor: "#0a7ea4",
              paddingVertical: 14,
              borderRadius: 8,
              alignItems: "center",
            }}
          >
            <Text className="text-white font-semibold text-base">Try Again</Text>
          </TouchableOpacity>

          <TouchableOpacity
            onPress={() => router.replace("/login")}
            style={{
              backgroundColor: "transparent",
              borderColor: "#ccc",
              borderWidth: 1,
              paddingVertical: 14,
              borderRadius: 8,
              alignItems: "center",
            }}
          >
            <Text className="text-foreground font-semibold text-base">Go to Login</Text>
          </TouchableOpacity>
        </View>
      </View>
    </ScreenContainer>
  );
}
