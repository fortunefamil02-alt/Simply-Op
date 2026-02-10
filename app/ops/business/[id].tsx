import { ScrollView, Text, View, ActivityIndicator, Alert } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useEffect, useState } from "react";
import { ScreenContainer } from "@/components/screen-container";
import { trpc } from "@/lib/trpc";

/**
 * Business Details Screen
 * Shows business info and audit log for that business
 */
export default function BusinessDetailsScreen() {
  const { id } = useLocalSearchParams();
  const router = useRouter();
  const [logs, setLogs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const { data: queriedLogs = [], isLoading: queryLoading } = trpc.governance.getBusinessAuditLog.useQuery(
    { businessId: id as string },
    { enabled: !!id }
  );

  useEffect(() => {
    setLogs(queriedLogs);
    setLoading(queryLoading);
  }, [queriedLogs, queryLoading]);

  const getActionLabel = (action: string) => {
    const labels: Record<string, string> = {
      business_created: "Business Created",
      business_activated: "Business Activated",
      business_suspended: "Business Suspended",
    };
    return labels[action] || action;
  };

  const getActionColor = (action: string) => {
    if (action.includes("activated")) return "bg-green-100";
    if (action.includes("suspended")) return "bg-red-100";
    if (action.includes("created")) return "bg-blue-100";
    return "bg-gray-100";
  };

  const getActionTextColor = (action: string) => {
    if (action.includes("activated")) return "text-green-800";
    if (action.includes("suspended")) return "text-red-800";
    if (action.includes("created")) return "text-blue-800";
    return "text-gray-800";
  };

  return (
    <ScreenContainer className="p-4">
      <ScrollView contentContainerStyle={{ flexGrow: 1 }}>
        {/* Header */}
        <View className="mb-6">
          <Text className="text-2xl font-bold text-foreground">Business Details</Text>
          <Text className="text-xs text-muted mt-1">{id}</Text>
        </View>

        {/* Audit Log */}
        <View className="gap-2">
          <Text className="text-lg font-semibold text-foreground mb-2">Governance Actions</Text>

          {loading ? (
            <View className="items-center justify-center py-8">
              <ActivityIndicator size="large" color="#0a7ea4" />
            </View>
          ) : logs.length === 0 ? (
            <View className="bg-surface border border-border rounded-lg p-4 items-center">
              <Text className="text-muted">No governance actions recorded</Text>
            </View>
          ) : (
            logs.map((log: any) => (
              <View
                key={log.id}
                className="bg-surface border border-border rounded-lg p-3 gap-2"
              >
                {/* Action Badge and Timestamp */}
                <View className="flex-row justify-between items-start gap-2">
                  <View className={`${getActionColor(log.action)} rounded-full px-2 py-1`}>
                    <Text className={`text-xs font-semibold ${getActionTextColor(log.action)}`}>
                      {getActionLabel(log.action)}
                    </Text>
                  </View>
                  <Text className="text-xs text-muted">
                    {new Date(log.createdAt).toLocaleString()}
                  </Text>
                </View>

                {/* Details */}
                {log.details && (
                  <View className="bg-muted/10 rounded p-2">
                    <Text className="text-xs text-muted font-mono">
                      {JSON.stringify(log.details, null, 2)}
                    </Text>
                  </View>
                )}
              </View>
            ))
          )}
        </View>

        {/* Info Box */}
        <View className="bg-blue-50 border border-blue-200 rounded-lg p-4 mt-6">
          <Text className="text-xs font-semibold text-blue-900 mb-1">Immutable Record</Text>
          <Text className="text-xs text-blue-800">
            All governance actions for this business are recorded here and cannot be modified or
            deleted.
          </Text>
        </View>
      </ScrollView>
    </ScreenContainer>
  );
}
