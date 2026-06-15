import type { BetaLevel } from "./types";

export const colors = {
  bg: "#0f1419",
  surface: "#1a2129",
  surfaceAlt: "#232c36",
  border: "#2e3a45",
  text: "#e8edf2",
  textMuted: "#9aa7b3",
  primary: "#4ea1ff",
  primaryText: "#06121f",
  danger: "#ff6b6b",
  success: "#46d39a",
  start: "#46d39a", // chwyt startowy
  finish: "#ff6b6b", // chwyt końcowy (top)
  hold: "#ffd54a", // zwykły chwyt
  krux: "#ff4d6d", // najtrudniejszy ruch (krux)
  foot: "#b388ff", // oparcie stopy
};

export const levelColor: Record<BetaLevel, string> = {
  static: "#46d39a",
  dynamic: "#ff9f43",
  flash: "#4ea1ff",
};

export const spacing = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
};

export const radius = {
  sm: 8,
  md: 12,
  lg: 16,
};
