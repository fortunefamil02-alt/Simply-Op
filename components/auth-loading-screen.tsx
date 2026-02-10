import { View, Text, ActivityIndicator } from "react-native";
import { ScreenContainer } from "./screen-container";

export function AuthLoadingScreen() {
  return (
    <ScreenContainer edges={["top", "left", "right", "bottom"]} className="bg-background">
      <View className="flex-1 items-center justify-center gap-4">
        <ActivityIndicator size="large" color="#0a7ea4" />
        <Text className="text-foreground text-lg font-semibold">Loading...</Text>
        <Text className="text-muted text-sm">Checking your session</Text>
      </View>
    </ScreenContainer>
  );
}
