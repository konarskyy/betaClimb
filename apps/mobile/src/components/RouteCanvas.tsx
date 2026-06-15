import { useState } from "react";
import {
  Image,
  Pressable,
  StyleSheet,
  View,
  type GestureResponderEvent,
  type LayoutChangeEvent,
} from "react-native";
import Svg, { Circle, Line, Text as SvgText } from "react-native-svg";
import { colors, levelColor } from "../theme";
import type { BetaResult, Hold } from "../types";

interface Props {
  imageUri: string;
  imgW: number;
  imgH: number;
  holds: Hold[];
  /** tryb edycji: dotknięcie pustego miejsca dodaje chwyt */
  editable?: boolean;
  onAddHold?: (x: number, y: number) => void;
  selectedHoldId?: string | null;
  onSelectHold?: (id: string | null) => void;
  /** w trybie podglądu: narysuj ścieżkę bety */
  beta?: BetaResult | null;
  /** rozmyj i przyciemnij zdjęcie w tle (ekran wyniku), by chwyty były wyraźniejsze */
  blurBackground?: boolean;
  /** tryb krok-po-kroku: numer aktualnie pokazywanego ruchu (1..n); null = cała trasa */
  activeMoveIndex?: number | null;
  /** numer najtrudniejszego ruchu (krux) — wyróżniony kolorem */
  kruxIndex?: number | null;
}

const TAP_HIT = 0.05; // próg trafienia w istniejący chwyt (w jedn. znormalizowanych)

export function RouteCanvas({
  imageUri,
  imgW,
  imgH,
  holds,
  editable,
  onAddHold,
  selectedHoldId,
  onSelectHold,
  beta,
  blurBackground,
  activeMoveIndex,
  kruxIndex,
}: Props) {
  const [width, setWidth] = useState(0);
  const height = width > 0 ? width * (imgH / imgW) : 0;

  function onLayout(e: LayoutChangeEvent) {
    setWidth(e.nativeEvent.layout.width);
  }

  function handlePress(e: GestureResponderEvent) {
    if (width === 0 || height === 0) return;
    const { locationX, locationY } = e.nativeEvent;
    const x = Math.min(1, Math.max(0, locationX / width));
    const y = Math.min(1, Math.max(0, locationY / height));

    // najpierw sprawdź, czy trafiono w istniejący chwyt → zaznacz go
    let nearest: Hold | null = null;
    let nearestDist = TAP_HIT;
    for (const h of holds) {
      const d = Math.hypot(h.x - x, h.y - y);
      if (d < nearestDist) {
        nearest = h;
        nearestDist = d;
      }
    }
    if (nearest) {
      onSelectHold?.(nearest.id);
      return;
    }
    // puste miejsce → w trybie edycji dodaj chwyt, inaczej odznacz
    if (editable && onAddHold) onAddHold(x, y);
    else onSelectHold?.(null);
  }

  const byId = new Map(holds.map((h) => [h.id, h]));
  const betaColor = beta ? levelColor[beta.level] : colors.primary;
  const stepping = activeMoveIndex != null;
  const activeMove = stepping ? beta?.moves.find((m) => m.index === activeMoveIndex) ?? null : null;
  const targetId = activeMove?.toHoldId ?? null;
  const footHold = activeMove?.footType === "hold" && activeMove.footHoldId
    ? byId.get(activeMove.footHoldId) ?? null
    : null;

  function holdColor(h: Hold): string {
    if (h.isStart) return colors.start;
    if (h.isFinish) return colors.finish;
    return colors.hold;
  }

  return (
    <View onLayout={onLayout} style={styles.container}>
      {width > 0 && (
        <Pressable onPress={handlePress}>
          <Image
            source={{ uri: imageUri }}
            style={{ width, height }}
            resizeMode="cover"
            blurRadius={blurBackground ? 4 : 0}
          />

          {/* lekkie przyciemnienie tła, by chwyty i beta były czytelniejsze */}
          {blurBackground && (
            <View
              pointerEvents="none"
              style={[StyleSheet.absoluteFill, { backgroundColor: "rgba(15,20,25,0.25)" }]}
            />
          )}

          <Svg
            width={width}
            height={height}
            style={StyleSheet.absoluteFill}
            pointerEvents="none"
          >
            {/* Linie bety między kolejnymi chwytami */}
            {beta?.moves.map((m) => {
              const a = byId.get(m.fromHoldId);
              const b = byId.get(m.toHoldId);
              if (!a || !b) return null;
              // w trybie krok-po-kroku ukryj ruchy jeszcze niewykonane
              if (stepping && m.index > activeMoveIndex!) return null;
              const isCurrent = stepping && m.index === activeMoveIndex;
              const isKrux = kruxIndex != null && m.index === kruxIndex;
              const done = stepping && m.index < activeMoveIndex!;
              return (
                <Line
                  key={`mv-${m.index}`}
                  x1={a.x * width}
                  y1={a.y * height}
                  x2={b.x * width}
                  y2={b.y * height}
                  stroke={isKrux ? colors.krux : betaColor}
                  strokeWidth={isCurrent ? 5 : 3}
                  strokeOpacity={done ? 0.25 : 1}
                  strokeDasharray={m.isDynamic ? "8,6" : undefined}
                  strokeLinecap="round"
                />
              );
            })}

            {/* Łącznik stopy (pod chwytami) — od ręki do oparcia stopy */}
            {footHold && activeMove && (() => {
              const from = byId.get(activeMove.fromHoldId);
              if (!from) return null;
              return (
                <Line
                  x1={from.x * width}
                  y1={from.y * height}
                  x2={footHold.x * width}
                  y2={footHold.y * height}
                  stroke={colors.foot}
                  strokeWidth={2}
                  strokeDasharray="3,6"
                  strokeOpacity={0.9}
                />
              );
            })()}

            {/* Chwyty */}
            {holds.map((h) => {
              const selected = h.id === selectedHoldId;
              const isTarget = h.id === targetId;
              const emph = selected || isTarget;
              return (
                <Circle
                  key={h.id}
                  cx={h.x * width}
                  cy={h.y * height}
                  r={emph ? 13 : 10}
                  fill={holdColor(h)}
                  fillOpacity={0.85}
                  stroke={emph ? "#ffffff" : "rgba(0,0,0,0.55)"}
                  strokeWidth={emph ? 3 : 2}
                />
              );
            })}

            {/* Oparcie stopy (na chwytach) dla aktualnego ruchu */}
            {footHold && (
              <Circle
                cx={footHold.x * width}
                cy={footHold.y * height}
                r={13}
                fill={colors.foot}
                fillOpacity={0.95}
                stroke="#ffffff"
                strokeWidth={2}
              />
            )}

            {/* Numeracja kroków bety — w trybie krok-po-kroku tylko do bieżącego */}
            {beta?.feasible &&
              beta.holdSequence.map((id, i) => {
                const h = byId.get(id);
                if (!h) return null;
                if (stepping && activeMove && i > beta.holdSequence.indexOf(activeMove.toHoldId)) {
                  return null;
                }
                return (
                  <SvgText
                    key={`n-${id}`}
                    x={h.x * width}
                    y={h.y * height + 4}
                    fontSize={11}
                    fontWeight="bold"
                    fill={colors.primaryText}
                    textAnchor="middle"
                  >
                    {i + 1}
                  </SvgText>
                );
              })}
          </Svg>
        </Pressable>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: "100%",
    backgroundColor: colors.surfaceAlt,
    borderRadius: 12,
    overflow: "hidden",
  },
});
