import { randomUUID } from "node:crypto";
import { mkdir, unlink, writeFile } from "node:fs/promises";
import path from "node:path";
import { env } from "./env.js";

/**
 * Abstrakcja zapisu zdjęć tras. W dev zapisujemy na lokalnym dysku i serwujemy
 * statycznie spod /uploads. Interfejs jest celowo wąski, by łatwo podmienić
 * implementację na S3/MinIO w produkcji.
 */
const ALLOWED = new Map<string, string>([
  ["image/jpeg", ".jpg"],
  ["image/png", ".png"],
  ["image/webp", ".webp"],
]);

export function isAllowedMime(mime: string): boolean {
  return ALLOWED.has(mime);
}

const storageRoot = path.resolve(env.STORAGE_DIR);

/**
 * Zapisuje obraz i zwraca ŚCIEŻKĘ WZGLĘDNĄ (`/uploads/<plik>`).
 * Pełny adres dokleja klient na podstawie aktualnego adresu serwera —
 * dzięki temu zdjęcia działają niezależnie od IP/hosta.
 */
export async function saveImage(buffer: Buffer, mime: string): Promise<string> {
  const ext = ALLOWED.get(mime);
  if (!ext) throw new Error("Nieobsługiwany format obrazu");
  await mkdir(storageRoot, { recursive: true });
  const filename = `${randomUUID()}${ext}`;
  await writeFile(path.join(storageRoot, filename), buffer);
  return `/uploads/${filename}`;
}

/**
 * Usuwa plik zdjęcia na podstawie zapisanego adresu (`/uploads/<plik>` lub starego
 * adresu bezwzględnego). Best-effort — brak pliku nie jest błędem.
 */
export async function deleteImage(imageUrl: string): Promise<void> {
  const filename = path.basename(imageUrl);
  if (!filename) return;
  try {
    await unlink(path.join(storageRoot, filename));
  } catch {
    // plik mógł już nie istnieć — ignorujemy
  }
}

export { storageRoot };
