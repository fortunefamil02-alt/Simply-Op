import { ScrollView, Text, View, TouchableOpacity, ActivityIndicator, Alert, TextInput } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useState, useEffect } from "react";
import { ScreenContainer } from "@/components/screen-container";
import { trpc } from "@/lib/trpc";

/**
 * Property Detail/Edit Screen
 */
export default function PropertyDetailScreen() {
  const { id } = useLocalSearchParams();
  const router = useRouter();
  const isNew = id === "new";

  const [name, setName] = useState("");
  const [address, setAddress] = useState("");
  const [city, setCity] = useState("");
  const [state, setState] = useState("");
  const [zipCode, setZipCode] = useState("");
  const [unitType, setUnitType] = useState("");
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);

  // Fetch property if editing
  const { data: property, isLoading } = trpc.properties.getById.useQuery(
    { propertyId: id as string },
    { enabled: !!id && !isNew }
  );

  useEffect(() => {
    if (property) {
      setName(property.name || "");
      setAddress(property.address || "");
      setCity(property.city || "");
      setState(property.state || "");
      setZipCode(property.zipCode || "");
      setUnitType(property.unitType || "");
      setNotes(property.notes || "");
    }
  }, [property]);

  // Create property mutation
  const createPropertyMutation = trpc.properties.create.useMutation({
    onSuccess: () => {
      Alert.alert("Success", "Property created!");
      router.push("/(tabs)/properties");
    },
    onError: (error: any) => {
      Alert.alert("Error", error.message || "Failed to create property");
    },
  });

  // Update property mutation
  const updatePropertyMutation = trpc.properties.update.useMutation({
    onSuccess: () => {
      Alert.alert("Success", "Property updated!");
      router.push("/(tabs)/properties");
    },
    onError: (error: any) => {
      Alert.alert("Error", error.message || "Failed to update property");
    },
  });

  const handleSave = async () => {
    if (!name.trim() || !address.trim()) {
      Alert.alert("Error", "Name and address are required");
      return;
    }

    setSaving(true);
    try {
      if (isNew) {
        await createPropertyMutation.mutateAsync({
          name,
          address,
          city,
          state,
          zipCode,
          unitType,
          notes,
        });
      } else {
        await updatePropertyMutation.mutateAsync({
          propertyId: id as string,
          name,
          address,
          city,
          state,
          zipCode,
          unitType,
          notes,
        });
      }
    } finally {
      setSaving(false);
    }
  };

  if (!isNew && isLoading) {
    return (
      <ScreenContainer className="items-center justify-center">
        <ActivityIndicator size="large" color="#0a7ea4" />
      </ScreenContainer>
    );
  }

  return (
    <ScreenContainer className="p-4">
      <ScrollView contentContainerStyle={{ flexGrow: 1 }}>
        {/* Header */}
        <View className="flex-row justify-between items-start mb-6">
          <View className="flex-1">
            <Text className="text-2xl font-bold text-foreground">
              {isNew ? "New Property" : "Edit Property"}
            </Text>
          </View>
          <TouchableOpacity onPress={() => router.back()} className="bg-surface rounded-lg p-2">
            <Text className="text-primary font-semibold">Back</Text>
          </TouchableOpacity>
        </View>

        {/* Form Fields */}
        <View className="gap-4 mb-6">
          {/* Name */}
          <View>
            <Text className="text-sm font-semibold text-foreground mb-1">Property Name *</Text>
            <TextInput
              value={name}
              onChangeText={setName}
              placeholder="e.g., Downtown Loft"
              className="bg-surface border border-border rounded-lg px-4 py-3 text-foreground"
              placeholderTextColor="#9BA1A6"
            />
          </View>

          {/* Address */}
          <View>
            <Text className="text-sm font-semibold text-foreground mb-1">Address *</Text>
            <TextInput
              value={address}
              onChangeText={setAddress}
              placeholder="e.g., 123 Main Street"
              className="bg-surface border border-border rounded-lg px-4 py-3 text-foreground"
              placeholderTextColor="#9BA1A6"
            />
          </View>

          {/* City */}
          <View>
            <Text className="text-sm font-semibold text-foreground mb-1">City</Text>
            <TextInput
              value={city}
              onChangeText={setCity}
              placeholder="e.g., San Francisco"
              className="bg-surface border border-border rounded-lg px-4 py-3 text-foreground"
              placeholderTextColor="#9BA1A6"
            />
          </View>

          {/* State */}
          <View>
            <Text className="text-sm font-semibold text-foreground mb-1">State</Text>
            <TextInput
              value={state}
              onChangeText={setState}
              placeholder="e.g., CA"
              className="bg-surface border border-border rounded-lg px-4 py-3 text-foreground"
              placeholderTextColor="#9BA1A6"
            />
          </View>

          {/* Zip Code */}
          <View>
            <Text className="text-sm font-semibold text-foreground mb-1">Zip Code</Text>
            <TextInput
              value={zipCode}
              onChangeText={setZipCode}
              placeholder="e.g., 94105"
              className="bg-surface border border-border rounded-lg px-4 py-3 text-foreground"
              placeholderTextColor="#9BA1A6"
            />
          </View>

          {/* Unit Type */}
          <View>
            <Text className="text-sm font-semibold text-foreground mb-1">Unit Type</Text>
            <TextInput
              value={unitType}
              onChangeText={setUnitType}
              placeholder="e.g., 2BR/2BA"
              className="bg-surface border border-border rounded-lg px-4 py-3 text-foreground"
              placeholderTextColor="#9BA1A6"
            />
          </View>

          {/* Notes */}
          <View>
            <Text className="text-sm font-semibold text-foreground mb-1">Notes</Text>
            <TextInput
              value={notes}
              onChangeText={setNotes}
              placeholder="e.g., Access code 1234, key under mat"
              multiline
              numberOfLines={4}
              className="bg-surface border border-border rounded-lg px-4 py-3 text-foreground"
              placeholderTextColor="#9BA1A6"
            />
          </View>
        </View>

        {/* Action Buttons */}
        <View className="gap-3 mt-6">
          <TouchableOpacity
            onPress={handleSave}
            disabled={saving}
            className="bg-primary rounded-lg py-3 items-center"
          >
            {saving ? (
              <ActivityIndicator color="white" />
            ) : (
              <Text className="text-white font-semibold">{isNew ? "Create" : "Update"} Property</Text>
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
