import { ScrollView, Text, View, Pressable, FlatList } from "react-native";
import { useCallback, useMemo, useState } from "react";
import { ScreenContainer } from "@/components/screen-container";
import { useAuth } from "@/lib/auth-context";
import { trpc } from "@/lib/trpc";
import { cn } from "@/lib/utils";
import { useColors } from "@/hooks/use-colors";

/**
 * Manager Dashboard — Job List & Overview
 *
 * This is a representation layer that displays job data logged in the system.
 * All language is neutral and non-authoritative.
 * No enforcement, verification, or outcome implication.
 */

type JobStatus = "available" | "accepted" | "in_progress" | "completed" | "needs_review";

interface JobRecord {
  id: string;
  propertyId: string;
  cleanerId: string | null;
  status: JobStatus;
  scheduledDate: Date;
  price: number;
  startTime: Date | null;
  endTime: Date | null;
  gpsStartLat: string | null;
  gpsStartLng: string | null;
  gpsEndLat: string | null;
  gpsEndLng: string | null;
  accessDenied: boolean;
  payTypeOverride: "hourly" | "per_job" | null;
  property?: {
    name: string;
    address: string;
  };
  cleaner?: {
    firstName: string | null;
    lastName: string | null;
  };
}

const STATUS_LABELS: Record<JobStatus, string> = {
  available: "Available",
  accepted: "Accepted",
  in_progress: "In Progress",
  completed: "Completed",
  needs_review: "Needs Review",
};

const STATUS_COLORS: Record<JobStatus, string> = {
  available: "bg-blue-100",
  accepted: "bg-yellow-100",
  in_progress: "bg-orange-100",
  completed: "bg-green-100",
  needs_review: "bg-red-100",
};

export default function ManagerDashboard() {
  const { user } = useAuth();
  const colors = useColors();
  const [selectedStatus, setSelectedStatus] = useState<JobStatus | "all">("all");

  // Fetch jobs for manager
  const { data: jobs = [], isLoading, error } = trpc.jobs.listForManager.useQuery(undefined, {
    enabled: user?.role === "manager" || user?.role === "super_manager",
  });

  // Filter jobs by selected status
  const filteredJobs = useMemo(() => {
    if (selectedStatus === "all") return jobs;
    return jobs.filter((job: JobRecord) => job.status === selectedStatus);
  }, [jobs, selectedStatus]);

  // Count jobs by status
  const statusCounts = useMemo(() => {
    return {
      available: jobs.filter((j: JobRecord) => j.status === "available").length,
      accepted: jobs.filter((j: JobRecord) => j.status === "accepted").length,
      in_progress: jobs.filter((j: JobRecord) => j.status === "in_progress").length,
      completed: jobs.filter((j: JobRecord) => j.status === "completed").length,
      needs_review: jobs.filter((j: JobRecord) => j.status === "needs_review").length,
    };
  }, [jobs]);

  const renderJobCard = useCallback(
    ({ item: job }: { item: JobRecord }) => (
      <Pressable
        onPress={() => {
          // Navigate to job detail (future implementation)
        }}
        className="bg-surface rounded-lg p-4 mb-3 border border-border"
      >
        {/* Status Badge */}
        <View className="flex-row items-center justify-between mb-2">
          <Text className={cn("text-xs font-semibold px-2 py-1 rounded", STATUS_COLORS[job.status])}>
            {STATUS_LABELS[job.status]}
          </Text>
          {job.payTypeOverride && (
            <Text className="text-xs text-muted">Override: {job.payTypeOverride}</Text>
          )}
        </View>

        {/* Property & Address */}
        <Text className="text-base font-semibold text-foreground mb-1">
          {job.property?.name || "Property"}
        </Text>
        <Text className="text-sm text-muted mb-2">{job.property?.address || "No address"}</Text>

        {/* Scheduled Date */}
        <Text className="text-sm text-muted mb-2">
          Scheduled: {new Date(job.scheduledDate).toLocaleDateString()}
        </Text>

        {/* Assigned Cleaner */}
        <Text className="text-sm text-muted mb-2">
          Assigned:{" "}
          {job.cleaner
            ? `${job.cleaner.firstName || ""} ${job.cleaner.lastName || ""}`.trim()
            : "Unassigned"}
        </Text>

        {/* Price */}
        <Text className="text-sm font-semibold text-foreground">
          Price: ${parseFloat(job.price.toString()).toFixed(2)}
        </Text>

        {/* GPS & Time Indicators */}
        {job.status === "in_progress" && (
          <View className="mt-2 pt-2 border-t border-border">
            <Text className="text-xs text-muted">
              {job.gpsStartLat && job.gpsStartLng ? "✓ GPS Start Recorded" : "⚠ GPS Start Missing"}
            </Text>
          </View>
        )}

        {job.status === "completed" && (
          <View className="mt-2 pt-2 border-t border-border">
            <Text className="text-xs text-muted">
              {job.startTime && job.endTime
                ? `Logged: ${new Date(job.startTime).toLocaleTimeString()} - ${new Date(job.endTime).toLocaleTimeString()}`
                : "Time not logged"}
            </Text>
          </View>
        )}

        {job.accessDenied && (
          <View className="mt-2 pt-2 border-t border-border">
            <Text className="text-xs text-error">Note: Access denied recorded</Text>
          </View>
        )}
      </Pressable>
    ),
    []
  );

  if (!user || (user.role !== "manager" && user.role !== "super_manager")) {
    return (
      <ScreenContainer className="p-6">
        <Text className="text-foreground">Access not authorized</Text>
      </ScreenContainer>
    );
  }

  return (
    <ScreenContainer className="p-6">
      <ScrollView contentContainerStyle={{ flexGrow: 1 }}>
        {/* Header */}
        <View className="mb-6">
          <Text className="text-3xl font-bold text-foreground mb-2">Jobs</Text>
          <Text className="text-sm text-muted">Logged activity across all properties</Text>
        </View>

        {/* Status Filter Tabs */}
        <View className="flex-row gap-2 mb-6 flex-wrap">
          {[
            { status: "all" as const, label: "All", count: jobs.length },
            { status: "available" as const, label: "Available", count: statusCounts.available },
            { status: "accepted" as const, label: "Accepted", count: statusCounts.accepted },
            { status: "in_progress" as const, label: "In Progress", count: statusCounts.in_progress },
            { status: "completed" as const, label: "Completed", count: statusCounts.completed },
            { status: "needs_review" as const, label: "Review", count: statusCounts.needs_review },
          ].map(({ status, label, count }) => (
            <Pressable
              key={status}
              onPress={() => setSelectedStatus(status)}
              className={cn(
                "px-3 py-2 rounded-full",
                selectedStatus === status ? "bg-primary" : "bg-surface border border-border"
              )}
            >
              <Text
                className={cn(
                  "text-sm font-semibold",
                  selectedStatus === status ? "text-background" : "text-foreground"
                )}
              >
                {label} ({count})
              </Text>
            </Pressable>
          ))}
        </View>

        {/* Loading State */}
        {isLoading && (
          <View className="items-center py-8">
            <Text className="text-muted">Loading jobs...</Text>
          </View>
        )}

        {/* Error State */}
        {error && (
          <View className="bg-error/10 rounded-lg p-4 mb-4">
            <Text className="text-error text-sm">Error loading jobs</Text>
          </View>
        )}

        {/* Job List */}
        {!isLoading && filteredJobs.length > 0 ? (
            <FlatList
              data={filteredJobs}
              renderItem={renderJobCard}
              keyExtractor={(job: JobRecord) => job.id}
              scrollEnabled={false}
            />
        ) : (
          !isLoading && (
            <View className="items-center py-8">
              <Text className="text-muted">No jobs recorded</Text>
            </View>
          )
        )}
      </ScrollView>
    </ScreenContainer>
  );
}
