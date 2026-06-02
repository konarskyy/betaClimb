import { z } from "zod";
import { BETA_LEVELS } from "./domain.js";

/** Wspólne reguły walidacji. */
const username = z
  .string()
  .trim()
  .min(3, "Login musi mieć co najmniej 3 znaki")
  .max(32, "Login może mieć najwyżej 32 znaki")
  .regex(/^[a-zA-Z0-9_.-]+$/, "Dozwolone znaki: litery, cyfry, . _ -");

const password = z
  .string()
  .min(8, "Hasło musi mieć co najmniej 8 znaków")
  .max(128, "Hasło jest zbyt długie");

const heightCm = z
  .number()
  .int("Wzrost podaj w pełnych centymetrach")
  .min(100, "Wzrost musi wynosić co najmniej 100 cm")
  .max(250, "Wzrost musi wynosić najwyżej 250 cm");

// ---------- Auth ----------

export const registerSchema = z.object({
  username,
  password,
  heightCm,
});
export type RegisterInput = z.infer<typeof registerSchema>;

export const loginSchema = z.object({
  username,
  password,
});
export type LoginInput = z.infer<typeof loginSchema>;

export const refreshSchema = z.object({
  refreshToken: z.string().min(10),
});
export type RefreshInput = z.infer<typeof refreshSchema>;

export const updateProfileSchema = z.object({
  heightCm,
});
export type UpdateProfileInput = z.infer<typeof updateProfileSchema>;

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
}

export interface PublicUser {
  id: string;
  username: string;
  heightCm: number;
  role: "user" | "admin";
}

export interface AuthResponse {
  user: PublicUser;
  tokens: AuthTokens;
}

// ---------- Trasy ----------

const normalized = z.number().min(0).max(1);

export const holdInputSchema = z.object({
  x: normalized,
  y: normalized,
  isStart: z.boolean().default(false),
  isFinish: z.boolean().default(false),
});
export type HoldInput = z.infer<typeof holdInputSchema>;

export const createRouteSchema = z.object({
  name: z.string().trim().min(1, "Podaj nazwę trasy").max(80),
  /** szerokość zdjęcia w px */
  imgW: z.number().int().positive(),
  /** wysokość zdjęcia w px */
  imgH: z.number().int().positive(),
  /** rzeczywista wysokość trasy w metrach (skala) */
  routeHeightM: z.number().positive().max(60),
  holds: z
    .array(holdInputSchema)
    .min(2, "Trasa musi mieć co najmniej 2 chwyty")
    .max(200, "Zbyt wiele chwytów"),
});
export type CreateRouteInput = z.infer<typeof createRouteSchema>;

export const betaQuerySchema = z.object({
  /** opcjonalne nadpisanie wzrostu (domyślnie z profilu) */
  heightCm: z
    .number()
    .int()
    .min(100)
    .max(250)
    .optional(),
  /** które poziomy policzyć; domyślnie wszystkie */
  levels: z.array(z.enum(BETA_LEVELS)).nonempty().optional(),
});
export type BetaQueryInput = z.infer<typeof betaQuerySchema>;
