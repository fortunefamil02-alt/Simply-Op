import { ScrollView, Text, View, TouchableOpacity, ActivityIndicator, Alert, FlatList } from "react-native";
import { useRouter } from "expo-router";
import { useState, useEffect } from "react";
import { ScreenContainer } from "@/components/screen-container";
import { trpc } from "@/lib/trpc";

/**
 * Manager Dashboard - Job List
 * Shows all jobs with status filtering and quick actions
 */
export default function ManagerJobsScreen() {
  const router = useRouter();
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [refreshing, setRefreshing] = useState(false);

  // Fetch jobs for manager
  const { data: jobs = [], isLoading, refetch } = trpc.jobs.listForManager.useQuery(undefined, {
    refetchInterval: 30000, // Refetch every 30 seconds
  });

  // Filter jobs by status
  const filteredJobs = statusFilter === "all" 
    ? jobs 
    : jobs.filter((job: any) => job.status === statusFilter);

  const handleRefresh = async () => {
    setRefreshing(true);
    try {
      await refetch();
    } catch (error) {
      Alert.alert("Error", "Failed to refresh jobs");
    } finally {
      setRefreshing(false);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "available":
        return "bg-yellow-100";
      case "accepted":
        return "bg-blue-100";
      case "in_progress":
        return "bg-purple-100";
      case "completed":
        return "bg-green-100";
      default:
        return "bg-gray-100";
    }
  };

  const getStatusTextColor = (status: string) => {
    switch (status) {
      case "available":
        return "text-yellow-800";
      case "accepted":
        return "text-blue-800";
      case "in_progress":
        return "text-purple-800";
      case "completed":
        return "text-green-800";
      default:
        return "text-gray-800";
    }
  };

  const getStatusLabel = (status: string) => {
    const labels: Record<string, string> = {
      available: "Available",
      accepted: "Accepted",
      in_progress: "In Progress",
      completed: "Completed",
    };
    return labels[status] || status;
  };

  const renderJobCard = ({ item: job }: { item: any }) => (
    <TouchableOpacity
      onPress={() => router.push(`/job/${job.id}`)}
      className="bg-surface border border-border rounded-lg p-4 mb-3"
    >
      <View className="flex-row justify-between items-start mb-2">
        <View className="flex-1">
          <Text className="text-lg font-semibold text-foreground">{job.property?.name || "Unknown Property"}</Text>
          <Text className="text-xs text-muted mt-1">
            {new Date(job.cleaningDate).toLocaleDateString()} at {job.cleaningTime || "TBD"}
          </Text>
        </View>
        <View className={`${getStatusColor(job.status)} rounded-full px-3 py-1`}>
          <Text className={`text-xs font-semibold ${getStatusTextColor(job.status)}`}>
            {getStatusLabel(job.status)}
          </Text>
        </View>
      </View>

      {job.assignedCleaner && (
        <Text className="text-sm text-muted">
          Assigned to: {job.assignedCleaner.name}
        </Text>
      )}

      {job.notes && (
        <Text className="text-sm text-muted mt-2 line-clamp-2">{job.notes}</Text>
      )}

      <View className="flex-row justify-between items-center mt-3 pt-3 border-t border-border">
        <Text className="text-xs text-muted">{job.id}</Text>
        <TouchableOpacity className="bg-primary rounded px-3 py-1">
          <Text className="text-white text-xs font-semibold">View</Text>
        </TouchableOpacity>
      </View>
    </TouchableOpacity>
  );

  return (
    <ScreenContainer className="p-4">
      <View className="flex-1">
        {/* Header */}
        <View className="flex-row justify-between items-center mb-6">
          <View>
            <Text className="text-2xl font-bold text-foreground">Jobs</Text>
            <Text className="text-sm text-muted">Manage cleaning operations</Text>
          </View>
          <TouchableOpacity
            onPress={() => router.push("/(tabs)/create-job")}
            className="bg-primary rounded-lg px-4 py-2"
          >
            <Text className="text-white font-semibold">+ New Job</Text>
          </TouchableOpacity>
        </View>

        {/* Status Filter Tabs */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} className="mb-4">
          {["all", "available", "accepted", "in_progress", "completed"].map((status) => (
            <TouchableOpacity
              key={status}
              onPress={() => setStatusFilter(status)}
              className={`mr-2 px-4 py-2 rounded-full ${
                statusFilter === status
                  ? "bg-primary"
                  : "bg-surface border border-border"
              }`}
            >
              <Text
                className={`font-semibold ${
                  statusFilter === status ? "text-white" : "text-foreground"
                }`}
              >
                {status === "all" ? "All" : getStatusLabel(status)}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        {/* Jobs List */}
        {isLoading ? (
          <View className="flex-1 items-center justify-center">
            <ActivityIndicator size="large" color="#0a7ea4" />
          </View>
        ) : filteredJobs.length === 0 ? (
          <View className="flex-1 items-center justify-center">
            <Text className="text-lg text-muted">No jobs found</Text>
            <TouchableOpacity
              onPress={() => router.push("/(tabs)/create-job")}
              className="mt-4 bg-primary rounded-lg px-6 py-3"
            >
              <Text className="text-white font-semibold">Create First Job</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <FlatList
            data={filteredJobs}
            renderItem={renderJobCard}
            keyExtractor={(item) => item.id}
            onRefresh={handleRefresh}
            refreshing={refreshing}
            scrollEnabled={false}
          />
        )}
      </View>
    </ScreenContainer>
  );
}
