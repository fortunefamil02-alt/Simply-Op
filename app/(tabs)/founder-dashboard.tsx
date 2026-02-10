import { ScrollView, Text, View, Pressable } from "react-native";
import { useCallback, useMemo } from "react";
import { ScreenContainer } from "@/components/screen-container";
import { useAuth } from "@/lib/auth-context";
import { trpc } from "@/lib/trpc";
import { cn } from "@/lib/utils";
import { useColors } from "@/hooks/use-colors";

/**
 * Founder Dashboard — Governance-Only, Read-Only
 *
 * This dashboard is strictly for system-level governance oversight.
 * It shows aggregate metrics, legal acceptance records, and account status.
 *
 * CONSTRAINTS:
 * - No job-level data
 * - No cleaner data
 * - No business internal activity
 * - No operational controls
 * - Read-only except governance flags
 */

interface MetricCard {
  label: string;
  value: string | number;
  description?: string;
}

interface LegalRecord {
  id: string;
  type: string;
  timestamp: Date;
  status: "accepted" | "pending" | "rejected";
  description: string;
}

export default function FounderDashboard() {
  const { user } = useAuth();
  const colors = useColors();

  // Fetch aggregate metrics (counts only, no details)
  const { data: metrics = {}, isLoading: metricsLoading } = trpc.founder.getMetrics.useQuery(
    undefined,
    {
      enabled: user?.role === "super_manager",
    }
  );

  // Fetch legal acceptance records
  const { data: legalRecords = [], isLoading: legalLoading } =
    trpc.founder.getLegalRecords.useQuery(undefined, {
      enabled: user?.role === "super_manager",
    });

  // Get environment indicator
  const environment = useMemo(() => {
    const env = process.env.NODE_ENV || "production";
    if (env === "development") return "Alpha";
    if (process.env.EXPO_PUBLIC_SANDBOX === "true") return "Sandbox";
    return "Production";
  }, []);

  const environmentColor =
    environment === "Production" ? "bg-success/10" : environment === "Alpha" ? "bg-warning/10" : "bg-error/10";
  const environmentTextColor =
    environment === "Production" ? "text-success" : environment === "Alpha" ? "text-warning" : "text-error";

  // Aggregate metrics (counts only)
  const metricCards: MetricCard[] = useMemo(
    () => [
      {
        label: "Total Accounts",
        value: (metrics as any)?.totalAccounts || 0,
        description: "System-level count",
      },
      {
        label: "Active Businesses",
        value: (metrics as any)?.activeBusinesses || 0,
        description: "Operational accounts",
      },
      {
        label: "Total Users",
        value: (metrics as any)?.totalUsers || 0,
        description: "System-wide count",
      },
      {
        label: "Governance Status",
        value: (metrics as any)?.governanceReady ? "Ready" : "Preparing",
        description: "Compliance status",
      },
    ],
    [metrics]
  );

  const renderMetricCard = useCallback((card: MetricCard, index: number) => (
    <View
      key={index}
      className="bg-surface rounded-lg p-4 border border-border"
    >
      <Text className="text-sm text-muted mb-2">{card.label}</Text>
      <Text className="text-2xl font-bold text-foreground mb-1">{card.value}</Text>
      {card.description && <Text className="text-xs text-muted">{card.description}</Text>}
    </View>
  ), []);

  const renderLegalRecord = useCallback((record: LegalRecord, index: number) => (
    <View
      key={index}
      className={cn(
        "bg-surface rounded-lg p-4 border border-border mb-2",
        record.status === "accepted" && "border-success/50",
        record.status === "rejected" && "border-error/50",
        record.status === "pending" && "border-warning/50"
      )}
    >
      <View className="flex-row items-center justify-between mb-2">
        <Text className="font-semibold text-foreground">{record.type}</Text>
        <View
          className={cn(
            "px-2 py-1 rounded-full",
            record.status === "accepted" && "bg-success/10",
            record.status === "rejected" && "bg-error/10",
            record.status === "pending" && "bg-warning/10"
          )}
        >
          <Text
            className={cn(
              "text-xs font-semibold capitalize",
              record.status === "accepted" && "text-success",
              record.status === "rejected" && "text-error",
              record.status === "pending" && "text-warning"
            )}
          >
            {record.status}
          </Text>
        </View>
      </View>
      <Text className="text-sm text-muted mb-2">{record.description}</Text>
      <Text className="text-xs text-muted">{new Date(record.timestamp).toLocaleString()}</Text>
    </View>
  ), [cn]);

  if (!user || user.role !== "super_manager") {
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
          <Text className="text-3xl font-bold text-foreground mb-2">Governance</Text>
          <Text className="text-sm text-muted">System-level oversight and compliance</Text>
        </View>

        {/* Environment Indicator */}
        <View className={cn("rounded-lg p-4 mb-6 border border-border", environmentColor)}>
          <Text className={cn("text-sm font-semibold", environmentTextColor)}>
            Environment: {environment}
          </Text>
          <Text className="text-xs text-muted mt-1">
            {environment === "Production"
              ? "Live system"
              : environment === "Alpha"
                ? "Development and testing"
                : "Sandbox — Non-production data only"}
          </Text>
        </View>

        {/* Aggregate Metrics */}
        <View className="mb-6">
          <Text className="text-lg font-semibold text-foreground mb-3">System Metrics</Text>
          {metricsLoading ? (
            <Text className="text-muted">Loading metrics...</Text>
          ) : (
            <View className="gap-3">
              {metricCards.map((card: MetricCard, idx: number) => renderMetricCard(card, idx))}
            </View>
          )}
        </View>

        {/* Legal Acceptance Records */}
        <View className="mb-6">
          <Text className="text-lg font-semibold text-foreground mb-3">Legal Acceptance Log</Text>
          {legalLoading ? (
            <Text className="text-muted">Loading records...</Text>
          ) : legalRecords.length > 0 ? (
            <View>{legalRecords.map((record: LegalRecord, idx: number) => renderLegalRecord(record, idx))}</View>
          ) : (
            <View className="bg-surface rounded-lg p-4 border border-border">
              <Text className="text-sm text-muted">No legal records on file</Text>
            </View>
          )}
        </View>

        {/* Governance Status Summary */}
        <View className="bg-surface rounded-lg p-4 border border-border">
          <Text className="text-sm font-semibold text-foreground mb-2">Governance Status</Text>
          <Text className="text-xs text-muted mb-2">
            ✓ Specification v1.0 — Active
          </Text>
          <Text className="text-xs text-muted mb-2">
            ✓ Builder Acknowledgement — Recorded
          </Text>
          <Text className="text-xs text-muted">
            ✓ Compliance Framework — Enforced
          </Text>
        </View>

        {/* Read-Only Notice */}
        <View className="mt-6 bg-muted/10 rounded-lg p-4 border border-border">
          <Text className="text-xs text-muted">
            This dashboard is read-only. Governance flags are managed through system administration.
          </Text>
        </View>
      </ScrollView>
    </ScreenContainer>
  );
}
