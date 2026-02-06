import { View, Text, Pressable, StyleSheet } from "react-native";
import { useColors } from "@/hooks/use-colors";
import { cn } from "@/lib/utils";

export interface JobCardProps {
  jobId: string;
  propertyName: string;
  propertyAddress: string;
  cleaningDate: Date;
  guestCount: number;
  hasPets: boolean;
  price: number;
  status: "available" | "accepted" | "in_progress" | "completed" | "needs_review";
  onPress?: () => void;
  onAccept?: () => void;
  isAccepting?: boolean;
}

export function JobCard({
  jobId,
  propertyName,
  propertyAddress,
  cleaningDate,
  guestCount,
  hasPets,
  price,
  status,
  onPress,
  onAccept,
  isAccepting = false,
}: JobCardProps) {
  const colors = useColors();

  const statusConfig = {
    available: { label: "Available", bgColor: colors.success, textColor: "#ffffff" },
    accepted: { label: "Accepted", bgColor: colors.primary, textColor: "#ffffff" },
    in_progress: { label: "In Progress", bgColor: colors.warning, textColor: "#ffffff" },
    completed: { label: "Completed", bgColor: colors.success, textColor: "#ffffff" },
    needs_review: { label: "Needs Review", bgColor: colors.error, textColor: "#ffffff" },
  };

  const statusInfo = statusConfig[status];
  const formattedDate = cleaningDate.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });

  const handleAcceptPress = (e: any) => {
    e.stopPropagation();
    onAccept?.();
  };

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.container,
        {
          backgroundColor: colors.surface,
          borderColor: colors.border,
          opacity: pressed ? 0.7 : 1,
        },
      ]}
    >
      <View style={styles.header}>
        <View style={styles.titleSection}>
          <Text style={[styles.propertyName, { color: colors.foreground }]} numberOfLines={1}>
            {propertyName}
          </Text>
          <Text style={[styles.address, { color: colors.muted }]} numberOfLines={1}>
            {propertyAddress}
          </Text>
        </View>
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

      <View style={styles.detailsRow}>
        <View style={styles.detailItem}>
          <Text style={[styles.detailLabel, { color: colors.muted }]}>Date</Text>
          <Text style={[styles.detailValue, { color: colors.foreground }]}>{formattedDate}</Text>
        </View>

        <View style={styles.detailItem}>
          <Text style={[styles.detailLabel, { color: colors.muted }]}>Guests</Text>
          <Text style={[styles.detailValue, { color: colors.foreground }]}>
            {guestCount} {hasPets ? "🐾" : ""}
          </Text>
        </View>

        <View style={styles.detailItem}>
          <Text style={[styles.detailLabel, { color: colors.muted }]}>Price</Text>
          <Text style={[styles.detailValue, { color: colors.foreground }]}>${price}</Text>
        </View>
      </View>

      {status === "available" && onAccept && (
        <Pressable
          onPress={handleAcceptPress}
          disabled={isAccepting}
          style={({ pressed }) => [
            styles.acceptButton,
            {
              backgroundColor: colors.primary,
              opacity: pressed || isAccepting ? 0.8 : 1,
            },
          ]}
        >
          <Text style={[styles.acceptButtonText, { color: "#ffffff" }]}>
            {isAccepting ? "Accepting..." : "Accept Job"}
          </Text>
        </Pressable>
      )}

      {status !== "available" && (
        <Pressable
          onPress={onPress}
          style={({ pressed }) => [
            styles.viewButton,
            {
              backgroundColor: colors.primary,
              opacity: pressed ? 0.8 : 1,
            },
          ]}
        >
          <Text style={[styles.viewButtonText, { color: "#ffffff" }]}>View Details</Text>
        </Pressable>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: {
    borderRadius: 12,
    borderWidth: 1,
    padding: 16,
    marginBottom: 12,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 12,
  },
  titleSection: {
    flex: 1,
    marginRight: 12,
  },
  propertyName: {
    fontSize: 16,
    fontWeight: "600",
    marginBottom: 4,
  },
  address: {
    fontSize: 13,
    lineHeight: 18,
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
  detailsRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 12,
  },
  detailItem: {
    flex: 1,
  },
  detailLabel: {
    fontSize: 11,
    fontWeight: "500",
    marginBottom: 2,
    textTransform: "uppercase",
  },
  detailValue: {
    fontSize: 14,
    fontWeight: "600",
  },
  acceptButton: {
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
  },
  acceptButtonText: {
    fontSize: 14,
    fontWeight: "600",
  },
  viewButton: {
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
  },
  viewButtonText: {
    fontSize: 14,
    fontWeight: "600",
  },
});
