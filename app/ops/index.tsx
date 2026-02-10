import { ScrollView, Text, View, TouchableOpacity, Alert, ActivityIndicator } from "react-native";
import { useRouter } from "expo-router";
import { useEffect, useState } from "react";
import { useAuth } from "@/lib/auth-context";
import { ScreenContainer } from "@/components/screen-container";
import { trpc } from "@/lib/trpc";

/**
 * Simply Ops Founder Dashboard
 * Lists all businesses with activation/suspension controls
 */
export default function OpsDashboardScreen() {
  const router = useRouter();
  const { user, logout } = useAuth();
  const [businesses, setBusinesses] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // tRPC mutations
  const activateMutation = trpc.governance.activateBusiness.useMutation();
  const suspendMutation = trpc.governance.suspendBusiness.useMutation();

  // Fetch businesses with useQuery hook
  const { data: queriedBusinesses = [], isLoading: queryLoading, refetch } = trpc.governance.getBusinesses.useQuery();

  // Update local state when query data changes
  useEffect(() => {
    setBusinesses(queriedBusinesses);
    setLoading(queryLoading);
  }, [queriedBusinesses, queryLoading]);

  const fetchBusinesses = async () => {
    setRefreshing(true);
    try {
      await refetch();
    } catch (error) {
      console.error("Failed to fetch businesses:", error);
      Alert.alert("Error", "Failed to load businesses");
    } finally {
      setRefreshing(false);
    }
  };

  const handleLogout = async () => {
    try {
      await logout();
      router.replace("/login");
    } catch (error) {
      Alert.alert("Error", "Failed to logout");
    }
  };

  const handleActivate = async (businessId: string, businessName: string) => {
    Alert.alert(
      "Activate Business",
      `Activate "${businessName}"? This will transition the business from pending to active.`,
      [
        { text: "Cancel", onPress: () => {} },
        {
          text: "Activate",
          onPress: async () => {
            try {
              await activateMutation.mutateAsync({ businessId });
              Alert.alert("Success", "Business activated");
              fetchBusinesses();
            } catch (error) {
              const message = error instanceof Error ? error.message : "Failed to activate";
              Alert.alert("Error", message);
            }
          },
        },
      ]
    );
  };

  const handleSuspend = async (businessId: string, businessName: string) => {
    Alert.alert(
      "Suspend Business",
      `Enter suspension reason for "${businessName}":`,
      [
        { text: "Cancel", onPress: () => {} },
        {
          text: "Suspend",
          onPress: async () => {
            // In a real app, would show a text input modal
            const reason = "Violation of terms of service";
            try {
              await suspendMutation.mutateAsync({ businessId, reason });
              Alert.alert("Success", "Business suspended");
              fetchBusinesses();
            } catch (error) {
              const message = error instanceof Error ? error.message : "Failed to suspend";
              Alert.alert("Error", message);
            }
          },
        },
      ]
    );
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "pending":
        return "bg-yellow-100";
      case "active":
        return "bg-green-100";
      case "suspended":
        return "bg-red-100";
      default:
        return "bg-gray-100";
    }
  };

  const getStatusTextColor = (status: string) => {
    switch (status) {
      case "pending":
        return "text-yellow-800";
      case "active":
        return "text-green-800";
      case "suspended":
        return "text-red-800";
      default:
        return "text-gray-800";
    }
  };

  return (
    <ScreenContainer className="p-4">
      <ScrollView contentContainerStyle={{ flexGrow: 1 }}>
        {/* Header */}
        <View className="flex-row justify-between items-center mb-6">
          <View>
            <Text className="text-2xl font-bold text-foreground">Founder Dashboard</Text>
            <Text className="text-sm text-muted">{user?.email}</Text>
          </View>
          <TouchableOpacity
            onPress={handleLogout}
            className="bg-red-500 px-4 py-2 rounded-lg"
          >
            <Text className="text-white text-sm font-semibold">Logout</Text>
          </TouchableOpacity>
        </View>

        {/* Businesses List */}
        <View className="gap-4">
          <View className="flex-row justify-between items-center">
            <Text className="text-lg font-semibold text-foreground">Businesses</Text>
          <TouchableOpacity
            onPress={fetchBusinesses}
            disabled={refreshing}
          >
            <Text className="text-primary font-semibold">
              {refreshing ? "Refreshing..." : "Refresh"}
            </Text>
          </TouchableOpacity>
          </View>

          {loading ? (
            <View className="items-center justify-center py-8">
              <ActivityIndicator size="large" color="#0a7ea4" />
            </View>
          ) : businesses.length === 0 ? (
            <View className="bg-surface border border-border rounded-lg p-4 items-center">
              <Text className="text-muted">No businesses found</Text>
            </View>
          ) : (
            businesses.map((business: any) => (
              <View
                key={business.id}
                className="bg-surface border border-border rounded-lg p-4 gap-3"
              >
                {/* Business Name and Status */}
                <View className="flex-row justify-between items-start gap-2">
                  <View className="flex-1">
                    <Text className="text-base font-semibold text-foreground">
                      {business.name}
                    </Text>
                    <Text className="text-xs text-muted mt-1">{business.id}</Text>
                  </View>
                  <View className={`${getStatusColor(business.status)} rounded-full px-3 py-1`}>
                    <Text className={`text-xs font-semibold ${getStatusTextColor(business.status)}`}>
                      {business.status.toUpperCase()}
                    </Text>
                  </View>
                </View>

                {/* Timestamps */}
                <View className="gap-1">
                  <Text className="text-xs text-muted">
                    Created: {new Date(business.createdAt).toLocaleDateString()}
                  </Text>
                  {business.activatedAt && (
                    <Text className="text-xs text-muted">
                      Activated: {new Date(business.activatedAt).toLocaleDateString()}
                    </Text>
                  )}
                  {business.suspendedAt && (
                    <View>
                      <Text className="text-xs text-muted">
                        Suspended: {new Date(business.suspendedAt).toLocaleDateString()}
                      </Text>
                      {business.suspensionReason && (
                        <Text className="text-xs text-red-600 mt-1">
                          Reason: {business.suspensionReason}
                        </Text>
                      )}
                    </View>
                  )}
                </View>

                {/* Actions */}
                <View className="flex-row gap-2 mt-2">
                  {business.status === "pending" && (
                    <TouchableOpacity
                      onPress={() => handleActivate(business.id, business.name)}
                      className="flex-1 bg-green-500 rounded-lg py-2 items-center"
                    >
                      <Text className="text-white font-semibold text-sm">Activate</Text>
                    </TouchableOpacity>
                  )}
                  {business.status === "active" && (
                    <TouchableOpacity
                      onPress={() => handleSuspend(business.id, business.name)}
                      className="flex-1 bg-red-500 rounded-lg py-2 items-center"
                    >
                      <Text className="text-white font-semibold text-sm">Suspend</Text>
                    </TouchableOpacity>
                  )}
                  <TouchableOpacity
                    onPress={() => router.push(`/ops/business/${business.id}`)}
                    className="flex-1 bg-primary rounded-lg py-2 items-center"
                  >
                    <Text className="text-white font-semibold text-sm">Details</Text>
                  </TouchableOpacity>
                </View>
              </View>
            ))
          )}
        </View>

        {/* Audit Log Link */}
        <TouchableOpacity
          onPress={() => router.push("/ops/audit-log")}
          className="mt-6 bg-primary rounded-lg py-3 items-center"
        >
          <Text className="text-white font-semibold">View Audit Log</Text>
        </TouchableOpacity>
      </ScrollView>
    </ScreenContainer>
  );
}
