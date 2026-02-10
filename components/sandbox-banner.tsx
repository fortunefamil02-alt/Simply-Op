import { View, Text } from "react-native";
import { useAuth } from "@/lib/auth-context";
import { useColors } from "@/hooks/use-colors";
import { cn } from "@/lib/utils";

/**
 * Sandbox Banner Component
 *
 * Displays a persistent visual banner indicating sandbox mode.
 * Only shown when app is running in sandbox environment.
 *
 * CONSTRAINTS:
 * - Persistent visual indicator
 * - Clear labeling: "Sandbox — Not Real Data"
 * - Always visible when in sandbox
 * - No dismissal option
 */

export function SandboxBanner() {
  const { user } = useAuth();
  const colors = useColors();

  // Check if running in sandbox mode (environment variable)
  const isSandbox = process.env.EXPO_PUBLIC_SANDBOX_MODE === "true";

  // Only show if in sandbox mode
  if (!isSandbox) {
    return null;
  }

  return (
    <View
      className={cn(
        "w-full px-4 py-2 bg-warning/10 border-b border-warning/50",
        "flex-row items-center justify-center"
      )}
    >
      <Text className="text-xs font-semibold text-warning">
        ⚠️ SANDBOX — Not Real Data
      </Text>
    </View>
  );
}
