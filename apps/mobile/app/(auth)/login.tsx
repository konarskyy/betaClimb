import { Link, useRouter } from "expo-router";
import { useState } from "react";
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, View } from "react-native";
import { ApiError } from "@/api";
import { useAuth } from "@/auth";
import { Button, ErrorText, Field } from "@/components/ui";
import { colors, spacing } from "@/theme";

export default function Login() {
  const { signIn } = useAuth();
  const router = useRouter();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit() {
    setError(null);
    setLoading(true);
    try {
      await signIn(username.trim(), password);
      router.replace("/(app)");
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Nie udało się zalogować");
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
        <Text style={styles.title}>BetaClimb 🧗</Text>
        <Text style={styles.subtitle}>Zaloguj się, aby analizować swoje trasy.</Text>

        <Field
          label="Login"
          value={username}
          onChangeText={setUsername}
          autoCapitalize="none"
          autoCorrect={false}
          placeholder="np. jan"
        />
        <Field
          label="Hasło"
          value={password}
          onChangeText={setPassword}
          secureTextEntry
          placeholder="••••••••"
        />

        <ErrorText>{error}</ErrorText>
        <Button title="Zaloguj się" onPress={onSubmit} loading={loading} />

        <View style={styles.footer}>
          <Text style={styles.muted}>Nie masz konta? </Text>
          <Link href="/(auth)/register" style={styles.link}>
            Zarejestruj się
          </Link>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  content: { padding: spacing.lg, paddingTop: spacing.xl, flexGrow: 1, justifyContent: "center" },
  title: { color: colors.text, fontSize: 32, fontWeight: "800", textAlign: "center" },
  subtitle: {
    color: colors.textMuted,
    textAlign: "center",
    marginTop: spacing.sm,
    marginBottom: spacing.xl,
  },
  footer: { flexDirection: "row", justifyContent: "center", marginTop: spacing.lg },
  muted: { color: colors.textMuted },
  link: { color: colors.primary, fontWeight: "700" },
});
