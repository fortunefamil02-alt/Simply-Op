import { ScrollView, Text, View, TouchableOpacity, ActivityIndicator, Alert, FlatList } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useState, useEffect } from "react";
import { ScreenContainer } from "@/components/screen-container";
import { trpc } from "@/lib/trpc";

/**
 * Job Photo Capture Screen
 * Cleaner uploads photos before completing job
 */
export default function JobPhotosScreen() {
  const { id } = useLocalSearchParams();
  const router = useRouter();
  const [photos, setPhotos] = useState<any[]>([]);
  const [uploading, setUploading] = useState(false);
  const [loadingPhotos, setLoadingPhotos] = useState(true);

  // Fetch existing photos
  const { data: existingPhotos = [], isLoading } = trpc.photos.getJobPhotos.useQuery(
    { jobId: id as string },
    { enabled: !!id }
  );

  useEffect(() => {
    if (existingPhotos) {
      setPhotos(existingPhotos);
      setLoadingPhotos(false);
    }
  }, [existingPhotos]);

  // Upload photo mutation
  const uploadPhotoMutation = trpc.photos.uploadPhoto.useMutation({
    onSuccess: (newPhoto) => {
      setPhotos([...photos, newPhoto]);
      Alert.alert("Success", "Photo uploaded");
    },
    onError: (error: any) => {
      Alert.alert("Error", error.message || "Failed to upload photo");
    },
  });

  // Delete photo mutation
  const deletePhotoMutation = trpc.photos.deletePhoto.useMutation({
    onSuccess: () => {
      setPhotos(photos.filter((p) => p.id !== selectedPhotoId));
      setSelectedPhotoId(null);
      Alert.alert("Success", "Photo deleted");
    },
    onError: (error: any) => {
      Alert.alert("Error", error.message || "Failed to delete photo");
    },
  });

  const [selectedPhotoId, setSelectedPhotoId] = useState<string | null>(null);

  const handlePickImage = async () => {
    // TODO: Integrate with expo-image-picker for real image capture
    // For now, show mock photo upload
    setUploading(true);
    try {
      await uploadPhotoMutation.mutateAsync({
        jobId: id as string,
        imageBase64: "mock-base64-data",
        room: undefined,
      });
    } finally {
      setUploading(false);
    }
  };

  const handleDeletePhoto = (photoId: string) => {
    Alert.alert("Delete Photo", "Are you sure?", [
      { text: "Cancel", onPress: () => setSelectedPhotoId(null) },
      {
        text: "Delete",
        onPress: async () => {
          await deletePhotoMutation.mutateAsync({
            photoId,
            jobId: id as string,
          });
        },
      },
    ]);
  };

  const handleCompleteJob = () => {
    if (photos.length === 0) {
      Alert.alert("Error", "Please upload at least one photo before completing the job");
      return;
    }

    Alert.alert("Complete Job", "Mark this job as completed?", [
      { text: "Cancel" },
      {
        text: "Complete",
        onPress: () => {
          router.push(`/job/${id}/complete`);
        },
      },
    ]);
  };

  const renderPhotoCard = ({ item }: { item: any }) => (
    <TouchableOpacity
      onPress={() => setSelectedPhotoId(selectedPhotoId === item.id ? null : item.id)}
      className={`bg-surface border-2 rounded-lg p-3 mb-3 ${
        selectedPhotoId === item.id ? "border-primary" : "border-border"
      }`}
    >
      <View className="bg-gray-200 rounded h-40 mb-2 items-center justify-center">
        <Text className="text-muted">Photo {item.id.slice(0, 8)}</Text>
      </View>
      {item.room && <Text className="text-sm text-muted mb-2">Room: {item.room}</Text>}
      <Text className="text-xs text-muted">
        {new Date(item.uploadedAt).toLocaleString()}
      </Text>

      {selectedPhotoId === item.id && (
        <TouchableOpacity
          onPress={() => handleDeletePhoto(item.id)}
          className="mt-2 bg-error rounded px-3 py-2 items-center"
        >
          <Text className="text-white text-sm font-semibold">Delete</Text>
        </TouchableOpacity>
      )}
    </TouchableOpacity>
  );

  return (
    <ScreenContainer className="p-4">
      <ScrollView contentContainerStyle={{ flexGrow: 1 }}>
        {/* Header */}
        <View className="flex-row justify-between items-start mb-6">
          <View className="flex-1">
            <Text className="text-2xl font-bold text-foreground">Job Photos</Text>
            <Text className="text-sm text-muted mt-1">Upload photos before completing</Text>
          </View>
          <TouchableOpacity onPress={() => router.back()} className="bg-surface rounded-lg p-2">
            <Text className="text-primary font-semibold">Back</Text>
          </TouchableOpacity>
        </View>

        {/* Photo Count */}
        <View className="bg-surface border border-border rounded-lg p-4 mb-4">
          <Text className="text-lg font-semibold text-foreground">
            Photos: {photos.length}
          </Text>
          <Text className="text-sm text-muted mt-1">
            {photos.length === 0
              ? "No photos yet. Upload at least one."
              : "Ready to complete job"}
          </Text>
        </View>

        {/* Upload Button */}
        <TouchableOpacity
          onPress={handlePickImage}
          disabled={uploading}
          className="bg-primary rounded-lg py-3 items-center mb-6"
        >
          {uploading ? (
            <ActivityIndicator color="white" />
          ) : (
            <Text className="text-white font-semibold">+ Add Photo</Text>
          )}
        </TouchableOpacity>

        {/* Photos List */}
        {loadingPhotos ? (
          <View className="items-center justify-center py-8">
            <ActivityIndicator size="large" color="#0a7ea4" />
          </View>
        ) : photos.length === 0 ? (
          <View className="items-center justify-center py-8">
            <Text className="text-muted">No photos uploaded yet</Text>
          </View>
        ) : (
          <FlatList
            data={photos}
            renderItem={renderPhotoCard}
            keyExtractor={(item) => item.id}
            scrollEnabled={false}
          />
        )}

        {/* Complete Job Button */}
        <View className="gap-3 mt-6">
          <TouchableOpacity
            onPress={handleCompleteJob}
            disabled={photos.length === 0}
            className={`rounded-lg py-3 items-center ${
              photos.length === 0 ? "bg-gray-300" : "bg-primary"
            }`}
          >
            <Text className={`font-semibold ${photos.length === 0 ? "text-gray-600" : "text-white"}`}>
              Complete Job with {photos.length} Photo{photos.length !== 1 ? "s" : ""}
            </Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </ScreenContainer>
  );
}
