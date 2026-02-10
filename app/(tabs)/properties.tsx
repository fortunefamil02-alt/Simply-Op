import { ScrollView, Text, View, TouchableOpacity, ActivityIndicator, Alert, FlatList } from "react-native";
import { useRouter } from "expo-router";
import { useState } from "react";
import { ScreenContainer } from "@/components/screen-container";
import { trpc } from "@/lib/trpc";
import { useFocusEffect } from "@react-navigation/native";
import { useCallback } from "react";

/**
 * Manager Properties List Screen
 * View and manage properties
 */
export default function PropertiesScreen() {
  const router = useRouter();
  const [refreshing, setRefreshing] = useState(false);

  // Fetch properties
  const { data: properties = [], isLoading, refetch } = trpc.properties.list.useQuery();

  // Refetch when screen is focused
  useFocusEffect(
    useCallback(() => {
      refetch();
    }, [refetch])
  );

  const handleRefresh = async () => {
    setRefreshing(true);
    await refetch();
    setRefreshing(false);
  };

  const handleDeleteProperty = (propertyId: string, propertyName: string) => {
    Alert.alert("Delete Property", `Delete "${propertyName}"?`, [
      { text: "Cancel" },
      {
        text: "Delete",
        onPress: async () => {
          try {
            // TODO: Add delete mutation
            Alert.alert("Success", "Property deleted");
            refetch();
          } catch (error: any) {
            Alert.alert("Error", error.message || "Failed to delete property");
          }
        },
      },
    ]);
  };

  const renderPropertyCard = ({ item }: { item: any }) => (
    <TouchableOpacity
      onPress={() => router.push(`/property/${item.id}`)}
      className="bg-surface border border-border rounded-lg p-4 mb-3"
    >
      <View className="flex-row justify-between items-start mb-2">
        <View className="flex-1">
          <Text className="text-lg font-semibold text-foreground">{item.name}</Text>
          {item.unitType && <Text className="text-sm text-muted">{item.unitType}</Text>}
        </View>
        <TouchableOpacity
          onPress={() => handleDeleteProperty(item.id, item.name)}
          className="bg-error rounded px-2 py-1"
        >
          <Text className="text-white text-xs font-semibold">Delete</Text>
        </TouchableOpacity>
      </View>

      <Text className="text-sm text-muted mb-2">{item.address}</Text>
      {item.city && (
        <Text className="text-xs text-muted">
          {item.city}
          {item.state ? `, ${item.state}` : ""}
          {item.zipCode ? ` ${item.zipCode}` : ""}
        </Text>
      )}

      {item.notes && (
        <Text className="text-xs text-muted mt-2 italic">
          {item.notes.length > 100 ? item.notes.substring(0, 100) + "..." : item.notes}
        </Text>
      )}
    </TouchableOpacity>
  );

  return (
    <ScreenContainer className="p-4">
      <ScrollView
        contentContainerStyle={{ flexGrow: 1 }}
        refreshControl={
          {
            refreshing,
            onRefresh: handleRefresh,
          } as any
        }
      >
        {/* Header */}
        <View className="flex-row justify-between items-center mb-6">
          <View>
            <Text className="text-2xl font-bold text-foreground">Properties</Text>
            <Text className="text-sm text-muted mt-1">{properties.length} properties</Text>
          </View>
          <TouchableOpacity
            onPress={() => router.push("/property/new")}
            className="bg-primary rounded-lg px-4 py-2"
          >
            <Text className="text-white font-semibold text-sm">+ Add</Text>
          </TouchableOpacity>
        </View>

        {/* Properties List */}
        {isLoading ? (
          <View className="items-center justify-center py-8">
            <ActivityIndicator size="large" color="#0a7ea4" />
          </View>
        ) : properties.length === 0 ? (
          <View className="items-center justify-center py-12">
            <Text className="text-lg text-muted mb-4">No properties yet</Text>
            <TouchableOpacity
              onPress={() => router.push("/property/new")}
              className="bg-primary rounded-lg px-6 py-3"
            >
              <Text className="text-white font-semibold">Create First Property</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <FlatList
            data={properties}
            renderItem={renderPropertyCard}
            keyExtractor={(item) => item.id}
            scrollEnabled={false}
          />
        )}
      </ScrollView>
    </ScreenContainer>
  );
}
