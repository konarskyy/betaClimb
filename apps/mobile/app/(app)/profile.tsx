import { useQueryClient } from "@tanstack/react-query";
import * as ImagePicker from "expo-image-picker";
import { useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { api, ApiError, imageSrc } from "@/api";
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
  const [uploadingAvatar, setUploadingAvatar] = useState(false);

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

  async function changeAvatar() {
    setError(null);
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      setError("Brak uprawnień do galerii.");
      return;
    }
    const res = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.7,
    });
    if (res.canceled || !res.assets[0]) return;
    setUploadingAvatar(true);
    try {
      const updated = await api.uploadAvatar(res.assets[0].uri);
      setUser(updated);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Nie udało się zmienić zdjęcia");
    } finally {
      setUploadingAvatar(false);
    }
  }

  function onLogout() {
    Alert.alert("Wylogowanie", "Czy na pewno chcesz się wylogować?", [
      { text: "Anuluj", style: "cancel" },
      { text: "Wyloguj", style: "destructive", onPress: () => signOut() },
    ]);
  }

  const avatarUri = imageSrc(user?.avatarUrl);
  const initial = user?.username?.[0]?.toUpperCase() ?? "?";

  return (
    <ScrollView contentContainerStyle={styles.content}>
      <Card>
        <View style={styles.profileRow}>
          <Pressable onPress={changeAvatar} disabled={uploadingAvatar} style={styles.avatarWrap}>
            {avatarUri ? (
              <Image source={{ uri: avatarUri }} style={styles.avatar} />
            ) : (
              <View style={[styles.avatar, styles.avatarPlaceholder]}>
                <Text style={styles.avatarInitial}>{initial}</Text>
              </View>
            )}
            <View style={styles.avatarBadge}>
              {uploadingAvatar ? (
                <ActivityIndicator size="small" color={colors.primaryText} />
              ) : (
                <Text style={styles.avatarBadgeText}>✎</Text>
              )}
            </View>
          </Pressable>
          <View style={{ flex: 1 }}>
            <Text style={styles.label}>Zalogowany jako</Text>
            <Text style={styles.username}>{user?.username}</Text>
            <Pressable onPress={changeAvatar} disabled={uploadingAvatar}>
              <Text style={styles.changeLink}>Zmień zdjęcie</Text>
            </Pressable>
          </View>
        </View>
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

const AVATAR = 72;

const styles = StyleSheet.create({
  content: { padding: spacing.md },
  profileRow: { flexDirection: "row", alignItems: "center", gap: spacing.md },
  avatarWrap: { width: AVATAR, height: AVATAR },
  avatar: { width: AVATAR, height: AVATAR, borderRadius: AVATAR / 2, backgroundColor: colors.surfaceAlt },
  avatarPlaceholder: { alignItems: "center", justifyContent: "center" },
  avatarInitial: { color: colors.text, fontSize: 30, fontWeight: "800" },
  avatarBadge: {
    position: "absolute",
    right: -2,
    bottom: -2,
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: colors.primary,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 2,
    borderColor: colors.surface,
  },
  avatarBadgeText: { color: colors.primaryText, fontSize: 13, fontWeight: "800" },
  label: { color: colors.textMuted, fontSize: 13 },
  username: { color: colors.text, fontSize: 22, fontWeight: "800", marginTop: spacing.xs },
  changeLink: { color: colors.primary, fontWeight: "600", marginTop: spacing.xs },
  hint: { color: colors.textMuted, fontSize: 12, marginBottom: spacing.sm },
  saved: { color: colors.success, marginBottom: spacing.sm },
});
