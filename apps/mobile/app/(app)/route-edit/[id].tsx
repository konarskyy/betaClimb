import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Stack, useLocalSearchParams, useRouter } from "expo-router";
import * as ImagePicker from "expo-image-picker";
import { useEffect, useState } from "react";
import { ActivityIndicator, Alert, ScrollView, StyleSheet, Text, View } from "react-native";
import { api, ApiError, imageSrc } from "@/api";
import { HoldTagger } from "@/components/HoldTagger";
import { Button, Card, ErrorText, Field } from "@/components/ui";
import { colors, spacing } from "@/theme";
import type { Hold } from "@/types";

interface PickedImage {
  uri: string;
  width: number;
  height: number;
}

export default function EditRoute() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const queryClient = useQueryClient();

  const routeQ = useQuery({ queryKey: ["route", id], queryFn: () => api.getRoute(id) });

  const [initialized, setInitialized] = useState(false);
  const [name, setName] = useState("");
  const [heightM, setHeightM] = useState("");
  const [holds, setHolds] = useState<Hold[]>([]);
  const [selected, setSelected] = useState<string | null>(null);
  // null = zostaw dotychczasowe zdjęcie; obiekt = nowo wybrane zdjęcie do wgrania
  const [newImage, setNewImage] = useState<PickedImage | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  // Wczytaj dane trasy do formularza (raz, po pobraniu).
  useEffect(() => {
    if (initialized || !routeQ.data) return;
    setName(routeQ.data.name);
    setHeightM(String(routeQ.data.routeHeightM));
    setHolds(routeQ.data.holds.map((h) => ({ ...h })));
    setInitialized(true);
  }, [initialized, routeQ.data]);

  async function pickImage(fromCamera: boolean) {
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
    setNewImage({ uri: a.uri, width: a.width, height: a.height });

    // Nowe zdjęcie zwykle nie pasuje do dotychczasowych pozycji chwytów —
    // zapytaj, czy je wyczyścić.
    if (holds.length > 0) {
      Alert.alert(
        "Nowe zdjęcie",
        "Czy wyczyścić dotychczasowe chwyty? Pozycje z poprzedniego zdjęcia mogą nie pasować.",
        [
          { text: "Zachowaj chwyty", style: "cancel" },
          {
            text: "Wyczyść",
            style: "destructive",
            onPress: () => {
              setHolds([]);
              setSelected(null);
            },
          },
        ],
      );
    }
  }

  function confirmChangeImage() {
    Alert.alert("Zmiana zdjęcia", "Wybierz nowe zdjęcie ściany.", [
      { text: "Anuluj", style: "cancel" },
      { text: "📷 Aparat", onPress: () => pickImage(true) },
      { text: "🖼️ Galeria", onPress: () => pickImage(false) },
    ]);
  }

  async function save() {
    setError(null);
    const routeHeightM = Number(heightM);
    if (!name.trim()) return setError("Podaj nazwę trasy.");
    if (!Number.isFinite(routeHeightM) || routeHeightM <= 0 || routeHeightM > 60) {
      return setError("Podaj wysokość trasy w metrach (0–60).");
    }
    if (holds.length < 2) return setError("Zaznacz co najmniej 2 chwyty.");

    setSaving(true);
    try {
      await api.updateRoute(id, {
        name: name.trim(),
        routeHeightM,
        holds: holds.map(({ x, y, isStart, isFinish }) => ({ x, y, isStart, isFinish })),
        ...(newImage && { imgW: newImage.width, imgH: newImage.height }),
      });
      if (newImage) await api.uploadImage(id, newImage.uri);

      await queryClient.invalidateQueries({ queryKey: ["route", id] });
      await queryClient.invalidateQueries({ queryKey: ["beta", id] });
      queryClient.invalidateQueries({ queryKey: ["routes"] });
      router.back();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Nie udało się zapisać zmian.");
      setSaving(false);
    }
  }

  if (routeQ.isLoading || !initialized) {
    return (
      <View style={styles.center}>
        <Stack.Screen options={{ title: "Edytuj chwyty" }} />
        <ActivityIndicator color={colors.primary} size="large" />
      </View>
    );
  }
  if (routeQ.isError || !routeQ.data) {
    return (
      <View style={styles.center}>
        <Text style={styles.muted}>Nie udało się pobrać trasy.</Text>
      </View>
    );
  }

  const route = routeQ.data;
  const imageUri = newImage ? newImage.uri : imageSrc(route.imageUrl);
  const imgW = newImage ? newImage.width : route.imgW;
  const imgH = newImage ? newImage.height : route.imgH;

  return (
    <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
      <Stack.Screen options={{ title: "Edytuj chwyty" }} />

      <Card>
        <Field label="Nazwa trasy" value={name} onChangeText={setName} />
        <Field
          label="Wysokość trasy (m)"
          value={heightM}
          onChangeText={setHeightM}
          keyboardType="decimal-pad"
        />
        <Text style={styles.hint}>Wysokość to skala zdjęcia — jej zmiana przelicza betę.</Text>
      </Card>

      <Card style={{ marginTop: spacing.md }}>
        <Text style={styles.h}>Chwyty</Text>
        <Text style={styles.muted}>
          Dotknij zdjęcia, aby dodać chwyt. Dotknij istniejącego, aby go zaznaczyć i zmienić.
        </Text>
        <View style={{ height: spacing.sm }} />
        {imageUri ? (
          <HoldTagger
            imageUri={imageUri}
            imgW={imgW}
            imgH={imgH}
            holds={holds}
            setHolds={setHolds}
            selected={selected}
            setSelected={setSelected}
          />
        ) : (
          <Text style={styles.muted}>Brak zdjęcia trasy — wybierz nowe poniżej.</Text>
        )}
        <View style={{ height: spacing.md }} />
        <Button title="Zmień zdjęcie ściany" variant="secondary" onPress={confirmChangeImage} />
      </Card>

      <View style={{ marginTop: spacing.md }}>
        <ErrorText>{error}</ErrorText>
        <Button title="Zapisz zmiany" onPress={save} loading={saving} />
        <View style={{ height: spacing.sm }} />
        <Button title="Anuluj" variant="secondary" onPress={() => router.back()} />
      </View>

      <View style={{ height: spacing.xl }} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: { padding: spacing.md },
  center: { flex: 1, justifyContent: "center", alignItems: "center", backgroundColor: colors.bg },
  h: { color: colors.text, fontSize: 18, fontWeight: "700", marginBottom: spacing.xs },
  muted: { color: colors.textMuted },
  hint: { color: colors.textMuted, fontSize: 12, marginTop: spacing.sm },
});
