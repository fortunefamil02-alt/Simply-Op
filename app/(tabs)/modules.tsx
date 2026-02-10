import { ScrollView, Text, View, Pressable } from "react-native";
import { useCallback, useMemo } from "react";
import { ScreenContainer } from "@/components/screen-container";
import { useAuth } from "@/lib/auth-context";
import { cn } from "@/lib/utils";
import { useColors } from "@/hooks/use-colors";

/**
 * Modules Screen — Module Registry (Not Modules)
 *
 * This screen displays the module registry and status indicators.
 * No module functionality is implemented.
 * Clicking inactive modules displays: "This module is not yet active. Governance framework prepared."
 *
 * CONSTRAINTS:
 * - Module Registry table only (no functionality)
 * - Status indicators: Planned, Active, Disabled
 * - "Governance framework prepared" message for inactive modules
 * - No module functionality allowed
 */

interface Module {
  id: string;
  name: string;
  description: string;
  status: "active" | "planned" | "disabled";
  version: string;
  lastUpdated: Date;
  governancePrepared: boolean;
}

const MODULES: Module[] = [
  {
    id: "simply-organized",
    name: "Simply Organized",
    description: "Core job booking and invoice management system",
    status: "active",
    version: "1.0.0",
    lastUpdated: new Date("2026-02-10"),
    governancePrepared: true,
  },
  {
    id: "simply-hosting",
    name: "Simply Hosting",
    description: "Property management and hosting integrations",
    status: "planned",
    version: "0.0.0",
    lastUpdated: new Date("2026-02-10"),
    governancePrepared: true,
  },
];

const STATUS_COLORS: Record<string, string> = {
  active: "bg-success/10",
  planned: "bg-warning/10",
  disabled: "bg-error/10",
};

const STATUS_TEXT_COLORS: Record<string, string> = {
  active: "text-success",
  planned: "text-warning",
  disabled: "text-error",
};

const STATUS_LABELS: Record<string, string> = {
  active: "Active",
  planned: "Coming Soon",
  disabled: "Disabled",
};

export default function ModulesScreen() {
  const { user } = useAuth();
  const colors = useColors();

  const handleModulePress = useCallback((module: Module) => {
    if (module.status !== "active") {
      // Show message for inactive modules
      alert(`This module is not yet active. Governance framework prepared.`);
    }
  }, []);

  const renderModuleCard = useCallback(
    (module: Module, index: number) => (
      <Pressable
        key={index}
        onPress={() => handleModulePress(module)}
        className={cn(
          "rounded-lg p-4 border border-border mb-3",
          STATUS_COLORS[module.status]
        )}
      >
        {/* Module Header */}
        <View className="flex-row items-center justify-between mb-2">
          <Text className="font-semibold text-foreground flex-1">{module.name}</Text>
          <View
            className={cn(
              "px-2 py-1 rounded-full",
              STATUS_COLORS[module.status]
            )}
          >
            <Text
              className={cn(
                "text-xs font-semibold",
                STATUS_TEXT_COLORS[module.status]
              )}
            >
              {STATUS_LABELS[module.status]}
            </Text>
          </View>
        </View>

        {/* Description */}
        <Text className="text-sm text-muted mb-2">{module.description}</Text>

        {/* Module Details */}
        <View className="flex-row items-center justify-between pt-2 border-t border-border/50">
          <Text className="text-xs text-muted">v{module.version}</Text>
          <Text className="text-xs text-muted">
            Updated: {module.lastUpdated.toLocaleDateString()}
          </Text>
        </View>

        {/* Governance Status */}
        {module.governancePrepared && (
          <View className="mt-2 pt-2 border-t border-border/50">
            <Text className="text-xs text-muted">✓ Governance framework prepared</Text>
          </View>
        )}
      </Pressable>
    ),
    [handleModulePress]
  );

  if (!user || (user.role !== "manager" && user.role !== "super_manager")) {
    return (
      <ScreenContainer className="p-6">
        <Text className="text-foreground">Access not authorized</Text>
      </ScreenContainer>
    );
  }

  return (
    <ScreenContainer className="p-6">
      <ScrollView contentContainerStyle={{ flexGrow: 1 }}>
        {/* Header */}
        <View className="mb-6">
          <Text className="text-3xl font-bold text-foreground mb-2">Modules</Text>
          <Text className="text-sm text-muted">Platform capabilities and roadmap</Text>
        </View>

        {/* Module Registry */}
        <View className="mb-6">
          <Text className="text-lg font-semibold text-foreground mb-3">Module Registry</Text>
          <View>
            {MODULES.map((module, idx) => renderModuleCard(module, idx))}
          </View>
        </View>

        {/* Information Section */}
        <View className="bg-surface rounded-lg p-4 border border-border">
          <Text className="text-sm font-semibold text-foreground mb-2">About Modules</Text>
          <Text className="text-xs text-muted mb-2">
            Modules represent distinct capabilities within the Simply Organized platform.
          </Text>
          <Text className="text-xs text-muted mb-2">
            <Text className="font-semibold">Active</Text> modules are available for use.
          </Text>
          <Text className="text-xs text-muted mb-2">
            <Text className="font-semibold">Coming Soon</Text> modules are in development with governance framework prepared.
          </Text>
          <Text className="text-xs text-muted">
            <Text className="font-semibold">Disabled</Text> modules are not available in this environment.
          </Text>
        </View>
      </ScrollView>
    </ScreenContainer>
  );
}
