import { ScrollView, Text, View, TouchableOpacity, ActivityIndicator, Alert } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useState, useEffect } from "react";
import { ScreenContainer } from "@/components/screen-container";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/lib/auth-context";

/**
 * Job Detail Screen
 * Shows job information, status timeline, and available actions
 */
export default function JobDetailScreen() {
  const { id } = useLocalSearchParams();
  const router = useRouter();
  const { user } = useAuth();
  const [actionLoading, setActionLoading] = useState(false);

  // Fetch job details based on user role
  const { data: job, isLoading, refetch } = trpc.jobsDetail.getByIdForManager.useQuery(
    { jobId: id as string },
    { enabled: !!id && user?.role === "manager" }
  );

  const { data: cleanerJob, isLoading: cleanerLoading } = trpc.jobsDetail.getByIdForCleaner.useQuery(
    { jobId: id as string },
    { enabled: !!id && user?.role === "cleaner" }
  );

  const currentJob = job || cleanerJob;
  const loading = isLoading || cleanerLoading;

  // Mutations
  const acceptJobMutation = trpc.jobs.accept.useMutation({
    onSuccess: () => {
      Alert.alert("Success", "Job accepted!");
      refetch();
    },
    onError: (error: any) => {
      Alert.alert("Error", error.message || "Failed to accept job");
    },
  });



  const startJobMutation = trpc.jobs.start.useMutation({
    onSuccess: () => {
      Alert.alert("Success", "Job started!");
      refetch();
    },
    onError: (error: any) => {
      Alert.alert("Error", error.message || "Failed to start job");
    },
  });

  const completeJobMutation = trpc.jobs.complete.useMutation({
    onSuccess: () => {
      Alert.alert("Success", "Job completed!");
      refetch();
    },
    onError: (error: any) => {
      Alert.alert("Error", error.message || "Failed to complete job");
    },
  });

  const handleAcceptJob = async () => {
    if (!id) return;
    setActionLoading(true);
    try {
      await acceptJobMutation.mutateAsync({ jobId: id as string });
    } finally {
      setActionLoading(false);
    }
  };

  const handleStartJob = async () => {
    if (!id) return;
    setActionLoading(true);
    try {
      await startJobMutation.mutateAsync({ jobId: id as string, gpsLat: 0, gpsLng: 0 });
    } finally {
      setActionLoading(false);
    }
  };

  const handleCompleteJob = async () => {
    if (!id) return;
    setActionLoading(true);
    try {
      await completeJobMutation.mutateAsync({ jobId: id as string, gpsLat: 0, gpsLng: 0 });
    } finally {
      setActionLoading(false);
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

  if (loading) {
    return (
      <ScreenContainer className="items-center justify-center">
        <ActivityIndicator size="large" color="#0a7ea4" />
      </ScreenContainer>
    );
  }

  if (!currentJob) {
    return (
      <ScreenContainer className="items-center justify-center">
        <Text className="text-lg text-muted">Job not found</Text>
        <TouchableOpacity
          onPress={() => router.back()}
          className="mt-4 bg-primary rounded-lg px-6 py-3"
        >
          <Text className="text-white font-semibold">Go Back</Text>
        </TouchableOpacity>
      </ScreenContainer>
    );
  }

  return (
    <ScreenContainer className="p-4">
      <ScrollView contentContainerStyle={{ flexGrow: 1 }}>
        {/* Header */}
        <View className="flex-row justify-between items-start mb-6">
          <View className="flex-1">
            <Text className="text-2xl font-bold text-foreground">Job Details</Text>
            <Text className="text-xs text-muted mt-1">{currentJob.id}</Text>
          </View>
          <TouchableOpacity onPress={() => router.back()} className="bg-surface rounded-lg p-2">
            <Text className="text-primary font-semibold">Back</Text>
          </TouchableOpacity>
        </View>

        {/* Status Badge */}
        <View className={`${getStatusColor(currentJob.status)} rounded-lg p-4 mb-6`}>
          <Text className={`text-sm font-semibold ${getStatusTextColor(currentJob.status)}`}>
            Current Status
          </Text>
          <Text className={`text-2xl font-bold ${getStatusTextColor(currentJob.status)} mt-1`}>
            {getStatusLabel(currentJob.status)}
          </Text>
        </View>

        {/* Property Information */}
        <View className="bg-surface border border-border rounded-lg p-4 mb-4">
          <Text className="text-lg font-semibold text-foreground mb-3">Property</Text>
          <View className="gap-2">
            <View>
              <Text className="text-xs font-semibold text-muted">Name</Text>
              <Text className="text-sm text-foreground">{currentJob.property?.name || "Unknown"}</Text>
            </View>
            <View>
              <Text className="text-xs font-semibold text-muted">Address</Text>
              <Text className="text-sm text-foreground">
                {currentJob.property?.address || "No address"}
              </Text>
            </View>
          </View>
        </View>

        {/* Job Information */}
        <View className="bg-surface border border-border rounded-lg p-4 mb-4">
          <Text className="text-lg font-semibold text-foreground mb-3">Job Details</Text>
          <View className="gap-3">
            <View className="flex-row justify-between">
              <Text className="text-xs font-semibold text-muted">Date</Text>
              <Text className="text-sm text-foreground">
                {new Date(currentJob.cleaningDate).toLocaleDateString()}
              </Text>
            </View>
            <View className="flex-row justify-between">
              <Text className="text-xs font-semibold text-muted">Time</Text>
              <Text className="text-sm text-foreground">{currentJob.cleaningTime || "TBD"}</Text>
            </View>
            {currentJob.price && (
              <View className="flex-row justify-between">
                <Text className="text-xs font-semibold text-muted">Price</Text>
                <Text className="text-sm text-foreground">${currentJob.price}</Text>
              </View>
            )}
          </View>
        </View>

        {/* Notes */}
        {currentJob.notes && (
          <View className="bg-surface border border-border rounded-lg p-4 mb-4">
            <Text className="text-lg font-semibold text-foreground mb-2">Instructions</Text>
            <Text className="text-sm text-foreground">{currentJob.notes}</Text>
          </View>
        )}

        {/* Assigned Cleaner */}
        {currentJob.assignedCleaner && (
          <View className="bg-surface border border-border rounded-lg p-4 mb-4">
            <Text className="text-lg font-semibold text-foreground mb-2">Assigned Cleaner</Text>
            <Text className="text-sm text-foreground">{currentJob.assignedCleaner.name}</Text>
            <Text className="text-xs text-muted mt-1">{currentJob.assignedCleaner.email}</Text>
          </View>
        )}

        {/* Action Buttons */}
        <View className="gap-3 mt-6">
          {user?.role === "cleaner" && currentJob.status === "available" && (
            <TouchableOpacity
              onPress={handleAcceptJob}
              disabled={actionLoading}
              className="bg-primary rounded-lg py-3 items-center"
            >
              {actionLoading ? (
                <ActivityIndicator color="white" />
              ) : (
                <Text className="text-white font-semibold">Accept Job</Text>
              )}
            </TouchableOpacity>
          )}

          {user?.role === "cleaner" && currentJob.status === "accepted" && (
            <TouchableOpacity
              onPress={handleStartJob}
              disabled={actionLoading}
              className="bg-primary rounded-lg py-3 items-center"
            >
              {actionLoading ? (
                <ActivityIndicator color="white" />
              ) : (
                <Text className="text-white font-semibold">Start Job</Text>
              )}
            </TouchableOpacity>
          )}

          {user?.role === "cleaner" && currentJob.status === "in_progress" && (
            <TouchableOpacity
              onPress={() => router.push(`/job/${id}/photos`)}
              className="bg-primary rounded-lg py-3 items-center"
            >
              <Text className="text-white font-semibold">Add Photos & Complete</Text>
            </TouchableOpacity>
          )}

          {user?.role === "manager" && currentJob.status !== "in_progress" && currentJob.status !== "completed" && (
            <TouchableOpacity
              onPress={() => router.push(`/job/${id}/reassign`)}
              className="bg-warning rounded-lg py-3 items-center"
            >
              <Text className="text-white font-semibold">Reassign Cleaner</Text>
            </TouchableOpacity>
          )}
        </View>
      </ScrollView>
    </ScreenContainer>
  );
}
