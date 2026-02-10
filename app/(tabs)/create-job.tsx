import { ScrollView, Text, View, TouchableOpacity, TextInput, FlatList, Pressable, StyleSheet } from "react-native";
import { useState, useEffect } from "react";
import { ScreenContainer } from "@/components/screen-container";
import { useAuth } from "@/lib/auth-context";
import { trpc } from "@/lib/trpc";
import { useRouter } from "expo-router";

interface Property {
  id: string;
  name: string;
  address: string;
}

interface Cleaner {
  id: string;
  email: string;
}

const styles = StyleSheet.create({
  submitButton: {
    backgroundColor: "#0a7ea4",
    paddingVertical: 14,
    borderRadius: 8,
    alignItems: "center",
  },
  cancelButton: {
    borderColor: "#ccc",
    borderWidth: 1,
    paddingVertical: 14,
    borderRadius: 8,
    alignItems: "center",
  },
});

export default function CreateJobScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const [properties, setProperties] = useState<Property[]>([]);
  const [cleaners, setCleaners] = useState<Cleaner[]>([]);
  const [selectedProperty, setSelectedProperty] = useState<string | null>(null);
  const [selectedCleaner, setSelectedCleaner] = useState<string | null>(null);
  const [cleaningDate, setCleaningDate] = useState<string>("");
  const [cleaningTime, setCleaningTime] = useState<string>("");
  const [notes, setNotes] = useState<string>("");
  const [price, setPrice] = useState<string>("");
  const [showPropertyDropdown, setShowPropertyDropdown] = useState(false);
  const [showCleanerDropdown, setShowCleanerDropdown] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const createJobMutation = trpc.jobs.create.useMutation();

  // Fetch properties and cleaners on mount
  useEffect(() => {
    const fetchData = async () => {
      try {
        // In a real implementation, these would be API calls
        // For now, using mock data
        setProperties([
          { id: "prop_1", name: "Downtown Apartment", address: "123 Main St" },
          { id: "prop_2", name: "Beachfront Condo", address: "456 Ocean Ave" },
        ]);
        setCleaners([
          { id: "cleaner_1", email: "sarah@example.com" },
          { id: "cleaner_2", email: "mike@example.com" },
        ]);
      } catch (err) {
        setError("Failed to load properties and cleaners");
      }
    };
    fetchData();
  }, []);

  const handleCreateJob = async () => {
    if (!selectedProperty || !cleaningDate) {
      setError("Please select a property and cleaning date");
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      const cleaningDateObj = new Date(cleaningDate);
      const priceNum = price ? parseFloat(price) : undefined;

      await createJobMutation.mutateAsync({
        propertyId: selectedProperty,
        cleaningDate: cleaningDateObj,
        cleaningTime,
        notes,
        assignedCleanerId: selectedCleaner || undefined,
        price: priceNum,
      });

      // Reset form
      setSelectedProperty(null);
      setSelectedCleaner(null);
      setCleaningDate("");
      setCleaningTime("");
      setNotes("");
      setPrice("");

      // Navigate back to job list
      router.back();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create job");
    } finally {
      setIsSubmitting(false);
    }
  };

  const selectedPropertyObj = properties.find((p) => p.id === selectedProperty);
  const selectedCleanerObj = cleaners.find((c) => c.id === selectedCleaner);

  return (
    <ScreenContainer className="p-4">
      <ScrollView contentContainerStyle={{ flexGrow: 1 }} showsVerticalScrollIndicator={false}>
        <View className="gap-6 pb-8">
          {/* Header */}
          <View className="gap-2">
            <Text className="text-3xl font-bold text-foreground">Create Job</Text>
            <Text className="text-sm text-muted">Add a new cleaning job manually</Text>
          </View>

          {/* Error Message */}
          {error && (
            <View className="bg-error/10 border border-error rounded-lg p-3">
              <Text className="text-error text-sm">{error}</Text>
            </View>
          )}

          {/* Property Selection */}
          <View className="gap-2">
            <Text className="text-sm font-semibold text-foreground">Property *</Text>
            <Pressable
              onPress={() => setShowPropertyDropdown(!showPropertyDropdown)}
              style={({ pressed }: any) => ({
                backgroundColor: pressed ? "rgba(0,0,0,0.05)" : "transparent",
                borderColor: "#ccc",
                borderWidth: 1,
                borderRadius: 8,
                paddingHorizontal: 12,
                paddingVertical: 12,
              })}
            >
              <Text className="text-foreground">
                {selectedPropertyObj?.name || "Select a property"}
              </Text>
            </Pressable>

            {showPropertyDropdown && (
              <View className="bg-surface border border-border rounded-lg overflow-hidden">
                <FlatList
                  data={properties}
                  keyExtractor={(item) => item.id}
                  scrollEnabled={false}
                  renderItem={({ item }) => (
                    <Pressable
                      onPress={() => {
                        setSelectedProperty(item.id);
                        setShowPropertyDropdown(false);
                      }}
                      style={({ pressed }: any) => ({
                        backgroundColor: pressed ? "rgba(0,0,0,0.05)" : "transparent",
                        paddingHorizontal: 12,
                        paddingVertical: 12,
                        borderBottomColor: "#eee",
                        borderBottomWidth: 1,
                      })}
                    >
                      <Text className="text-foreground font-medium">{item.name}</Text>
                      <Text className="text-xs text-muted">{item.address}</Text>
                    </Pressable>
                  )}
                />
              </View>
            )}
          </View>

          {/* Cleaning Date */}
          <View className="gap-2">
            <Text className="text-sm font-semibold text-foreground">Cleaning Date *</Text>
            <TextInput
              placeholder="YYYY-MM-DD"
              value={cleaningDate}
              onChangeText={setCleaningDate}
              style={{
                borderColor: "#ccc",
                borderWidth: 1,
                borderRadius: 8,
                paddingHorizontal: 12,
                paddingVertical: 12,
                color: "#000",
              }}
              placeholderTextColor="#999"
            />
          </View>

          {/* Cleaning Time */}
          <View className="gap-2">
            <Text className="text-sm font-semibold text-foreground">Cleaning Time</Text>
            <TextInput
              placeholder="HH:MM (optional)"
              value={cleaningTime}
              onChangeText={setCleaningTime}
              style={{
                borderColor: "#ccc",
                borderWidth: 1,
                borderRadius: 8,
                paddingHorizontal: 12,
                paddingVertical: 12,
                color: "#000",
              }}
              placeholderTextColor="#999"
            />
          </View>

          {/* Price */}
          <View className="gap-2">
            <Text className="text-sm font-semibold text-foreground">Price</Text>
            <TextInput
              placeholder="0.00 (optional)"
              value={price}
              onChangeText={setPrice}
              keyboardType="decimal-pad"
              style={{
                borderColor: "#ccc",
                borderWidth: 1,
                borderRadius: 8,
                paddingHorizontal: 12,
                paddingVertical: 12,
                color: "#000",
              }}
              placeholderTextColor="#999"
            />
          </View>

          {/* Assign Cleaner */}
          <View className="gap-2">
            <Text className="text-sm font-semibold text-foreground">Assign Cleaner (optional)</Text>
            <Pressable
              onPress={() => setShowCleanerDropdown(!showCleanerDropdown)}
              style={({ pressed }: any) => ({
                backgroundColor: pressed ? "rgba(0,0,0,0.05)" : "transparent",
                borderColor: "#ccc",
                borderWidth: 1,
                borderRadius: 8,
                paddingHorizontal: 12,
                paddingVertical: 12,
              })}
            >
              <Text className="text-foreground">
                {selectedCleanerObj?.email || "Select a cleaner (optional)"}
              </Text>
            </Pressable>

            {showCleanerDropdown && (
              <View className="bg-surface border border-border rounded-lg overflow-hidden">
                <Pressable
                  onPress={() => {
                    setSelectedCleaner(null);
                    setShowCleanerDropdown(false);
                  }}
                  style={({ pressed }: any) => ({
                    backgroundColor: pressed ? "rgba(0,0,0,0.05)" : "transparent",
                    paddingHorizontal: 12,
                    paddingVertical: 12,
                    borderBottomColor: "#eee",
                    borderBottomWidth: 1,
                  })}
                >
                  <Text className="text-foreground">None (unassigned)</Text>
                </Pressable>
                <FlatList
                  data={cleaners}
                  keyExtractor={(item) => item.id}
                  scrollEnabled={false}
                  renderItem={({ item }) => (
                    <Pressable
                      onPress={() => {
                        setSelectedCleaner(item.id);
                        setShowCleanerDropdown(false);
                      }}
                      style={({ pressed }: any) => ({
                        backgroundColor: pressed ? "rgba(0,0,0,0.05)" : "transparent",
                        paddingHorizontal: 12,
                        paddingVertical: 12,
                        borderBottomColor: "#eee",
                        borderBottomWidth: 1,
                      })}
                    >
                      <Text className="text-foreground font-medium">{item.email}</Text>
                    </Pressable>
                  )}
                />
              </View>
            )}
          </View>

          {/* Notes */}
          <View className="gap-2">
            <Text className="text-sm font-semibold text-foreground">Notes</Text>
            <TextInput
              placeholder="Job instructions (optional)"
              value={notes}
              onChangeText={setNotes}
              multiline
              numberOfLines={4}
              style={{
                borderColor: "#ccc",
                borderWidth: 1,
                borderRadius: 8,
                paddingHorizontal: 12,
                paddingVertical: 12,
                color: "#000",
                textAlignVertical: "top",
              }}
              placeholderTextColor="#999"
            />
          </View>

          {/* Submit Button */}
          <TouchableOpacity
            onPress={handleCreateJob}
            disabled={isSubmitting}
            style={[styles.submitButton, { backgroundColor: isSubmitting ? "#ccc" : "#0a7ea4" }]}
          >
            <Text className="text-white font-semibold text-base">
              {isSubmitting ? "Creating..." : "Create Job"}
            </Text>
          </TouchableOpacity>

          {/* Cancel Button */}
          <TouchableOpacity
            onPress={() => router.back()}
            style={styles.cancelButton}
          >
            <Text className="text-foreground font-semibold text-base">Cancel</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </ScreenContainer>
  );
}
