import { ScrollView, Text, View, TouchableOpacity } from "react-native";
import { ScreenContainer } from "./screen-container";
import { useAuth } from "@/lib/auth-context";

/**
 * Suspended Account Screen
 * Shown when user's business has been suspended by founder
 * Blocks all app usage until business is reactivated
 */
export function SuspendedAccountScreen({ reason }: { reason?: string }) {
  const { logout } = useAuth();

  return (
    <ScreenContainer edges={["top", "bottom", "left", "right"]}>
      <ScrollView contentContainerStyle={{ flexGrow: 1 }}>
        <View className="flex-1 justify-center items-center px-6 gap-6">
          {/* Icon/Status */}
          <View className="w-16 h-16 rounded-full bg-red-100 items-center justify-center">
            <Text className="text-3xl">🔒</Text>
          </View>

          {/* Title */}
          <View className="items-center gap-2">
            <Text className="text-2xl font-bold text-foreground">Account Suspended</Text>
            <Text className="text-sm text-muted text-center">
              Your business account has been suspended and is no longer accessible.
            </Text>
          </View>

          {/* Details */}
          <View className="bg-surface border border-border rounded-lg p-4 gap-3 w-full">
            <View>
              <Text className="text-xs font-semibold text-muted mb-1">Status</Text>
              <Text className="text-sm text-red-600 font-semibold">Suspended</Text>
            </View>
            {reason && (
              <View>
                <Text className="text-xs font-semibold text-muted mb-1">Reason</Text>
                <Text className="text-sm text-foreground">{reason}</Text>
              </View>
            )}
            <View>
              <Text className="text-xs font-semibold text-muted mb-1">What to do?</Text>
              <Text className="text-sm text-foreground">
                Contact the founder or system administrator to discuss the suspension and
                potential reactivation.
              </Text>
            </View>
          </View>

          {/* Warning Box */}
          <View className="bg-red-50 border border-red-200 rounded-lg p-4">
            <Text className="text-xs text-red-900">
              All access to this account has been revoked. No data can be accessed or modified
              until the suspension is lifted.
            </Text>
          </View>

          {/* Logout Button */}
          <TouchableOpacity
            onPress={logout}
            className="w-full bg-primary rounded-lg py-3 items-center mt-4"
          >
            <Text className="text-white font-semibold">Logout</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </ScreenContainer>
  );
}
