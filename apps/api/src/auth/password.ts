import argon2 from "argon2";

/**
 * Hashowanie hasła algorytmem argon2id (zwycięzca Password Hashing Competition).
 * Sól jest losowa i osadzona w wynikowym ciągu — nie trzeba osobnej kolumny.
 * To mocniejszy następca PBKDF2 użytego w projekcie AuthDemo.
 */
export function hashPassword(plain: string): Promise<string> {
  return argon2.hash(plain, { type: argon2.argon2id });
}

/**
 * Weryfikacja hasła. argon2.verify porównuje w sposób odporny na timing attack.
 */
export async function verifyPassword(hash: string, plain: string): Promise<boolean> {
  try {
    return await argon2.verify(hash, plain);
  } catch {
    return false;
  }
}
