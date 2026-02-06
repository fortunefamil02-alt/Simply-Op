import { View, Text } from "react-native";
import { ScreenContainer } from "@/components/screen-container";
import { useColors } from "@/hooks/use-colors";

export default function InvoiceScreen() {
  const colors = useColors();

  return (
    <ScreenContainer className="flex-1 items-center justify-center">
      <Text style={{ color: colors.foreground, fontSize: 18, fontWeight: "600", marginBottom: 8 }}>
        Invoice
      </Text>
      <Text style={{ color: colors.muted, fontSize: 14 }}>Coming soon...</Text>
    </ScreenContainer>
  );
}
