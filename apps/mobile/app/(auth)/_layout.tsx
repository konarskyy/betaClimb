import { Redirect, Stack } from "expo-router";
import { useAuth } from "@/auth";
import { colors } from "@/theme";

export default function AuthLayout() {
  const { user, isLoading } = useAuth();
  if (!isLoading && user) return <Redirect href="/(app)" />;

  return (
    <Stack
      screenOptions={{
        headerStyle: { backgroundColor: colors.bg },
        headerTintColor: colors.text,
        headerShadowVisible: false,
        contentStyle: { backgroundColor: colors.bg },
      }}
    >
      <Stack.Screen name="login" options={{ title: "Logowanie" }} />
      <Stack.Screen name="register" options={{ title: "Rejestracja" }} />
    </Stack>
  );
}
