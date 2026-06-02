import { z } from "zod";

// Wczytaj plik .env, jeśli istnieje (w testach zmienne mogą być ustawione bezpośrednio).
try {
  process.loadEnvFile();
} catch {
  // brak .env — pomijamy
}

const schema = z.object({
  DATABASE_URL: z.string().url(),
  JWT_ACCESS_SECRET: z.string().min(16),
  JWT_REFRESH_SECRET: z.string().min(16),
  ACCESS_TTL: z.string().default("15m"),
  REFRESH_TTL: z.string().default("30d"),
  PORT: z.coerce.number().default(4000),
  HOST: z.string().default("0.0.0.0"),
  STORAGE_DIR: z.string().default("./storage"),
  PUBLIC_URL: z.string().url().default("http://localhost:4000"),
});

export const env = schema.parse(process.env);
export type Env = z.infer<typeof schema>;
