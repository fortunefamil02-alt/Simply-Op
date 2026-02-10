import { ScrollView, Text, View, TouchableOpacity, ActivityIndicator, Alert, FlatList } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useState, useEffect } from "react";
import { ScreenContainer } from "@/components/screen-container";
import { trpc } from "@/lib/trpc";

/**
 * Job Completion Screen
 * Shows photos and confirms job completion
 */
export default function JobCompleteScreen() {
  const { id } = useLocalSearchParams();
  const router = useRouter();
  const [photos, setPhotos] = useState<any[]>([]);
  const [loadingPhotos, setLoadingPhotos] = useState(true);
  const [completing, setCompleting] = useState(false);

  // Fetch photos
  const { data: existingPhotos = [] } = trpc.photos.getJobPhotos.useQuery(
    { jobId: id as string },
    { enabled: !!id }
  );

  useEffect(() => {
    if (existingPhotos) {
      setPhotos(existingPhotos);
      setLoadingPhotos(false);
    }
  }, [existingPhotos]);

  // Complete job mutation
  const completeJobMutation = trpc.jobs.complete.useMutation({
    onSuccess: () => {
      Alert.alert("Success", "Job completed!", [
        {
          text: "OK",
          onPress: () => router.push("/(cleaner)/jobs"),
        },
      ]);
    },
    onError: (error: any) => {
      Alert.alert("Error", error.message || "Failed to complete job");
    },
  });

  const handleCompleteJob = async () => {
    if (photos.length === 0) {
      Alert.alert("Error", "No photos attached to this job");
      return;
    }

    setCompleting(true);
    try {
      await completeJobMutation.mutateAsync({
        jobId: id as string,
        gpsLat: 0,
        gpsLng: 0,
      });
    } finally {
      setCompleting(false);
    }
  };

  const renderPhotoCard = ({ item }: { item: any }) => (
    <View className="bg-surface border border-border rounded-lg p-3 mb-3">
      <View className="bg-gray-200 rounded h-40 mb-2 items-center justify-center">
        <Text className="text-muted">Photo {item.id.slice(0, 8)}</Text>
      </View>
      <Text className="text-xs text-muted">
        {new Date(item.uploadedAt).toLocaleString()}
      </Text>
    </View>
  );

  return (
    <ScreenContainer className="p-4">
      <ScrollView contentContainerStyle={{ flexGrow: 1 }}>
        {/* Header */}
        <View className="flex-row justify-between items-start mb-6">
          <View className="flex-1">
            <Text className="text-2xl font-bold text-foreground">Complete Job</Text>
            <Text className="text-sm text-muted mt-1">Review photos and confirm completion</Text>
          </View>
          <TouchableOpacity onPress={() => router.back()} className="bg-surface rounded-lg p-2">
            <Text className="text-primary font-semibold">Back</Text>
          </TouchableOpacity>
        </View>

        {/* Photo Summary */}
        <View className="bg-surface border border-border rounded-lg p-4 mb-4">
          <Text className="text-lg font-semibold text-foreground">
            Photos Attached: {photos.length}
          </Text>
          <Text className="text-sm text-muted mt-1">
            {photos.length === 1 ? "1 photo" : `${photos.length} photos`} will be submitted with this job
          </Text>
        </View>

        {/* Photos List */}
        {loadingPhotos ? (
          <View className="items-center justify-center py-8">
            <ActivityIndicator size="large" color="#0a7ea4" />
          </View>
        ) : photos.length === 0 ? (
          <View className="items-center justify-center py-8">
            <Text className="text-muted">No photos to display</Text>
          </View>
        ) : (
          <FlatList
            data={photos}
            renderItem={renderPhotoCard}
            keyExtractor={(item) => item.id}
            scrollEnabled={false}
          />
        )}

        {/* Info Box */}
        <View className="bg-blue-100 border border-blue-300 rounded-lg p-4 my-4">
          <Text className="text-blue-900 font-semibold">Job Completion</Text>
          <Text className="text-blue-800 text-sm mt-2">
            By completing this job, you confirm that the cleaning has been finished and the photos are an accurate record of the work.
          </Text>
        </View>

        {/* Action Buttons */}
        <View className="gap-3 mt-6">
          <TouchableOpacity
            onPress={handleCompleteJob}
            disabled={completing || photos.length === 0}
            className={`rounded-lg py-3 items-center ${
              completing || photos.length === 0 ? "bg-gray-300" : "bg-primary"
            }`}
          >
            {completing ? (
              <ActivityIndicator color="white" />
            ) : (
              <Text className={`font-semibold ${photos.length === 0 ? "text-gray-600" : "text-white"}`}>
                Confirm Completion
              </Text>
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
