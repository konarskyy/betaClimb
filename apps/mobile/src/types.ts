// Typy domenowe (lustro pakietu @betaclimb/shared — aplikacja mobilna jest poza
// workspace npm, więc trzyma własną, lekką kopię typów potrzebnych w UI).

export const BETA_LEVELS = ["static", "dynamic", "flash"] as const;
export type BetaLevel = (typeof BETA_LEVELS)[number];

export const BETA_LEVEL_LABEL: Record<BetaLevel, string> = {
  static: "Statyczne",
  dynamic: "Dynamiczne",
  flash: "Flash",
};

export interface PublicUser {
  id: string;
  username: string;
  heightCm: number;
  role: "user" | "admin";
}

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
}

export interface AuthResponse {
  user: PublicUser;
  tokens: AuthTokens;
}

export interface Hold {
  id: string;
  x: number; // 0..1
  y: number; // 0..1
  isStart: boolean;
  isFinish: boolean;
}

export interface RouteSummary {
  id: string;
  name: string;
  imageUrl: string | null;
  imgW: number;
  imgH: number;
  routeHeightM: number;
  createdAt: string;
  _count?: { holds: number };
}

export interface RouteDetail extends RouteSummary {
  holds: Hold[];
}

export interface BetaMove {
  index: number;
  fromHoldId: string;
  toHoldId: string;
  /** chwyt pod stopę wspierający ruch (model nóg) */
  footHoldId: string;
  distanceCm: number;
  /** dystans od stopy do celu — decyduje o wykonalności */
  footReachCm: number;
  reachUsage: number;
  difficulty: number;
  isDynamic: boolean;
}

export interface BetaResult {
  level: BetaLevel;
  feasible: boolean;
  holdSequence: string[];
  moves: BetaMove[];
  moveCount: number;
  totalDifficulty: number;
  hardestMove: number;
  maxReachCm: number;
  note?: string;
}

export interface BetaResponse {
  routeId: string;
  heightCm: number;
  betas: Record<BetaLevel, BetaResult>;
}
