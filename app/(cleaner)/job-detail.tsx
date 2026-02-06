import { View, Text, ScrollView, Pressable, ActivityIndicator, Alert } from "react-native";
import { ScreenContainer } from "@/components/screen-container";
import { useColors } from "@/hooks/use-colors";
import { useRouter, useLocalSearchParams } from "expo-router";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Location from "expo-location";
import { useState, useEffect } from "react";

interface Job {
  id: string;
  propertyName: string;
  propertyAddress: string;
  cleaningDate: string;
  guestCount: number;
  hasPets: boolean;
  price: number;
  status: "available" | "accepted" | "in_progress" | "completed" | "needs_review";
  propertyId: string;
  bookingId: string;
  instructions?: string;
  propertyLat: number;
  propertyLng: number;
  gpsStartLat?: number;
  gpsStartLng?: number;
  gpsEndLat?: number;
  gpsEndLng?: number;
  startedAt?: string;
  completedAt?: string;
  acceptedAt?: string;
  hasPhotos?: boolean;
  photoCount?: number;
}

interface Conflict {
  type: "gps_invalid" | "missing_photos" | "access_denied" | "booking_conflict";
  severity: "error" | "warning";
  message: string;
  details?: string;
}

interface InventoryItem {
  id: string;
  name: string;
  lowMeaning?: string;
}

interface InventorySelection {
  itemId: string;
  status: "good" | "low" | "order_more" | null;
  notes?: string;
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
  const [conflicts, setConflicts] = useState<Conflict[]>([]);
  const [inventoryItems, setInventoryItems] = useState<InventoryItem[]>([]);
  const [inventorySelections, setInventorySelections] = useState<Map<string, InventorySelection>>(new Map());

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
          setJob(foundJob);
          // Load inventory items for this property
          await loadInventoryItems(foundJob.propertyId);
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

  const loadInventoryItems = async (propertyId: string) => {
    try {
      const inventoryData = await AsyncStorage.getItem(`inventory_${propertyId}`);
      if (inventoryData) {
        const items = JSON.parse(inventoryData);
        setInventoryItems(items);
      }
      const selectionsData = await AsyncStorage.getItem(`inventory_selections_${jobId}`);
      if (selectionsData) {
        const selections = JSON.parse(selectionsData) as Array<[string, InventorySelection]>;
        const selectionsMap = new Map<string, InventorySelection>(selections);
        setInventorySelections(selectionsMap);
      }
    } catch (err) {
      console.error("Failed to load inventory items:", err);
    }
  };

  const updateInventorySelection = async (itemId: string, status: any, notes?: string) => {
    const newSelection: InventorySelection = { itemId, status, notes };
    const updatedSelections = new Map(inventorySelections);
    updatedSelections.set(itemId, newSelection);
    setInventorySelections(updatedSelections);
    try {
      const selectionsArray = Array.from(updatedSelections.entries());
      await AsyncStorage.setItem(`inventory_selections_${jobId}`, JSON.stringify(selectionsArray));
    } catch (err) {
      console.error("Failed to save inventory selection:", err);
    }
  };

  const checkGPS = async (): Promise<boolean> => {
    try {
      setGpsStatus("checking");

      // Request location permission
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== "granted") {
        setError("Location permission denied. Please enable location access in settings.");
        setGpsStatus("invalid");
        return false;
      }

      // Get current location
      const location = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.High,
      });
      setCurrentLocation(location);

      if (!job) return false;

      // Calculate distance (Haversine formula)
      const distance = calculateDistance(
        location.coords.latitude,
        location.coords.longitude,
        job.propertyLat,
        job.propertyLng
      );

      // Check precision (at least 4 decimal places = ~11m accuracy)
      const precision = location.coords.accuracy || 0;
      if (precision > 50) {
        setError(
          `GPS precision too low (${Math.round(precision)}m). Please try again in an open area.`
        );
        setGpsStatus("invalid");
        return false;
      }

      // Check if within 50 meters
      if (distance <= 50) {
        setGpsStatus("valid");
        return true;
      } else {
        setError(`You are ${Math.round(distance)}m away from the property. Get closer to complete.`);
        setGpsStatus("invalid");
        return false;
      }
    } catch (err) {
      console.error("GPS check failed:", err);
      setError("Failed to check GPS location. Please try again.");
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

  const handleAcceptJob = async () => {
    try {
      setIsProcessing(true);
      setError(null);

      if (!job) return;

      const updatedJob: Job = {
        ...job,
        status: "accepted" as const,
        acceptedAt: new Date().toISOString(),
      };
      setJob(updatedJob);

      // Update cache
      const jobsData = await AsyncStorage.getItem("jobs");
      if (jobsData) {
        const jobs = JSON.parse(jobsData);
        const updatedJobs = jobs.map((j: any) => (j.id === jobId ? updatedJob : j));
        await AsyncStorage.setItem("jobs", JSON.stringify(updatedJobs));
      }

      // TODO: Call API to accept job
      // await fetch(`/api/jobs/${jobId}/accept`, { method: "POST" });

      Alert.alert("Success", "Job accepted! You can now start the cleaning.");
    } catch (err) {
      console.error("Failed to accept job:", err);
      setError("Failed to accept job. Please try again.");
    } finally {
      setIsProcessing(false);
    }
  };

  const handleStartJob = async () => {
    try {
      setIsProcessing(true);
      setError(null);

      // Verify GPS location
      const isValidLocation = await checkGPS();
      if (!isValidLocation) {
        setIsProcessing(false);
        return;
      }

      if (!job || !currentLocation) return;

      const updatedJob: Job = {
        ...job,
        status: "in_progress" as const,
        startedAt: new Date().toISOString(),
        gpsStartLat: currentLocation.coords.latitude,
        gpsStartLng: currentLocation.coords.longitude,
      };
      setJob(updatedJob);

      // Update cache
      const jobsData = await AsyncStorage.getItem("jobs");
      if (jobsData) {
        const jobs = JSON.parse(jobsData);
        const updatedJobs = jobs.map((j: any) => (j.id === jobId ? updatedJob : j));
        await AsyncStorage.setItem("jobs", JSON.stringify(updatedJobs));
      }

      // TODO: Call API to start job
      // await fetch(`/api/jobs/${jobId}/start`, { method: "POST" });

      Alert.alert("Success", "Job started! Timer is now running.");
    } catch (err) {
      console.error("Failed to start job:", err);
      setError("Failed to start job. Please try again.");
    } finally {
      setIsProcessing(false);
    }
  };

  const detectConflicts = (): Conflict[] => {
    const detectedConflicts: Conflict[] = [];

    if (!job) return detectedConflicts;

    // Check GPS validity (for completion)
    if (gpsStatus === "invalid") {
      detectedConflicts.push({
        type: "gps_invalid",
        severity: "error",
        message: "GPS location invalid",
        details: error || "You are too far from the property",
      });
    }

    // Check for required photos
    if (!job.hasPhotos || (job.photoCount || 0) === 0) {
      detectedConflicts.push({
        type: "missing_photos",
        severity: "error",
        message: "No photos uploaded",
        details: "Upload at least 1 photo before completing the job",
      });
    }

    return detectedConflicts;
  };

  const handleCompleteJob = async () => {
    try {
      setIsProcessing(true);
      setError(null);

      // Verify GPS location at completion
      const isValidLocation = await checkGPS();

      if (!job || !currentLocation) return;

      // Detect conflicts
      const detectedConflicts = detectConflicts();

      // If conflicts exist, move to needs_review instead of completed
      const finalStatus: "completed" | "needs_review" = detectedConflicts.length > 0 ? "needs_review" : "completed";

      const updatedJob: Job = {
        ...job,
        status: finalStatus,
        completedAt: new Date().toISOString(),
        gpsEndLat: currentLocation.coords.latitude,
        gpsEndLng: currentLocation.coords.longitude,
      };
      setJob(updatedJob);
      setConflicts(detectedConflicts);

      // Update cache
      const jobsData = await AsyncStorage.getItem("jobs");
      if (jobsData) {
        const jobs = JSON.parse(jobsData);
        const updatedJobs = jobs.map((j: any) => (j.id === jobId ? updatedJob : j));
        await AsyncStorage.setItem("jobs", JSON.stringify(updatedJobs));
      }

      // TODO: Call API to complete job
      // await fetch(`/api/jobs/${jobId}/complete`, { method: "POST" });

      if (detectedConflicts.length > 0) {
        Alert.alert(
          "Review Required",
          "Your job has conflicts that need manager review. A manager will contact you shortly.",
          [{ text: "OK", onPress: () => router.back() }]
        );
      } else {
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
        <Text style={{ color: colors.muted, marginTop: 12 }}>Loading job details...</Text>
      </ScreenContainer>
    );
  }

  if (!job) {
    return (
      <ScreenContainer className="flex-1 items-center justify-center">
        <Text style={{ color: colors.error, fontSize: 16, fontWeight: "600" }}>
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
      <ScrollView contentContainerStyle={{ paddingBottom: 100 }} showsVerticalScrollIndicator={false}>
        {/* Header */}
        <View style={{ paddingHorizontal: 16, paddingVertical: 12, flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
          <Pressable onPress={() => router.back()} style={({ pressed }) => [{ opacity: pressed ? 0.6 : 1 }]}>
            <Text style={{ color: colors.primary, fontSize: 16, fontWeight: "600" }}>← Back</Text>
          </Pressable>
          <View style={{ backgroundColor: statusInfo.bgColor, paddingHorizontal: 12, paddingVertical: 6, borderRadius: 6 }}>
            <Text style={{ color: statusInfo.textColor, fontWeight: "600", fontSize: 14 }}>
              {statusInfo.label}
            </Text>
          </View>
        </View>

        {/* Error Message */}
        {error && (
          <View style={{ backgroundColor: colors.error, marginHorizontal: 16, marginVertical: 8, paddingHorizontal: 12, paddingVertical: 10, borderRadius: 6 }}>
            <Text style={{ color: "#ffffff", fontSize: 14 }}>{error}</Text>
          </View>
        )}

        {/* Conflicts */}
        {conflicts.length > 0 && (
          <View style={{ marginHorizontal: 16, marginVertical: 8 }}>
            <Text style={{ color: colors.foreground, fontWeight: "600", marginBottom: 8 }}>
              ⚠️ Review Required
            </Text>
            {conflicts.map((conflict, idx) => (
              <View
                key={idx}
                style={{
                  backgroundColor: colors.surface,
                  borderLeftWidth: 4,
                  borderLeftColor: conflict.severity === "error" ? colors.error : colors.warning,
                  paddingHorizontal: 12,
                  paddingVertical: 10,
                  borderRadius: 6,
                  marginBottom: 8,
                }}
              >
                <Text style={{ color: colors.foreground, fontWeight: "600", marginBottom: 4 }}>
                  {conflict.message}
                </Text>
                {conflict.details && (
                  <Text style={{ color: colors.muted, fontSize: 13 }}>{conflict.details}</Text>
                )}
              </View>
            ))}
          </View>
        )}

        {/* Property Info */}
        <View style={{ marginHorizontal: 16, marginVertical: 12, paddingHorizontal: 12, paddingVertical: 12, backgroundColor: colors.surface, borderRadius: 8, borderWidth: 1, borderColor: colors.border }}>
          <Text style={{ color: colors.foreground, fontWeight: "600", fontSize: 16, marginBottom: 4 }}>
            {job.propertyName}
          </Text>
          <Text style={{ color: colors.muted, fontSize: 14 }}>{job.propertyAddress}</Text>
        </View>

        {/* Job Details */}
        <View style={{ marginHorizontal: 16, marginVertical: 12, paddingHorizontal: 12, paddingVertical: 12, backgroundColor: colors.surface, borderRadius: 8, borderWidth: 1, borderColor: colors.border }}>
          <Text style={{ color: colors.foreground, fontWeight: "600", fontSize: 14, marginBottom: 8 }}>
            Details
          </Text>
          <View style={{ marginBottom: 8, flexDirection: "row", justifyContent: "space-between" }}>
            <Text style={{ color: colors.muted, fontSize: 13 }}>Date</Text>
            <Text style={{ color: colors.foreground, fontWeight: "500" }}>
              {new Date(job.cleaningDate).toLocaleDateString("en-US", {
                month: "short",
                day: "numeric",
              })}
            </Text>
          </View>
          <View style={{ marginBottom: 8, flexDirection: "row", justifyContent: "space-between" }}>
            <Text style={{ color: colors.muted, fontSize: 13 }}>Guests</Text>
            <Text style={{ color: colors.foreground, fontWeight: "500" }}>
              {job.guestCount} {job.hasPets ? "🐾" : ""}
            </Text>
          </View>
          <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
            <Text style={{ color: colors.muted, fontSize: 13 }}>Price</Text>
            <Text style={{ color: colors.foreground, fontWeight: "600" }}>${job.price}</Text>
          </View>
        </View>

        {/* Instructions */}
        {job.instructions && (
          <View style={{ marginHorizontal: 16, marginVertical: 12, paddingHorizontal: 12, paddingVertical: 12, backgroundColor: colors.surface, borderRadius: 8, borderWidth: 1, borderColor: colors.border }}>
            <Text style={{ color: colors.foreground, fontWeight: "600", fontSize: 14, marginBottom: 8 }}>
              Instructions
            </Text>
            <Text style={{ color: colors.foreground, fontSize: 13, lineHeight: 18 }}>
              {job.instructions}
            </Text>
          </View>
        )}

        {/* Inventory Checklist */}
        {inventoryItems.length > 0 && (
          <View style={{ marginHorizontal: 16, marginVertical: 12, paddingHorizontal: 12, paddingVertical: 12, backgroundColor: colors.surface, borderRadius: 8, borderWidth: 1, borderColor: colors.border }}>
            <Text style={{ color: colors.foreground, fontWeight: "600", fontSize: 14, marginBottom: 12 }}>
              Inventory Checklist
            </Text>
            {inventoryItems.map((item: InventoryItem) => {
              const selection = inventorySelections.get(item.id);
              return (
                <View key={item.id} style={{ marginBottom: 12, paddingBottom: 12, borderBottomWidth: 1, borderBottomColor: colors.border }}>
                  <Text style={{ color: colors.foreground, fontWeight: "500", fontSize: 13, marginBottom: 4 }}>
                    {item.name}
                  </Text>
                  {item.lowMeaning && (
                    <Text style={{ color: colors.muted, fontSize: 12, marginBottom: 8, fontStyle: "italic" }}>
                      {item.lowMeaning}
                    </Text>
                  )}
                  <View style={{ flexDirection: "row", gap: 8 }}>
                    {["good", "low", "order_more"].map((status) => (
                      <Pressable
                        key={status}
                        onPress={() => updateInventorySelection(item.id, status === selection?.status ? null : status)}
                        style={({ pressed }) => [{
                          flex: 1,
                          paddingVertical: 8,
                          paddingHorizontal: 8,
                          borderRadius: 6,
                          backgroundColor: selection?.status === status ? colors.primary : colors.border,
                          opacity: pressed ? 0.8 : 1,
                        }]}
                      >
                        <Text style={{
                          color: selection?.status === status ? "#ffffff" : colors.foreground,
                          fontWeight: "500",
                          fontSize: 12,
                          textAlign: "center",
                        }}>
                          {status === "good" ? "Good" : status === "low" ? "Low" : "Order"}
                        </Text>
                      </Pressable>
                    ))}
                  </View>
                </View>
              );
            })}
          </View>
        )}

        {/* Timer (In Progress) */}
        {job.status === "in_progress" && (
          <View style={{ marginHorizontal: 16, marginVertical: 12, paddingHorizontal: 12, paddingVertical: 12, backgroundColor: colors.surface, borderRadius: 8, borderWidth: 1, borderColor: colors.border }}>
            <Text style={{ color: colors.foreground, fontWeight: "600", fontSize: 14, marginBottom: 8 }}>
              Elapsed Time
            </Text>
            <Text style={{ color: colors.primary, fontSize: 28, fontWeight: "600", fontFamily: "monospace" }}>
              {formatTime(elapsedTime)}
            </Text>
          </View>
        )}

        {/* GPS Status */}
        {(job.status === "in_progress" || job.status === "accepted") && (
          <View style={{ marginHorizontal: 16, marginVertical: 12, paddingHorizontal: 12, paddingVertical: 12, backgroundColor: colors.surface, borderRadius: 8, borderWidth: 1, borderColor: colors.border }}>
            <Text style={{ color: colors.foreground, fontWeight: "600", fontSize: 14, marginBottom: 8 }}>
              GPS Status
            </Text>
            <Text
              style={{
                color:
                  gpsStatus === "valid"
                    ? colors.success
                    : gpsStatus === "invalid"
                      ? colors.error
                      : colors.muted,
                fontSize: 13,
                fontWeight: "500",
              }}
            >
              {gpsStatus === "not_checked"
                ? "Not checked yet"
                : gpsStatus === "checking"
                  ? "Checking location..."
                  : gpsStatus === "valid"
                    ? "✓ Location verified"
                    : "✗ Location invalid"}
            </Text>
          </View>
        )}

        {/* Action Buttons */}
        <View style={{ marginHorizontal: 16, marginVertical: 20, gap: 12 }}>
          {job.status === "available" && (
            <Pressable
              onPress={handleAcceptJob}
              disabled={isProcessing}
              style={({ pressed }) => [
                {
                  backgroundColor: colors.primary,
                  paddingHorizontal: 16,
                  paddingVertical: 14,
                  borderRadius: 8,
                  opacity: pressed || isProcessing ? 0.8 : 1,
                },
              ]}
            >
              <Text style={{ color: "#ffffff", fontWeight: "600", textAlign: "center", fontSize: 16 }}>
                {isProcessing ? "Accepting..." : "Accept Job"}
              </Text>
            </Pressable>
          )}

          {job.status === "accepted" && (
            <Pressable
              onPress={handleStartJob}
              disabled={isProcessing}
              style={({ pressed }) => [
                {
                  backgroundColor: colors.primary,
                  paddingHorizontal: 16,
                  paddingVertical: 14,
                  borderRadius: 8,
                  opacity: pressed || isProcessing ? 0.8 : 1,
                },
              ]}
            >
              <Text style={{ color: "#ffffff", fontWeight: "600", textAlign: "center", fontSize: 16 }}>
                {isProcessing ? "Starting..." : "Start Job"}
              </Text>
            </Pressable>
          )}

          {job.status === "in_progress" && (
            <Pressable
              onPress={handleCompleteJob}
              disabled={isProcessing}
              style={({ pressed }) => [
                {
                  backgroundColor: colors.success,
                  paddingHorizontal: 16,
                  paddingVertical: 14,
                  borderRadius: 8,
                  opacity: pressed || isProcessing ? 0.8 : 1,
                },
              ]}
            >
              <Text style={{ color: "#ffffff", fontWeight: "600", textAlign: "center", fontSize: 16 }}>
                {isProcessing ? "Completing..." : "Mark Done"}
              </Text>
            </Pressable>
          )}

          {(job.status === "completed" || job.status === "needs_review") && (
            <Pressable
              onPress={() => router.push("/(cleaner)/invoice")}
              style={({ pressed }) => [
                {
                  backgroundColor: colors.primary,
                  paddingHorizontal: 16,
                  paddingVertical: 14,
                  borderRadius: 8,
                  opacity: pressed ? 0.8 : 1,
                },
              ]}
            >
              <Text style={{ color: "#ffffff", fontWeight: "600", textAlign: "center", fontSize: 16 }}>
                View Invoice
              </Text>
            </Pressable>
          )}
        </View>
      </ScrollView>
    </ScreenContainer>
  );
}
