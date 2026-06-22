import type { Dispatch, SetStateAction } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { colors, radius, spacing } from "../theme";
import type { Hold } from "../types";
import { RouteCanvas } from "./RouteCanvas";

function makeHold(x: number, y: number): Hold {
  return {
    id: `h_${Date.now()}_${Math.round(Math.random() * 1e6)}`,
    x,
    y,
    isStart: false,
    isFinish: false,
  };
}

interface Props {
  imageUri: string;
  imgW: number;
  imgH: number;
  holds: Hold[];
  setHolds: Dispatch<SetStateAction<Hold[]>>;
  selected: string | null;
  setSelected: (id: string | null) => void;
}

/**
 * Współdzielony edytor chwytów na zdjęciu: dotknięcie dodaje chwyt, dotknięcie
 * istniejącego zaznacza go, a dla zaznaczonego można ustawić rolę (start/top/zwykły)
 * lub go usunąć. Używany przy tworzeniu nowej trasy i przy edycji istniejącej.
 */
export function HoldTagger({ imageUri, imgW, imgH, holds, setHolds, selected, setSelected }: Props) {
  function addHold(x: number, y: number) {
    const h = makeHold(x, y);
    setHolds((prev) => [...prev, h]);
    setSelected(h.id);
  }

  function setRole(role: "start" | "finish" | "normal") {
    if (!selected) return;
    setHolds((prev) =>
      prev.map((h) =>
        h.id === selected
          ? { ...h, isStart: role === "start", isFinish: role === "finish" }
          : h,
      ),
    );
  }

  function deleteSelected() {
    if (!selected) return;
    setHolds((prev) => prev.filter((h) => h.id !== selected));
    setSelected(null);
  }

  const startCount = holds.filter((h) => h.isStart).length;
  const finishCount = holds.filter((h) => h.isFinish).length;

  return (
    <>
      <RouteCanvas
        imageUri={imageUri}
        imgW={imgW}
        imgH={imgH}
        holds={holds}
        editable
        onAddHold={addHold}
        selectedHoldId={selected}
        onSelectHold={setSelected}
      />

      <View style={styles.legend}>
        <Legend color={colors.start} label={`Start (${startCount})`} />
        <Legend color={colors.hold} label="Chwyt" />
        <Legend color={colors.finish} label={`Top (${finishCount})`} />
      </View>

      {selected ? (
        <View style={styles.actions}>
          <Text style={styles.actionsLabel}>Zaznaczony chwyt:</Text>
          <View style={styles.actionRow}>
            <SmallBtn label="Start" onPress={() => setRole("start")} />
            <SmallBtn label="Top" onPress={() => setRole("finish")} />
            <SmallBtn label="Zwykły" onPress={() => setRole("normal")} />
            <SmallBtn label="Usuń" danger onPress={deleteSelected} />
          </View>
        </View>
      ) : (
        <Text style={styles.hint}>
          Oznacz co najmniej jeden chwyt jako Start i jeden jako Top (inaczej
          wybierzemy najniższy i najwyższy automatycznie).
        </Text>
      )}
    </>
  );
}

function Legend({ color, label }: { color: string; label: string }) {
  return (
    <View style={styles.legendItem}>
      <View style={[styles.dot, { backgroundColor: color }]} />
      <Text style={styles.muted}>{label}</Text>
    </View>
  );
}

function SmallBtn({
  label,
  onPress,
  danger,
}: {
  label: string;
  onPress: () => void;
  danger?: boolean;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.smallBtn,
        { borderColor: danger ? colors.danger : colors.border, opacity: pressed ? 0.7 : 1 },
      ]}
    >
      <Text style={{ color: danger ? colors.danger : colors.text, fontWeight: "600" }}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  muted: { color: colors.textMuted },
  hint: { color: colors.textMuted, fontSize: 12, marginTop: spacing.sm },
  legend: { flexDirection: "row", justifyContent: "space-around", marginTop: spacing.md },
  legendItem: { flexDirection: "row", alignItems: "center", gap: spacing.xs },
  dot: { width: 14, height: 14, borderRadius: 7 },
  actions: { marginTop: spacing.md },
  actionsLabel: { color: colors.textMuted, marginBottom: spacing.xs },
  actionRow: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm },
  smallBtn: {
    borderWidth: 1,
    borderRadius: radius.sm,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
  },
});
