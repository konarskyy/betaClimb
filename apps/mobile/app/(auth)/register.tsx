import { useRouter } from "expo-router";
import { useState } from "react";
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text } from "react-native";
import { ApiError } from "@/api";
import { useAuth } from "@/auth";
import { Button, ErrorText, Field } from "@/components/ui";
import { colors, spacing } from "@/theme";

export default function Register() {
  const { signUp } = useAuth();
  const router = useRouter();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [height, setHeight] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit() {
    setError(null);
    const heightCm = Number(height);
    if (!Number.isFinite(heightCm) || heightCm < 100 || heightCm > 250) {
      setError("Podaj wzrost w centymetrach (100–250).");
      return;
    }
    setLoading(true);
    try {
      await signUp(username.trim(), password, Math.round(heightCm));
      router.replace("/(app)");
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Nie udało się zarejestrować");
    } finally {
      setLoading(false);
    }
  }

  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <Text style={styles.title}>Załóż konto</Text>
        <Text style={styles.subtitle}>
          Wzrost posłuży do personalizacji bety pod Twój zasięg.
        </Text>

        <Field
          label="Login"
          value={username}
          onChangeText={setUsername}
          autoCapitalize="none"
          autoCorrect={false}
          placeholder="min. 3 znaki"
        />
        <Field
          label="Hasło"
          value={password}
          onChangeText={setPassword}
          secureTextEntry
          placeholder="min. 8 znaków"
        />
        <Field
          label="Wzrost (cm)"
          value={height}
          onChangeText={setHeight}
          keyboardType="number-pad"
          placeholder="np. 178"
        />

        <ErrorText>{error}</ErrorText>
        <Button title="Zarejestruj się" onPress={onSubmit} loading={loading} />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  content: { padding: spacing.lg, paddingTop: spacing.xl, flexGrow: 1, justifyContent: "center" },
  title: { color: colors.text, fontSize: 28, fontWeight: "800", textAlign: "center" },
  subtitle: {
    color: colors.textMuted,
    textAlign: "center",
    marginTop: spacing.sm,
    marginBottom: spacing.xl,
  },
});
