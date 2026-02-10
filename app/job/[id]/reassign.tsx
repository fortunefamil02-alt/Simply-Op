import { ScrollView, Text, View, TouchableOpacity, ActivityIndicator, Alert, FlatList } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useState, useEffect } from "react";
import { ScreenContainer } from "@/components/screen-container";
import { trpc } from "@/lib/trpc";

/**
 * Reassign Cleaner Screen
 * Manager selects a different cleaner for an unstarted job
 */
export default function ReassignCleanerScreen() {
  const { id } = useLocalSearchParams();
  const router = useRouter();
  const [selectedCleanerId, setSelectedCleanerId] = useState<string | null>(null);
  const [reassigning, setReassigning] = useState(false);

  // Fetch job details
  const { data: job, isLoading: jobLoading } = trpc.jobsDetail.getByIdForManager.useQuery(
    { jobId: id as string },
    { enabled: !!id }
  );

  // Fetch all cleaners (mock for now - should fetch from API)
  const [cleaners, setCleaners] = useState<any[]>([]);

  useEffect(() => {
    // TODO: Fetch cleaners from API
    setCleaners([
      { id: "cleaner_1", email: "sarah@example.com", name: "Sarah" },
      { id: "cleaner_2", email: "mike@example.com", name: "Mike" },
      { id: "cleaner_3", email: "jane@example.com", name: "Jane" },
    ]);
  }, []);

  // Reassign mutation
  const reassignMutation = trpc.jobs.reassign.useMutation({
    onSuccess: () => {
      Alert.alert("Success", "Cleaner reassigned!");
      router.back();
    },
    onError: (error: any) => {
      Alert.alert("Error", error.message || "Failed to reassign cleaner");
    },
  });

  const handleReassign = async () => {
    if (!selectedCleanerId) {
      Alert.alert("Error", "Please select a cleaner");
      return;
    }

    if (!job || job.status === "in_progress" || job.status === "completed") {
      Alert.alert("Error", "Cannot reassign job with current status");
      return;
    }

    setReassigning(true);
    try {
      await reassignMutation.mutateAsync({
        jobId: id as string,
        newCleanerId: selectedCleanerId,
      });
    } finally {
      setReassigning(false);
    }
  };

  if (jobLoading) {
    return (
      <ScreenContainer className="items-center justify-center">
        <ActivityIndicator size="large" color="#0a7ea4" />
      </ScreenContainer>
    );
  }

  if (!job) {
    return (
      <ScreenContainer className="p-4">
        <Text className="text-lg text-foreground">Job not found</Text>
      </ScreenContainer>
    );
  }

  if (job.status === "in_progress" || job.status === "completed") {
    return (
      <ScreenContainer className="p-4">
        <Text className="text-lg text-error font-semibold mb-2">Cannot Reassign</Text>
        <Text className="text-foreground">
          Jobs with status "{job.status}" cannot be reassigned
        </Text>
      </ScreenContainer>
    );
  }

  const currentCleaner = cleaners.find((c) => c.id === job.assignedCleanerId);
  const availableCleaners = cleaners.filter((c) => c.id !== job.assignedCleanerId);

  return (
    <ScreenContainer className="p-4">
      <ScrollView contentContainerStyle={{ flexGrow: 1 }}>
        {/* Header */}
        <View className="mb-6">
          <Text className="text-2xl font-bold text-foreground">Reassign Cleaner</Text>
          <Text className="text-sm text-muted mt-1">Select a different cleaner for this job</Text>
        </View>

        {/* Current Cleaner */}
        {currentCleaner && (
          <View className="bg-surface border border-border rounded-lg p-4 mb-6">
            <Text className="text-sm text-muted mb-1">Currently Assigned</Text>
            <Text className="text-lg font-semibold text-foreground">{currentCleaner.name}</Text>
            <Text className="text-sm text-muted">{currentCleaner.email}</Text>
          </View>
        )}

        {/* Available Cleaners */}
        <View className="mb-6">
          <Text className="text-sm font-semibold text-foreground mb-3">Select New Cleaner</Text>
          <FlatList
            data={availableCleaners}
            keyExtractor={(item) => item.id}
            scrollEnabled={false}
            renderItem={({ item }) => (
              <TouchableOpacity
                onPress={() => setSelectedCleanerId(item.id)}
                className={`border rounded-lg p-4 mb-2 ${
                  selectedCleanerId === item.id
                    ? "bg-primary/10 border-primary"
                    : "bg-surface border-border"
                }`}
              >
                <View className="flex-row justify-between items-start">
                  <View className="flex-1">
                    <Text className="text-lg font-semibold text-foreground">{item.name}</Text>
                    <Text className="text-sm text-muted">{item.email}</Text>
                  </View>
                  {selectedCleanerId === item.id && (
                    <View className="bg-primary rounded-full w-6 h-6 items-center justify-center">
                      <Text className="text-white font-bold">✓</Text>
                    </View>
                  )}
                </View>
              </TouchableOpacity>
            )}
          />
        </View>

        {/* Action Buttons */}
        <View className="gap-3 mt-6">
          <TouchableOpacity
            onPress={handleReassign}
            disabled={reassigning || !selectedCleanerId}
            className="bg-primary rounded-lg py-3 items-center"
          >
            {reassigning ? (
              <ActivityIndicator color="white" />
            ) : (
              <Text className="text-white font-semibold">Reassign Cleaner</Text>
            )}
          </TouchableOpacity>

          <TouchableOpacity
            onPress={() => router.back()}
            className="bg-surface border border-border rounded-lg py-3 items-center"
          >
            <Text className="text-foreground font-semibold">Cancel</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </ScreenContainer>
  );
}
