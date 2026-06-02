import jwt from "jsonwebtoken";
import { env } from "../env.js";
import type { JwtPayload } from "../types.js";

type Claims = Omit<JwtPayload, "type">;

export function signAccess(claims: Claims): string {
  return jwt.sign({ ...claims, type: "access" }, env.JWT_ACCESS_SECRET, {
    expiresIn: env.ACCESS_TTL,
  } as jwt.SignOptions);
}

export function signRefresh(claims: Claims): string {
  return jwt.sign({ ...claims, type: "refresh" }, env.JWT_REFRESH_SECRET, {
    expiresIn: env.REFRESH_TTL,
  } as jwt.SignOptions);
}

export function verifyAccess(token: string): JwtPayload {
  const decoded = jwt.verify(token, env.JWT_ACCESS_SECRET) as JwtPayload;
  if (decoded.type !== "access") throw new Error("Nieprawidłowy typ tokenu");
  return decoded;
}

export function verifyRefresh(token: string): JwtPayload {
  const decoded = jwt.verify(token, env.JWT_REFRESH_SECRET) as JwtPayload;
  if (decoded.type !== "refresh") throw new Error("Nieprawidłowy typ tokenu");
  return decoded;
}

/** Wydaje parę tokenów dla użytkownika. */
export function issueTokens(claims: Claims) {
  return {
    accessToken: signAccess(claims),
    refreshToken: signRefresh(claims),
  };
}
