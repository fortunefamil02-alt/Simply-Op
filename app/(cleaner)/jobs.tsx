import { useState, useEffect, useCallback } from "react";
import { View, Text, FlatList, Pressable, ActivityIndicator, StyleSheet } from "react-native";
import { ScreenContainer } from "@/components/screen-container";
import { JobCard } from "@/components/job-card";
import { useColors } from "@/hooks/use-colors";
import { useAuth } from "@/hooks/use-auth";
import { useRouter } from "expo-router";
import AsyncStorage from "@react-native-async-storage/async-storage";

type JobStatus = "available" | "accepted" | "in_progress" | "completed";

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
}

export default function JobsScreen() {
  const colors = useColors();
  const { user } = useAuth();
  const router = useRouter();

  const [activeTab, setActiveTab] = useState<JobStatus>("available");
  const [jobs, setJobs] = useState<Job[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isAccepting, setIsAccepting] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Load jobs from mock data (will be replaced with API call)
  useEffect(() => {
    loadJobs();
  }, []);

  const loadJobs = async () => {
    try {
      setIsLoading(true);
      setError(null);

      // Try to load from AsyncStorage first (offline support)
      const cachedJobs = await AsyncStorage.getItem("jobs");
      if (cachedJobs) {
        const parsedJobs = JSON.parse(cachedJobs).map((job: any) => ({
          ...job,
          cleaningDate: new Date(job.cleaningDate),
        }));
        setJobs(parsedJobs);
      }

      // TODO: Replace with actual API call
      // const response = await fetch("/api/jobs", {
      //   headers: { Authorization: `Bearer ${token}` },
      // });
      // const data = await response.json();
      // setJobs(data);
      // await AsyncStorage.setItem("jobs", JSON.stringify(data));

      // Mock data for development
      const mockJobs: Job[] = [
        {
          id: "job_001",
          propertyName: "Downtown Loft",
          propertyAddress: "123 Main St, San Francisco, CA 94102",
          cleaningDate: new Date(Date.now() + 86400000), // Tomorrow
          guestCount: 2,
          hasPets: false,
          price: 150,
          status: "available",
          propertyId: "prop_001",
          bookingId: "booking_001",
        },
        {
          id: "job_002",
          propertyName: "Marina Apartment",
          propertyAddress: "456 Market St, San Francisco, CA 94105",
          cleaningDate: new Date(Date.now() + 172800000), // In 2 days
          guestCount: 4,
          hasPets: true,
          price: 200,
          status: "available",
          propertyId: "prop_002",
          bookingId: "booking_002",
        },
        {
          id: "job_003",
          propertyName: "Sunset Studio",
          propertyAddress: "789 Valencia St, San Francisco, CA 94103",
          cleaningDate: new Date(Date.now() - 86400000), // Yesterday (completed)
          guestCount: 1,
          hasPets: false,
          price: 100,
          status: "completed",
          propertyId: "prop_003",
          bookingId: "booking_003",
        },
        {
          id: "job_004",
          propertyName: "Mission District Home",
          propertyAddress: "321 Mission St, San Francisco, CA 94103",
          cleaningDate: new Date(Date.now() + 259200000), // In 3 days
          guestCount: 3,
          hasPets: true,
          price: 175,
          status: "accepted",
          propertyId: "prop_004",
          bookingId: "booking_004",
        },
      ];

      setJobs(mockJobs);
      await AsyncStorage.setItem("jobs", JSON.stringify(mockJobs));
    } catch (err) {
      console.error("Failed to load jobs:", err);
      setError("Failed to load jobs. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleAcceptJob = useCallback(
    async (jobId: string) => {
      try {
        setIsAccepting(jobId);

        // TODO: Replace with actual API call
        // const response = await fetch(`/api/jobs/${jobId}/accept`, {
        //   method: "POST",
        //   headers: { Authorization: `Bearer ${token}` },
        // });
        // const updatedJob = await response.json();

        // Update local state
        setJobs((prevJobs) =>
          prevJobs.map((job) =>
            job.id === jobId ? { ...job, status: "accepted" as const } : job
          )
        );

        // Update cache
        const updatedJobs = jobs.map((job) =>
          job.id === jobId ? { ...job, status: "accepted" as const } : job
        );
        await AsyncStorage.setItem("jobs", JSON.stringify(updatedJobs));

        // Show success feedback
        console.log(`Job ${jobId} accepted`);
      } catch (err) {
        console.error("Failed to accept job:", err);
        setError("Failed to accept job. Please try again.");
      } finally {
        setIsAccepting(null);
      }
    },
    [jobs]
  );

  const handleJobPress = useCallback(
    (jobId: string) => {
      router.push({
        pathname: "/(cleaner)/job-detail",
        params: { jobId },
      });
    },
    [router]
  );

  const filteredJobs = jobs.filter((job) => {
    if (activeTab === "available") return job.status === "available";
    if (activeTab === "accepted") return job.status === "accepted" || job.status === "in_progress";
    if (activeTab === "completed") return job.status === "completed" || job.status === "needs_review";
    return false;
  });

  const renderJobCard = ({ item }: { item: Job }) => (
    <JobCard
      jobId={item.id}
      propertyName={item.propertyName}
      propertyAddress={item.propertyAddress}
      cleaningDate={item.cleaningDate}
      guestCount={item.guestCount}
      hasPets={item.hasPets}
      price={item.price}
      status={item.status}
      onPress={() => handleJobPress(item.id)}
      onAccept={() => handleAcceptJob(item.id)}
      isAccepting={isAccepting === item.id}
    />
  );

  const renderEmptyState = () => (
    <View style={[styles.emptyState, { paddingTop: 40 }]}>
      <Text style={[styles.emptyStateTitle, { color: colors.foreground }]}>
        {activeTab === "available" ? "No Available Jobs" : "No Jobs"}
      </Text>
      <Text style={[styles.emptyStateMessage, { color: colors.muted }]}>
        {activeTab === "available"
          ? "Check back later for new cleaning jobs"
          : `You have no ${activeTab} jobs yet`}
      </Text>
    </View>
  );

  return (
    <ScreenContainer className="flex-1 bg-background">
      <View style={styles.header}>
        <Text style={[styles.title, { color: colors.foreground }]}>Jobs</Text>
      </View>

      {/* Tab Navigation */}
      <View style={[styles.tabBar, { borderBottomColor: colors.border }]}>
        {(["available", "accepted", "completed"] as const).map((tab) => (
          <Pressable
            key={tab}
            onPress={() => setActiveTab(tab)}
            style={[
              styles.tab,
              activeTab === tab && {
                borderBottomColor: colors.primary,
                borderBottomWidth: 2,
              },
            ]}
          >
            <Text
              style={[
                styles.tabLabel,
                {
                  color: activeTab === tab ? colors.primary : colors.muted,
                  fontWeight: activeTab === tab ? "600" : "500",
                },
              ]}
            >
              {tab.charAt(0).toUpperCase() + tab.slice(1)}
            </Text>
          </Pressable>
        ))}
      </View>

      {/* Error Message */}
      {error && (
        <View style={[styles.errorBanner, { backgroundColor: colors.error }]}>
          <Text style={[styles.errorText, { color: "#ffffff" }]}>{error}</Text>
        </View>
      )}

      {/* Loading State */}
      {isLoading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={[styles.loadingText, { color: colors.muted, marginTop: 12 }]}>
            Loading jobs...
          </Text>
        </View>
      ) : (
        <FlatList
          data={filteredJobs}
          renderItem={renderJobCard}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContent}
          ListEmptyComponent={renderEmptyState}
          onEndReachedThreshold={0.5}
          scrollEnabled={true}
        />
      )}

      {/* Pull-to-Refresh Indicator */}
      <Pressable
        onPress={loadJobs}
        style={({ pressed }) => [
          styles.refreshButton,
          {
            backgroundColor: colors.primary,
            opacity: pressed ? 0.8 : 1,
          },
        ]}
      >
        <Text style={[styles.refreshButtonText, { color: "#ffffff" }]}>↻ Refresh</Text>
      </Pressable>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  header: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    marginBottom: 8,
  },
  title: {
    fontSize: 28,
    fontWeight: "700",
  },
  tabBar: {
    flexDirection: "row",
    borderBottomWidth: 1,
    marginBottom: 12,
  },
  tab: {
    flex: 1,
    paddingVertical: 12,
    paddingHorizontal: 16,
    alignItems: "center",
    borderBottomWidth: 2,
    borderBottomColor: "transparent",
  },
  tabLabel: {
    fontSize: 14,
  },
  errorBanner: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    marginHorizontal: 16,
    marginBottom: 12,
    borderRadius: 8,
  },
  errorText: {
    fontSize: 13,
    fontWeight: "500",
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  loadingText: {
    fontSize: 14,
    fontWeight: "500",
  },
  listContent: {
    paddingHorizontal: 16,
    paddingBottom: 80,
  },
  emptyState: {
    alignItems: "center",
    justifyContent: "center",
  },
  emptyStateTitle: {
    fontSize: 18,
    fontWeight: "600",
    marginBottom: 8,
  },
  emptyStateMessage: {
    fontSize: 14,
    textAlign: "center",
  },
  refreshButton: {
    position: "absolute",
    bottom: 20,
    right: 20,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 8,
  },
  refreshButtonText: {
    fontSize: 14,
    fontWeight: "600",
  },
});
