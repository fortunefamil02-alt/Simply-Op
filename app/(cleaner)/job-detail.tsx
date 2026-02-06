import { useState, useEffect } from "react";
import { View, Text, ScrollView, Pressable, ActivityIndicator, StyleSheet, Alert } from "react-native";
import { ScreenContainer } from "@/components/screen-container";
import { useColors } from "@/hooks/use-colors";
import { useLocalSearchParams, useRouter } from "expo-router";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Location from "expo-location";

interface Job {
  id: string;
  propertyName: string;
  propertyAddress: string;
  cleaningDate: Date;
  guestCount: number;
  hasPets: boolean;
  price: number;
  status: "available" | "accepted" | "in_progress" | "completed" | "needs_review";
  propertyId: string;
  bookingId: string;
  instructions?: string;
  propertyLat?: number;
  propertyLng?: number;
  gpsStartLat?: number;
  gpsStartLng?: number;
  gpsEndLat?: number;
  gpsEndLng?: number;
  startedAt?: Date;
  completedAt?: Date;
  acceptedAt?: Date;
}

export default function JobDetailScreen() {
  const colors = useColors();
  const router = useRouter();
  const { jobId } = useLocalSearchParams<{ jobId: string }>();

  const [job, setJob] = useState<Job | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [elapsedTime, setElapsedTime] = useState(0);
  const [gpsStatus, setGpsStatus] = useState<"checking" | "valid" | "invalid" | "not_checked">(
    "not_checked"
  );
  const [currentLocation, setCurrentLocation] = useState<Location.LocationObject | null>(null);

  useEffect(() => {
    loadJobDetail();
  }, [jobId]);

  // Timer effect for in-progress jobs
  useEffect(() => {
    if (job?.status !== "in_progress" || !job.startedAt) return;

    const interval = setInterval(() => {
      const elapsed = Math.floor((Date.now() - new Date(job.startedAt!).getTime()) / 1000);
      setElapsedTime(elapsed);
    }, 1000);

    return () => clearInterval(interval);
  }, [job?.status, job?.startedAt]);

  const loadJobDetail = async () => {
    try {
      setIsLoading(true);
      setError(null);

      // Load from mock data (will be replaced with API call)
      const jobsData = await AsyncStorage.getItem("jobs");
      if (jobsData) {
        const jobs = JSON.parse(jobsData);
        const foundJob = jobs.find((j: any) => j.id === jobId);
        if (foundJob) {
          setJob({
            ...foundJob,
            cleaningDate: new Date(foundJob.cleaningDate),
            startedAt: foundJob.startedAt ? new Date(foundJob.startedAt) : undefined,
            completedAt: foundJob.completedAt ? new Date(foundJob.completedAt) : undefined,
            acceptedAt: foundJob.acceptedAt ? new Date(foundJob.acceptedAt) : undefined,
          });
        }
      }

      // TODO: Replace with actual API call
      // const response = await fetch(`/api/jobs/${jobId}`, {
      //   headers: { Authorization: `Bearer ${token}` },
      // });
      // const data = await response.json();
      // setJob(data);
    } catch (err) {
      console.error("Failed to load job detail:", err);
      setError("Failed to load job details. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  const checkGPS = async () => {
    try {
      setGpsStatus("checking");

      // Request location permission
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== "granted") {
        setError("Location permission denied");
        setGpsStatus("invalid");
        return;
      }

      // Get current location
      const location = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.High,
      });
      setCurrentLocation(location);

      // TODO: Get property coordinates from job data
      // For now, using mock coordinates (San Francisco)
      const propertyLat = 37.7749;
      const propertyLng = -122.4194;

      // Calculate distance (Haversine formula)
      const distance = calculateDistance(
        location.coords.latitude,
        location.coords.longitude,
        propertyLat,
        propertyLng
      );

      // Check if within 50 meters
      if (distance <= 50) {
        setGpsStatus("valid");
        return true;
      } else {
        setGpsStatus("invalid");
        setError(`You are ${Math.round(distance)}m away from the property`);
        return false;
      }
    } catch (err) {
      console.error("GPS check failed:", err);
      setError("Failed to check GPS location");
      setGpsStatus("invalid");
      return false;
    }
  };

  const calculateDistance = (lat1: number, lon1: number, lat2: number, lon2: number): number => {
    const R = 6371000; // Earth's radius in meters
    const dLat = ((lat2 - lat1) * Math.PI) / 180;
    const dLon = ((lon2 - lon1) * Math.PI) / 180;
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos((lat1 * Math.PI) / 180) *
        Math.cos((lat2 * Math.PI) / 180) *
        Math.sin(dLon / 2) *
        Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  };

  const handleStartJob = async () => {
    try {
      setIsProcessing(true);

      // Verify GPS location
      const isValidLocation = await checkGPS();
      if (!isValidLocation) {
        setIsProcessing(false);
        return;
      }

      // Update job status to in_progress
      if (job) {
        const updatedJob = {
          ...job,
          status: "in_progress" as const,
          startedAt: new Date(),
          gpsStartLat: currentLocation?.coords.latitude,
          gpsStartLng: currentLocation?.coords.longitude,
        };
        setJob(updatedJob);

        // Update cache
        const jobsData = await AsyncStorage.getItem("jobs");
        if (jobsData) {
          const jobs = JSON.parse(jobsData);
          const updatedJobs = jobs.map((j: any) => (j.id === jobId ? updatedJob : j));
          await AsyncStorage.setItem("jobs", JSON.stringify(updatedJobs));
        }

        // TODO: Call API to update job status
        // await fetch(`/api/jobs/${jobId}/start`, { method: "POST" });
      }
    } catch (err) {
      console.error("Failed to start job:", err);
      setError("Failed to start job. Please try again.");
    } finally {
      setIsProcessing(false);
    }
  };

  const handleCompleteJob = async () => {
    try {
      setIsProcessing(true);

      // Verify GPS location at completion
      const isValidLocation = await checkGPS();
      if (!isValidLocation) {
        setIsProcessing(false);
        return;
      }

      // TODO: Check if required photos are uploaded
      // For now, just complete the job
      if (job) {
        const updatedJob = {
          ...job,
          status: "completed" as const,
          completedAt: new Date(),
          gpsEndLat: currentLocation?.coords.latitude,
          gpsEndLng: currentLocation?.coords.longitude,
        };
        setJob(updatedJob);

        // Update cache
        const jobsData = await AsyncStorage.getItem("jobs");
        if (jobsData) {
          const jobs = JSON.parse(jobsData);
          const updatedJobs = jobs.map((j: any) => (j.id === jobId ? updatedJob : j));
          await AsyncStorage.setItem("jobs", JSON.stringify(updatedJobs));
        }

        // TODO: Call API to complete job
        // await fetch(`/api/jobs/${jobId}/complete`, { method: "POST" });

        Alert.alert("Success", "Job completed successfully!", [
          {
            text: "OK",
            onPress: () => router.back(),
          },
        ]);
      }
    } catch (err) {
      console.error("Failed to complete job:", err);
      setError("Failed to complete job. Please try again.");
    } finally {
      setIsProcessing(false);
    }
  };

  const formatTime = (seconds: number): string => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    return `${hours.toString().padStart(2, "0")}:${minutes.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
  };

  if (isLoading) {
    return (
      <ScreenContainer className="flex-1 items-center justify-center">
        <ActivityIndicator size="large" color={colors.primary} />
        <Text style={[{ color: colors.muted, marginTop: 12 }]}>Loading job details...</Text>
      </ScreenContainer>
    );
  }

  if (!job) {
    return (
      <ScreenContainer className="flex-1 items-center justify-center">
        <Text style={[{ color: colors.error, fontSize: 16, fontWeight: "600" }]}>
          Job not found
        </Text>
        <Pressable
          onPress={() => router.back()}
          style={({ pressed }) => [
            {
              backgroundColor: colors.primary,
              paddingHorizontal: 16,
              paddingVertical: 10,
              borderRadius: 8,
              marginTop: 16,
              opacity: pressed ? 0.8 : 1,
            },
          ]}
        >
          <Text style={{ color: "#ffffff", fontWeight: "600" }}>Go Back</Text>
        </Pressable>
      </ScreenContainer>
    );
  }

  const statusConfig = {
    available: { label: "Available", bgColor: colors.success, textColor: "#ffffff" },
    accepted: { label: "Accepted", bgColor: colors.primary, textColor: "#ffffff" },
    in_progress: { label: "In Progress", bgColor: colors.warning, textColor: "#ffffff" },
    completed: { label: "Completed", bgColor: colors.success, textColor: "#ffffff" },
    needs_review: { label: "Needs Review", bgColor: colors.error, textColor: "#ffffff" },
  };

  const statusInfo = statusConfig[job.status];

  return (
    <ScreenContainer className="flex-1 bg-background">
      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {/* Header */}
        <View style={styles.header}>
          <Pressable
            onPress={() => router.back()}
            style={({ pressed }) => [{ opacity: pressed ? 0.6 : 1 }]}
          >
            <Text style={[{ color: colors.primary, fontSize: 16, fontWeight: "600" }]}>← Back</Text>
          </Pressable>
          <View
            style={[
              styles.statusBadge,
              {
                backgroundColor: statusInfo.bgColor,
              },
            ]}
          >
            <Text style={[styles.statusText, { color: statusInfo.textColor }]}>
              {statusInfo.label}
            </Text>
          </View>
        </View>

        {/* Error Message */}
        {error && (
          <View style={[styles.errorBanner, { backgroundColor: colors.error }]}>
            <Text style={[styles.errorText, { color: "#ffffff" }]}>{error}</Text>
          </View>
        )}

        {/* Property Info */}
        <View style={[styles.section, { borderColor: colors.border }]}>
          <Text style={[styles.sectionTitle, { color: colors.foreground }]}>Property</Text>
          <Text style={[styles.propertyName, { color: colors.foreground }]}>{job.propertyName}</Text>
          <Text style={[styles.address, { color: colors.muted }]}>{job.propertyAddress}</Text>
        </View>

        {/* Job Details */}
        <View style={[styles.section, { borderColor: colors.border }]}>
          <Text style={[styles.sectionTitle, { color: colors.foreground }]}>Details</Text>
          <View style={styles.detailRow}>
            <Text style={[styles.detailLabel, { color: colors.muted }]}>Date</Text>
            <Text style={[styles.detailValue, { color: colors.foreground }]}>
              {job.cleaningDate.toLocaleDateString("en-US", {
                month: "short",
                day: "numeric",
                year: "numeric",
              })}
            </Text>
          </View>
          <View style={styles.detailRow}>
            <Text style={[styles.detailLabel, { color: colors.muted }]}>Guests</Text>
            <Text style={[styles.detailValue, { color: colors.foreground }]}>
              {job.guestCount} {job.hasPets ? "🐾" : ""}
            </Text>
          </View>
          <View style={styles.detailRow}>
            <Text style={[styles.detailLabel, { color: colors.muted }]}>Price</Text>
            <Text style={[styles.detailValue, { color: colors.foreground }]}>${job.price}</Text>
          </View>
        </View>

        {/* Instructions */}
        {job.instructions && (
          <View style={[styles.section, { borderColor: colors.border }]}>
            <Text style={[styles.sectionTitle, { color: colors.foreground }]}>Instructions</Text>
            <Text style={[styles.instructionText, { color: colors.foreground }]}>
              {job.instructions}
            </Text>
          </View>
        )}

        {/* Timer (In Progress) */}
        {job.status === "in_progress" && (
          <View style={[styles.section, { borderColor: colors.border }]}>
            <Text style={[styles.sectionTitle, { color: colors.foreground }]}>Elapsed Time</Text>
            <Text style={[styles.timerText, { color: colors.primary }]}>{formatTime(elapsedTime)}</Text>
          </View>
        )}

        {/* GPS Status */}
        {(job.status === "in_progress" || job.status === "accepted") && (
          <View style={[styles.section, { borderColor: colors.border }]}>
            <Text style={[styles.sectionTitle, { color: colors.foreground }]}>GPS Status</Text>
            <Text
              style={[
                styles.gpsStatusText,
                {
                  color:
                    gpsStatus === "valid"
                      ? colors.success
                      : gpsStatus === "invalid"
                        ? colors.error
                        : colors.muted,
                },
              ]}
            >
              {gpsStatus === "not_checked"
                ? "Not checked"
                : gpsStatus === "checking"
                  ? "Checking..."
                  : gpsStatus === "valid"
                    ? "✓ Valid location"
                    : "✗ Invalid location"}
            </Text>
          </View>
        )}

        {/* Action Buttons */}
        <View style={styles.actionButtons}>
          {job.status === "accepted" && (
            <Pressable
              onPress={handleStartJob}
              disabled={isProcessing}
              style={({ pressed }) => [
                styles.primaryButton,
                {
                  backgroundColor: colors.primary,
                  opacity: pressed || isProcessing ? 0.8 : 1,
                },
              ]}
            >
              {isProcessing ? (
                <ActivityIndicator size="small" color="#ffffff" />
              ) : (
                <Text style={styles.primaryButtonText}>Start Job</Text>
              )}
            </Pressable>
          )}

          {job.status === "in_progress" && (
            <Pressable
              onPress={handleCompleteJob}
              disabled={isProcessing || gpsStatus !== "valid"}
              style={({ pressed }) => [
                styles.primaryButton,
                {
                  backgroundColor:
                    gpsStatus === "valid" ? colors.success : colors.muted,
                  opacity: pressed || isProcessing ? 0.8 : 1,
                },
              ]}
            >
              {isProcessing ? (
                <ActivityIndicator size="small" color="#ffffff" />
              ) : (
                <Text style={styles.primaryButtonText}>
                  {gpsStatus === "valid" ? "Mark Done" : "GPS Required"}
                </Text>
              )}
            </Pressable>
          )}

          {job.status === "completed" && (
            <Text style={[styles.completedText, { color: colors.success }]}>
              ✓ Job Completed
            </Text>
          )}
        </View>
      </ScrollView>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  scrollContent: {
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 16,
  },
  statusBadge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
  },
  statusText: {
    fontSize: 12,
    fontWeight: "600",
  },
  errorBanner: {
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 8,
    marginBottom: 16,
  },
  errorText: {
    fontSize: 13,
    fontWeight: "500",
  },
  section: {
    borderWidth: 1,
    borderRadius: 12,
    padding: 12,
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 12,
    fontWeight: "600",
    textTransform: "uppercase",
    marginBottom: 8,
  },
  propertyName: {
    fontSize: 18,
    fontWeight: "700",
    marginBottom: 4,
  },
  address: {
    fontSize: 14,
    lineHeight: 20,
  },
  detailRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: 8,
  },
  detailLabel: {
    fontSize: 13,
    fontWeight: "500",
  },
  detailValue: {
    fontSize: 14,
    fontWeight: "600",
  },
  instructionText: {
    fontSize: 14,
    lineHeight: 20,
  },
  timerText: {
    fontSize: 32,
    fontWeight: "700",
    textAlign: "center",
    fontFamily: "Menlo",
  },
  gpsStatusText: {
    fontSize: 14,
    fontWeight: "600",
    textAlign: "center",
  },
  actionButtons: {
    marginTop: 20,
    marginBottom: 40,
  },
  primaryButton: {
    paddingVertical: 14,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
  },
  primaryButtonText: {
    color: "#ffffff",
    fontSize: 16,
    fontWeight: "600",
  },
  completedText: {
    fontSize: 16,
    fontWeight: "600",
    textAlign: "center",
    paddingVertical: 14,
  },
});
