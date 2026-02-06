import { View, Text, ScrollView, Pressable, ActivityIndicator, Alert } from "react-native";
import { ScreenContainer } from "@/components/screen-container";
import { useColors } from "@/hooks/use-colors";
import { useAuth } from "@/lib/auth-context";
import { useEffect, useState } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";

interface Invoice {
  id: string | null;
  status: string;
  totalAmount: number;
  lineItems: Array<{
    id: string;
    jobId: string;
    amount: number;
    jobDate?: string;
    jobDuration?: number;
    createdAt: Date;
  }>;
  payType: string;
  invoiceCycle: string;
  createdAt: Date | null;
  submittedAt: Date | null;
}

interface SubmittedInvoice extends Invoice {
  submittedAt: Date;
}

export default function InvoiceScreen() {
  const colors = useColors();
  const { user } = useAuth();
  const [currentInvoice, setCurrentInvoice] = useState<Invoice | null>(null);
  const [submittedInvoices, setSubmittedInvoices] = useState<SubmittedInvoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [activeTab, setActiveTab] = useState<"current" | "history">("current");

  // Load invoices on mount
  useEffect(() => {
    loadInvoices();
  }, []);

  const loadInvoices = async () => {
    try {
      setLoading(true);

      // Try to load from API first
      if (user?.id) {
        try {
          // Load current invoice
          const currentRes = await fetch("/api/invoices.getCurrent", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
          });

          if (currentRes.ok) {
            const current = await currentRes.json();
            setCurrentInvoice(current);
            // Save to AsyncStorage for offline access
            await AsyncStorage.setItem("currentInvoice", JSON.stringify(current));
          }

          // Load submitted invoices
          const historyRes = await fetch("/api/invoices.getHistory", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
          });

          if (historyRes.ok) {
            const history = await historyRes.json();
            setSubmittedInvoices(history);
            // Save to AsyncStorage for offline access
            await AsyncStorage.setItem("submittedInvoices", JSON.stringify(history));
          }
        } catch (error) {
          console.warn("[Invoice] API load failed, trying AsyncStorage:", error);
          // Fall back to AsyncStorage
          const cached = await AsyncStorage.getItem("currentInvoice");
          if (cached) {
            setCurrentInvoice(JSON.parse(cached));
          }
          const cachedHistory = await AsyncStorage.getItem("submittedInvoices");
          if (cachedHistory) {
            setSubmittedInvoices(JSON.parse(cachedHistory));
          }
        }
      }
    } catch (error) {
      console.error("[Invoice] Load error:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmitInvoice = async () => {
    if (!currentInvoice?.id) {
      Alert.alert("Error", "No invoice to submit");
      return;
    }

    const payTypeLabel = currentInvoice.payType === "hourly" ? "hourly" : "per-job";
    const totalDisplay = `$${currentInvoice.totalAmount.toFixed(2)}`;

    Alert.alert(
      "Submit Invoice?",
      `Submit ${payTypeLabel} invoice for ${totalDisplay}?`,
      [
        {
          text: "Cancel",
          onPress: () => {},
          style: "cancel",
        },
        {
          text: "Submit",
          onPress: async () => {
            try {
              setSubmitting(true);

              const response = await fetch("/api/invoices.submit", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ invoiceId: currentInvoice.id }),
              });

              if (response.ok) {
                const submitted = await response.json();

                // Update state
                setCurrentInvoice(null);
                setSubmittedInvoices([submitted, ...submittedInvoices]);

                // Clear AsyncStorage
                await AsyncStorage.removeItem("currentInvoice");

                Alert.alert("Success", "Invoice submitted successfully");
                setActiveTab("history");
              } else {
                const error = await response.json();
                Alert.alert("Error", error.message || "Failed to submit invoice");
              }
            } catch (error) {
              console.error("[Invoice] Submit error:", error);
              Alert.alert("Error", "Failed to submit invoice");
            } finally {
              setSubmitting(false);
            }
          },
        },
      ]
    );
  };

  if (loading) {
    return (
      <ScreenContainer className="flex-1 items-center justify-center">
        <ActivityIndicator size="large" color={colors.primary} />
      </ScreenContainer>
    );
  }

  return (
    <ScreenContainer className="flex-1">
      {/* Tab Navigation */}
      <View style={{ flexDirection: "row", borderBottomWidth: 1, borderBottomColor: colors.border, marginBottom: 16 }}>
        <Pressable
          onPress={() => setActiveTab("current")}
          style={({ pressed }) => [
            {
              flex: 1,
              paddingVertical: 12,
              paddingHorizontal: 16,
              borderBottomWidth: activeTab === "current" ? 2 : 0,
              borderBottomColor: activeTab === "current" ? colors.primary : "transparent",
              opacity: pressed ? 0.7 : 1,
            },
          ]}
        >
          <Text
            style={{
              color: activeTab === "current" ? colors.primary : colors.muted,
              fontWeight: activeTab === "current" ? "600" : "400",
              fontSize: 14,
              textAlign: "center",
            }}
          >
            Current
          </Text>
        </Pressable>
        <Pressable
          onPress={() => setActiveTab("history")}
          style={({ pressed }) => [
            {
              flex: 1,
              paddingVertical: 12,
              paddingHorizontal: 16,
              borderBottomWidth: activeTab === "history" ? 2 : 0,
              borderBottomColor: activeTab === "history" ? colors.primary : "transparent",
              opacity: pressed ? 0.7 : 1,
            },
          ]}
        >
          <Text
            style={{
              color: activeTab === "history" ? colors.primary : colors.muted,
              fontWeight: activeTab === "history" ? "600" : "400",
              fontSize: 14,
              textAlign: "center",
            }}
          >
            History
          </Text>
        </Pressable>
      </View>

      <ScrollView contentContainerStyle={{ flexGrow: 1, paddingHorizontal: 16 }}>
        {activeTab === "current" ? (
          // Current Invoice Tab
          currentInvoice && currentInvoice.id ? (
            <View>
              {/* Total Amount - Pay Type Specific Header */}
              <View
                style={{
                  backgroundColor: colors.surface,
                  borderRadius: 12,
                  padding: 16,
                  marginBottom: 16,
                  borderWidth: 1,
                  borderColor: colors.border,
                }}
              >
                {/* Pay Type Label */}
                <Text style={{ color: colors.muted, fontSize: 12, marginBottom: 4 }}>
                  {currentInvoice.payType === "hourly" ? "Total Earnings" : "Invoice Total"}
                </Text>

                {/* Amount */}
                <Text
                  style={{
                    color: colors.primary,
                    fontSize: 36,
                    fontWeight: "700",
                    marginBottom: 8,
                  }}
                >
                  ${currentInvoice.totalAmount.toFixed(2)}
                </Text>

                {/* Pay Type and Cycle */}
                <Text style={{ color: colors.muted, fontSize: 12 }}>
                  {currentInvoice.payType === "hourly" ? "Hourly" : "Per-Job"} • {currentInvoice.invoiceCycle}
                </Text>

                {/* Pay Type Specific Message */}
                {currentInvoice.payType === "hourly" && (
                  <Text style={{ color: colors.muted, fontSize: 11, marginTop: 8, fontStyle: "italic" }}>
                    Earnings from {currentInvoice.lineItems.length} completed job{currentInvoice.lineItems.length !== 1 ? "s" : ""}
                  </Text>
                )}
              </View>

              {/* Line Items - Pay Type Specific Display */}
              {currentInvoice.lineItems.length > 0 && (
                <View
                  style={{
                    backgroundColor: colors.surface,
                    borderRadius: 12,
                    padding: 16,
                    marginBottom: 16,
                    borderWidth: 1,
                    borderColor: colors.border,
                  }}
                >
                  <Text style={{ color: colors.foreground, fontWeight: "600", fontSize: 14, marginBottom: 12 }}>
                    {currentInvoice.lineItems.length} Job{currentInvoice.lineItems.length !== 1 ? "s" : ""}
                  </Text>

                  {currentInvoice.lineItems.map((item, index) => (
                    <View
                      key={item.id}
                      style={{
                        paddingVertical: 12,
                        borderBottomWidth: index < currentInvoice.lineItems.length - 1 ? 1 : 0,
                        borderBottomColor: colors.border,
                      }}
                    >
                      <View style={{ flexDirection: "row", justifyContent: "space-between", marginBottom: 4 }}>
                        <Text style={{ color: colors.foreground, fontWeight: "500", fontSize: 13 }}>
                          Job {index + 1}
                        </Text>
                        {/* Only show price for per-job cleaners */}
                        {currentInvoice.payType === "per_job" && (
                          <Text style={{ color: colors.primary, fontWeight: "600", fontSize: 13 }}>
                            ${item.amount.toFixed(2)}
                          </Text>
                        )}
                      </View>

                      {/* Job date for all pay types */}
                      {item.jobDate && (
                        <Text style={{ color: colors.muted, fontSize: 12 }}>
                          {new Date(item.jobDate).toLocaleDateString("en-US", {
                            month: "short",
                            day: "numeric",
                          })}
                        </Text>
                      )}

                      {/* Duration for hourly cleaners */}
                      {currentInvoice.payType === "hourly" && item.jobDuration && (
                        <Text style={{ color: colors.muted, fontSize: 12 }}>
                          {Math.round(item.jobDuration / 60)} min
                        </Text>
                      )}
                    </View>
                  ))}
                </View>
              )}

              {/* Submit Button */}
              <Pressable
                onPress={handleSubmitInvoice}
                disabled={submitting}
                style={({ pressed }) => [
                  {
                    backgroundColor: colors.primary,
                    paddingVertical: 12,
                    paddingHorizontal: 16,
                    borderRadius: 8,
                    opacity: submitting ? 0.6 : pressed ? 0.9 : 1,
                  },
                ]}
              >
                {submitting ? (
                  <ActivityIndicator color="#ffffff" />
                ) : (
                  <Text style={{ color: "#ffffff", fontWeight: "600", fontSize: 14, textAlign: "center" }}>
                    Submit Invoice
                  </Text>
                )}
              </Pressable>

              <Text style={{ color: colors.muted, fontSize: 12, marginTop: 12, textAlign: "center" }}>
                Invoice will lock after submission
              </Text>
            </View>
          ) : (
            <View style={{ flex: 1, justifyContent: "center", alignItems: "center" }}>
              <Text style={{ color: colors.muted, fontSize: 14, marginBottom: 8 }}>No running invoice</Text>
              <Text style={{ color: colors.muted, fontSize: 12 }}>Complete a job to start one</Text>
            </View>
          )
        ) : (
          // History Tab
          submittedInvoices.length > 0 ? (
            <View>
              {submittedInvoices.map((invoice, index) => (
                <View
                  key={invoice.id}
                  style={{
                    backgroundColor: colors.surface,
                    borderRadius: 12,
                    padding: 16,
                    marginBottom: 12,
                    borderWidth: 1,
                    borderColor: colors.border,
                  }}
                >
                  <View style={{ flexDirection: "row", justifyContent: "space-between", marginBottom: 8 }}>
                    <Text style={{ color: colors.foreground, fontWeight: "600", fontSize: 14 }}>
                      Invoice #{index + 1}
                    </Text>
                    <Text style={{ color: colors.primary, fontWeight: "600", fontSize: 14 }}>
                      ${invoice.totalAmount.toFixed(2)}
                    </Text>
                  </View>
                  <Text style={{ color: colors.muted, fontSize: 12, marginBottom: 4 }}>
                    {invoice.payType === "hourly" ? "Hourly" : "Per-Job"} • {invoice.lineItems.length} job
                    {invoice.lineItems.length !== 1 ? "s" : ""}
                  </Text>
                  {invoice.submittedAt && (
                    <Text style={{ color: colors.muted, fontSize: 12 }}>
                      Submitted:{" "}
                      {new Date(invoice.submittedAt).toLocaleDateString("en-US", {
                        month: "short",
                        day: "numeric",
                        year: "numeric",
                      })}
                    </Text>
                  )}
                </View>
              ))}
            </View>
          ) : (
            <View style={{ flex: 1, justifyContent: "center", alignItems: "center" }}>
              <Text style={{ color: colors.muted, fontSize: 14 }}>No submitted invoices</Text>
            </View>
          )
        )}
      </ScrollView>
    </ScreenContainer>
  );
}
