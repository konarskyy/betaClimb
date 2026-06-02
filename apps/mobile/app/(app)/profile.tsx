import { useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Alert, ScrollView, StyleSheet, Text, View } from "react-native";
import { api, ApiError } from "@/api";
import { useAuth } from "@/auth";
import { Button, Card, ErrorText, Field } from "@/components/ui";
import { colors, spacing } from "@/theme";

export default function Profile() {
  const { user, setUser, signOut } = useAuth();
  const queryClient = useQueryClient();
  const [height, setHeight] = useState(String(user?.heightCm ?? ""));
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  async function onSave() {
    setError(null);
    setSaved(false);
    const heightCm = Number(height);
    if (!Number.isFinite(heightCm) || heightCm < 100 || heightCm > 250) {
      setError("Podaj wzrost w centymetrach (100–250).");
      return;
    }
    setSaving(true);
    try {
      const updated = await api.updateProfile(Math.round(heightCm));
      setUser(updated);
      setSaved(true);
      // beta zależy od wzrostu — odśwież wyniki przy ponownym wejściu na trasę
      queryClient.invalidateQueries({ queryKey: ["beta"] });
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Nie udało się zapisać");
    } finally {
      setSaving(false);
    }
  }

  function onLogout() {
    Alert.alert("Wylogowanie", "Czy na pewno chcesz się wylogować?", [
      { text: "Anuluj", style: "cancel" },
      { text: "Wyloguj", style: "destructive", onPress: () => signOut() },
    ]);
  }

  return (
    <ScrollView contentContainerStyle={styles.content}>
      <Card>
        <Text style={styles.label}>Zalogowany jako</Text>
        <Text style={styles.username}>{user?.username}</Text>
      </Card>

      <Card style={{ marginTop: spacing.md }}>
        <Field
          label="Wzrost (cm)"
          value={height}
          onChangeText={setHeight}
          keyboardType="number-pad"
        />
        <Text style={styles.hint}>
          Wzrost wpływa na zasięg ruchu — zmiana zmienia wyznaczaną betę.
        </Text>
        <ErrorText>{error}</ErrorText>
        {saved && <Text style={styles.saved}>Zapisano ✓</Text>}
        <Button title="Zapisz" onPress={onSave} loading={saving} />
      </Card>

      <View style={{ marginTop: spacing.xl }}>
        <Button title="Wyloguj się" variant="danger" onPress={onLogout} />
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: { padding: spacing.md },
  label: { color: colors.textMuted, fontSize: 13 },
  username: { color: colors.text, fontSize: 22, fontWeight: "800", marginTop: spacing.xs },
  hint: { color: colors.textMuted, fontSize: 12, marginBottom: spacing.sm },
  saved: { color: colors.success, marginBottom: spacing.sm },
});
