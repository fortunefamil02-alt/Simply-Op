import { ScrollView, Text, View, Pressable } from "react-native";
import { useCallback, useMemo } from "react";
import { ScreenContainer } from "@/components/screen-container";
import { useAuth } from "@/lib/auth-context";
import { trpc } from "@/lib/trpc";
import { cn } from "@/lib/utils";
import { useColors } from "@/hooks/use-colors";

/**
 * Owner Dashboard — KPIs, Guesty Integration Status, Emergency Visibility
 *
 * This is a representation layer displaying logged system activity.
 * All language is neutral and non-authoritative.
 * No enforcement, verification, or outcome implication.
 */

interface KPICard {
  label: string;
  value: string | number;
  subtext?: string;
  variant?: "default" | "warning" | "error";
}

export default function OwnerDashboard() {
  const { user } = useAuth();
  const colors = useColors();

  // Fetch jobs for KPI calculations
  const { data: jobs = [], isLoading: jobsLoading } = trpc.jobs.listForManager.useQuery(
    undefined,
    {
      enabled: user?.role === "super_manager",
    }
  );

  // Calculate KPIs from logged data
  const kpis = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const jobsToday = jobs.filter((job: any) => {
      const jobDate = new Date(job.scheduledDate);
      jobDate.setHours(0, 0, 0, 0);
      return jobDate.getTime() === today.getTime();
    });

    const inProgress = jobsToday.filter((j: any) => j.status === "in_progress").length;
    const completed = jobsToday.filter((j: any) => j.status === "completed").length;
    const atRisk = jobsToday.filter((j: any) => j.status === "needs_review").length;

    // Calculate total labor hours (sum of completed job durations)
    const totalHours = jobsToday
      .filter((j: any) => j.status === "completed" && j.startTime && j.endTime)
      .reduce((sum: number, j: any) => {
        const start = new Date(j.startTime!).getTime();
        const end = new Date(j.endTime!).getTime();
        const hours = (end - start) / (1000 * 60 * 60);
        return sum + hours;
      }, 0);

    // Count unique cleaners assigned today
    const uniqueCleaners = new Set(jobsToday.filter((j: any) => j.cleanerId).map((j: any) => j.cleanerId))
      .size;

    return {
      jobsToday: jobsToday.length,
      inProgress,
      completed,
      atRisk,
      laborHours: totalHours.toFixed(1),
      cleanersActive: uniqueCleaners,
    };
  }, [jobs]);

  // Render KPI card
  const renderKPICard = useCallback(
    (kpi: KPICard, index: number) => (
      <View
        key={index}
        className={cn(
          "flex-1 rounded-lg p-4 min-h-[120px] justify-between",
          kpi.variant === "warning" && "bg-warning/10",
          kpi.variant === "error" && "bg-error/10",
          !kpi.variant && "bg-surface"
        )}
      >
        <Text className="text-sm text-muted mb-2">{kpi.label}</Text>
        <Text
          className={cn(
            "text-3xl font-bold mb-1",
            kpi.variant === "error" && "text-error",
            kpi.variant === "warning" && "text-warning",
            !kpi.variant && "text-foreground"
          )}
        >
          {kpi.value}
        </Text>
        {kpi.subtext && <Text className="text-xs text-muted">{kpi.subtext}</Text>}
      </View>
    ),
    []
  );

  if (!user || user.role !== "super_manager") {
    return (
      <ScreenContainer className="p-6">
        <Text className="text-foreground">Access not authorized</Text>
      </ScreenContainer>
    );
  }

  const kpiData: KPICard[] = [
    {
      label: "Jobs Today",
      value: kpis.jobsToday,
      subtext: "Total scheduled",
    },
    {
      label: "In Progress",
      value: kpis.inProgress,
      subtext: "Active now",
    },
    {
      label: "Completed",
      value: kpis.completed,
      subtext: "Finished",
    },
    {
      label: "Needs Review",
      value: kpis.atRisk,
      variant: kpis.atRisk > 0 ? "warning" : "default",
      subtext: "Flagged",
    },
    {
      label: "Labor Hours",
      value: kpis.laborHours,
      subtext: "Logged today",
    },
    {
      label: "Active Cleaners",
      value: kpis.cleanersActive,
      subtext: "Assigned today",
    },
  ];

  return (
    <ScreenContainer className="p-6">
      <ScrollView contentContainerStyle={{ flexGrow: 1 }}>
        {/* Header */}
        <View className="mb-6">
          <Text className="text-3xl font-bold text-foreground mb-2">Overview</Text>
          <Text className="text-sm text-muted">Activity logged today</Text>
        </View>

        {/* KPI Grid */}
        {jobsLoading ? (
          <View className="items-center py-8">
            <Text className="text-muted">Loading activity...</Text>
          </View>
        ) : (
          <>
            {/* Row 1: Jobs & Status */}
            <View className="flex-row gap-3 mb-3">
              {renderKPICard(kpiData[0], 0)}
              {renderKPICard(kpiData[1], 1)}
            </View>

            {/* Row 2: Completed & Review */}
            <View className="flex-row gap-3 mb-3">
              {renderKPICard(kpiData[2], 2)}
              {renderKPICard(kpiData[3], 3)}
            </View>

            {/* Row 3: Hours & Cleaners */}
            <View className="flex-row gap-3 mb-6">
              {renderKPICard(kpiData[4], 4)}
              {renderKPICard(kpiData[5], 5)}
            </View>

            {/* Integration Status Section */}
            <View className="mb-6">
              <Text className="text-lg font-semibold text-foreground mb-3">Integrations</Text>

              {/* Guesty Status Card */}
              <View className="bg-surface rounded-lg p-4 border border-border mb-3">
                <View className="flex-row items-center justify-between mb-2">
                  <Text className="font-semibold text-foreground">Guesty Sync</Text>
                  <View className="bg-muted/20 rounded-full px-2 py-1">
                    <Text className="text-xs text-muted">Not Connected</Text>
                  </View>
                </View>
                <Text className="text-sm text-muted mb-3">
                  Booking data is logged locally. Connect Guesty to auto-sync bookings.
                </Text>
                <Pressable className="bg-primary rounded-lg px-4 py-2 items-center">
                  <Text className="text-background font-semibold text-sm">Connect Guesty</Text>
                </Pressable>
              </View>
            </View>

            {/* Emergency Activity Section */}
            <View className="mb-6">
              <Text className="text-lg font-semibold text-foreground mb-3">Activity Log</Text>

              {/* Emergency Alerts */}
              {kpis.atRisk > 0 && (
                <View className="bg-error/10 rounded-lg p-4 border border-error/20 mb-3">
                  <View className="flex-row items-center justify-between mb-2">
                    <Text className="font-semibold text-error">Flagged Items</Text>
                    <Text className="text-sm text-error">{kpis.atRisk}</Text>
                  </View>
                  <Text className="text-sm text-muted">
                    {kpis.atRisk} job(s) logged as needing review. Check job details for notes.
                  </Text>
                </View>
              )}

              {/* No Critical Items */}
              {kpis.atRisk === 0 && (
                <View className="bg-success/10 rounded-lg p-4 border border-success/20">
                  <Text className="text-sm text-muted">No flagged items today</Text>
                </View>
              )}
            </View>

            {/* System Status */}
            <View className="bg-surface rounded-lg p-4 border border-border">
              <Text className="text-sm font-semibold text-foreground mb-2">System Status</Text>
              <Text className="text-xs text-muted mb-1">✓ Jobs: Recording</Text>
              <Text className="text-xs text-muted mb-1">✓ Invoices: Recording</Text>
              <Text className="text-xs text-muted">✓ GPS: Recording</Text>
            </View>
          </>
        )}
      </ScrollView>
    </ScreenContainer>
  );
}
