import { useQuery } from "@tanstack/react-query";
import { Stack, useLocalSearchParams } from "expo-router";
import { useEffect, useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { api, imageSrc } from "@/api";
import { RouteCanvas } from "@/components/RouteCanvas";
import { Card } from "@/components/ui";
import { colors, levelColor, radius, spacing } from "@/theme";
import { BETA_LEVEL_LABEL, BETA_LEVELS, type BetaLevel, type Hold } from "@/types";

export default function RouteDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [level, setLevel] = useState<BetaLevel>("flash");
  const [stepMode, setStepMode] = useState(false);
  const [step, setStep] = useState(1);

  const routeQ = useQuery({ queryKey: ["route", id], queryFn: () => api.getRoute(id) });
  const betaQ = useQuery({ queryKey: ["beta", id], queryFn: () => api.getBeta(id) });

  // zmiana poziomu = inna sekwencja → wróć do pierwszego ruchu
  useEffect(() => {
    setStep(1);
  }, [level]);

  if (routeQ.isLoading || betaQ.isLoading) {
    return (
      <View style={styles.center}>
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
  const imageUri = imageSrc(route.imageUrl);
  const beta = betaQ.data?.betas[level] ?? null;
  const holdsById = new Map<string, Hold>(route.holds.map((h) => [h.id, h]));

  // krux = ruch o największej trudności
  const kruxIndex =
    beta?.feasible && beta.moves.length
      ? beta.moves.reduce((best, m) => (m.difficulty > best.difficulty ? m : best)).index
      : null;
  const moveCount = beta?.moveCount ?? 0;
  const canStep = !!beta?.feasible && moveCount > 0;
  const currentStep = Math.min(step, moveCount);
  const activeMoveIndex = stepMode && canStep ? currentStep : null;

  return (
    <ScrollView contentContainerStyle={styles.content}>
      <Stack.Screen options={{ title: route.name }} />

      {imageUri ? (
        <RouteCanvas
          imageUri={imageUri}
          imgW={route.imgW}
          imgH={route.imgH}
          holds={route.holds}
          beta={beta}
          blurBackground
          activeMoveIndex={activeMoveIndex}
          kruxIndex={kruxIndex}
        />
      ) : (
        <Card>
          <Text style={styles.muted}>Brak zdjęcia trasy.</Text>
        </Card>
      )}

      {/* Wybór poziomu bety */}
      <View style={styles.levels}>
        {BETA_LEVELS.map((l) => {
          const active = l === level;
          return (
            <Pressable
              key={l}
              onPress={() => setLevel(l)}
              style={[
                styles.levelBtn,
                {
                  backgroundColor: active ? levelColor[l] : colors.surface,
                  borderColor: active ? levelColor[l] : colors.border,
                },
              ]}
            >
              <Text style={{ color: active ? colors.primaryText : colors.text, fontWeight: "700" }}>
                {BETA_LEVEL_LABEL[l]}
              </Text>
            </Pressable>
          );
        })}
      </View>

      {betaQ.data && (
        <Text style={styles.heightNote}>
          Beta policzona dla wzrostu {betaQ.data.heightCm} cm (zasięg ~{beta?.maxReachCm ?? "?"} cm)
        </Text>
      )}

      {/* Podsumowanie / kroki */}
      {beta?.feasible ? (
        <>
          <Card style={{ marginTop: spacing.md }}>
            <View style={styles.statsRow}>
              <Stat label="Ruchów" value={String(beta.moveCount)} />
              <Stat label="Trudność" value={beta.totalDifficulty.toFixed(1)} />
              <Stat label="Krux" value={beta.hardestMove.toFixed(1)} />
            </View>
          </Card>

          {/* Tryb krok-po-kroku */}
          <Pressable
            onPress={() => setStepMode((v) => !v)}
            style={[
              styles.stepToggle,
              { backgroundColor: stepMode ? levelColor[level] : colors.surface },
            ]}
          >
            <Text
              style={{ color: stepMode ? colors.primaryText : colors.text, fontWeight: "700" }}
            >
              {stepMode ? "✓ Krok po kroku" : "▶ Krok po kroku"}
            </Text>
          </Pressable>

          {stepMode && (
            <View style={styles.stepBar}>
              <Pressable
                onPress={() => setStep((s) => Math.max(1, Math.min(s, moveCount) - 1))}
                disabled={currentStep <= 1}
                style={[styles.stepNav, currentStep <= 1 && styles.stepNavOff]}
              >
                <Text style={styles.stepNavText}>◀</Text>
              </Pressable>
              <Text style={styles.stepLabel}>
                Ruch {currentStep} / {moveCount}
              </Text>
              <Pressable
                onPress={() => setStep((s) => Math.min(moveCount, Math.min(s, moveCount) + 1))}
                disabled={currentStep >= moveCount}
                style={[styles.stepNav, currentStep >= moveCount && styles.stepNavOff]}
              >
                <Text style={styles.stepNavText}>▶</Text>
              </Pressable>
            </View>
          )}

          <Text style={styles.sectionTitle}>Sekwencja ruchów</Text>
          {beta.moves.map((m) => {
            const to = holdsById.get(m.toHoldId);
            const target = to?.isFinish ? "TOP" : `chwyt ${beta.holdSequence.indexOf(m.toHoldId) + 1}`;
            const footIdx = m.footHoldId ? beta.holdSequence.indexOf(m.footHoldId) : -1;
            const footLabel =
              m.footType === "smear"
                ? "tarcie o ścianę"
                : m.footType === "flag"
                  ? "noga w powietrzu"
                  : footIdx >= 0
                    ? `krok ${footIdx + 1}`
                    : "chwyt pomocniczy";
            const isKrux = m.index === kruxIndex;
            const isActive = stepMode && m.index === currentStep;
            return (
              <Pressable
                key={m.index}
                onPress={() => {
                  setStepMode(true);
                  setStep(m.index);
                }}
                style={[
                  styles.move,
                  isActive && { borderColor: levelColor[level], borderWidth: 2 },
                ]}
              >
                <View
                  style={[
                    styles.moveNum,
                    { backgroundColor: isKrux ? colors.krux : levelColor[level] },
                  ]}
                >
                  <Text style={styles.moveNumText}>{m.index}</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.moveText}>
                    Ruch do {target} · {Math.round(m.distanceCm)} cm
                    {isKrux ? "  💀 krux" : ""}
                  </Text>
                  <Text style={styles.muted}>
                    {m.isDynamic ? "⚡ dynamiczny" : "kontrolowany"} · trudność {m.difficulty.toFixed(1)}
                  </Text>
                  <Text style={styles.muted}>🦶 stopa: {footLabel}</Text>
                </View>
              </Pressable>
            );
          })}
        </>
      ) : (
        <Card style={{ marginTop: spacing.md }}>
          <Text style={styles.infeasible}>Brak wykonalnego przejścia na tym poziomie.</Text>
          {beta?.note && <Text style={styles.muted}>{beta.note}</Text>}
          <Text style={[styles.muted, { marginTop: spacing.sm }]}>
            Spróbuj poziomu „Dynamiczne" lub dodaj chwyty pośrednie.
          </Text>
        </Card>
      )}

      <View style={{ height: spacing.xl }} />
    </ScrollView>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.stat}>
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.muted}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  content: { padding: spacing.md },
  center: { flex: 1, justifyContent: "center", alignItems: "center", backgroundColor: colors.bg },
  muted: { color: colors.textMuted },
  levels: { flexDirection: "row", gap: spacing.sm, marginTop: spacing.md },
  levelBtn: {
    flex: 1,
    paddingVertical: spacing.sm,
    borderRadius: radius.md,
    borderWidth: 1,
    alignItems: "center",
  },
  heightNote: { color: colors.textMuted, fontSize: 12, marginTop: spacing.sm, textAlign: "center" },
  statsRow: { flexDirection: "row", justifyContent: "space-around" },
  stat: { alignItems: "center" },
  stepToggle: {
    marginTop: spacing.sm,
    paddingVertical: spacing.sm,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: "center",
  },
  stepBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: spacing.sm,
  },
  stepNav: {
    width: 56,
    height: 40,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: "center",
    justifyContent: "center",
  },
  stepNavOff: { opacity: 0.4 },
  stepNavText: { color: colors.text, fontSize: 18, fontWeight: "800" },
  stepLabel: { color: colors.text, fontWeight: "700", fontSize: 15 },
  statValue: { color: colors.text, fontSize: 22, fontWeight: "800" },
  sectionTitle: {
    color: colors.text,
    fontSize: 16,
    fontWeight: "700",
    marginTop: spacing.lg,
    marginBottom: spacing.sm,
  },
  move: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.sm,
    marginBottom: spacing.sm,
  },
  moveNum: { width: 30, height: 30, borderRadius: 15, alignItems: "center", justifyContent: "center" },
  moveNumText: { color: colors.primaryText, fontWeight: "800" },
  moveText: { color: colors.text, fontWeight: "600" },
  infeasible: { color: colors.danger, fontWeight: "700", marginBottom: spacing.xs },
});
