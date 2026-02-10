import { ScrollView, Text, View } from "react-native";
import { ScreenContainer } from "./screen-container";

/**
 * Pending Activation Screen
 * Shown when user's business is pending activation by founder
 * Blocks all app usage until business is activated
 */
export function PendingActivationScreen() {
  return (
    <ScreenContainer edges={["top", "bottom", "left", "right"]}>
      <ScrollView contentContainerStyle={{ flexGrow: 1 }}>
        <View className="flex-1 justify-center items-center px-6 gap-6">
          {/* Icon/Status */}
          <View className="w-16 h-16 rounded-full bg-yellow-100 items-center justify-center">
            <Text className="text-3xl">⏳</Text>
          </View>

          {/* Title */}
          <View className="items-center gap-2">
            <Text className="text-2xl font-bold text-foreground">Pending Activation</Text>
            <Text className="text-sm text-muted text-center">
              Your business account is awaiting activation by the founder.
            </Text>
          </View>

          {/* Details */}
          <View className="bg-surface border border-border rounded-lg p-4 gap-3 w-full">
            <View>
              <Text className="text-xs font-semibold text-muted mb-1">Status</Text>
              <Text className="text-sm text-foreground">Pending Activation</Text>
            </View>
            <View>
              <Text className="text-xs font-semibold text-muted mb-1">What happens next?</Text>
              <Text className="text-sm text-foreground">
                The founder will review your business information and activate your account. You'll
                be notified once activation is complete.
              </Text>
            </View>
          </View>

          {/* Info Box */}
          <View className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <Text className="text-xs text-blue-900">
              This is a security measure to ensure all businesses are properly verified before
              accessing the system.
            </Text>
          </View>
        </View>
      </ScrollView>
    </ScreenContainer>
  );
}
