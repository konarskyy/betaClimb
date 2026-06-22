import { useQueryClient } from "@tanstack/react-query";
import { useRouter } from "expo-router";
import * as ImagePicker from "expo-image-picker";
import { useState } from "react";
import { Alert, ScrollView, StyleSheet, Text, View } from "react-native";
import { api, ApiError } from "@/api";
import { HoldTagger } from "@/components/HoldTagger";
import { Button, Card, ErrorText, Field } from "@/components/ui";
import { colors, spacing } from "@/theme";
import type { Hold } from "@/types";

interface PickedImage {
  uri: string;
  width: number;
  height: number;
}

export default function NewRoute() {
  const router = useRouter();
  const queryClient = useQueryClient();

  const [image, setImage] = useState<PickedImage | null>(null);
  const [name, setName] = useState("");
  const [heightM, setHeightM] = useState("");
  const [holds, setHolds] = useState<Hold[]>([]);
  const [selected, setSelected] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function pick(fromCamera: boolean) {
    setError(null);
    const perm = fromCamera
      ? await ImagePicker.requestCameraPermissionsAsync()
      : await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      setError("Brak uprawnień do aparatu/galerii.");
      return;
    }
    const res = fromCamera
      ? await ImagePicker.launchCameraAsync({ quality: 0.8 })
      : await ImagePicker.launchImageLibraryAsync({ mediaTypes: ["images"], quality: 0.8 });
    if (res.canceled || !res.assets[0]) return;
    const a = res.assets[0];
    setImage({ uri: a.uri, width: a.width, height: a.height });
    setHolds([]);
    setSelected(null);
  }

  async function save() {
    setError(null);
    const routeHeightM = Number(heightM);
    if (!image) return setError("Najpierw wybierz zdjęcie trasy.");
    if (!name.trim()) return setError("Podaj nazwę trasy.");
    if (!Number.isFinite(routeHeightM) || routeHeightM <= 0 || routeHeightM > 60) {
      return setError("Podaj wysokość trasy w metrach (0–60).");
    }
    if (holds.length < 2) return setError("Zaznacz co najmniej 2 chwyty.");

    setSaving(true);
    try {
      const created = await api.createRoute({
        name: name.trim(),
        imgW: image.width,
        imgH: image.height,
        routeHeightM,
        holds: holds.map(({ x, y, isStart, isFinish }) => ({ x, y, isStart, isFinish })),
      });
      await api.uploadImage(created.id, image.uri);
      queryClient.invalidateQueries({ queryKey: ["routes"] });
      router.replace(`/(app)/route/${created.id}`);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Nie udało się zapisać trasy.");
      setSaving(false);
    }
  }

  return (
    <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
      {!image ? (
        <Card>
          <Text style={styles.h}>1. Zdjęcie trasy</Text>
          <Text style={styles.muted}>Zrób zdjęcie ściany lub wybierz je z galerii.</Text>
          <View style={{ height: spacing.md }} />
          <Button title="📷 Zrób zdjęcie" onPress={() => pick(true)} />
          <View style={{ height: spacing.sm }} />
          <Button title="🖼️ Wybierz z galerii" variant="secondary" onPress={() => pick(false)} />
        </Card>
      ) : (
        <>
          <Card>
            <Field label="Nazwa trasy" value={name} onChangeText={setName} placeholder="np. Kominek 6a" />
            <Field
              label="Wysokość trasy (m)"
              value={heightM}
              onChangeText={setHeightM}
              keyboardType="decimal-pad"
              placeholder="np. 12"
            />
            <Text style={styles.hint}>
              Wysokość służy do przeliczenia skali zdjęcia (piksele → centymetry).
            </Text>
          </Card>

          <Card style={{ marginTop: spacing.md }}>
            <Text style={styles.h}>2. Zaznacz chwyty</Text>
            <Text style={styles.muted}>
              Dotknij zdjęcia, aby dodać chwyt. Dotknij istniejącego, aby go zaznaczyć.
            </Text>
            <View style={{ height: spacing.sm }} />
            <HoldTagger
              imageUri={image.uri}
              imgW={image.width}
              imgH={image.height}
              holds={holds}
              setHolds={setHolds}
              selected={selected}
              setSelected={setSelected}
            />
          </Card>

          <View style={{ marginTop: spacing.md }}>
            <ErrorText>{error}</ErrorText>
            <Button title="Zapisz trasę i policz betę" onPress={save} loading={saving} />
            <View style={{ height: spacing.sm }} />
            <Button
              title="Zmień zdjęcie"
              variant="secondary"
              onPress={() =>
                Alert.alert("Zmiana zdjęcia", "Utracisz zaznaczone chwyty. Kontynuować?", [
                  { text: "Anuluj", style: "cancel" },
                  { text: "Tak", onPress: () => setImage(null) },
                ])
              }
            />
          </View>
        </>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: { padding: spacing.md },
  h: { color: colors.text, fontSize: 18, fontWeight: "700", marginBottom: spacing.xs },
  muted: { color: colors.textMuted },
  hint: { color: colors.textMuted, fontSize: 12, marginTop: spacing.sm },
});
